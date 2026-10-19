"""The window's worker threads. None of them touches Tk: each reports through ``emit``, which puts
the event on a queue the window drains every 50 ms (D-059).

- ``CameraReader`` reads the camera as fast as it gives frames and keeps only the newest one in a
  ``FrameBox``. When the camera drops (a phone on Wi-Fi), it reconnects for a while before giving
  up.
- ``PreviewLoop`` runs the model on the newest frame at the preview size, a few times a second.
  Its boxes are only a preview: nothing is sent (D-060).
- ``StationRunner`` loads the model, starts the two above, then runs the same ``Station`` loop as
  ``run webcam``, with the Capture and Stop buttons as its trigger.
- ``LiveSource`` hands the station the frame that was on screen when Capture was pressed.
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from ..client import ScanClient
from ..config import Config
from ..detector import FrameDetector
from ..encode import encode_jpeg
from ..events import BatchShown, NoBatchNow, StationEvent, StationStopped
from ..logs import StationLog
from ..mapper import map_detections
from ..sources import Frame, SourceError
from ..spool import Spool
from ..station import Station
from ..triggers import ButtonTrigger
from ..types import Detection
from .settings import CameraChoice

Clock = Callable[[], datetime]


def _now() -> datetime:
    return datetime.now().astimezone()


# ───────────── events the workers add to the station's own ─────────────


@dataclass(frozen=True)
class Said:
    """A line the station printed (the console's words)."""

    text: str


@dataclass(frozen=True)
class Starting:
    message: str


@dataclass(frozen=True)
class CameraOpened:
    description: str


@dataclass(frozen=True)
class CameraLost:
    message: str


@dataclass(frozen=True)
class CameraBack:
    pass


@dataclass(frozen=True)
class CameraFailed:
    """The camera couldn't be opened, or didn't come back. The station stops."""

    message: str


@dataclass(frozen=True)
class PreviewFailed:
    message: str


@dataclass(frozen=True)
class RunEnded:
    """Everything stopped and the camera is released. ``problem`` is what to fix, if anything."""

    problem: str | None


WorkerEvent = (
    Said
    | Starting
    | CameraOpened
    | CameraLost
    | CameraBack
    | CameraFailed
    | PreviewFailed
    | RunEnded
)
Emit = Callable[[object], None]


# ───────────── the newest frame ─────────────


@dataclass(frozen=True)
class Snapshot:
    image: Any  # an OpenCV (BGR) frame
    seq: int
    taken_at: datetime


@dataclass(frozen=True)
class PreviewResult:
    detections: tuple[Detection, ...]
    inference_ms: float
    seq: int  # the frame it was run on


class FrameBox:
    """One slot for the newest frame and one for the newest preview, shared between threads."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._frame: Snapshot | None = None
        self._preview: PreviewResult | None = None
        self._seq = 0

    def put(self, image: Any, taken_at: datetime) -> None:
        with self._lock:
            self._seq += 1
            self._frame = Snapshot(image, self._seq, taken_at)

    def latest(self) -> Snapshot | None:
        with self._lock:
            return self._frame

    def set_preview(self, result: PreviewResult) -> None:
        with self._lock:
            self._preview = result

    def preview(self) -> PreviewResult | None:
        with self._lock:
            return self._preview

    def clear(self) -> None:
        with self._lock:
            self._frame = None
            self._preview = None


# ───────────── camera ─────────────


def lost_message(name: str, is_address: bool) -> str:
    where = (
        "Check DroidCam (or the camera) is still open and the PC is on the same network"
        if is_address
        else "Check the cable, or that DroidCam is still open on the phone"
    )
    return f"{name} stopped giving a picture. {where}."


class CameraReader(threading.Thread):
    """Reads frames until stopped. ``opener`` returns an OpenCV ``VideoCapture``-like object."""

    def __init__(
        self,
        opener: Callable[[], Any],
        name: str,
        is_address: bool,
        box: FrameBox,
        emit: Emit,
        *,
        warmup_frames: int = 5,
        retry_seconds: float = 2.0,
        give_up_seconds: float = 30.0,
        clock: Clock = _now,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        super().__init__(name="camera-reader", daemon=True)
        self._opener = opener
        self._name = name
        self._is_address = is_address
        self._box = box
        self._emit = emit
        self._warmup = warmup_frames
        self._retry = retry_seconds
        self._give_up = give_up_seconds
        self._clock = clock
        self._monotonic = monotonic
        self._stop = threading.Event()
        self.opened = threading.Event()  # set once the first frame arrived, or it failed
        self.failure: str | None = None
        self.description = name

    def stop(self) -> None:
        self._stop.set()

    def _open(self) -> Any | None:
        camera = self._opener()
        if not camera.isOpened():
            camera.release()
            return None
        for _ in range(self._warmup):  # let exposure and white balance settle
            camera.read()
        return camera

    def _fail(self, message: str) -> None:
        self.failure = message
        self._emit(CameraFailed(message))
        self.opened.set()

    def run(self) -> None:
        try:
            camera = self._open()
        except Exception as error:  # a broken driver can raise anything
            self._fail(f"{self._name} couldn't be opened ({error}).")
            return
        if camera is None:
            self._fail(
                f"{self._name} couldn't be opened. Check it's connected and not in use by another "
                "app (Camera, Teams, Zoom, the DroidCam client's own preview), or try the other "
                "driver."
            )
            return
        try:
            self._read(camera)
        finally:
            camera.release()

    def _read(self, camera: Any) -> None:
        first = True
        while not self._stop.is_set():
            ok, image = camera.read()
            if ok and image is not None:
                self._box.put(image, self._clock())
                if first:
                    h, w = image.shape[:2]
                    self.description = f"{self._name} at {w} x {h}"
                    self._emit(CameraOpened(self.description))
                    self.opened.set()
                    first = False
                continue
            if first:
                self._fail(f"{self._name} opened but gave no picture. Try the other driver.")
                return
            camera.release()
            camera = self._reconnect()
            if camera is None:
                return

    def _reconnect(self) -> Any | None:
        self._box.clear()
        self._emit(CameraLost(f"{lost_message(self._name, self._is_address)} Reconnecting..."))
        deadline = self._monotonic() + self._give_up
        while not self._stop.is_set() and self._monotonic() < deadline:
            try:
                camera = self._open()
            except Exception:
                camera = None
            if camera is not None:
                ok, image = camera.read()
                if ok and image is not None:
                    self._box.put(image, self._clock())
                    self._emit(CameraBack())
                    return camera
                camera.release()
            self._stop.wait(self._retry)
        if not self._stop.is_set():
            self._fail(
                f"{lost_message(self._name, self._is_address)} It didn't come back within "
                f"{self._give_up:g} s, so the station stopped. Saved captures are kept."
            )
        return None


# ───────────── preview ─────────────


class PreviewLoop(threading.Thread):
    """The model on the newest frame at ``imgsz``, at most ``max_fps`` times a second. Frames that
    arrive while it works are skipped, never queued."""

    def __init__(
        self,
        detector: FrameDetector,
        config: Config,
        box: FrameBox,
        emit: Emit,
        *,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        super().__init__(name="preview", daemon=True)
        self._detector = detector
        self._config = config
        self._box = box
        self._emit = emit
        self._monotonic = monotonic
        self._stop = threading.Event()
        self._period = 1.0 / config.window.preview_max_fps

    def stop(self) -> None:
        self._stop.set()

    def step(self, last_seq: int) -> int:
        """Runs the model once on a new frame, if there is one. Returns the frame's seq."""
        snap = self._box.latest()
        if snap is None or snap.seq == last_seq:
            return last_seq
        output = self._detector.detect_frame(snap.image, self._config.window.preview_imgsz)
        detections = map_detections(output.detections, self._detector.names, self._config.mapper)
        self._box.set_preview(PreviewResult(tuple(detections), output.inference_ms, snap.seq))
        return snap.seq

    def run(self) -> None:
        last = 0
        try:
            while not self._stop.is_set():
                started = self._monotonic()
                last = self.step(last)
                self._stop.wait(max(0.02, self._period - (self._monotonic() - started)))
        except Exception as error:
            self._emit(
                PreviewFailed(
                    f"The live preview stopped ({error}). Capture still works and the app still "
                    "decides each scan."
                )
            )


# ───────────── what the station captures ─────────────


class LiveSource:
    """The station's frame source in the window. ``hold`` keeps the frame on screen at the moment
    Capture was pressed; ``capture`` sends that one, with the press time as its capturedAt."""

    def __init__(
        self,
        box: FrameBox,
        name: str,
        jpeg_quality: int,
        encode: Callable[[Any, int], bytes] = encode_jpeg,
    ) -> None:
        self._box = box
        self._encode = encode
        self._name = name
        self._quality = jpeg_quality
        self._held: Snapshot | None = None
        self._count = 0
        self._lock = threading.Lock()
        self.description = name

    def hold(self, pressed_at: datetime) -> bool:
        """Keeps the newest frame for the next capture. False when there's no picture."""
        snap = self._box.latest()
        with self._lock:
            self._held = Snapshot(snap.image, snap.seq, pressed_at) if snap else None
        return snap is not None

    def capture(self) -> Frame | None:
        with self._lock:
            snap, self._held = self._held, None
        snap = snap or self._box.latest()
        if snap is None:
            raise SourceError(f"{self._name} has no picture to capture. Check the camera.")
        self._count += 1
        data = self._encode(snap.image, self._quality)
        return Frame(data, f"{self._name} #{self._count}", snap.taken_at)

    def remaining(self) -> int | None:
        return None

    def close(self) -> None:
        pass  # the runner stops the camera reader once the station has finished


# ───────────── the run ─────────────


@dataclass
class RunDeps:
    """How the runner builds what it needs; tests swap in fakes."""

    detector: Callable[[Config], FrameDetector]
    client: Callable[[Config, Mapping[str, str]], ScanClient | None]
    opener: Callable[[CameraChoice], Callable[[], Any]]
    model_version: Callable[[Config], str]
    clock: Clock = field(default=_now)
    encode: Callable[[Any, int], bytes] = encode_jpeg


class StationRunner(threading.Thread):
    def __init__(
        self,
        config: Config,
        env: Mapping[str, str],
        choice: CameraChoice,
        camera_name: str,
        emit: Emit,
        deps: RunDeps,
        box: FrameBox | None = None,
        *,
        camera_wait_seconds: float = 20.0,
    ) -> None:
        super().__init__(name="station", daemon=True)
        self.config = config
        self._env = env
        self._choice = choice
        self._camera_name = camera_name
        self._emit = emit
        self._deps = deps
        self.box = box or FrameBox()
        self._camera_wait = camera_wait_seconds
        self.trigger = ButtonTrigger(config.station.check_in_seconds)
        self.source = LiveSource(self.box, camera_name, config.station.jpeg_quality, deps.encode)
        self._stop = threading.Event()
        self._problem: str | None = None
        self._reader: CameraReader | None = None
        self._preview: PreviewLoop | None = None

    # called from the window's thread

    def capture(self) -> bool:
        """Capture pressed: keep the frame on screen and wake the station. False when there's
        no picture to capture."""
        if not self.source.hold(self._deps.clock()):
            return False
        self.trigger.press()
        return True

    def request_stop(self) -> None:
        self._stop.set()
        self.trigger.stop()

    # the station's thread

    def _on_event(self, event: StationEvent) -> None:
        # Ask more often while no batch is at Preparation, so Capture comes back quickly.
        if isinstance(event, NoBatchNow):
            self.trigger.idle_seconds = self.config.station.no_batch_wait_seconds
        elif isinstance(event, BatchShown):
            self.trigger.idle_seconds = self.config.station.check_in_seconds
        elif isinstance(event, StationStopped) and event.problem:
            self._problem = event.problem
        self._emit(event)

    def _on_camera(self, event: object) -> None:
        if isinstance(event, CameraFailed) and self.is_alive():
            self._problem = event.message
            self.request_stop()
        self._emit(event)

    def run(self) -> None:
        try:
            self._run()
        except Exception as error:  # never leave the window thinking it still runs
            self._problem = f"The station stopped unexpectedly: {error}"
        finally:
            self._stop.set()
            if self._preview is not None:
                self._preview.stop()
                self._preview.join(timeout=10)
            if self._reader is not None:
                self._reader.stop()
                self._reader.join(timeout=10)
            self.box.clear()
            self._emit(RunEnded(self._problem))

    def _run(self) -> None:
        config = self.config
        client = self._deps.client(config, self._env)
        if client is None:
            self._problem = (
                "CV_DEVICE_TOKEN isn't set. As the System Admin, create a device token under API "
                "tokens, then put CV_DEVICE_TOKEN=... in cv/.env."
            )
            return
        on_gpu = config.model.device != "cpu"
        self._emit(
            Starting(f"Loading the model on the {'GPU' if on_gpu else 'CPU'}. This takes a moment.")
        )
        try:
            version = self._deps.model_version(config)
            detector = self._deps.detector(config)
        except Exception as error:  # ModelError and friends already say what to fix
            self._problem = str(error)
            return
        if self._stop.is_set():
            return

        self._emit(Starting(f"Opening {self._camera_name}..."))
        self._reader = CameraReader(
            self._deps.opener(self._choice),
            self._camera_name,
            isinstance(self._choice.device, str),
            self.box,
            self._on_camera,
            warmup_frames=config.camera.warmup_frames,
            clock=self._deps.clock,
        )
        self._reader.start()
        if not self._reader.opened.wait(self._camera_wait) and not self._stop.is_set():
            self._problem = (
                f"{self._camera_name} gave no picture within {self._camera_wait:g} s. Check it's "
                "connected (for DroidCam, that the app is open on the phone)."
            )
            return
        if self._reader.failure or self._stop.is_set():
            self._problem = self._problem or self._reader.failure
            return
        self.source.description = self._reader.description

        self._preview = PreviewLoop(detector, config, self.box, self._emit)
        self._preview.start()

        station = Station(
            config=config,
            source=self.source,
            trigger=self.trigger,
            detector=detector,
            client=client,
            spool=Spool(config.station.spool_dir, config.station.failed_dir),
            log=StationLog(config.station.log_dir),
            model_version=version,
            say=lambda text: self._emit(Said(text)),
            events=self._on_event,
            should_stop=self._stop.is_set,
            sleep=self._sleep,
        )
        station.run()

    def _sleep(self, seconds: float) -> None:
        self._stop.wait(seconds)  # Stop wakes it at once
