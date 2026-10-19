"""The window's last camera choice, in ``cv/station-window.json`` (git-ignored, D-062).

The window never edits ``cv/config.toml``: that file stays the team's. It saves only which camera
to open (a number or an address) and the driver. An address with a user name or password is never
saved here; it belongs in ``cv/.env`` as ``CPOINT_CV_CAMERA_URL``, which the station already reads.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from ..config import CAMERA_BACKENDS, CV_DIR, CameraConfig

SETTINGS_FILE = CV_DIR / "station-window.json"
_CREDENTIALS = re.compile(r"//[^/@]*@")


def has_credentials(url: str) -> bool:
    """True when an address carries ``user:password@`` (or ``user@``)."""
    return bool(_CREDENTIALS.search(url))


@dataclass(frozen=True)
class CameraChoice:
    """A numbered camera, or an address (rtsp://, http://, https://) used instead of it."""

    index: int = 0
    url: str | None = None
    backend: str = "default"

    @property
    def device(self) -> int | str:
        return self.url or self.index

    @classmethod
    def from_config(cls, camera: CameraConfig) -> CameraChoice:
        return cls(index=camera.index, url=camera.url, backend=camera.backend)


def validate_url(url: str) -> str | None:
    """None when the address can be opened, else what to change."""
    if not url.lower().startswith(("rtsp://", "http://", "https://")):
        return (
            "The camera address must start with http://, https:// or rtsp://. For DroidCam on "
            "an iPhone it looks like http://192.168.1.23:4747/video (DroidCam shows the IP)."
        )
    return None


def load_choice(fallback: CameraChoice, path: Path = SETTINGS_FILE) -> CameraChoice:
    """The saved choice, or ``fallback`` (from the config) when there is none or it's unreadable.

    A password-carrying address from the config (or ``cv/.env``) is kept as the fallback's: only
    the saved file never holds one."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return fallback
    if not isinstance(data, dict):
        return fallback
    backend = data.get("backend")
    if backend not in CAMERA_BACKENDS:
        backend = fallback.backend
    url = data.get("url")
    if isinstance(url, str) and url.strip() and validate_url(url.strip()) is None:
        return CameraChoice(index=fallback.index, url=url.strip(), backend=backend)
    index = data.get("index")
    if isinstance(index, int) and not isinstance(index, bool) and 0 <= index <= 99:
        return CameraChoice(index=index, url=None, backend=backend)
    return CameraChoice(index=fallback.index, url=fallback.url, backend=backend)


def save_choice(choice: CameraChoice, path: Path = SETTINGS_FILE) -> str | None:
    """Saves the choice for next time. Returns a note when the address wasn't saved because it
    holds a password; the camera is still used for this run."""
    note = None
    data: dict[str, object] = {"backend": choice.backend}
    if choice.url and has_credentials(choice.url):
        note = (
            "This camera address holds a user name or password, so it isn't saved. To open it "
            "every time, put CPOINT_CV_CAMERA_URL=<the address> in cv/.env."
        )
        data["index"] = choice.index
    elif choice.url:
        data["url"] = choice.url
    else:
        data["index"] = choice.index
    try:
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    except OSError as error:
        return f"Your camera choice couldn't be saved for next time ({error})."
    return note
