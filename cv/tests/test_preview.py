"""Mirrors tests/unit/decision-engine.test.ts so the preview can't drift from the app's rule."""

import pytest

from cpoint_cv.preview import PreviewConfig, PreviewDecision, preview_verdict
from cpoint_cv.types import Box, Detection

CONFIG = PreviewConfig(
    reject_at_or_above=0.9,
    rework_at_or_above=0.6,
    active_keys=frozenset({"cut", "hole", "abrasion"}),
    inactive_keys=frozenset({"dirt"}),
)
BOX = Box(0.1, 0.1, 0.1, 0.1)


def dets(*pairs: tuple[str, float]) -> list[Detection]:
    return [Detection(key, conf, BOX) for key, conf in pairs]


def test_a_clean_section_passes() -> None:
    assert preview_verdict([], CONFIG) == PreviewDecision("PASS", None, (), ())


@pytest.mark.parametrize(
    ("confidence", "verdict"),
    [
        (0.5999, "PASS"),
        (0.6, "REWORK"),
        (0.75, "REWORK"),
        (0.8999, "REWORK"),
        (0.9, "REJECT"),
        (0.99, "REJECT"),
    ],
)
def test_thresholds(confidence: float, verdict: str) -> None:
    assert preview_verdict(dets(("cut", confidence)), CONFIG).verdict == verdict


def test_the_highest_confidence_decides() -> None:
    d = preview_verdict(dets(("hole", 0.62), ("cut", 0.93), ("abrasion", 0.4)), CONFIG)
    assert (d.verdict, d.max_confidence) == ("REJECT", 0.93)


def test_inactive_types_are_ignored() -> None:
    assert preview_verdict(dets(("dirt", 0.99)), CONFIG) == PreviewDecision(
        "PASS", None, (), ("dirt",)
    )


def test_an_unknown_class_goes_to_review_even_beside_a_certain_reject() -> None:
    d = preview_verdict(dets(("cut", 0.95), ("scratch", 0.7), ("scratch", 0.8)), CONFIG)
    assert d == PreviewDecision("NEEDS_REVIEW", 0.95, ("scratch",), ())


def test_edited_thresholds_are_followed() -> None:
    strict = PreviewConfig(0.7, 0.3, frozenset({"cut"}), frozenset())
    assert preview_verdict(dets(("cut", 0.5)), strict).verdict == "REWORK"
    assert preview_verdict(dets(("cut", 0.7)), strict).verdict == "REJECT"
