"""``python -m cpoint_cv window`` (or the CPoint Camera shortcut): opens the station window.

It runs under ``pythonw`` from the shortcut, which has no console, so a failure at start is written
to ``cv/out/logs/window-error.log`` and shown in a message box instead of vanishing (D-063).
"""

from __future__ import annotations

import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import Any

from ..config import CV_DIR, Config, ConfigError, load_config
from ..env import station_env
from .settings import CameraChoice, load_choice

ERROR_LOG = CV_DIR / "out" / "logs" / "window-error.log"


def _dpi_aware() -> None:
    """Sharp text on a scaled (125 %, 150 %) Windows screen."""
    if sys.platform != "win32":
        return
    try:
        import ctypes

        ctypes.windll.shcore.SetProcessDpiAwareness(2)  # per monitor
    except (AttributeError, OSError):
        pass


def _log_error(text: str) -> Path | None:
    try:
        ERROR_LOG.parent.mkdir(parents=True, exist_ok=True)
        with ERROR_LOG.open("a", encoding="utf-8") as f:
            f.write(f"--- {datetime.now().astimezone().isoformat(timespec='seconds')}\n{text}\n")
        return ERROR_LOG
    except OSError:
        return None


def _show_error(message: str) -> None:
    print(message, file=sys.stderr)
    try:
        import tkinter as tk
        from tkinter import messagebox

        root = tk.Tk()
        root.withdraw()
        messagebox.showerror("CPoint Camera", message, parent=root)
        root.destroy()
    except Exception:  # no display, or Tk itself is broken: the log has it
        pass


def _run_deps() -> Any:
    """The real camera, model and app client. Imported only when Start is pressed."""
    from ..cli import make_client
    from ..model_info import model_version, sha256_file
    from ..sources import open_capture
    from ..yolo_detector import YoloDetector
    from .workers import RunDeps

    def opener(choice: CameraChoice) -> Any:
        import cv2

        return lambda: open_capture(cv2, choice.device, choice.backend)

    def detector(config: Config) -> YoloDetector:
        return YoloDetector(config.model, config.mapper.confidence_floor)

    def version(config: Config) -> str:
        return model_version(config.model.name, sha256_file(config.model.path))

    return RunDeps(detector=detector, client=make_client, opener=opener, model_version=version)


def main(config_path: Path | None = None) -> int:
    try:
        import tkinter as tk
    except ImportError:
        _show_error(
            "Tkinter isn't available in this Python. Install Python 3.13 from python.org (it "
            "includes Tkinter), then recreate cv/.venv (cv/README.md, Set up the station)."
        )
        return 2

    _dpi_aware()
    env = station_env()
    try:
        fallback = CameraChoice.from_config(load_config(config_path, env).camera)
    except ConfigError:
        fallback = CameraChoice()  # "Check this machine" shows the config problem
    choice = load_choice(fallback)

    from .view import StationWindow

    root = tk.Tk()

    def report_callback_exception(*info: Any) -> None:
        text = "".join(traceback.format_exception(*info))
        where = _log_error(text)
        window.presenter.note(
            f"Something went wrong in the window: {info[1]}. Details are in {where or 'the log'}."
        )
        window.refresh()

    window = StationWindow(
        root, config_path=config_path, env=env, choice=choice, run_deps=_run_deps
    )
    root.report_callback_exception = report_callback_exception
    root.mainloop()
    return 0


def safe_main(config_path: Path | None = None) -> int:
    """``main``, with any failure at start logged and shown, since pythonw has no console."""
    try:
        return main(config_path)
    except Exception as error:
        where = _log_error(traceback.format_exc())
        _show_error(
            f"The CPoint Camera window couldn't start: {error}\n\n"
            f"Details are in {where or 'the console'}. Run python -m cpoint_cv doctor in cv/ "
            "to see what's missing."
        )
        return 1
