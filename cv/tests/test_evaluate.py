from pathlib import Path

import pytest

from cpoint_cv.detector import FakeDetector
from cpoint_cv.evaluate import (
    Case,
    Label,
    LabelError,
    class_scores,
    load_labels,
    parse_labels,
    run_cases,
    sweep,
    to_markdown,
)
from cpoint_cv.mapper import MapperConfig
from cpoint_cv.preview import PreviewConfig
from cpoint_cv.types import Box, Detection, RawDetection

PREVIEW = PreviewConfig(
    active_keys=frozenset({"crease", "cut", "hole", "scratch"}),
    inactive_keys=frozenset({"abrasion", "dirt"}),
    outcomes={
        "cut": "NOT_ACCEPTED",
        "hole": "NOT_ACCEPTED",
        "crease": "USABLE",
        "scratch": "USABLE",
    },
)
BOX = Box(0.1, 0.1, 0.1, 0.1)


def case(file: str, expected: str, classes: str, *found: tuple[str, float]) -> Case:
    label = Label(file, expected, frozenset(c for c in classes.split(";") if c))
    return Case(label, [Detection(k, c, BOX) for k, c in found], 250.0)


CASES = [
    case("a.jpg", "REJECT", "cut;scratch", ("scratch", 0.66), ("cut", 0.51)),
    case("b.jpg", "PASS", "crease", ("crease", 0.51)),
    case("c.jpg", "PASS", "", ("scratch", 0.3)),
    case("d.jpg", "REJECT", "hole"),
]


def test_parses_labels_and_names_the_bad_row() -> None:
    labels = parse_labels("﻿file,expected_verdict,classes\na.jpg,reject,cut; scratch\nb.jpg,PASS,\n")
    assert labels == [
        Label("a.jpg", "REJECT", frozenset({"cut", "scratch"})),
        Label("b.jpg", "PASS", frozenset()),
    ]
    with pytest.raises(LabelError, match=r"line 3: expected_verdict for b.jpg must be one of"):
        parse_labels("file,expected_verdict\na.jpg,PASS\nb.jpg,MAYBE\n")
    with pytest.raises(LabelError, match=r"line 2: REWORK for a.jpg is no longer a verdict"):
        parse_labels("file,expected_verdict\na.jpg,REWORK\n")
    with pytest.raises(LabelError, match=r"Write REJECT instead"):
        parse_labels("file,expected_verdict\na.jpg,NEEDS_REVIEW\n")
    with pytest.raises(LabelError, match=r"line 3: a.jpg is listed twice"):
        parse_labels("file,expected_verdict\na.jpg,PASS\na.jpg,PASS\n")
    with pytest.raises(LabelError, match="expected_verdict is missing"):
        parse_labels("file,verdict\na.jpg,PASS\n")


def test_load_labels_checks_the_photos_exist(tmp_path: Path) -> None:
    with pytest.raises(LabelError, match=r"labels.csv wasn't found"):
        load_labels(tmp_path)
    (tmp_path / "labels.csv").write_text("file,expected_verdict\na.jpg,PASS\n", encoding="utf-8")
    with pytest.raises(LabelError, match="aren't in"):
        load_labels(tmp_path)
    (tmp_path / "a.jpg").write_bytes(b"x")
    assert len(load_labels(tmp_path)) == 1


def test_runs_the_detector_once_per_labelled_photo(tmp_path: Path) -> None:
    detector = FakeDetector({1: "cut"}, [RawDetection(1, 0.8, 0.5, 0.5, 0.2, 0.2)], 120.0)
    cases = run_cases(
        tmp_path, [Label("a.jpg", "REJECT", frozenset({"cut"}))], detector, MapperConfig()
    )
    assert detector.calls == [tmp_path / "a.jpg"]
    assert cases[0].detections[0].class_key == "cut"


def test_per_class_precision_and_recall_by_photo() -> None:
    scores = {s.key: s for s in class_scores(CASES)}
    assert (scores["scratch"].true_pos, scores["scratch"].false_pos) == (1, 1)
    assert scores["scratch"].precision == 0.5
    assert scores["hole"].recall == 0.0
    assert scores["hole"].precision is None  # never found: no precision to give


def test_sweep_moves_the_found_at_value() -> None:
    rows = sweep(CASES, PREVIEW)
    assert [r.setting for r in rows][:2] == ["Found at 0.50", "Found at 0.60"]
    assert rows[0].matches == 3  # a, b, c right; d's hole was missed
    assert rows[1].counts["PASS"] == 4  # at 0.60 the 0.51 cut no longer counts


def test_report_is_labelled_a_small_check() -> None:
    report = to_markdown(
        CASES,
        PREVIEW,
        model_version="yolo-v1-1d729fb0",
        date="2026-10-19",
        settings_line="S.",
        floor=0.25,
    )
    assert report.startswith("# Model check: yolo-v1-1d729fb0 (2026-10-19)")
    assert "**Small check on 4 photos.**" in report
    assert "matched the expected verdict on **3 of 4** photos" in report
    assert "| d.jpg | REJECT | PASS | nothing | no |" in report
    assert "| REJECT | 1 | 1 |" in report  # expected Reject: one passed, one rejected
    assert "Rework" not in report
