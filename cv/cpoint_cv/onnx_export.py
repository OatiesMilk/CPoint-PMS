"""``export-onnx``: the model as ONNX for the website's Capture page (Phase 18, D-064).

The app runs the ONNX file with ONNX Runtime inside its container. ONNX Runtime for Node can't read
the model's own metadata, so a sidecar JSON beside the file carries what the app needs: the class
names, the input size, the ``modelVersion`` of the ``.pt`` weights (so station and website scans
read as one model), the ONNX file's SHA-256, and the mapper settings (floor, overlap, renames).
Both files stay in ``cv/models/``, out of git and the image (D-049).
"""

from __future__ import annotations

import json
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import Config, ModelConfig
from .mapper import MapperConfig
from .model_info import model_version, sha256_file


class ExportError(RuntimeError):
    """The export couldn't run. The message says what to fix."""


@dataclass(frozen=True)
class Exported:
    onnx_path: Path
    names: Mapping[int, str]
    stride: int = 32


Exporter = Callable[[ModelConfig], Exported]


def sidecar_path(onnx_path: Path) -> Path:
    return onnx_path.with_suffix(".json")


def sidecar(
    version: str,
    names: Mapping[int, str],
    imgsz: int,
    onnx_sha256: str,
    mapper: MapperConfig,
    stride: int = 32,
) -> dict[str, Any]:
    """What the app reads beside the ONNX file (src/server/lib/cv/model-info.ts)."""
    return {
        "modelVersion": version,
        "names": {str(k): v for k, v in sorted(names.items())},
        "imgsz": imgsz,
        "stride": stride,
        "onnxSha256": onnx_sha256,
        "confidenceFloor": mapper.confidence_floor,
        "overlapIou": mapper.overlap_iou,
        "rename": dict(mapper.rename),
    }


def ultralytics_exporter(model: ModelConfig) -> Exported:
    """Exports FP32, simplified, on the CPU, with a dynamic input size: the app pads a photo only
    to the next multiple of the stride, as the station's ``.pt`` model does, not to a square."""
    try:
        import onnx  # noqa: F401  # Ultralytics needs it; check before it tries to pip install
        from ultralytics import YOLO
    except ImportError:
        raise ExportError(
            "The ONNX export needs onnx and onnxslim. Run: "
            "pip install -r cv/requirements-export.txt"
        ) from None
    yolo: Any = YOLO(str(model.path), task="segment")
    names = {int(k): str(v) for k, v in yolo.names.items()}
    stride = int(max(yolo.model.stride))
    out = yolo.export(
        format="onnx", imgsz=model.imgsz, dynamic=True, simplify=True, half=False, device="cpu"
    )
    return Exported(Path(out), names, stride)


def export_onnx(config: Config, exporter: Exporter = ultralytics_exporter) -> tuple[Path, Path]:
    """Writes ``<model>.onnx`` and ``<model>.json`` beside the ``.pt`` file. Returns both paths."""
    if not config.model.path.is_file():
        raise ExportError(
            f"The model file {config.model.path} wasn't found. Check [model] path in the config."
        )
    version = model_version(config.model.name, sha256_file(config.model.path))
    exported = exporter(config.model)
    target = config.model.path.with_suffix(".onnx")
    if exported.onnx_path.resolve() != target.resolve():
        exported.onnx_path.replace(target)
    data = sidecar(
        version,
        exported.names,
        config.model.imgsz,
        sha256_file(target),
        config.mapper,
        exported.stride,
    )
    info = sidecar_path(target)
    info.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return target, info
