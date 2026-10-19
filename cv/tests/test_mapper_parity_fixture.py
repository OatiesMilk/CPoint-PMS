"""The mapper parity fixture (tests/fixtures/cv-mapper-parity.json at the repo root).

The website's Capture page maps the model's output in TypeScript (src/server/lib/cv/mapper.ts).
This test writes what ``mapper.py`` makes of a set of raw detections; the app's Vitest test
(tests/unit/cv-mapper-parity.test.ts) runs the TypeScript mapper on the same input and must get
exactly the same. Rewrite the fixture on purpose with:
    CPOINT_CV_UPDATE_FIXTURE=1 pytest tests/test_mapper_parity_fixture.py
"""

import json
import os
from typing import Any

from cpoint_cv.config import CV_DIR
from cpoint_cv.mapper import MapperConfig, map_detections
from cpoint_cv.types import RawDetection

FIXTURE = CV_DIR.parent / "tests" / "fixtures" / "cv-mapper-parity.json"
NAMES = {0: "crease", 1: "cut", 2: "hole", 3: "scratch"}

# Edge cases on purpose: below the floor, off every edge, a same-class copy and a
# different-class overlap, an index the model's names don't cover, values that round, and ties.
RAW = [
    RawDetection(1, 0.712345, cx=0.42, cy=0.38, w=0.12, h=0.05),
    RawDetection(1, 0.70111, cx=0.421, cy=0.381, w=0.12, h=0.05),
    RawDetection(0, 0.68, cx=0.42, cy=0.38, w=0.12, h=0.05),
    RawDetection(0, 0.48761, cx=0.95, cy=0.6, w=0.2, h=0.08),
    RawDetection(3, 0.33333, cx=0.25, cy=0.75, w=0.3, h=0.02),
    RawDetection(2, 0.9149, cx=0.02, cy=0.03, w=0.06, h=0.08),
    RawDetection(2, 0.5, cx=0.99999, cy=0.99999, w=0.0001, h=0.0001),
    RawDetection(7, 0.61, cx=0.5, cy=0.1, w=0.1, h=0.1),
    RawDetection(3, 0.12, cx=0.5, cy=0.5, w=0.1, h=0.1),
    RawDetection(2, 0.77, cx=-0.2, cy=0.5, w=0.1, h=0.1),
    RawDetection(3, 0.6, cx=0.123456, cy=0.654321, w=0.0123456, h=0.0987654),
    RawDetection(1, 0.6, cx=0.8, cy=0.2, w=0.33333, h=0.66666),
    RawDetection(3, 1.2, cx=0.5, cy=0.5, w=1.4, h=1.4),
]

CASES: dict[str, MapperConfig] = {
    "default": MapperConfig(),
    "renamed, no overlap filter, top 3": MapperConfig(
        confidence_floor=0.3, rename={"crease": "wrinkle"}, max_detections=3, overlap_iou=0.0
    ),
    "high floor, loose overlap": MapperConfig(confidence_floor=0.65, overlap_iou=0.1),
}


def _raw(d: RawDetection) -> dict[str, Any]:
    return {
        "classIndex": d.class_index,
        "confidence": d.confidence,
        "cx": d.cx,
        "cy": d.cy,
        "w": d.w,
        "h": d.h,
    }


def build() -> dict[str, Any]:
    return {
        "description": (
            "Raw detections and what cv/cpoint_cv/mapper.py makes of them. Written by "
            "cv/tests/test_mapper_parity_fixture.py; checked by "
            "tests/unit/cv-mapper-parity.test.ts."
        ),
        "names": {str(k): v for k, v in NAMES.items()},
        "raw": [_raw(d) for d in RAW],
        "cases": [
            {
                "name": name,
                "config": {
                    "confidenceFloor": c.confidence_floor,
                    "rename": dict(c.rename),
                    "maxDetections": c.max_detections,
                    "overlapIou": c.overlap_iou,
                },
                "expected": [d.to_contract() for d in map_detections(RAW, NAMES, c)],
            }
            for name, c in CASES.items()
        ],
    }


def test_the_mapper_produces_the_shared_parity_fixture() -> None:
    document = build()
    if os.environ.get("CPOINT_CV_UPDATE_FIXTURE") == "1":
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    assert json.loads(FIXTURE.read_text(encoding="utf-8")) == document
