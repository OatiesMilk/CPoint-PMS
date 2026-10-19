"""``python -m cpoint_cv doctor``: checks the station can run, and says what to fix when it can't.

Model file and checksum, Python and package versions, the GPU, the camera, the app's address, the
device token and this computer's clock. Nothing is sent and nothing changes. The station window's
"Check this machine" runs the same checks (D-061).

Each check passes, fails or warns. A failure means the station can't work until it's fixed; a
warning means it works, but slower or with a risk worth knowing (no GPU, a package version other
than the pinned one, no batch yet, a clock a little off).
"""

from __future__ import annotations

import platform
import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from importlib import metadata
from pathlib import Path
from typing import Any

from .client import BatchInfo, NoBatch, ScanClient, TokenRefused
from .config import CV_DIR, Config
from .model_info import sha256_file
from .transport import TransportError

REQUIREMENTS = CV_DIR / "requirements.txt"
# A clock this far off is worth a warning; past APP_FUTURE_LIMIT_SECONDS ahead, the app refuses
# the scans (capturedAt more than 5 minutes in its future, scan.validator.ts).
CLOCK_TOLERANCE_SECONDS = 120
APP_FUTURE_LIMIT_SECONDS = 300


@dataclass(frozen=True)
class Check:
    name: str
    ok: bool
    detail: str
    # ok but worth knowing: the station works, slower or with a risk. Never blocks anything.
    warning: bool = False

    @property
    def status(self) -> str:
        """``ok``, ``warn`` or ``fail``."""
        if not self.ok:
            return "fail"
        return "warn" if self.warning else "ok"

    def line(self) -> str:
        label = {"ok": "ok  ", "warn": "warn", "fail": "FAIL"}[self.status]
        return f"{label}  {self.name}: {self.detail}"


def warn(name: str, detail: str) -> Check:
    return Check(name, True, detail, warning=True)


def check_model(config: Config) -> Check:
    path = config.model.path
    if not path.is_file():
        return Check(
            "Model file",
            False,
            f"{path} wasn't found. Put the model in cv/models/ or fix [model] path in "
            f"{config.source_file or 'cv/config.toml'}.",
        )
    sha = sha256_file(path)
    if config.model.sha256 and config.model.sha256 != sha:
        return Check(
            "Model file",
            False,
            f"{path.name} doesn't match [model] sha256 (found {sha[:8]}..., expected "
            f"{config.model.sha256[:8]}...). Check it's the right file, then update sha256 and "
            "cv/MODEL_CARD.md.",
        )
    return Check("Model file", True, f"{path.name}, SHA-256 {sha[:8]}... matches")


def pinned_versions(requirements: Path = REQUIREMENTS) -> dict[str, str]:
    pins: dict[str, str] = {}
    if requirements.is_file():
        for line in requirements.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^\s*([A-Za-z0-9_.-]+)==([^\s#;]+)", line)
            if match:
                pins[match.group(1).lower()] = match.group(2)
    return pins


def installed_version(package: str) -> str | None:
    try:
        return metadata.version(package)
    except metadata.PackageNotFoundError:
        return None


def check_python(
    version: str | None = None,
    pins: Mapping[str, str] | None = None,
    installed: Callable[[str], str | None] = installed_version,
) -> list[Check]:
    version = version or platform.python_version()
    checks = [
        Check(
            "Python",
            tuple(int(p) for p in version.split(".")[:2]) >= (3, 13),
            version
            if tuple(int(p) for p in version.split(".")[:2]) >= (3, 13)
            else f"{version} is too old. Install Python 3.13 and recreate cv/.venv.",
        )
    ]
    fix = "Run: pip install -r requirements.txt (in cv/, with cv/.venv active)."
    for package, wanted in (pins if pins is not None else pinned_versions()).items():
        found = installed(package)
        if found is None:
            checks.append(Check(package, False, f"not installed, needs {wanted}. {fix}"))
        # The CUDA build of torch reports e.g. 2.6.0+cu124: compare without the local suffix.
        elif found.split("+")[0] == wanted:
            checks.append(Check(package, True, found))
        else:
            checks.append(
                warn(package, f"{found} is installed; the station was tested with {wanted}. {fix}")
            )
    return checks


@dataclass(frozen=True)
class GpuInfo:
    torch_version: str
    cuda_build: str | None  # torch.version.cuda: None for the CPU build of torch
    available: bool
    name: str | None


def probe_gpu() -> GpuInfo | None:
    """What torch sees, or None when torch isn't installed. Imports torch (slow the first time)."""
    try:
        import torch
    except ImportError:
        return None
    torch_any: Any = torch
    available = bool(torch_any.cuda.is_available())
    return GpuInfo(
        torch_version=str(torch_any.__version__),
        cuda_build=torch_any.version.cuda,
        available=available,
        name=str(torch_any.cuda.get_device_name(0)) if available else None,
    )


def check_gpu(
    device: str, probe: Callable[[], GpuInfo | None] = probe_gpu, *, cpu_fallback: bool = False
) -> Check:
    """The GPU, if any, and whether ``[model] device`` can use it. With ``cpu_fallback`` (the
    window), a configured GPU that isn't there is a warning: the window runs on the CPU. Without it
    (``run``, ``predict``), that is a failure: the model can't load on that device."""
    info = probe()
    if info is None:
        return warn("GPU", "can't check it: torch isn't installed (see the torch line).")
    wants_gpu = device != "cpu"
    if info.available:
        detail = f"{info.name}, CUDA {info.cuda_build} (torch {info.torch_version})"
        if not wants_gpu:
            return warn(
                "GPU",
                f'{detail}, but [model] device is "cpu". Set device = "cuda:0" in cv/config.toml '
                "for about 3 times faster scans.",
            )
        return Check("GPU", True, detail)

    why = (
        f"torch {info.torch_version} is the CPU build. To use an NVIDIA GPU, install the CUDA "
        "build of torch (cv/README.md, Set up the station)"
        if info.cuda_build is None
        else "no NVIDIA GPU is usable (there's none, its driver isn't installed, or "
        "CUDA_VISIBLE_DEVICES hides it)"
    )
    if not wants_gpu:
        return warn("GPU", f"none: {why}. The model runs on the CPU, about 3 times slower.")
    if cpu_fallback:
        return warn(
            "GPU",
            f"[model] device is {device!r}, but {why}. The window runs the model on the CPU "
            "instead, about 3 times slower.",
        )
    return Check(
        "GPU",
        False,
        f'[model] device is {device!r}, but {why}. Or set device = "cpu" in cv/config.toml.',
    )


def check_camera(device: int | str, probe: Callable[[int | str], str | None]) -> Check:
    from .sources import camera_name

    problem = probe(device)
    return Check("Camera", problem is None, problem or f"{camera_name(device)} gives a picture")


def check_app(
    client: ScanClient | None, now: Callable[[], datetime] = lambda: datetime.now().astimezone()
) -> list[Check]:
    if client is None:
        return [
            Check(
                "Device token",
                False,
                "CV_DEVICE_TOKEN isn't set. As the System Admin, create one under API tokens "
                "(scope scans:create), then put CV_DEVICE_TOKEN=... in cv/.env.",
            )
        ]
    try:
        health = client.health()
    except TransportError as error:
        return [
            Check(
                "App",
                False,
                f"can't reach {client.base_url} ({error}). Start the app (npm run dev, or "
                "docker compose up -d) or set CV_BASE_URL to its address.",
            )
        ]
    checks = [
        Check("App", True, f"{client.base_url} is up")
        if health.status == 200
        else Check(
            "App",
            False,
            f"{client.base_url}/api/health answered {health.status}. The app is running but "
            "unhealthy: check its database (npm run db:up).",
        )
    ]

    batch = client.current_batch()
    if isinstance(batch, BatchInfo):
        checks.append(
            Check("Device token", True, f"accepted; next scan goes to {batch.describe()}")
        )
    elif isinstance(batch, NoBatch):
        checks.append(
            warn(
                "Device token",
                "accepted; no batch is at Preparation yet. Start one on the Batches page before "
                "capturing.",
            )
        )
    elif isinstance(batch, TokenRefused):
        checks.append(Check("Device token", False, batch.message))
    else:
        checks.append(Check("Device token", False, f"couldn't check it ({batch.reason})."))

    server_date = health.header("Date")
    if server_date:
        offset = (now() - parsedate_to_datetime(server_date)).total_seconds()
        direction = "ahead of" if offset > 0 else "behind"
        sync = "Sync the clock (Windows: Settings > Time & language > Sync now)."
        if abs(offset) <= CLOCK_TOLERANCE_SECONDS:
            checks.append(Check("Clock", True, f"within {abs(offset):.0f} s of the app"))
        elif offset > APP_FUTURE_LIMIT_SECONDS:
            checks.append(
                Check(
                    "Clock",
                    False,
                    f"this computer is {offset:.0f} s ahead of the app, and the app refuses scans "
                    f"taken more than 5 minutes in its future. {sync}",
                )
            )
        else:
            checks.append(
                warn(
                    "Clock",
                    f"this computer is {abs(offset):.0f} s {direction} the app, so scan times "
                    f"will be off. {sync}",
                )
            )
    return checks
