"""Model toolkit settings from a TOML file, with a few environment overrides.

Every value ``predict``, ``evaluate`` and ``export-onnx`` use (model file, image size, device,
confidence floor, class renames, the preview's thresholds and defect types) lives here or in the
file, never in the code. Lookup order for the file: ``--config``, then ``CPOINT_CV_CONFIG``,
then ``cv/config.toml``, then ``cv/config.example.toml``. Other sections (the retired station's
``[server]``, ``[station]``, ``[camera]`` and ``[window]``) are ignored.
"""

from __future__ import annotations

import os
import tomllib
from collections.abc import Mapping
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any

from .mapper import CONTRACT_MAX_DETECTIONS, MapperConfig
from .preview import ACTIONS, PreviewConfig

CV_DIR = Path(__file__).resolve().parent.parent

# Environment variable → (section, key). Values from the environment win over the file.
ENV_OVERRIDES = {
    "CPOINT_CV_MODEL_PATH": ("model", "path"),
    "CPOINT_CV_MODEL_DEVICE": ("model", "device"),
    "CPOINT_CV_MODEL_IMGSZ": ("model", "imgsz"),
    "CPOINT_CV_CONFIDENCE_FLOOR": ("mapper", "confidence_floor"),
}


class ConfigError(ValueError):
    """A setting is missing or wrong. The message names the setting and the fix."""


@dataclass(frozen=True)
class ModelConfig:
    path: Path
    name: str
    imgsz: int = 1536
    device: str = "cpu"
    sha256: str | None = None


@dataclass(frozen=True)
class Config:
    model: ModelConfig
    mapper: MapperConfig = field(default_factory=MapperConfig)
    preview: PreviewConfig = field(default_factory=PreviewConfig)
    source_file: Path | None = None


def default_config_path() -> Path:
    local = CV_DIR / "config.toml"
    return local if local.is_file() else CV_DIR / "config.example.toml"


def _section(data: Mapping[str, Any], name: str) -> Mapping[str, Any]:
    value = data.get(name, {})
    if not isinstance(value, Mapping):
        raise ConfigError(f"[{name}] must be a table of settings.")
    return value


def _number(section: str, key: str, value: Any, *, low: float, high: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ConfigError(
            f"[{section}] {key} must be a number from {low} to {high}; got {value!r}."
        ) from None
    if not low <= number <= high:
        raise ConfigError(f"[{section}] {key} must be from {low} to {high}; got {number}.")
    return number


def _whole(section: str, key: str, value: Any, *, low: int, high: int) -> int:
    if isinstance(value, bool):
        value = None
    try:
        number = int(str(value))
    except (TypeError, ValueError):
        raise ConfigError(
            f"[{section}] {key} must be a whole number from {low} to {high}; got {value!r}."
        ) from None
    if not low <= number <= high:
        raise ConfigError(f"[{section}] {key} must be from {low} to {high}; got {number}.")
    return number


def _keys(section: str, key: str, value: Any) -> frozenset[str]:
    if value is None:
        return frozenset()
    if not isinstance(value, list) or not all(isinstance(v, str) and v.strip() for v in value):
        raise ConfigError(f'[{section}] {key} must be a list of class keys, e.g. ["cut", "hole"].')
    return frozenset(v.strip() for v in value)


def parse_config(
    data: Mapping[str, Any], *, base_dir: Path, env: Mapping[str, str] | None = None
) -> Config:
    """Validate raw settings. Relative model paths are taken from ``base_dir``."""
    merged: dict[str, dict[str, Any]] = {
        name: dict(_section(data, name)) for name in ("model", "mapper", "preview")
    }
    for var, (section, key) in ENV_OVERRIDES.items():
        if env and env.get(var, "").strip():
            merged[section][key] = env[var].strip()

    m = merged["model"]
    raw_path = m.get("path")
    if not isinstance(raw_path, str) or not raw_path.strip():
        raise ConfigError(
            '[model] path is missing. Set it to the model file, e.g. "models/yolo-v1.pt".'
        )
    path = Path(raw_path.strip())
    name = m.get("name") or path.stem
    if not isinstance(name, str):
        raise ConfigError('[model] name must be text, e.g. "yolo-v1".')
    imgsz = _whole("model", "imgsz", m.get("imgsz", 1536), low=32, high=4096)
    if imgsz % 32:
        raise ConfigError(f"[model] imgsz must be a multiple of 32, e.g. 1536; got {imgsz}.")
    device = str(m.get("device", "cpu")).strip()
    if not (device == "cpu" or device == "mps" or device.startswith("cuda") or device.isdigit()):
        raise ConfigError(
            f'[model] device must be "cpu", "cuda:0" (a GPU) or "mps"; got {device!r}.'
        )
    sha = m.get("sha256")
    if sha is not None and (not isinstance(sha, str) or len(sha.strip()) != 64):
        raise ConfigError("[model] sha256 must be the 64-character SHA-256 of the model file.")

    mp = merged["mapper"]
    rename = mp.get("rename", {})
    if not isinstance(rename, Mapping) or not all(
        isinstance(k, str) and isinstance(v, str) and v.strip() for k, v in rename.items()
    ):
        raise ConfigError('[mapper.rename] maps a model class to a key, e.g. crease = "wrinkle".')
    mapper = MapperConfig(
        confidence_floor=_number(
            "mapper", "confidence_floor", mp.get("confidence_floor", 0.25), low=0.0, high=1.0
        ),
        rename={k: v.strip() for k, v in rename.items()},
        max_detections=_whole(
            "mapper",
            "max_detections",
            mp.get("max_detections", CONTRACT_MAX_DETECTIONS),
            low=1,
            high=CONTRACT_MAX_DETECTIONS,
        ),
        overlap_iou=_number("mapper", "overlap_iou", mp.get("overlap_iou", 0.7), low=0.0, high=1.0),
    )

    pv = merged["preview"]
    reject = _number(
        "preview", "reject_at_or_above", pv.get("reject_at_or_above", 0.9), low=0.01, high=1.0
    )
    rework = _number(
        "preview", "rework_at_or_above", pv.get("rework_at_or_above", 0.6), low=0.01, high=1.0
    )
    if rework >= reject:
        raise ConfigError(
            "[preview] rework_at_or_above must be lower than reject_at_or_above, as in Settings."
        )
    active = _keys("preview", "active_keys", pv.get("active_keys"))
    inactive = _keys("preview", "inactive_keys", pv.get("inactive_keys"))
    if active & inactive:
        both = ", ".join(sorted(active & inactive))
        raise ConfigError(f"[preview] {both} can't be both active and inactive.")
    found = _number(
        "preview", "found_at_or_above", pv.get("found_at_or_above", 0.5), low=0.01, high=0.99
    )
    actions = pv.get("actions", {})
    if not isinstance(actions, Mapping) or not all(
        isinstance(k, str) and isinstance(v, str) and v.strip().upper() in ACTIONS
        for k, v in actions.items()
    ):
        raise ConfigError(
            '[preview.actions] maps a class key to "REWORK" or "REJECT", e.g. hole = "REJECT". '
            "Leave a type out to go by confidence."
        )

    return Config(
        model=ModelConfig(
            path=path if path.is_absolute() else (base_dir / path).resolve(),
            name=name.strip(),
            imgsz=imgsz,
            device=device,
            sha256=sha.strip().lower() if isinstance(sha, str) else None,
        ),
        mapper=mapper,
        preview=PreviewConfig(
            reject_at_or_above=reject,
            rework_at_or_above=rework,
            active_keys=active,
            inactive_keys=inactive,
            found_at_or_above=found,
            actions={k: v.strip().upper() for k, v in actions.items()},
        ),
    )


def load_config(path: Path | None = None, env: Mapping[str, str] | None = None) -> Config:
    env = os.environ if env is None else env
    if path is None and env.get("CPOINT_CV_CONFIG"):
        path = Path(env["CPOINT_CV_CONFIG"])
    path = path or default_config_path()
    if not path.is_file():
        raise ConfigError(
            f"The config file {path} wasn't found. Copy cv/config.example.toml to cv/config.toml."
        )
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as error:
        raise ConfigError(f"{path.name} isn't valid TOML: {error}") from None
    config = parse_config(data, base_dir=path.resolve().parent, env=env)
    return replace(config, source_file=path.resolve())
