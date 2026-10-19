"""A Python port of the app's decision rule (D-011, ``src/lib/decision-engine.ts``).

Used only by ``predict`` to show what the app *would* decide. The station never sends a verdict
and never filters by these thresholds; the app decides with the settings in force when the scan
arrives. Keep this in step with ``decide()``: ``tests/test_preview.py`` mirrors its unit tests.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from .types import Detection


@dataclass(frozen=True)
class PreviewConfig:
    """Thresholds and defect types as the app has them in Settings (copied into config)."""

    reject_at_or_above: float = 0.9
    rework_at_or_above: float = 0.6
    active_keys: frozenset[str] = frozenset()
    inactive_keys: frozenset[str] = frozenset()


@dataclass(frozen=True)
class PreviewDecision:
    verdict: str  # PASS | REWORK | REJECT | NEEDS_REVIEW
    max_confidence: float | None
    unknown_keys: tuple[str, ...]
    ignored_keys: tuple[str, ...]


def preview_verdict(detections: Iterable[Detection], config: PreviewConfig) -> PreviewDecision:
    unknown: dict[str, None] = {}  # ordered sets, like the JS Set in decide()
    ignored: dict[str, None] = {}
    best: float | None = None

    for d in detections:
        if d.class_key in config.active_keys:
            if best is None or d.confidence > best:
                best = d.confidence
        elif d.class_key in config.inactive_keys:
            ignored[d.class_key] = None
        else:
            unknown[d.class_key] = None

    if unknown:
        verdict = "NEEDS_REVIEW"
    elif best is not None and best >= config.reject_at_or_above:
        verdict = "REJECT"
    elif best is not None and best >= config.rework_at_or_above:
        verdict = "REWORK"
    else:
        verdict = "PASS"
    return PreviewDecision(verdict, best, tuple(unknown), tuple(ignored))
