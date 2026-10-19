"""The window's threads with fakes: the frame on screen is the one captured, the camera
reconnects, the preview never sends, and a full run goes through the station's spool and
captureId path (D-059, D-060). No OpenCV, torch, Tk or network."""

from __future__ import annotations

import queue
import threading
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fakes import (
    JPEG,
    TOKEN,
    FakeCapture,
    FakeImage,
    FakeTransport,
    batch_ok,
    created,
    error,
)

from cpoint_cv.client import ScanClient
from cpoint_cv.config import Config, StationConfig, parse_config
from cpoint_cv.detector import FakeDetector
from cpoint_cv.events import Pending, ReadyToCapture, ScanSent, StationStopped
from cpoint_cv.types import RawDetection
from cpoint_cv.window.settings import CameraChoice
from cpoint_cv.window.workers import (
    CameraBack,
    CameraFailed,
    CameraLost,
    CameraOpened,
    CameraReader,
    FrameBox,
    LiveSource,
    PreviewLoop,
    RunDeps,
    RunEnded,
    StationRunner,
)

MANILA = timezone(timedelta(hours=8))
PRESSED = datetime(2026, 10, 19, 9, 30, 5, tzinfo=MANILA)
NAMES = {0: "crease", 1: "cut", 2: "hole", 3: "scratch"}
WAIT = 5.0


def make_config(tmp_path: Path) -> Config:
    base = parse_config(
        {"model": {"path": "m.pt"}, "camera": {"warmup_frames": 0}}, base_dir=tmp_path
    )
    return Config(
        model=base.model,
        mapper=base.mapper,
        camera=base.camera,
        window=base.window,
        station=StationConfig(tmp_path / "spool", tmp_path / "failed", tmp_path / "logs"),
    )


def detector() -> FakeDetector:
    return FakeDetector(NAMES, [RawDetection(1, 0.71, cx=0.5, cy=0.5, w=0.2, h=0.1)], 110)


class Collector:
    def __init__(self) -> None:
        self.events: queue.Queue[object] = queue.Queue()
        self.seen: list[object] = []

    def __call__(self, event: object) -> None:
        self.events.put(event)

    def until(self, kind: type, timeout: float = WAIT) -> Any:
        """Waits for the next event of ``kind``, keeping everything seen on the way."""
        while True:
            event = self.events.get(timeout=timeout)
            self.seen.append(event)
            if isinstance(event, kind):
                return event


class TestFrames:
    def test_capture_sends_the_frame_on_screen_at_the_press(self) -> None:
        box = FrameBox()
        box.put(FakeImage(tag=1), PRESSED - timedelta(seconds=1))
        source = LiveSource(
            box, "Camera 1 (DirectShow)", 90, encode=lambda img, _q: b"%d" % img.tag
        )
        assert source.hold(PRESSED)
        box.put(FakeImage(tag=2), PRESSED + timedelta(seconds=1))  # a newer frame arrives
        frame = source.capture()
        assert frame is not None
        assert frame.data == b"1"  # the one that was on screen, not the newer one
        assert frame.taken_at == PRESSED
        assert frame.label == "Camera 1 (DirectShow) #1"

    def test_no_picture_means_nothing_to_hold(self) -> None:
        assert not LiveSource(FrameBox(), "Camera 0", 90).hold(PRESSED)

    def test_the_preview_runs_small_and_skips_repeats(self, tmp_path: Path) -> None:
        box = FrameBox()
        fake = detector()
        loop = PreviewLoop(fake, make_config(tmp_path), box, lambda _e: None)
        assert loop.step(0) == 0  # nothing yet
        box.put(FakeImage(), PRESSED)
        assert loop.step(0) == 1
        assert loop.step(1) == 1  # same frame: the model doesn't run again
        assert fake.frame_calls == [960]  # the preview size, never the capture's 1536
        assert fake.calls == []  # and it never makes a scan
        preview = box.preview()
        assert preview is not None and preview.detections[0].class_key == "cut"


class TestCameraReader:
    def test_opens_reads_and_releases(self) -> None:
        emitted = Collector()
        capture = FakeCapture()
        box = FrameBox()
        reader = CameraReader(lambda: capture, "Camera 0", False, box, emitted, warmup_frames=2)
        reader.start()
        opened = emitted.until(CameraOpened)
        assert opened.description == "Camera 0 at 1280 x 720"
        assert box.latest() is not None
        reader.stop()
        reader.join(WAIT)
        assert capture.released

    def test_a_camera_that_wont_open_says_what_to_check(self) -> None:
        emitted = Collector()
        reader = CameraReader(
            lambda: FakeCapture(opened=False), "Camera 4", False, FrameBox(), emitted
        )
        reader.start()
        failed = emitted.until(CameraFailed)
        assert "not in use by another app" in failed.message and "other driver" in failed.message
        reader.join(WAIT)

    def test_a_dropped_phone_camera_reconnects(self) -> None:
        emitted = Collector()
        captures = iter([FakeCapture(frames=3), FakeCapture()])
        reader = CameraReader(
            lambda: next(captures),
            "IP camera http://192.168.1.23:4747/video",
            True,
            FrameBox(),
            emitted,
            warmup_frames=0,
            retry_seconds=0.01,
        )
        reader.start()
        lost = emitted.until(CameraLost)
        assert "same network" in lost.message
        emitted.until(CameraBack)
        reader.stop()
        reader.join(WAIT)

    def test_gives_up_with_the_fix(self) -> None:
        emitted = Collector()
        captures = iter([FakeCapture(frames=1), *[FakeCapture(opened=False)] * 50])
        reader = CameraReader(
            lambda: next(captures),
            "Camera 1",
            False,
            FrameBox(),
            emitted,
            warmup_frames=0,
            retry_seconds=0.01,
            give_up_seconds=0.1,
        )
        reader.start()
        failed = emitted.until(CameraFailed)
        assert "didn't come back" in failed.message and "Saved captures are kept" in failed.message
        reader.join(WAIT)


def runner(
    tmp_path: Path, transport: FakeTransport, emitted: Collector, fake: FakeDetector
) -> StationRunner:
    def client(_c: Config, _env: Mapping[str, str]) -> ScanClient:
        return ScanClient(
            "http://localhost:3000", TOKEN, transport, sleep=lambda _s: None, rand=lambda: 1.0
        )

    deps = RunDeps(
        detector=lambda _c: fake,
        client=client,
        opener=lambda _choice: FakeCapture,
        model_version=lambda _c: "yolo-v1-1d729fb0",
        clock=lambda: PRESSED,
        encode=lambda _img, _q: JPEG,
    )
    return StationRunner(make_config(tmp_path), {}, CameraChoice(1), "Camera 1", emitted, deps)


class TestRun:
    def test_one_capture_goes_through_the_spool_with_a_capture_id(self, tmp_path: Path) -> None:
        transport = FakeTransport(current=[batch_ok()], scans=[created(sequence=12)])
        emitted = Collector()
        fake = detector()
        run = runner(tmp_path, transport, emitted, fake)
        run.start()
        emitted.until(ReadyToCapture)
        assert run.capture()
        sent = emitted.until(ScanSent)
        assert (sent.sequence, sent.verdict) == (12, "REWORK")  # the app's answer
        [post] = transport.posts()
        form = post.form()
        assert form["capturedAt"] == "2026-10-19T09:30:05+08:00"  # the moment of the press
        assert form["captureId"] and form["batchId"]
        assert len(fake.calls) == 1  # the capture ran at full size, through the file
        emitted.until(ReadyToCapture)
        run.request_stop()
        ended = emitted.until(RunEnded)
        assert ended.problem is None
        run.join(WAIT)
        assert not any((tmp_path / "spool").iterdir())  # sent, so nothing waits
        assert any(isinstance(e, Pending) and e.count == 0 for e in emitted.seen)

    def test_a_refused_token_stops_with_the_fix(self, tmp_path: Path) -> None:
        transport = FakeTransport(
            current=[batch_ok(), error(401, "UNAUTHENTICATED", "Invalid token.")]
        )
        emitted = Collector()
        run = runner(tmp_path, transport, emitted, detector())
        run.start()
        emitted.until(ReadyToCapture)
        run.capture()  # the recheck before capturing is refused
        stopped = emitted.until(StationStopped)
        assert stopped.problem and "device token was refused" in stopped.problem
        ended = emitted.until(RunEnded)
        assert ended.problem == stopped.problem
        run.join(WAIT)

    def test_stop_while_waiting_for_a_batch_is_quick(self, tmp_path: Path) -> None:
        transport = FakeTransport(
            current=[error(404, "NO_BATCH_AT_PREPARATION", "No batch is at Preparation.")]
        )
        emitted = Collector()
        run = runner(tmp_path, transport, emitted, detector())
        run.start()
        emitted.until(CameraOpened)
        done = threading.Event()
        threading.Timer(0.2, run.request_stop).start()
        emitted.until(RunEnded)
        done.set()
        run.join(WAIT)
        assert not run.is_alive()

    def test_no_token_is_a_problem_before_anything_opens(self, tmp_path: Path) -> None:
        emitted = Collector()
        run = runner(tmp_path, FakeTransport(), emitted, detector())
        run._deps.client = lambda _c, _e: None
        run.start()
        ended = emitted.until(RunEnded)
        assert ended.problem and "CV_DEVICE_TOKEN" in ended.problem
        run.join(WAIT)
