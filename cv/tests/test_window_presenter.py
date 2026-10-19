"""The window's states and words (D-059 to D-061). No Tk: the presenter is plain Python."""

from __future__ import annotations

from cpoint_cv.client import BatchInfo
from cpoint_cv.doctor import Check, warn
from cpoint_cv.events import (
    AppUnreachable,
    BatchShown,
    NoBatchNow,
    Pending,
    ReadyToCapture,
    ScanRefused,
    ScanSent,
    SendDelayed,
    StationStopped,
)
from cpoint_cv.window.checks import CheckReport
from cpoint_cv.window.presenter import (
    PREVIEW_BANNER,
    CameraChanged,
    ChecksDone,
    ChecksStarted,
    Phase,
    Presenter,
    Tone,
)
from cpoint_cv.window.workers import CameraBack, CameraFailed, CameraLost, RunEnded

BATCH = BatchInfo("b-1", "B-2026-0017", "LR-0042", "School Shoe")
NO_BATCH = "No batch is at Preparation. Start one on the Batches page, then scan again."


def report(*checks: Check) -> CheckReport:
    return CheckReport(checks or (Check("Model file", True, "ok"),), None)


def phase(p: Presenter) -> Phase:
    """Read afresh: the presenter changes it behind mypy's back."""
    return p.phase


def buttons(p: Presenter) -> tuple[bool, bool, bool, bool]:
    return p.can_check, p.can_start, p.can_capture, p.can_stop


def running(p: Presenter | None = None) -> Presenter:
    p = p or Presenter()
    p.handle(ChecksDone(report()))
    assert p.start_pressed()
    p.handle(BatchShown(BATCH))
    p.handle(ReadyToCapture())
    return p


class TestChecks:
    def test_idle_offers_only_the_check(self) -> None:
        p = Presenter()
        assert p.phase is Phase.IDLE
        assert buttons(p) == (True, False, False, False)
        assert p.can_pick_camera

    def test_checking_disables_everything(self) -> None:
        p = Presenter()
        p.handle(ChecksStarted())
        assert p.phase is Phase.CHECKING
        assert buttons(p) == (False, False, False, False)
        assert not p.can_pick_camera

    def test_a_failed_check_blocks_start_and_says_so(self) -> None:
        p = Presenter()
        p.handle(ChecksDone(report(Check("Camera", False, "Camera 1 couldn't be opened."))))
        assert p.phase is Phase.BLOCKED
        assert not p.can_start and p.can_check
        assert p.notice is not None and p.notice.tone is Tone.DANGER
        assert p.notice.text.startswith("Camera failed: Camera 1 couldn't be opened.")

    def test_warnings_never_block_start(self) -> None:
        p = Presenter()
        p.handle(ChecksDone(report(warn("GPU", "none: the model runs on the CPU."))))
        assert p.phase is Phase.READY and p.can_start
        assert "warning" in p.messages[0]

    def test_another_camera_means_checking_again(self) -> None:
        p = Presenter()
        p.handle(ChecksDone(report()))
        p.handle(CameraChanged())
        assert p.phase is Phase.IDLE and not p.can_start
        assert p.notice is not None and "Check this machine" in p.notice.text


class TestRun:
    def test_start_then_a_batch_offers_capture(self) -> None:
        p = running()
        assert p.phase is Phase.RUNNING
        assert buttons(p) == (False, False, True, True)
        assert not p.can_pick_camera
        assert p.batch_line == "Next scan goes to B-2026-0017 · roll LR-0042 · School Shoe"

    def test_no_batch_keeps_capture_off_with_the_apps_message(self) -> None:
        p = Presenter()
        p.handle(ChecksDone(report()))
        p.start_pressed()
        p.handle(NoBatchNow(NO_BATCH))
        assert p.phase is Phase.WAITING and not p.can_capture and p.can_stop
        assert p.notice is not None and p.notice.text == NO_BATCH
        assert p.notice.tone is Tone.WARNING

    def test_a_batch_arriving_while_waiting_turns_capture_on(self) -> None:
        p = running()
        p.handle(NoBatchNow(NO_BATCH))  # someone moved the batch on, seen at a check-in
        assert not p.can_capture
        p.handle(BatchShown(BATCH, changed=True))
        assert p.phase is Phase.RUNNING and p.can_capture and p.notice is None

    def test_one_press_one_scan(self) -> None:
        p = running()
        assert p.capture_pressed()
        assert p.phase is Phase.CAPTURING and not p.can_capture
        assert not p.capture_pressed()  # a second press is ignored until the first is sent
        p.handle(ScanSent("camera 1 #1", "B-2026-0017", 12, "REWORK", "crease 0.71", False))
        p.handle(Pending(0))
        p.handle(ReadyToCapture())
        assert phase(p) is Phase.RUNNING and p.can_capture
        assert p.last_scan is not None
        assert p.last_scan.verdict_label == "Rework"
        assert p.last_scan.line == "B-2026-0017 · section 12"
        assert p.pending_line == "Nothing waiting to send."

    def test_a_scan_that_waits_to_send_is_counted(self) -> None:
        p = running()
        p.capture_pressed()
        p.handle(SendDelayed("camera 1 #1", "Couldn't send it (timed out) after 4 tries."))
        p.handle(Pending(1))
        p.handle(ReadyToCapture())
        assert p.can_capture  # the spool covers sending; the operator carries on
        assert p.pending_line.startswith("1 waiting to send")
        assert p.notice is not None and p.notice.tone is Tone.WARNING

    def test_a_refused_scan_shows_why(self) -> None:
        p = running()
        p.capture_pressed()
        p.handle(ScanRefused("camera 1 #1", "The app refused it: too large. Kept in out/failed."))
        assert p.notice is not None and p.notice.tone is Tone.DANGER
        assert "too large" in p.notice.text

    def test_the_app_unreachable_keeps_capture_on(self) -> None:
        p = running()
        p.handle(AppUnreachable("Can't reach the app at http://localhost:3000 (refused)."))
        assert p.can_capture
        assert p.notice is not None and "sent when it answers" in p.notice.text

    def test_a_lost_camera_turns_capture_off_until_it_is_back(self) -> None:
        p = running()
        p.handle(CameraLost("Camera 1 stopped giving a picture. Reconnecting..."))
        assert not p.can_capture and p.can_stop
        p.handle(CameraBack())
        assert p.can_capture and p.notice is None


class TestStop:
    def test_stop_then_ended_frees_the_camera(self) -> None:
        p = running()
        assert p.stop_pressed()
        assert p.phase is Phase.STOPPING and not p.can_stop
        p.handle(RunEnded(None))
        assert phase(p) is Phase.STOPPED and p.can_start and p.can_pick_camera
        assert p.status == "Stopped. The camera is free."

    def test_a_refused_token_stops_with_the_fix(self) -> None:
        p = running()
        problem = "The device token was refused. Ask the System Admin for a new one."
        p.handle(StationStopped(problem))
        p.handle(RunEnded(None))
        assert p.phase is Phase.ERROR
        assert not p.can_start and p.can_check  # fix it, then check again
        assert p.notice is not None and p.notice.text == problem

    def test_a_camera_that_never_came_back_is_an_error(self) -> None:
        p = running()
        p.handle(CameraFailed("Camera 1 stopped giving a picture. It didn't come back."))
        p.handle(RunEnded(None))
        assert p.phase is Phase.ERROR and "didn't come back" in (p.notice.text if p.notice else "")


def test_the_preview_banner_says_it_is_not_the_decision() -> None:
    assert "Nothing is sent until you press Capture" in PREVIEW_BANNER
    assert "The app decides" in PREVIEW_BANNER


def test_needs_review_is_named_plainly() -> None:
    p = running()
    p.handle(ScanSent("x", "B-2026-0017", 3, "NEEDS_REVIEW", "class_7 0.66", True))
    assert p.last_scan is not None
    assert p.last_scan.verdict_label == "Needs review"
    assert "(the app already had it)" in p.last_scan.line
