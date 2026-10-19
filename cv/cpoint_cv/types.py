"""Plain data passed between the detector, the mapper and the payload builder."""

from __future__ import annotations

from dataclasses import dataclass

Point = tuple[float, float]


@dataclass(frozen=True)
class RawDetection:
    """What a detector reports, before mapping: the model's own class index and centre box.

    The box is ``xywhn``: centre x, centre y, width and height as fractions (0 to 1) of the image.
    ``polygon`` is the segment mask outline in the same fractions, used only for overlays.
    """

    class_index: int
    confidence: float
    cx: float
    cy: float
    w: float
    h: float
    polygon: tuple[Point, ...] | None = None


@dataclass(frozen=True)
class DetectorOutput:
    detections: list[RawDetection]
    inference_ms: float


@dataclass(frozen=True)
class Box:
    """Top-left corner box in fractions of the image, as the app's contract expects."""

    x: float
    y: float
    width: float
    height: float


@dataclass(frozen=True)
class Detection:
    """One detection in the shape of the app's ``detections`` entries."""

    class_key: str
    confidence: float
    box: Box

    def to_contract(self) -> dict[str, object]:
        return {
            "classKey": self.class_key,
            "confidence": self.confidence,
            "box": {
                "x": self.box.x,
                "y": self.box.y,
                "width": self.box.width,
                "height": self.box.height,
            },
        }
