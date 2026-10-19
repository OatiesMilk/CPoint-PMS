"""The detector port. ``YoloDetector`` (yolo_detector.py) is the real adapter; ``FakeDetector``
returns fixed detections so tests and dry runs need no torch.

``FrameDetector`` adds what the station window's live preview needs: the model on an in-memory
frame at a smaller size (D-060)."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any, Protocol

from .types import DetectorOutput, RawDetection


class Detector(Protocol):
    @property
    def names(self) -> Mapping[int, str]:
        """The model's own class names by index."""
        ...

    def detect(self, image: Path) -> DetectorOutput: ...


class FrameDetector(Detector, Protocol):
    def detect_frame(self, frame: Any, imgsz: int) -> DetectorOutput: ...


class FakeDetector:
    def __init__(
        self,
        names: Mapping[int, str],
        detections: Sequence[RawDetection] = (),
        inference_ms: float = 0.0,
    ) -> None:
        self._names = dict(names)
        self._detections = list(detections)
        self._inference_ms = inference_ms
        self.calls: list[Path] = []
        self.frame_calls: list[int] = []

    @property
    def names(self) -> Mapping[int, str]:
        return self._names

    def detect(self, image: Path) -> DetectorOutput:
        self.calls.append(image)
        return DetectorOutput(list(self._detections), self._inference_ms)

    def detect_frame(self, frame: Any, imgsz: int) -> DetectorOutput:
        self.frame_calls.append(imgsz)
        return DetectorOutput(list(self._detections), self._inference_ms)
