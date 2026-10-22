"""Turns what the model saw into the app's ``detections`` shape. Pure, no model imports.

The model reports, the app decides (D-011): nothing here applies PASS/REWORK/REJECT
thresholds. The confidence floor only drops noise.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field

from .types import Box, Detection, RawDetection

# The app accepts at most this many detections per scan (MAX_DETECTIONS in scan.validator.ts).
CONTRACT_MAX_DETECTIONS = 50
DECIMALS = 4


@dataclass(frozen=True)
class MapperConfig:
    confidence_floor: float = 0.25
    rename: Mapping[str, str] = field(default_factory=dict)
    max_detections: int = CONTRACT_MAX_DETECTIONS
    # Two boxes of the same class overlapping this much (intersection over union) are one
    # defect reported twice; only the more confident is kept. 0 keeps every box.
    overlap_iou: float = 0.7


def iou(a: Box, b: Box) -> float:
    """Intersection over union of two top-left boxes, 0 to 1."""
    w = min(a.x + a.width, b.x + b.width) - max(a.x, b.x)
    h = min(a.y + a.height, b.y + b.height) - max(a.y, b.y)
    if w <= 0 or h <= 0:
        return 0.0
    inter = w * h
    return inter / (a.width * a.height + b.width * b.height - inter)


def _clamp(value: float) -> float:
    return min(1.0, max(0.0, value))


def class_key_for(index: int, names: Mapping[int, str], rename: Mapping[str, str]) -> str:
    """The model's own name for the class, then the team's rename, if any.

    An index the model's names don't cover becomes ``class_<n>``: the app doesn't know that key,
    so the scan goes to the Quality Inspector instead of the detection being lost.
    """
    key = names.get(index, f"class_{index}")
    return rename.get(key, key)


def to_box(cx: float, cy: float, w: float, h: float) -> Box | None:
    """Centre box → top-left box, clipped to the image so ``x + width <= 1`` and
    ``y + height <= 1``. Returns None when nothing of the box is left inside the image."""
    x0, x1 = _clamp(cx - w / 2), _clamp(cx + w / 2)
    y0, y1 = _clamp(cy - h / 2), _clamp(cy + h / 2)
    x, y = round(x0, DECIMALS), round(y0, DECIMALS)
    # Rounding each side on its own could push the far edge past 1, so trim to what's left.
    width = min(round(x1 - x0, DECIMALS), round(1 - x, DECIMALS))
    height = min(round(y1 - y0, DECIMALS), round(1 - y, DECIMALS))
    if width <= 0 or height <= 0:
        return None
    return Box(x=x, y=y, width=width, height=height)


def map_with_sources(
    raw: Iterable[RawDetection], names: Mapping[int, str], config: MapperConfig
) -> list[tuple[Detection, RawDetection]]:
    """Like ``map_detections``, keeping each result's raw detection (for mask overlays)."""
    mapped: list[tuple[Detection, RawDetection]] = []
    for d in raw:
        if d.confidence < config.confidence_floor:
            continue
        box = to_box(d.cx, d.cy, d.w, d.h)
        if box is None:
            continue
        detection = Detection(
            class_key=class_key_for(d.class_index, names, config.rename),
            confidence=round(_clamp(d.confidence), DECIMALS),
            box=box,
        )
        mapped.append((detection, d))
    mapped.sort(key=lambda pair: pair[0].confidence, reverse=True)
    if config.overlap_iou > 0:
        kept: list[tuple[Detection, RawDetection]] = []
        for pair in mapped:  # strongest first, so the more confident of two copies stays
            det = pair[0]
            if not any(
                k.class_key == det.class_key and iou(k.box, det.box) >= config.overlap_iou
                for k, _ in kept
            ):
                kept.append(pair)
        mapped = kept
    return mapped[: config.max_detections]


def map_detections(
    raw: Iterable[RawDetection], names: Mapping[int, str], config: MapperConfig
) -> list[Detection]:
    """Floor, map, sort by confidence (highest first), drop same-class copies of one box and
    keep the strongest ``max_detections``."""
    return [detection for detection, _ in map_with_sources(raw, names, config)]
