"""The detector port. ``YoloDetector`` (yolo_detector.py) is the real adapter; ``FakeDetector``
returns fixed detections so tests need no torch."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Protocol

from .types import DetectorOutput, RawDetection


class Detector(Protocol):
    @property
    def names(self) -> Mapping[int, str]:
        """The model's own class names by index."""
        ...

    def detect(self, image: Path) -> DetectorOutput: ...


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

    @property
    def names(self) -> Mapping[int, str]:
        return self._names

    def detect(self, image: Path) -> DetectorOutput:
        self.calls.append(image)
        return DetectorOutput(list(self._detections), self._inference_ms)
