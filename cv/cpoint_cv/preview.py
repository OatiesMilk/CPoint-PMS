"""A Python port of the app's decision rule (``src/lib/decision-engine.ts``, D-011 and D-053).

Used only by ``predict`` and ``evaluate`` to show what the app *would* decide. The station never
sends a verdict and never filters by these settings; the app decides with the settings in force
when the scan arrives. Keep this in step with ``decide()``: ``tests/test_preview.py`` mirrors its
unit tests.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

from .types import Detection

ACTIONS = ("REWORK", "REJECT")
_RANK = {"PASS": 0, "REWORK": 1, "REJECT": 2}


@dataclass(frozen=True)
class PreviewConfig:
    """Thresholds, actions and defect types as the app has them in Settings (copied into config)."""

    reject_at_or_above: float = 0.9
    rework_at_or_above: float = 0.6
    active_keys: frozenset[str] = frozenset()
    inactive_keys: frozenset[str] = frozenset()
    # "A defect counts as found at" and each type's "When found" (D-053). A type that isn't
    # here goes by confidence.
    found_at_or_above: float = 0.5
    actions: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class PreviewDecision:
    verdict: str  # PASS | REWORK | REJECT | NEEDS_REVIEW
    max_confidence: float | None
    unknown_keys: tuple[str, ...]
    ignored_keys: tuple[str, ...]


def detection_outcome(confidence: float, action: str | None, config: PreviewConfig) -> str:
    """What one detection of an active type means on its own (``detectionOutcome``)."""
    if action:
        return action if confidence >= config.found_at_or_above else "PASS"
    if confidence >= config.reject_at_or_above:
        return "REJECT"
    if confidence >= config.rework_at_or_above:
        return "REWORK"
    return "PASS"


def preview_verdict(detections: Iterable[Detection], config: PreviewConfig) -> PreviewDecision:
    unknown: dict[str, None] = {}  # ordered sets, like the JS Set in decide()
    ignored: dict[str, None] = {}
    best: float | None = None
    worst = "PASS"

    for d in detections:
        if d.class_key in config.active_keys:
            if best is None or d.confidence > best:
                best = d.confidence
            outcome = detection_outcome(d.confidence, config.actions.get(d.class_key), config)
            if _RANK[outcome] > _RANK[worst]:
                worst = outcome
        elif d.class_key in config.inactive_keys:
            ignored[d.class_key] = None
        else:
            unknown[d.class_key] = None

    verdict = "NEEDS_REVIEW" if unknown else worst
    return PreviewDecision(verdict, best, tuple(unknown), tuple(ignored))
