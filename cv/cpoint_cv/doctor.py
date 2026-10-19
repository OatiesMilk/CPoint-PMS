"""``python -m cpoint_cv doctor``: checks the station can run, and says what to fix when it can't.

Model file and checksum, Python and package versions, the camera, the app's address, the device
token and this computer's clock. Nothing is sent and nothing changes.
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

from .client import BatchInfo, NoBatch, ScanClient, TokenRefused
from .config import CV_DIR, Config
from .model_info import sha256_file
from .transport import TransportError

REQUIREMENTS = CV_DIR / "requirements.txt"
# The app refuses a capturedAt more than 5 minutes ahead of its clock (scan.validator.ts).
CLOCK_TOLERANCE_SECONDS = 120


@dataclass(frozen=True)
class Check:
    name: str
    ok: bool
    detail: str

    def line(self) -> str:
        return f"{'ok  ' if self.ok else 'FAIL'}  {self.name}: {self.detail}"


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
    for package, wanted in (pins if pins is not None else pinned_versions()).items():
        found = installed(package)
        # The CUDA build of torch reports e.g. 2.6.0+cu124: compare without the local suffix.
        if found is not None and found.split("+")[0] == wanted:
            checks.append(Check(package, True, found))
        else:
            checks.append(
                Check(
                    package,
                    False,
                    f"{'not installed' if found is None else found}, needs {wanted}. Run: "
                    "pip install -r requirements.txt (in cv/, with cv/.venv active).",
                )
            )
    return checks


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
            Check("Device token", True, "accepted; no batch is at Preparation yet (start one)")
        )
    elif isinstance(batch, TokenRefused):
        checks.append(Check("Device token", False, batch.message))
    else:
        checks.append(Check("Device token", False, f"couldn't check it ({batch.reason})."))

    server_date = health.header("Date")
    if server_date:
        offset = (now() - parsedate_to_datetime(server_date)).total_seconds()
        direction = "ahead of" if offset > 0 else "behind"
        checks.append(
            Check("Clock", True, f"within {abs(offset):.0f} s of the app")
            if abs(offset) <= CLOCK_TOLERANCE_SECONDS
            else Check(
                "Clock",
                False,
                f"this computer is {abs(offset):.0f} s {direction} the app. The app refuses "
                "scans taken more than 5 minutes in its future; sync the clock (Windows: "
                "Settings > Time & language > Sync now).",
            )
        )
    return checks
