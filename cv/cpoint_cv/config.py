"""Station settings from a TOML file, with a few environment overrides.

Every value the station uses (model file, image size, device, confidence floor, class renames,
the preview's thresholds and defect types, the app's address, retries, the camera and the
station's folders) lives here or in the file, never in the code. The device token is the one
setting that is never in this file: it comes from ``CV_DEVICE_TOKEN`` (env.py).
Lookup order for the file: ``--config``, then ``CPOINT_CV_CONFIG``, then ``cv/config.toml``,
then ``cv/config.example.toml``.
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
    "CV_BASE_URL": ("server", "base_url"),  # the simulator's name, so one .env serves both
    # An IP camera's address may hold its password, so it can live in cv/.env instead.
    "CPOINT_CV_CAMERA_URL": ("camera", "url"),
}

# The app's ScanSource values a camera station may send (prisma/schema.prisma).
STATION_SOURCES = ("WEBCAM", "DEDICATED_CAMERA")
# How OpenCV opens a numbered camera on Windows: its default (Media Foundation), or DirectShow,
# which some virtual cameras (DroidCam, OBS) only offer.
CAMERA_BACKENDS = ("default", "dshow")


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
class ServerConfig:
    base_url: str = "http://localhost:3000"
    timeout_seconds: float = 30.0
    attempts: int = 4
    backoff_seconds: float = 1.0
    max_backoff_seconds: float = 15.0


@dataclass(frozen=True)
class StationConfig:
    spool_dir: Path
    failed_dir: Path
    log_dir: Path
    scan_source: str = "WEBCAM"
    jpeg_quality: int = 90
    interval_seconds: float = 3.0
    no_batch_wait_seconds: float = 5.0
    # While waiting for Space, ask the app for the batch this often (D-054). 0 turns it off.
    check_in_seconds: float = 20.0


@dataclass(frozen=True)
class CameraConfig:
    index: int = 0
    width: int = 1920
    height: int = 1080
    warmup_frames: int = 5
    # An IP camera's stream (rtsp://, http:// or https://). When set, it's used instead of index.
    url: str | None = None
    # "default" or "dshow" (DirectShow), for numbered cameras only (D-062).
    backend: str = "default"

    @property
    def device(self) -> int | str:
        return self.url or self.index


@dataclass(frozen=True)
class WindowConfig:
    """The station window's live preview (D-060). Captures always run at [model] imgsz."""

    preview_imgsz: int = 960
    preview_max_fps: float = 4.0


def _default_station() -> StationConfig:
    out = CV_DIR / "out"
    return StationConfig(out / "spool", out / "failed", out / "logs")


@dataclass(frozen=True)
class Config:
    model: ModelConfig
    mapper: MapperConfig = field(default_factory=MapperConfig)
    preview: PreviewConfig = field(default_factory=PreviewConfig)
    server: ServerConfig = field(default_factory=ServerConfig)
    station: StationConfig = field(default_factory=_default_station)
    camera: CameraConfig = field(default_factory=CameraConfig)
    window: WindowConfig = field(default_factory=WindowConfig)
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
        name: dict(_section(data, name))
        for name in ("model", "mapper", "preview", "server", "station", "camera", "window")
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

    def folder(key: str, default: str) -> Path:
        raw = merged["station"].get(key, default)
        if not isinstance(raw, str) or not raw.strip():
            raise ConfigError(f'[station] {key} must be a folder path, e.g. "{default}".')
        p = Path(raw.strip())
        return p if p.is_absolute() else (base_dir / p).resolve()

    sv = merged["server"]
    base_url = str(sv.get("base_url", "http://localhost:3000")).strip().rstrip("/")
    if not base_url.startswith(("http://", "https://")):
        raise ConfigError(
            f'[server] base_url must start with http:// or https://, e.g. "http://localhost:3000"; '
            f"got {base_url!r}."
        )
    backoff = _number("server", "backoff_seconds", sv.get("backoff_seconds", 1.0), low=0, high=60)
    max_backoff = _number(
        "server", "max_backoff_seconds", sv.get("max_backoff_seconds", 15.0), low=0, high=600
    )
    if max_backoff < backoff:
        raise ConfigError("[server] max_backoff_seconds can't be below backoff_seconds.")
    server = ServerConfig(
        base_url=base_url,
        timeout_seconds=_number(
            "server", "timeout_seconds", sv.get("timeout_seconds", 30.0), low=1, high=300
        ),
        attempts=_whole("server", "attempts", sv.get("attempts", 4), low=1, high=10),
        backoff_seconds=backoff,
        max_backoff_seconds=max_backoff,
    )

    st = merged["station"]
    scan_source = str(st.get("scan_source", "WEBCAM")).strip()
    if scan_source not in STATION_SOURCES:
        raise ConfigError(
            f"[station] scan_source must be {' or '.join(STATION_SOURCES)}; got {scan_source!r}."
        )
    station = StationConfig(
        spool_dir=folder("spool_dir", "out/spool"),
        failed_dir=folder("failed_dir", "out/failed"),
        log_dir=folder("log_dir", "out/logs"),
        scan_source=scan_source,
        jpeg_quality=_whole(
            "station", "jpeg_quality", st.get("jpeg_quality", 90), low=50, high=100
        ),
        interval_seconds=_number(
            "station", "interval_seconds", st.get("interval_seconds", 3.0), low=0, high=3600
        ),
        no_batch_wait_seconds=_number(
            "station",
            "no_batch_wait_seconds",
            st.get("no_batch_wait_seconds", 5.0),
            low=1,
            high=600,
        ),
        check_in_seconds=_number(
            "station", "check_in_seconds", st.get("check_in_seconds", 20.0), low=0, high=60
        ),
    )

    cm = merged["camera"]
    url = cm.get("url")
    if url is not None:
        if not isinstance(url, str):
            raise ConfigError('[camera] url must be text, e.g. "rtsp://192.168.1.50:554/stream1".')
        url = url.strip() or None
    if url and not url.lower().startswith(("rtsp://", "http://", "https://")):
        raise ConfigError(
            "[camera] url must start with rtsp://, http:// or https://, "
            'e.g. "rtsp://192.168.1.50:554/stream1". Leave it empty to use [camera] index.'
        )
    backend = str(cm.get("backend", "default")).strip().lower()
    if backend not in CAMERA_BACKENDS:
        raise ConfigError(
            f'[camera] backend must be "default" or "dshow" (DirectShow); got {backend!r}.'
        )
    camera = CameraConfig(
        url=url,
        backend=backend,
        index=_whole("camera", "index", cm.get("index", 0), low=0, high=99),
        width=_whole("camera", "width", cm.get("width", 1920), low=160, high=8192),
        height=_whole("camera", "height", cm.get("height", 1080), low=120, high=8192),
        warmup_frames=_whole("camera", "warmup_frames", cm.get("warmup_frames", 5), low=0, high=60),
    )

    wv = merged["window"]
    preview_imgsz = _whole(
        "window", "preview_imgsz", wv.get("preview_imgsz", 960), low=160, high=4096
    )
    if preview_imgsz % 32:
        raise ConfigError(
            f"[window] preview_imgsz must be a multiple of 32, e.g. 960; got {preview_imgsz}."
        )
    window = WindowConfig(
        preview_imgsz=preview_imgsz,
        preview_max_fps=_number(
            "window", "preview_max_fps", wv.get("preview_max_fps", 4.0), low=0.5, high=30
        ),
    )

    return Config(
        server=server,
        station=station,
        camera=camera,
        window=window,
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
