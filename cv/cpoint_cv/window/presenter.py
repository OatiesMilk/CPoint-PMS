"""The window's state and every word it shows, in plain Python (no Tk), so it's unit-tested.

    idle → checking → ready (or blocked) → starting → waiting for a batch ⇄ running
         → capturing → running … → stopping → stopped;   a problem to fix → error

The view only draws what this says: which buttons are on, the batch line, the notice bar, the
check list, the last scan and the messages. The app decides every verdict (D-011): the last scan
shows the app's answer, and the live preview never shows one (D-060).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from enum import Enum

from ..events import (
    AppUnreachable,
    BatchShown,
    Captured,
    NoBatchNow,
    Pending,
    ReadyToCapture,
    ScanRefused,
    ScanSent,
    SendDelayed,
    StationStopped,
)
from .checks import CheckReport
from .workers import (
    CameraBack,
    CameraFailed,
    CameraLost,
    CameraOpened,
    PreviewFailed,
    RunEnded,
    Said,
    Starting,
)

MAX_MESSAGES = 200
PREVIEW_BANNER = "Preview. Nothing is sent until you press Capture. The app decides the result."


class Phase(Enum):
    IDLE = "idle"
    CHECKING = "checking"
    BLOCKED = "blocked"
    READY = "ready"
    STARTING = "starting"
    WAITING = "waiting"  # no batch at Preparation: Capture is off
    RUNNING = "running"
    CAPTURING = "capturing"
    STOPPING = "stopping"
    STOPPED = "stopped"
    ERROR = "error"


RUN_PHASES = {Phase.STARTING, Phase.WAITING, Phase.RUNNING, Phase.CAPTURING, Phase.STOPPING}


class Tone(Enum):
    """How the notice bar is coloured: matches DESIGN.md's meaning."""

    INFO = "info"
    WARNING = "warning"
    DANGER = "danger"


@dataclass(frozen=True)
class Notice:
    text: str
    tone: Tone


@dataclass(frozen=True)
class ChecksStarted:
    pass


@dataclass(frozen=True)
class ChecksDone:
    report: CheckReport


@dataclass(frozen=True)
class CameraChanged:
    """The operator picked another camera or driver. The checks must run again."""


@dataclass(frozen=True)
class LastScan:
    batch_code: str
    sequence: int
    verdict: str  # the app's: PASS, REWORK, REJECT or NEEDS_REVIEW
    found: str
    duplicate: bool

    @property
    def verdict_label(self) -> str:
        return {
            "PASS": "Pass",
            "REWORK": "Rework",
            "REJECT": "Reject",
            "NEEDS_REVIEW": "Needs review",
        }.get(self.verdict, self.verdict.replace("_", " ").capitalize())

    @property
    def line(self) -> str:
        again = " (the app already had it)" if self.duplicate else ""
        return f"{self.batch_code} · section {self.sequence}{again}"


class Presenter:
    def __init__(self) -> None:
        self.phase = Phase.IDLE
        self.report: CheckReport | None = None
        self.batch_line = "Check this machine, then press Start."
        self.batch_ready = False
        self.notice: Notice | None = None
        self.camera_line = ""
        self.camera_lost = False
        self.last_scan: LastScan | None = None
        self.last_problem_scan: str | None = None
        self.pending = 0
        self.preview_note: str | None = None
        self.messages: deque[str] = deque(maxlen=MAX_MESSAGES)
        self._problem: str | None = None

    # ───────────── what the view may offer ─────────────

    @property
    def can_check(self) -> bool:
        return self.phase in {Phase.IDLE, Phase.BLOCKED, Phase.READY, Phase.STOPPED, Phase.ERROR}

    @property
    def can_pick_camera(self) -> bool:
        return self.phase not in RUN_PHASES and self.phase is not Phase.CHECKING

    @property
    def can_start(self) -> bool:
        return self.phase in {Phase.READY, Phase.STOPPED} and not (
            self.report is None or self.report.blocked
        )

    @property
    def can_capture(self) -> bool:
        return self.phase is Phase.RUNNING and not self.camera_lost

    @property
    def can_stop(self) -> bool:
        return self.phase in {Phase.STARTING, Phase.WAITING, Phase.RUNNING, Phase.CAPTURING}

    @property
    def running(self) -> bool:
        return self.phase in RUN_PHASES

    @property
    def status(self) -> str:
        return {
            Phase.IDLE: "Press Check this machine.",
            Phase.CHECKING: "Checking this machine...",
            Phase.BLOCKED: "Fix the failed checks, then check again.",
            Phase.READY: "Ready. Press Start.",
            Phase.STARTING: "Starting...",
            Phase.WAITING: "Waiting for a batch at Preparation. Capture is off until there is one.",
            Phase.RUNNING: "Place the section, then press Capture (or Space).",
            Phase.CAPTURING: "Capturing and sending...",
            Phase.STOPPING: "Stopping...",
            Phase.STOPPED: "Stopped. The camera is free.",
            Phase.ERROR: "Stopped. Fix the problem above, then check this machine again.",
        }[self.phase]

    @property
    def pending_line(self) -> str:
        if not self.pending:
            return "Nothing waiting to send."
        return f"{self.pending} waiting to send. They go out in order when the app answers."

    # ───────────── the operator ─────────────

    def capture_pressed(self) -> bool:
        if not self.can_capture:
            return False
        self.phase = Phase.CAPTURING
        return True

    def capture_had_no_picture(self) -> None:
        self.phase = Phase.RUNNING
        self._note("There's no camera picture to capture yet. Wait for it, then press Capture.")

    def stop_pressed(self) -> bool:
        if not self.can_stop:
            return False
        self.phase = Phase.STOPPING
        return True

    def start_pressed(self) -> bool:
        if not self.can_start:
            return False
        self.phase = Phase.STARTING
        self._problem = None
        self.notice = None
        self.camera_lost = False
        self.preview_note = None
        self.batch_ready = False
        self.batch_line = "Asking the app which batch is at Preparation..."
        return True

    def note(self, text: str, tone: Tone = Tone.INFO) -> None:
        """Something the window itself wants to say (a camera search, a choice not saved)."""
        self._note(text)
        if tone is not Tone.INFO:
            self.notice = Notice(text, tone)

    # ───────────── what the workers report ─────────────

    def handle(self, event: object) -> None:
        """One flat branch per event."""
        if isinstance(event, ChecksStarted):
            self.phase = Phase.CHECKING
            self.notice = None
        elif isinstance(event, ChecksDone):
            self.report = event.report
            self.phase = Phase.BLOCKED if event.report.blocked else Phase.READY
            self.notice = (
                Notice(event.report.summary(), Tone.DANGER) if event.report.blocked else None
            )
            self._note(event.report.summary())
        elif isinstance(event, CameraChanged):
            if self.report is not None or self.phase in {Phase.READY, Phase.BLOCKED}:
                self.report = None
                self.phase = Phase.IDLE
                self.notice = Notice(
                    "You chose another camera. Press Check this machine to test it.", Tone.INFO
                )
        elif isinstance(event, Starting):
            self._note(event.message)
        elif isinstance(event, Said):
            self.messages.appendleft(event.text)
        elif isinstance(event, CameraOpened):
            self.camera_line = event.description
        elif isinstance(event, CameraLost):
            self.camera_lost = True
            self.notice = Notice(event.message, Tone.WARNING)
        elif isinstance(event, CameraBack):
            self.camera_lost = False
            self.notice = None
            self._note("The camera is back.")
        elif isinstance(event, CameraFailed):
            self._problem = event.message
        elif isinstance(event, PreviewFailed):
            self.preview_note = event.message
            self._note(event.message)
        elif isinstance(event, BatchShown):
            self.batch_ready = True
            batch = event.batch
            self.batch_line = (
                f"Next scan goes to {batch.batch_code} · roll {batch.roll_code} · {batch.shoe_type}"
            )
            if self.notice and self.notice.tone is not Tone.DANGER and not self.camera_lost:
                self.notice = None
            if self.phase is Phase.WAITING:
                self.phase = Phase.RUNNING
        elif isinstance(event, NoBatchNow):
            self.batch_ready = False
            self.batch_line = "No batch at Preparation."
            self.notice = Notice(event.message, Tone.WARNING)
            if self.phase in {Phase.STARTING, Phase.RUNNING, Phase.CAPTURING}:
                self.phase = Phase.WAITING
        elif isinstance(event, AppUnreachable):
            self.notice = Notice(
                f"{event.message} Captures are saved and sent when it answers.", Tone.WARNING
            )
            if self.phase is Phase.STARTING:
                self.phase = Phase.WAITING
        elif isinstance(event, ReadyToCapture):
            if self.phase in {Phase.STARTING, Phase.WAITING, Phase.CAPTURING}:
                self.phase = Phase.RUNNING
        elif isinstance(event, Captured):
            self._note(
                f"Captured {event.label} for {event.batch_code}; the model found {event.found}."
            )
        elif isinstance(event, ScanSent):
            self.last_scan = LastScan(
                event.batch_code, event.sequence, event.verdict, event.found, event.duplicate
            )
            self.last_problem_scan = None
            if self.notice and self.batch_ready and not self.camera_lost:
                self.notice = None
        elif isinstance(event, ScanRefused):
            self.last_problem_scan = f"{event.label}: {event.message}"
            self.notice = Notice(f"{event.label}: {event.message}", Tone.DANGER)
        elif isinstance(event, SendDelayed):
            self.notice = Notice(f"{event.label}: {event.message}", Tone.WARNING)
        elif isinstance(event, Pending):
            self.pending = event.count
        elif isinstance(event, StationStopped):
            if event.problem:
                self._problem = event.problem
        elif isinstance(event, RunEnded):
            problem = event.problem or self._problem
            self.batch_ready = False
            self.camera_line = ""
            self.camera_lost = False
            if problem:
                self.phase = Phase.ERROR
                self.notice = Notice(problem, Tone.DANGER)
                self.batch_line = "The station stopped."
                self._note(problem)
            else:
                self.phase = Phase.STOPPED
                self.batch_line = "Stopped. Press Start to carry on."
                if self.notice and self.notice.tone is not Tone.DANGER:
                    self.notice = None

    def _note(self, text: str) -> None:
        self.messages.appendleft(text)
