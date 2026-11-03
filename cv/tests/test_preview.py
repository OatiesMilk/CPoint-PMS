"""Mirrors tests/unit/decision-engine.test.ts so the preview can't drift from the app's rule."""

import pytest

from cpoint_cv.preview import PreviewConfig, PreviewDecision, detection_outcome, preview_verdict
from cpoint_cv.types import Box, Detection

# The model's classes as CPoint decided them (C-11, C-12, C-19, A-13), plus an inactive
# Not accepted type.
CONFIG = PreviewConfig(
    active_keys=frozenset({"cut", "hole", "crease", "scratch"}),
    inactive_keys=frozenset({"dirt"}),
    found_at_or_above=0.5,
    outcomes={
        "cut": "NOT_ACCEPTED",
        "hole": "NOT_ACCEPTED",
        "crease": "USABLE",
        "scratch": "USABLE",
        "dirt": "NOT_ACCEPTED",
    },
)
BOX = Box(0.1, 0.1, 0.1, 0.1)


def dets(*pairs: tuple[str, float]) -> list[Detection]:
    return [Detection(key, conf, BOX) for key, conf in pairs]


def v(*pairs: tuple[str, float]) -> str:
    return preview_verdict(dets(*pairs), CONFIG).verdict


def test_a_section_with_no_detections_passes() -> None:
    assert preview_verdict([], CONFIG) == PreviewDecision("PASS", None, ())


@pytest.mark.parametrize(("confidence", "verdict"), [(0.4999, "PASS"), (0.5, "REJECT")])
def test_a_not_accepted_cut_from_found_at(confidence: float, verdict: str) -> None:
    assert v(("cut", confidence)) == verdict


def test_only_usable_defects_pass_however_sure() -> None:
    assert v(("crease", 0.5)) == "PASS"
    assert v(("scratch", 0.99), ("crease", 0.8)) == "PASS"


def test_usable_plus_not_accepted_rejects() -> None:
    assert v(("scratch", 0.66), ("hole", 0.52)) == "REJECT"


def test_a_not_accepted_type_below_found_at_counts_for_nothing() -> None:
    assert v(("scratch", 0.66), ("hole", 0.3)) == "PASS"


def test_several_types_report_the_highest_confidence() -> None:
    d = preview_verdict(dets(("hole", 0.62), ("cut", 0.93), ("crease", 0.4)), CONFIG)
    assert (d.verdict, d.max_confidence) == ("REJECT", 0.93)


def test_an_inactive_not_accepted_type_is_ignored() -> None:
    assert preview_verdict(dets(("dirt", 0.99)), CONFIG) == PreviewDecision("PASS", None, ("dirt",))


def test_a_class_with_no_defect_type_is_ignored() -> None:
    assert preview_verdict(dets(("stain", 0.99)), CONFIG) == PreviewDecision(
        "PASS", None, ("stain",)
    )


def test_a_class_with_no_defect_type_beside_a_usable_one_passes() -> None:
    d = preview_verdict(dets(("crease", 0.8), ("stain", 0.7), ("stain", 0.6)), CONFIG)
    assert d == PreviewDecision("PASS", 0.8, ("stain",))


def test_an_edited_found_at_value_is_followed() -> None:
    strict = PreviewConfig(CONFIG.active_keys, CONFIG.inactive_keys, 0.6, CONFIG.outcomes)
    assert preview_verdict(dets(("cut", 0.55)), strict).verdict == "PASS"


def test_detection_outcome() -> None:
    assert detection_outcome(0.5, "USABLE", CONFIG) == "USABLE"
    assert detection_outcome(0.49, "NOT_ACCEPTED", CONFIG) is None
    assert detection_outcome(0.9, None, CONFIG) is None
