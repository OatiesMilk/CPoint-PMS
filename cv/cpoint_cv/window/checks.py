"""The window's "Check this machine" (D-061): every ``doctor`` check, the GPU and the chosen camera.

A failed check blocks Start, because the station can't work until it's fixed: the config, the
model file, Python and missing packages, the camera, the app, the device token, or a clock so far
ahead the app refuses its scans. A warning never blocks: no GPU (the window runs on the CPU), a
package version other than the pinned one, no batch at Preparation yet, a clock a little off.
"""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from pathlib import Path

from ..client import ScanClient
from ..config import Config, ConfigError, load_config
from ..doctor import (
    Check,
    GpuInfo,
    check_app,
    check_camera,
    check_gpu,
    check_model,
    check_python,
    probe_gpu,
)
from ..sources import camera_name, probe_camera
from .settings import CameraChoice

DRIVER_NAMES = {"default": "default driver", "dshow": "DirectShow"}


def describe_camera(choice: CameraChoice) -> str:
    """How the window names the camera: "Camera 1 (DirectShow)", or an address without its
    password."""
    name = camera_name(choice.device)
    if isinstance(choice.device, int):
        name = f"Camera {choice.device} ({DRIVER_NAMES.get(choice.backend, choice.backend)})"
    return name


@dataclass(frozen=True)
class CheckReport:
    checks: tuple[Check, ...]
    config: Config | None
    # The device the model will run on: [model] device, or "cpu" when that GPU isn't there.
    device: str = "cpu"

    @property
    def blocked(self) -> bool:
        return any(not c.ok for c in self.checks)

    @property
    def failures(self) -> int:
        return sum(1 for c in self.checks if not c.ok)

    @property
    def warnings(self) -> int:
        return sum(1 for c in self.checks if c.status == "warn")

    def summary(self) -> str:
        if self.blocked:
            failed = [c for c in self.checks if not c.ok]
            if len(failed) == 1:
                check = failed[0]
                return f"{check.name} failed: {check.detail} Start stays off until it passes."
            names = ", ".join(c.name for c in failed)
            return (
                f"{len(failed)} checks failed ({names}). Fix them from the top of the Checks list, "
                "then check again. Start stays off until they pass."
            )
        if self.warnings:
            return f"Ready to start. Read the {self.warnings} warning(s): it works, but slower."
        return "Ready to start. Everything the station needs is in place."

    def config_for_run(self) -> Config | None:
        """The config with the device the checks settled on."""
        if self.config is None:
            return None
        return replace(self.config, model=replace(self.config.model, device=self.device))


@dataclass
class CheckDeps:
    """What the checks call; tests swap these for fakes."""

    load: Callable[[Path | None, Mapping[str, str]], Config] = load_config
    gpu: Callable[[], GpuInfo | None] = probe_gpu
    camera: Callable[[int | str, str], str | None] = probe_camera
    python: Callable[[], list[Check]] = check_python
    client: Callable[[Config, Mapping[str, str]], ScanClient | None] | None = None


def run_checks(
    config_path: Path | None,
    env: Mapping[str, str],
    choice: CameraChoice,
    deps: CheckDeps | None = None,
) -> CheckReport:
    deps = deps or CheckDeps()
    try:
        config = deps.load(config_path, env)
    except ConfigError as error:
        return CheckReport((Check("Config", False, str(error)),), None)

    if deps.client is None:
        from ..cli import make_client

        deps.client = make_client

    checks: list[Check] = [
        Check("Config", True, str(config.source_file or "cv/config.toml")),
        check_model(config),
        *deps.python(),
    ]
    info = deps.gpu()
    checks.append(check_gpu(config.model.device, lambda: info, cpu_fallback=True))
    device = config.model.device
    if device != "cpu" and not (info and info.available):
        device = "cpu"

    camera = check_camera(choice.device, lambda d: deps.camera(d, choice.backend))
    if camera.ok:
        camera = replace(camera, detail=f"{describe_camera(choice)} gives a picture")
    checks.append(camera)
    checks += check_app(deps.client(config, env))
    return CheckReport(tuple(checks), config, device)
