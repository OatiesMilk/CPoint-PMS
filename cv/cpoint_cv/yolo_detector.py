"""The YOLO adapter: the only module that imports ultralytics (and through it, torch).

It loads the model once, warms it up once, and reports each detection as the model's class index
with its normalized centre box. For the segment task, Ultralytics already gives a box for each
mask (``Results.boxes``); the mask outline (``Results.masks.xyn``) is kept for overlays only, so
the app's contract stays boxes only (gap 3).
"""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path
from typing import Any

from .config import ModelConfig
from .types import DetectorOutput, Point, RawDetection


class ModelError(RuntimeError):
    """The model couldn't be loaded or run. The message says what to fix."""


class YoloDetector:
    def __init__(self, config: ModelConfig, confidence_floor: float) -> None:
        if not config.path.is_file():
            raise ModelError(
                f"The model file {config.path} wasn't found. Put it in cv/models/ or set "
                "[model] path in cv/config.toml."
            )
        try:
            from ultralytics import YOLO
        except ImportError:
            raise ModelError(
                "ultralytics isn't installed. Run: pip install -r cv/requirements.txt "
                "(see cv/README.md for the GPU build of torch)."
            ) from None

        self._config = config
        self._floor = confidence_floor
        try:
            self._model: Any = YOLO(str(config.path), task="segment")
        except Exception as error:  # ultralytics raises many types; say which file failed
            raise ModelError(f"Couldn't load {config.path.name}: {error}") from error
        self._names: dict[int, str] = {int(k): str(v) for k, v in self._model.names.items()}
        self._warm_up()

    @property
    def names(self) -> Mapping[int, str]:
        return self._names

    @property
    def task(self) -> str:
        return str(getattr(self._model, "task", "unknown"))

    def _predict(self, source: Any) -> Any:
        try:
            return self._model.predict(
                source=source,
                imgsz=self._config.imgsz,
                device=self._config.device,
                conf=self._floor,
                verbose=False,
            )
        except Exception as error:
            if "cuda" in str(error).lower() and self._config.device != "cpu":
                raise ModelError(
                    f'Device "{self._config.device}" isn\'t usable ({error}). Set [model] '
                    'device = "cpu", or install the CUDA build of torch (cv/README.md).'
                ) from error
            raise

    def _warm_up(self) -> None:
        import numpy as np

        blank: Any = np.zeros((self._config.imgsz, self._config.imgsz, 3), dtype=np.uint8)
        self._predict(blank)

    def detect(self, image: Path) -> DetectorOutput:
        result = self._predict(str(image))[0]
        speed = getattr(result, "speed", {}) or {}
        inference_ms = float(
            sum(speed.get(k, 0.0) for k in ("preprocess", "inference", "postprocess"))
        )

        boxes = result.boxes
        if boxes is None or len(boxes) == 0:
            return DetectorOutput([], inference_ms)

        xywhn = boxes.xywhn.cpu().tolist()
        confs = boxes.conf.cpu().tolist()
        classes = boxes.cls.cpu().tolist()
        polygons: list[tuple[Point, ...] | None] = [None] * len(xywhn)
        if result.masks is not None:
            for i, outline in enumerate(result.masks.xyn[: len(xywhn)]):
                polygons[i] = tuple((float(px), float(py)) for px, py in outline.tolist())

        detections = [
            RawDetection(
                class_index=int(cls),
                confidence=float(conf),
                cx=float(b[0]),
                cy=float(b[1]),
                w=float(b[2]),
                h=float(b[3]),
                polygon=poly,
            )
            for b, conf, cls, poly in zip(xywhn, confs, classes, polygons, strict=True)
        ]
        return DetectorOutput(detections, inference_ms)


def runtime_versions() -> dict[str, str]:
    """Versions for the model card and the predict header."""
    import platform

    versions = {"python": platform.python_version()}
    try:
        import torch
        import ultralytics

        versions["ultralytics"] = ultralytics.__version__
        versions["torch"] = torch.__version__
        versions["cuda"] = (
            torch.cuda.get_device_name(0) if torch.cuda.is_available() else "not available"
        )
    except ImportError:
        pass
    return versions
