import json
from datetime import UTC, datetime, timedelta, timezone
from pathlib import Path

from cpoint_cv.spool import Spool, entry_name

T0 = datetime(2026, 10, 19, 1, 30, 0, tzinfo=UTC)
FIELDS = {"detections": "[]", "captureId": "c1"}


def spool(tmp_path: Path) -> Spool:
    return Spool(tmp_path / "spool", tmp_path / "failed")


def add(s: Spool, at: datetime, capture_id: str, label: str) -> Path:
    image = s.create(at, capture_id, b"\xff\xd8\xff" + label.encode(), "jpg")
    s.complete(image, {"fields": {**FIELDS, "captureId": capture_id}, "label": label})
    return image


def test_names_sort_by_capture_time_in_utc() -> None:
    at = datetime(2026, 10, 19, 9, 30, 0, 123456, tzinfo=timezone(timedelta(hours=8)))
    assert entry_name(at, "abc") == "20261019T013000123456Z-abc"


def test_pending_returns_ready_captures_oldest_first(tmp_path: Path) -> None:
    s = spool(tmp_path)
    add(s, T0 + timedelta(seconds=5), "b", "second")
    add(s, T0, "a", "first")
    entries = s.pending()
    assert [e.label for e in entries] == ["first", "second"]
    assert entries[0].fields == {**FIELDS, "captureId": "a"}
    assert entries[0].mime == "image/jpeg"
    assert entries[0].image.read_bytes() == b"\xff\xd8\xfffirst"
    assert s.count() == 2


def test_remove_deletes_a_sent_capture(tmp_path: Path) -> None:
    s = spool(tmp_path)
    add(s, T0, "a", "first")
    s.remove(s.pending()[0])
    assert s.pending() == [] and s.count() == 0


def test_fail_moves_it_with_the_reason(tmp_path: Path) -> None:
    s = spool(tmp_path)
    add(s, T0, "a", "first")
    where = s.fail(s.pending()[0], "The image must be a JPEG, PNG or WebP file.")
    assert where.parent == tmp_path / "failed"
    assert (where / "reason.txt").read_text(encoding="utf-8").startswith("The image must be")
    assert (where / "image.jpg").is_file()
    assert s.count() == 0


def test_a_capture_interrupted_before_the_model_ran_moves_to_failed(tmp_path: Path) -> None:
    s = spool(tmp_path)
    s.create(T0, "a", b"\xff\xd8\xff", "jpg")  # no capture.json: the station stopped mid-way
    add(s, T0 + timedelta(seconds=1), "b", "ready")
    assert [e.label for e in s.pending()] == ["ready"]
    [moved] = list((tmp_path / "failed").iterdir())
    assert "before the model ran" in (moved / "reason.txt").read_text(encoding="utf-8")


def test_an_unreadable_record_moves_to_failed(tmp_path: Path) -> None:
    s = spool(tmp_path)
    image = s.create(T0, "a", b"\xff\xd8\xff", "jpg")
    (image.parent / "capture.json").write_text("{broken", encoding="utf-8")
    assert s.pending() == []
    [moved] = list((tmp_path / "failed").iterdir())
    assert "couldn't be read" in (moved / "reason.txt").read_text(encoding="utf-8")


def test_complete_writes_the_record_atomically(tmp_path: Path) -> None:
    s = spool(tmp_path)
    image = add(s, T0, "a", "first")
    assert json.loads((image.parent / "capture.json").read_text(encoding="utf-8"))["label"] == (
        "first"
    )
    assert not list(image.parent.glob("*.tmp"))


def test_an_empty_spool(tmp_path: Path) -> None:
    s = spool(tmp_path)
    assert s.pending() == [] and s.count() == 0
