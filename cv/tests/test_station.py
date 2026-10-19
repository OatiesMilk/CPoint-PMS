import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fakes import (
    BATCH,
    JPEG,
    NO_BATCH_MESSAGE,
    TOKEN,
    FakeSource,
    FakeTransport,
    FakeTrigger,
    batch_ok,
    created,
    error,
    no_batch,
)

from cpoint_cv.client import TOKEN_REFUSED, ScanClient
from cpoint_cv.config import Config, StationConfig, parse_config
from cpoint_cv.detector import FakeDetector
from cpoint_cv.logs import StationLog
from cpoint_cv.sources import Frame
from cpoint_cv.spool import Spool
from cpoint_cv.station import Station
from cpoint_cv.transport import TransportError
from cpoint_cv.types import RawDetection

MANILA = timezone(timedelta(hours=8))
NAMES = {0: "crease", 1: "cut", 2: "hole", 3: "scratch"}


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 10, 19, 9, 30, tzinfo=MANILA)

    def __call__(self) -> datetime:
        self.now += timedelta(seconds=1)
        return self.now


def make(
    tmp_path: Path,
    transport: FakeTransport,
    frames: int = 1,
    presses: list[bool] | None = None,
) -> tuple[Station, list[str], list[float]]:
    base = parse_config({"model": {"path": "m.pt"}}, base_dir=tmp_path)
    config = Config(
        model=base.model,
        mapper=base.mapper,
        station=StationConfig(tmp_path / "spool", tmp_path / "failed", tmp_path / "logs"),
    )
    said: list[str] = []
    sleeps: list[float] = []
    ids = iter(f"0199f0a1-7c2e-4a51-9d3f-00000000000{i}" for i in range(1, 10))
    station = Station(
        config=config,
        source=FakeSource([Frame(JPEG, f"section-{i}.jpg") for i in range(1, frames + 1)]),
        trigger=FakeTrigger(presses if presses is not None else [True] * frames),
        detector=FakeDetector(
            NAMES,
            [RawDetection(1, 0.71, cx=0.5, cy=0.5, w=0.2, h=0.1)],
            inference_ms=255,
        ),
        client=ScanClient(
            "http://localhost:3000", TOKEN, transport, sleep=sleeps.append, rand=lambda: 1.0
        ),
        spool=Spool(tmp_path / "spool", tmp_path / "failed"),
        log=StationLog(tmp_path / "logs", Clock()),
        model_version="yolo-v1-1d729fb0",
        say=said.append,
        clock=Clock(),
        sleep=sleeps.append,
        new_id=lambda: next(ids),
    )
    return station, said, sleeps


def log_lines(tmp_path: Path) -> list[dict[str, object]]:
    [log] = list((tmp_path / "logs").glob("station-*.jsonl"))
    return [json.loads(line) for line in log.read_text(encoding="utf-8").splitlines()]


def test_captures_runs_the_model_and_sends_the_scan(tmp_path: Path) -> None:
    t = FakeTransport(current=[batch_ok()], scans=[created(3, "REWORK")])
    station, said, _ = make(tmp_path, t)
    assert station.run() == 0

    [post] = t.posts()
    form = post.form()
    assert form["batchId"] == BATCH["batchId"]  # pinned to the batch shown before the capture
    assert form["captureId"] == "0199f0a1-7c2e-4a51-9d3f-000000000001"
    assert form["modelVersion"] == "yolo-v1-1d729fb0"
    assert form["source"] == "WEBCAM"
    assert form["capturedAt"] == "2026-10-19T09:30:01+08:00"  # taken at capture, not at send
    assert json.loads(form["detections"])[0]["classKey"] == "cut"
    assert "Next scan goes to B-2026-0007 (roll LR-0042, School Shoe)." in said
    assert "section-1.jpg: B-2026-0007 section 3, REWORK (cut 0.71)" in said
    assert "No more images to send." in said
    assert station.spool.count() == 0


def test_waits_while_no_batch_is_at_preparation_and_never_captures(tmp_path: Path) -> None:
    t = FakeTransport(current=[no_batch(), no_batch(), batch_ok()], scans=[created()])
    station, said, sleeps = make(tmp_path, t)
    station.run()
    assert said.count(f"{NO_BATCH_MESSAGE} Waiting...") == 1  # said once, not every few seconds
    assert sleeps[:2] == [5.0, 5.0]
    assert len(t.posts()) == 1
    # The first scan was only sent after the batch appeared.
    first_post = next(i for i, r in enumerate(t.requests) if r.method == "POST")
    assert t.requests[first_post - 1].url.endswith("/batches/current")


def test_no_batch_after_the_trigger_captures_nothing(tmp_path: Path) -> None:
    t = FakeTransport(current=[batch_ok(), no_batch(), batch_ok()], scans=[created()])
    station, said, _ = make(tmp_path, t, presses=[True])
    station.run()
    assert t.posts() == []
    assert f"{NO_BATCH_MESSAGE} Nothing was captured." in said


def test_a_changed_batch_is_announced_and_used(tmp_path: Path) -> None:
    t = FakeTransport(
        current=[
            batch_ok(),
            batch_ok(batchId="0199e2b4-0000-7000-8000-000000000008", batchCode="B-2026-0008"),
        ],
        scans=[created()],
    )
    station, said, _ = make(tmp_path, t)
    station.run()
    assert t.posts()[0].form()["batchId"] == "0199e2b4-0000-7000-8000-000000000008"
    assert any(s.startswith("The batch changed. This scan goes to B-2026-0008") for s in said)


def test_a_network_failure_keeps_the_capture_and_a_later_run_sends_it(tmp_path: Path) -> None:
    down = FakeTransport(current=[batch_ok()], scans=[TransportError("connection refused")])
    station, said, sleeps = make(tmp_path, down)
    assert station.run() == 0
    assert len(down.posts()) == 4  # retried, then spooled
    assert sleeps[-3:] == [1.0, 2.0, 4.0]
    assert station.spool.count() == 1
    assert any("couldn't send it (connection refused) after 4 tries" in s for s in said)
    assert any("1 capture(s) are saved and waiting to send" in s for s in said)

    up = FakeTransport(current=[batch_ok()], scans=[created(4, "PASS")])
    again, said2, _ = make(tmp_path, up, frames=0, presses=[])
    assert again.run() == 0
    [post] = up.posts()
    assert post.form()["captureId"] == "0199f0a1-7c2e-4a51-9d3f-000000000001"  # the same capture
    assert up.requests[0].method == "POST"  # the spool goes first, before anything new
    assert "section-1.jpg: B-2026-0007 section 4, PASS (cut 0.71)" in said2
    assert again.spool.count() == 0


def test_a_repeat_the_app_already_had_is_cleared(tmp_path: Path) -> None:
    t = FakeTransport(current=[batch_ok()], scans=[created(3, "REWORK", duplicate=True)])
    station, said, _ = make(tmp_path, t)
    station.run()
    assert station.spool.count() == 0
    assert any(s.endswith("(the app already had it)") for s in said)


def test_spooled_captures_go_out_in_order(tmp_path: Path) -> None:
    down = FakeTransport(current=[batch_ok()], scans=[TransportError("timed out")])
    station, _, _ = make(tmp_path, down, frames=2)
    station.run()
    assert station.spool.count() == 2
    # The second capture waited behind the first: it was never attempted while the first failed.
    assert {p.form()["captureId"][-1] for p in down.posts()} == {"1"}

    up = FakeTransport(current=[batch_ok()], scans=[created(5), created(6)])
    make(tmp_path, up, frames=0, presses=[])[0].run()
    assert [p.form()["captureId"][-1] for p in up.posts()] == ["1", "2"]


def test_a_refused_scan_moves_to_failed_and_the_station_carries_on(tmp_path: Path) -> None:
    details = [{"path": ["detections"], "message": "detections must be a JSON array."}]
    t = FakeTransport(
        current=[batch_ok()],
        scans=[error(422, "VALIDATION", "Check the fields.", details), created(4)],
    )
    station, said, _ = make(tmp_path, t, frames=2)
    assert station.run() == 0
    [failed] = list((tmp_path / "failed").iterdir())
    reason = (failed / "reason.txt").read_text(encoding="utf-8")
    assert "detections: detections must be a JSON array." in reason
    assert any("the app refused it" in s for s in said)
    assert len(t.posts()) == 2 and station.spool.count() == 0


def test_a_refused_token_stops_the_station_and_keeps_the_capture(tmp_path: Path) -> None:
    t = FakeTransport(
        current=[batch_ok()], scans=[error(401, "UNAUTHENTICATED", "That token isn't valid.")]
    )
    station, said, _ = make(tmp_path, t, frames=2)
    assert station.run() == 3
    assert TOKEN_REFUSED in said
    assert len(t.posts()) == 1
    assert station.spool.count() == 1  # kept, to send once the token is fixed


def test_a_refused_token_while_asking_for_the_batch_stops_too(tmp_path: Path) -> None:
    t = FakeTransport(current=[error(401, "UNAUTHENTICATED", "That token isn't valid.")])
    station, said, _ = make(tmp_path, t)
    assert station.run() == 3
    assert TOKEN_REFUSED in said
    assert t.posts() == []


def test_the_app_unreachable_while_waiting_is_said_once(tmp_path: Path) -> None:
    t = FakeTransport(
        current=[
            TransportError("connection refused"),
            TransportError("connection refused"),
            batch_ok(),
        ],
        scans=[created()],
    )
    station, said, _ = make(tmp_path, t)
    station.run()
    unreachable = [s for s in said if s.startswith("Can't reach the app at http://localhost:3000")]
    assert len(unreachable) == 1


def test_the_operator_can_stop_before_capturing(tmp_path: Path) -> None:
    t = FakeTransport(current=[batch_ok()])
    station, _, _ = make(tmp_path, t, presses=[False])
    assert station.run() == 0
    assert t.posts() == []
    assert station.source.closed  # type: ignore[attr-defined]


def test_the_log_has_each_capture_and_send_but_never_the_token(tmp_path: Path) -> None:
    t = FakeTransport(current=[batch_ok()], scans=[created(3, "REWORK")])
    station, _, _ = make(tmp_path, t)
    station.run()
    lines = log_lines(tmp_path)
    captured = next(line for line in lines if line["event"] == "captured")
    sent = next(line for line in lines if line["event"] == "sent")
    assert captured["batch"] == "B-2026-0007" and captured["inferenceMs"] == 255
    assert sent["httpStatus"] == 201 and sent["attempts"] == 1 and sent["verdict"] == "REWORK"
    log_text = next((tmp_path / "logs").glob("*.jsonl")).read_text(encoding="utf-8")
    assert TOKEN not in log_text


def test_every_send_event_records_its_status_and_attempts(tmp_path: Path) -> None:
    details = [{"path": ["image"], "message": "The image must be a JPEG, PNG or WebP file."}]
    t = FakeTransport(
        current=[batch_ok()],
        scans=[
            error(422, "VALIDATION", "Check the fields.", details),
            TransportError("timed out"),
        ],
    )
    station, _, _ = make(tmp_path, t, frames=2)
    station.run()
    sends = [line for line in log_lines(tmp_path) if str(line["event"]).startswith("send")]
    assert [line["event"] for line in sends] == ["send_refused", "send_failed"]
    refused, failed = sends
    assert (refused["httpStatus"], refused["attempts"]) == (422, 1)
    assert (failed["httpStatus"], failed["attempts"]) == (None, 4)
