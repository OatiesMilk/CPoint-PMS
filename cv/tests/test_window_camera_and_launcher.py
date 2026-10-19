"""Camera search and drivers, the saved camera choice, the Capture/Stop trigger, and the launcher
(D-062, D-063). No OpenCV, Tk or Windows needed."""

from __future__ import annotations

import json
import subprocess
import threading
import time
from pathlib import Path
from typing import Any

import pytest
from fakes import FakeCapture, FakeCv2

from cpoint_cv.config import ConfigError, parse_config
from cpoint_cv.shortcut import LAUNCHER, create_shortcut, shortcut_script
from cpoint_cv.sources import open_capture
from cpoint_cv.triggers import ButtonTrigger
from cpoint_cv.window.cameras import find_cameras
from cpoint_cv.window.settings import (
    CameraChoice,
    has_credentials,
    load_choice,
    save_choice,
    validate_url,
)


class TestCameras:
    def test_lists_only_cameras_that_give_a_picture(self) -> None:
        cv2 = FakeCv2(
            {
                (0, "default"): FakeCapture(width=1280),
                (1, "default"): FakeCapture(frames=0),  # opens, but no picture
                (2, "default"): FakeCapture(width=1920),
            }
        )
        found = find_cameras("default", cv2, max_index=3)
        assert [o.label for o in found] == ["Camera 0 (1280 x 720)", "Camera 2 (1920 x 720)"]

    def test_directshow_opens_through_its_own_api(self) -> None:
        cv2 = FakeCv2({(1, "dshow"): FakeCapture()})
        assert [o.index for o in find_cameras("dshow", cv2, max_index=2)] == [1]
        assert all(api == FakeCv2.CAP_DSHOW for _d, api in cv2.opened)

    def test_every_probe_releases_the_camera(self) -> None:
        captures = {(i, "default"): FakeCapture() for i in range(3)}
        find_cameras("default", FakeCv2(captures), max_index=2)
        assert all(c.released for c in captures.values())

    def test_an_address_ignores_the_driver(self) -> None:
        cv2 = FakeCv2({})
        open_capture(cv2, "http://192.168.1.23:4747/video", "dshow")
        assert cv2.opened == [("http://192.168.1.23:4747/video", None)]

    def test_backend_is_a_setting(self, tmp_path: Path) -> None:
        base = {"model": {"path": "m.pt"}}
        assert parse_config(base, base_dir=tmp_path).camera.backend == "default"
        dshow = parse_config({**base, "camera": {"backend": "DShow"}}, base_dir=tmp_path)
        assert dshow.camera.backend == "dshow"
        with pytest.raises(ConfigError, match="DirectShow"):
            parse_config({**base, "camera": {"backend": "v4l2"}}, base_dir=tmp_path)

    def test_preview_size_and_rate_are_settings(self, tmp_path: Path) -> None:
        config = parse_config({"model": {"path": "m.pt"}}, base_dir=tmp_path)
        assert (config.window.preview_imgsz, config.window.preview_max_fps) == (960, 4.0)
        with pytest.raises(ConfigError, match="multiple of 32"):
            parse_config(
                {"model": {"path": "m.pt"}, "window": {"preview_imgsz": 1000}}, base_dir=tmp_path
            )


class TestSavedChoice:
    def test_round_trip(self, tmp_path: Path) -> None:
        path = tmp_path / "station-window.json"
        assert save_choice(CameraChoice(2, None, "dshow"), path) is None
        assert load_choice(CameraChoice(), path) == CameraChoice(2, None, "dshow")

    def test_an_address_is_saved(self, tmp_path: Path) -> None:
        path = tmp_path / "station-window.json"
        url = "http://192.168.1.23:4747/video"
        save_choice(CameraChoice(0, url, "default"), path)
        assert load_choice(CameraChoice(), path).url == url

    def test_a_password_is_never_saved(self, tmp_path: Path) -> None:
        path = tmp_path / "station-window.json"
        note = save_choice(CameraChoice(1, "rtsp://admin:secret@192.168.1.50/s1", "default"), path)
        assert note is not None and "CPOINT_CV_CAMERA_URL" in note
        text = path.read_text(encoding="utf-8")
        assert "secret" not in text and "admin" not in text
        assert json.loads(text) == {"backend": "default", "index": 1}

    def test_no_file_or_a_broken_one_falls_back_to_the_config(self, tmp_path: Path) -> None:
        fallback = CameraChoice(3, None, "dshow")
        assert load_choice(fallback, tmp_path / "none.json") == fallback
        (tmp_path / "bad.json").write_text("{not json", encoding="utf-8")
        assert load_choice(fallback, tmp_path / "bad.json") == fallback

    def test_addresses_are_checked(self) -> None:
        assert validate_url("http://192.168.1.23:4747/video") is None
        problem = validate_url("192.168.1.23:4747")
        assert problem is not None and "http://" in problem and "4747/video" in problem
        assert has_credentials("rtsp://user:pw@cam/1") and not has_credentials("http://cam/1")


class TestButtonTrigger:
    def test_capture_and_stop(self) -> None:
        trigger = ButtonTrigger(idle_seconds=0)
        trigger.press()
        trigger.stop()
        assert trigger.wait() is True
        assert trigger.wait() is False

    def test_checks_in_while_waiting(self) -> None:
        trigger = ButtonTrigger(idle_seconds=0.01)
        calls: list[float] = []

        def idle() -> None:
            calls.append(time.monotonic())
            if len(calls) == 2:
                trigger.press()

        assert trigger.wait(idle) is True
        assert len(calls) == 2

    def test_a_press_from_another_thread_wakes_it(self) -> None:
        trigger = ButtonTrigger(idle_seconds=0)
        threading.Timer(0.05, trigger.press).start()
        assert trigger.wait() is True


class TestLauncher:
    def test_the_launcher_explains_a_missing_venv(self) -> None:
        text = LAUNCHER.read_text(encoding="utf-8")
        assert 'if not exist ".venv\\Scripts\\pythonw.exe"' in text
        assert "cv\\.venv was not found" in text and "Set up the station" in text
        assert "MessageBox" in text  # shown, since the shortcut runs it minimized
        assert '".venv\\Scripts\\pythonw.exe" -m cpoint_cv window' in text

    def test_the_launcher_keeps_windows_line_endings(self) -> None:
        assert b"\r\n" in LAUNCHER.read_bytes()  # cmd.exe misreads labels with LF only

    def test_the_shortcut_script_quotes_paths(self) -> None:
        script = shortcut_script(Path("C:/Users/O'Brien/cv/CPoint Camera.cmd"))
        assert "'C:\\Users\\O''Brien\\cv\\CPoint Camera.cmd'" in script or "O''Brien" in script
        assert "WindowStyle = 7" in script and "GetFolderPath('Desktop')" in script

    def test_a_failed_shortcut_says_what_to_do(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr("sys.platform", "win32")
        launcher = tmp_path / "CPoint Camera.cmd"
        launcher.write_text("@echo off\r\n", encoding="utf-8")

        def fails(*_a: Any, **_k: Any) -> subprocess.CompletedProcess[str]:
            return subprocess.CompletedProcess([], 1, "", "Access is denied.\r\n")

        made, message = create_shortcut(launcher, fails)
        assert not made and "Access is denied." in message and "Double-click" in message

    def test_a_made_shortcut_says_where(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr("sys.platform", "win32")
        launcher = tmp_path / "CPoint Camera.cmd"
        launcher.write_text("@echo off\r\n", encoding="utf-8")

        def works(*_a: Any, **_k: Any) -> subprocess.CompletedProcess[str]:
            return subprocess.CompletedProcess(
                [], 0, "C:\\Users\\me\\Desktop\\CPoint Camera.lnk\n", ""
            )

        made, message = create_shortcut(launcher, works)
        assert made and "Desktop\\CPoint Camera.lnk" in message
