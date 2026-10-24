"""The shared contract fixture (tests/fixtures/cv-payload.json at the repo root).

This test rebuilds the payload through the real mapper and payload builder and checks it equals
the fixture; tests/unit/cv-contract.test.ts parses the same file with the app's
ingestFieldsSchema. If either side changes, one of them breaks.
Rewrite the fixture on purpose with:
    CPOINT_CV_UPDATE_FIXTURE=1 pytest tests/test_contract_fixture.py
"""

import json
import os
from datetime import datetime, timedelta, timezone

import pytest

from cpoint_cv.config import CV_DIR
from cpoint_cv.detector import FakeDetector
from cpoint_cv.mapper import MapperConfig, map_detections
from cpoint_cv.payload import build_fields
from cpoint_cv.types import RawDetection

FIXTURE = CV_DIR.parent / "tests" / "fixtures" / "cv-payload.json"

# What yolo-v1 might report for one section: a clear cut, a crease running off the right edge,
# a scratch, a hole near the top-left corner, and noise below the floor.
DETECTOR = FakeDetector(
    names={0: "crease", 1: "cut", 2: "hole", 3: "scratch"},
    detections=[
        RawDetection(1, 0.712345, cx=0.42, cy=0.38, w=0.12, h=0.05),
        RawDetection(0, 0.48761, cx=0.95, cy=0.6, w=0.2, h=0.08),
        RawDetection(3, 0.33333, cx=0.25, cy=0.75, w=0.3, h=0.02),
        RawDetection(2, 0.9149, cx=0.02, cy=0.03, w=0.06, h=0.08),
        RawDetection(3, 0.12, cx=0.5, cy=0.5, w=0.1, h=0.1),
    ],
)
CAPTURED_AT = datetime(2026, 10, 1, 9, 30, tzinfo=timezone(timedelta(hours=8)))
CAPTURE_ID = "0199f0a1-7c2e-4a51-9d3f-2b8c4e6a1f00"
ROLL_ID = "0199e2b4-1f00-7c3a-8d21-5e6f7a8b9c0d"


def build() -> dict[str, str]:
    output = DETECTOR.detect(CV_DIR / "section.jpg")
    detections = map_detections(output.detections, DETECTOR.names, MapperConfig(0.25))
    return build_fields(
        detections,
        "yolo-v1-1d729fb0",
        "WEBCAM",
        CAPTURED_AT,
        capture_id=CAPTURE_ID,
        roll_id=ROLL_ID,
    )


def test_the_mapper_and_payload_builder_produce_the_shared_fixture() -> None:
    fields = build()
    if os.environ.get("CPOINT_CV_UPDATE_FIXTURE") == "1":
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        document = {
            "description": (
                "Text fields of POST /api/v1/scans as a device-token client sends them. Written by "
                "cv/tests/test_contract_fixture.py; parsed by tests/unit/cv-contract.test.ts."
            ),
            "fields": fields,
        }
        FIXTURE.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    assert json.loads(FIXTURE.read_text(encoding="utf-8"))["fields"] == fields


def test_the_fixture_has_the_contract_shape() -> None:
    fields = json.loads(FIXTURE.read_text(encoding="utf-8"))["fields"]
    assert set(fields) == {
        "detections",
        "modelVersion",
        "source",
        "capturedAt",
        "captureId",
        "rollId",
    }
    detections = json.loads(fields["detections"])
    assert [d["classKey"] for d in detections] == ["hole", "cut", "crease", "scratch"]
    for d in detections:
        assert set(d) == {"classKey", "confidence", "box"}
        assert set(d["box"]) == {"x", "y", "width", "height"}
        assert 0 <= d["confidence"] <= 1
        assert all(0 <= v <= 1 for v in d["box"].values())
        assert d["box"]["x"] + d["box"]["width"] <= 1.0001
        assert d["box"]["y"] + d["box"]["height"] <= 1.0001
    assert datetime.fromisoformat(fields["capturedAt"]).utcoffset() is not None


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"source": "CAMERA"}, "source must be one of"),
        ({"captured_at": datetime(2026, 10, 19, 9, 30)}, "needs a time zone"),
        ({"capture_id": "capture-7"}, "capture_id must be a UUID"),
    ],
)
def test_payload_builder_refuses_what_the_app_would(
    kwargs: dict[str, object], message: str
) -> None:
    args: dict[str, object] = {
        "detections": [],
        "model_version": "yolo-v1-1d729fb0",
        "source": "WEBCAM",
        "captured_at": CAPTURED_AT,
        **kwargs,
    }
    with pytest.raises(ValueError, match=message):
        build_fields(**args)  # type: ignore[arg-type]
