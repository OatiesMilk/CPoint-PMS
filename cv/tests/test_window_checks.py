"""Check this machine (D-061): which checks block Start, the GPU fallback and the camera line."""

from __future__ import annotations

from collections.abc import Mapping
from email.utils import formatdate
from pathlib import Path

from fakes import TOKEN, FakeTransport, batch_ok, no_batch, reply

from cpoint_cv.client import ScanClient
from cpoint_cv.config import Config, ConfigError, parse_config
from cpoint_cv.doctor import Check, GpuInfo
from cpoint_cv.model_info import sha256_file
from cpoint_cv.window.checks import CheckDeps, describe_camera, run_checks
from cpoint_cv.window.settings import CameraChoice

RTX = GpuInfo("2.6.0+cu124", "12.4", True, "NVIDIA GeForce RTX 3060 Laptop GPU")
NO_GPU = GpuInfo("2.6.0+cu124", "12.4", False, None)


def config(tmp_path: Path, device: str = "cuda:0") -> Config:
    (tmp_path / "m.pt").write_bytes(b"weights")
    sha = sha256_file(tmp_path / "m.pt")
    return parse_config(
        {"model": {"path": "m.pt", "sha256": sha, "device": device}}, base_dir=tmp_path
    )


def deps(
    cfg: Config,
    *,
    gpu: GpuInfo | None = RTX,
    camera: str | None = None,
    batch: bool = True,
) -> tuple[CheckDeps, list[tuple[int | str, str]]]:
    probed: list[tuple[int | str, str]] = []

    def probe(device: int | str, backend: str) -> str | None:
        probed.append((device, backend))
        return camera

    def client(_c: Config, _env: Mapping[str, str]) -> ScanClient:
        t = FakeTransport(
            health=[reply(200, {"status": "ok"}, {"Date": formatdate(usegmt=True)})],
            current=[batch_ok()] if batch else [no_batch()],
        )
        return ScanClient("http://localhost:3000", TOKEN, t, sleep=lambda _s: None)

    return (
        CheckDeps(
            load=lambda _p, _e: cfg,
            gpu=lambda: gpu,
            camera=probe,
            python=lambda: [Check("Python", True, "3.13.5")],
            client=client,
        ),
        probed,
    )


def names(checks: tuple[Check, ...]) -> list[str]:
    return [c.name for c in checks]


def test_everything_in_place(tmp_path: Path) -> None:
    d, probed = deps(config(tmp_path))
    result = run_checks(None, {}, CameraChoice(1, None, "dshow"), d)
    assert not result.blocked and result.device == "cuda:0"
    assert names(result.checks) == [
        "Config",
        "Model file",
        "Python",
        "GPU",
        "Camera",
        "App",
        "Device token",
        "Clock",
    ]
    assert all(c.status == "ok" for c in result.checks), result.checks
    assert probed == [(1, "dshow")]  # the chosen camera with the chosen driver
    camera = next(c for c in result.checks if c.name == "Camera")
    assert camera.detail == "Camera 1 (DirectShow) gives a picture"


def test_no_gpu_runs_on_the_cpu_with_a_warning(tmp_path: Path) -> None:
    d, _ = deps(config(tmp_path), gpu=NO_GPU)
    result = run_checks(None, {}, CameraChoice(), d)
    gpu = next(c for c in result.checks if c.name == "GPU")
    assert gpu.status == "warn" and "on the CPU instead" in gpu.detail
    assert result.device == "cpu" and not result.blocked
    run_config = result.config_for_run()
    assert run_config is not None and run_config.model.device == "cpu"


def test_a_camera_without_a_picture_blocks_start(tmp_path: Path) -> None:
    d, _ = deps(config(tmp_path), camera="Camera 3 couldn't be opened.")
    result = run_checks(None, {}, CameraChoice(3), d)
    assert result.blocked
    assert "Start stays off" in result.summary()


def test_no_batch_is_only_a_warning(tmp_path: Path) -> None:
    d, _ = deps(config(tmp_path), batch=False)
    result = run_checks(None, {}, CameraChoice(), d)
    token = next(c for c in result.checks if c.name == "Device token")
    assert token.status == "warn" and not result.blocked


def test_a_missing_model_blocks_start(tmp_path: Path) -> None:
    cfg = parse_config({"model": {"path": "none.pt"}}, base_dir=tmp_path)
    d, _ = deps(cfg)
    result = run_checks(None, {}, CameraChoice(), d)
    model = next(c for c in result.checks if c.name == "Model file")
    assert result.blocked and model.status == "fail" and "cv/models/" in model.detail


def test_a_broken_config_is_one_failing_line(tmp_path: Path) -> None:
    def broken(_p: Path | None, _e: Mapping[str, str]) -> Config:
        raise ConfigError('[camera] backend must be "default" or "dshow" (DirectShow).')

    d, _ = deps(config(tmp_path))
    d.load = broken
    result = run_checks(None, {}, CameraChoice(), d)
    assert result.blocked and names(result.checks) == ["Config"]
    assert result.config_for_run() is None


def test_an_address_is_named_without_its_password() -> None:
    choice = CameraChoice(url="rtsp://admin:secret@192.168.1.50:554/stream1")
    assert describe_camera(choice) == "IP camera rtsp://192.168.1.50:554/stream1"
    assert "secret" not in describe_camera(choice)
