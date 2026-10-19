"""Finds the camera numbers that actually give a picture, with the driver chosen in the window.

OpenCV can't read a camera's name without another dependency, so each one is listed by number
and picture size ("Camera 1 (1920 x 1080)"). DroidCam's Windows client usually shows as the
highest number.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from ..sources import open_capture

# Laptops have one or two cameras; DroidCam and OBS add one each. Each empty number costs a
# moment to try, so the search stops here.
MAX_INDEX = 5


@dataclass(frozen=True)
class CameraOption:
    index: int
    width: int
    height: int

    @property
    def label(self) -> str:
        return f"Camera {self.index} ({self.width} x {self.height})"


def find_cameras(
    backend: str,
    cv2: Any | None = None,
    max_index: int = MAX_INDEX,
    stopped: Callable[[], bool] = lambda: False,
) -> list[CameraOption]:
    """Every camera from 0 to ``max_index`` that opens and gives one frame."""
    if cv2 is None:
        import cv2 as real_cv2

        cv2 = real_cv2
    found: list[CameraOption] = []
    for index in range(max_index + 1):
        if stopped():
            break
        camera = open_capture(cv2, index, backend)
        try:
            if not camera.isOpened():
                continue
            ok, frame = camera.read()
            if not ok or frame is None:
                continue
            height, width = frame.shape[:2]
            found.append(CameraOption(index, int(width), int(height)))
        finally:
            camera.release()
    return found
