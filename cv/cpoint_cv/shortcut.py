"""``python -m cpoint_cv shortcut``: puts a "CPoint Camera" shortcut on this PC's desktop (D-063).

The shortcut opens ``cv/CPoint Camera.cmd`` minimized, so no console flashes; the launcher checks
the setup and starts the window with ``pythonw``. Windows' own shortcut maker does the work through
PowerShell, so nothing new is installed.
"""

from __future__ import annotations

import subprocess
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

from .config import CV_DIR

LAUNCHER = CV_DIR / "CPoint Camera.cmd"
SHORTCUT_NAME = "CPoint Camera.lnk"
MINIMIZED = 7  # WshShortcut.WindowStyle


def _quoted(text: str) -> str:
    """A PowerShell single-quoted string."""
    return "'" + text.replace("'", "''") + "'"


def shortcut_script(launcher: Path = LAUNCHER) -> str:
    """PowerShell that makes the shortcut on the user's desktop (OneDrive's, if it moved there)
    and prints its path."""
    return "; ".join(
        [
            "$desktop = [Environment]::GetFolderPath('Desktop')",
            f"$path = Join-Path $desktop {_quoted(SHORTCUT_NAME)}",
            "$link = (New-Object -ComObject WScript.Shell).CreateShortcut($path)",
            f"$link.TargetPath = {_quoted(str(launcher))}",
            f"$link.WorkingDirectory = {_quoted(str(launcher.parent))}",
            f"$link.WindowStyle = {MINIMIZED}",
            "$link.Description = 'CPoint camera station: live preview, Capture and Stop'",
            "$link.Save()",
            "Write-Output $path",
        ]
    )


Runner = Callable[..., Any]


def create_shortcut(launcher: Path = LAUNCHER, run: Runner = subprocess.run) -> tuple[bool, str]:
    """(made, message). The message says where it is, or what went wrong and what to do."""
    if sys.platform != "win32":
        return (
            False,
            "The desktop shortcut is for Windows. Elsewhere, run: python -m cpoint_cv window",
        )
    if not launcher.is_file():
        return False, f"{launcher} wasn't found. Get it back from git (git checkout -- cv)."
    try:
        result = run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", shortcut_script(launcher)],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return (
            False,
            f"Windows couldn't make the shortcut ({error}). Double-click {launcher} instead.",
        )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "no details").strip().splitlines()[0]
        return (
            False,
            f"Windows couldn't make the shortcut ({detail}). Double-click {launcher} instead.",
        )
    where = (result.stdout or "").strip() or f"your desktop ({SHORTCUT_NAME})"
    return (
        True,
        f"Made the shortcut: {where}. Double-click CPoint Camera to open the station window.",
    )
