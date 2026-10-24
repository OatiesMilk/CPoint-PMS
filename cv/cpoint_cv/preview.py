"""A Python port of the app's decision rule (``src/lib/decision-engine.ts``, D-053 and D-093).

Used only by ``predict`` and ``evaluate`` to show what the app *would* decide. The toolkit never
sends a verdict and never filters by these settings; the app decides with the settings in force
when the scan arrives. Keep this in step with ``decide()``: ``tests/test_preview.py`` mirrors its
unit tests.

The rule: a detection of an active, known type at or above "counts as found at" gives its type's
outcome, Usable or Not accepted; below it, it counts for nothing. Any Not accepted, or any class
the app doesn't know, makes the section REJECT; otherwise PASS. Inactive types are ignored.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

from .types import Detection

OUTCOMES = ("USABLE", "NOT_ACCEPTED")
VERDICTS = ("PASS", "REJECT")


@dataclass(frozen=True)
class PreviewConfig:
    """Defect types, their outcomes and the found-at value, as the app has them in Settings."""

    active_keys: frozenset[str] = frozenset()
    inactive_keys: frozenset[str] = frozenset()
    # "A defect counts as found at" (D-053) and each type's "When found" outcome (D-093).
    found_at_or_above: float = 0.5
    outcomes: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class PreviewDecision:
    verdict: str  # PASS | REJECT
    max_confidence: float | None
    unknown_keys: tuple[str, ...]
    ignored_keys: tuple[str, ...]


def detection_outcome(confidence: float, outcome: str | None, config: PreviewConfig) -> str | None:
    """What one detection does (``detectionOutcome``): its type's outcome once found, nothing
    (None) below found-at. A class with no outcome (unknown) is Not accepted."""
    if not outcome:
        return "NOT_ACCEPTED"
    return outcome if confidence >= config.found_at_or_above else None


def preview_verdict(detections: Iterable[Detection], config: PreviewConfig) -> PreviewDecision:
    unknown: dict[str, None] = {}  # ordered sets, like the JS Set in decide()
    ignored: dict[str, None] = {}
    best: float | None = None
    rejected = False

    for d in detections:
        if d.class_key in config.active_keys:
            if best is None or d.confidence > best:
                best = d.confidence
            outcome = config.outcomes.get(d.class_key)
            if detection_outcome(d.confidence, outcome, config) == "NOT_ACCEPTED":
                rejected = True
        elif d.class_key in config.inactive_keys:
            ignored[d.class_key] = None
        else:
            unknown[d.class_key] = None

    verdict = "REJECT" if rejected or unknown else "PASS"
    return PreviewDecision(verdict, best, tuple(unknown), tuple(ignored))
