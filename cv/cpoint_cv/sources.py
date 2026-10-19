"""Frame sources: where each leather section's picture comes from.

- ``WebcamSource``: one frame per trigger from an OpenCV camera, never a stream;
- ``FolderSource``: every image in a folder, in name order, so a demo runs on real photos;
- ``FileSource``: one image, for debugging.

Only ``WebcamSource`` imports OpenCV, when it opens the camera.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Protocol

from .encode import encode_jpeg

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


class SourceError(RuntimeError):
    """The source can't give frames. The message says what to check."""


@dataclass(frozen=True)
class Frame:
    data: bytes
    label: str  # shown in the console and the log: the file name, or "webcam 0 #12"
    # When the picture was taken, if the source knows better than "now" (the window's Capture
    # press). The scan's capturedAt.
    taken_at: datetime | None = None


class FrameSource(Protocol):
    description: str

    def capture(self) -> Frame | None:
        """The next frame, or None when there are no more (folder or file finished)."""
        ...

    def remaining(self) -> int | None:
        """Frames left, or None when there is no end (a camera)."""
        ...

    def close(self) -> None: ...


def collect_images(paths: Sequence[Path]) -> list[Path]:
    """Images named directly, plus every image in a named folder (not its subfolders), sorted."""
    images: list[Path] = []
    for path in paths:
        if path.is_dir():
            images += sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
        elif path.is_file():
            images.append(path)
        else:
            raise FileNotFoundError(f"{path} isn't a file or folder.")
    return images


class FolderSource:
    def __init__(self, folder: Path) -> None:
        if not folder.is_dir():
            raise SourceError(f"{folder} isn't a folder. Give the folder of leather photos.")
        self._images = collect_images([folder])
        if not self._images:
            raise SourceError(f"{folder} has no images (jpg, jpeg, png, webp or bmp).")
        self._next = 0
        self.description = f"folder {folder} ({len(self._images)} images, in name order)"

    def capture(self) -> Frame | None:
        if self._next >= len(self._images):
            return None
        image = self._images[self._next]
        self._next += 1
        return Frame(image.read_bytes(), image.name)

    def remaining(self) -> int | None:
        return len(self._images) - self._next

    def close(self) -> None:
        pass


class FileSource:
    def __init__(self, image: Path) -> None:
        if not image.is_file():
            raise SourceError(f"{image} wasn't found. Give the path of one image.")
        self._image: Path | None = image
        self.description = f"file {image.name}"

    def capture(self) -> Frame | None:
        image, self._image = self._image, None
        return Frame(image.read_bytes(), image.name) if image else None

    def remaining(self) -> int | None:
        return 1 if self._image else 0

    def close(self) -> None:
        pass


def camera_name(device: int | str) -> str:
    """How a camera is shown in the console and logs: "camera 0", or an IP camera's address
    without the user name and password it may carry."""
    if isinstance(device, int):
        return f"camera {device}"
    return "IP camera " + re.sub(r"//[^/@]*@", "//", device)


def _upper_first(text: str) -> str:
    return text[:1].upper() + text[1:]


def open_capture(cv2: Any, device: int | str, backend: str = "default") -> Any:
    """``cv2.VideoCapture`` for a camera number or an address. ``backend = "dshow"`` opens a
    numbered camera through DirectShow, which some virtual cameras (DroidCam, OBS) need; an
    address always goes through OpenCV's default (FFmpeg) reader."""
    if isinstance(device, int) and backend == "dshow":
        return cv2.VideoCapture(device, cv2.CAP_DSHOW)
    return cv2.VideoCapture(device)


def _open_problem(device: int | str, backend: str = "default") -> str:
    if isinstance(device, int):
        other = "DirectShow" if backend == "default" else "the default driver"
        return (
            f"Camera {device} couldn't be opened. Check it's plugged in and not in use by "
            "another app (Camera, Teams, Zoom), or change [camera] index in cv/config.toml. "
            f"A virtual camera such as DroidCam may need {other} ([camera] backend)."
        )
    return (
        f"{camera_name(device)} couldn't be opened. Check the PC can reach it on the network, "
        "and the address, user name and password in [camera] url (or CPOINT_CV_CAMERA_URL). "
        "A phone app such as DroidCam serves one viewer at a time: close the DroidCam Windows "
        "client and any browser tab showing the camera."
    )


class WebcamSource:
    """A camera on the PC (a number) or an IP camera on the network (an rtsp:// or http://
    address); OpenCV opens both the same way."""

    def __init__(
        self,
        device: int | str,
        width: int,
        height: int,
        *,
        warmup_frames: int,
        jpeg_quality: int,
        backend: str = "default",
    ) -> None:
        try:
            import cv2
        except ImportError:
            raise SourceError(
                "OpenCV isn't installed. Run: pip install -r cv/requirements.txt"
            ) from None
        self._cv2: Any = cv2
        self._name = camera_name(device)
        self._quality = jpeg_quality
        self._count = 0
        self._camera: Any = open_capture(cv2, device, backend)
        if not self._camera.isOpened():
            raise SourceError(_open_problem(device, backend))
        self._camera.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self._camera.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        for _ in range(warmup_frames):  # let exposure and white balance settle
            self._camera.read()
        w = int(self._camera.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self._camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.description = f"{self._name} at {w} x {h}"

    def capture(self) -> Frame | None:
        # Drop frames the driver buffered while waiting, so the picture is from the trigger.
        for _ in range(2):
            self._camera.grab()
        ok, image = self._camera.read()
        if not ok or image is None:
            raise SourceError(
                f"{_upper_first(self._name)} stopped giving frames. Check the cable "
                "or the network, then restart."
            )
        self._count += 1
        return Frame(encode_jpeg(image, self._quality), f"{self._name} #{self._count}")

    def remaining(self) -> int | None:
        return None

    def close(self) -> None:
        self._camera.release()


def probe_camera(device: int | str, backend: str = "default") -> str | None:
    """For ``doctor``: None when the camera opens and gives a frame, else what's wrong."""
    try:
        import cv2
    except ImportError:
        return "OpenCV isn't installed. Run: pip install -r cv/requirements.txt"
    camera: Any = open_capture(cv2, device, backend)
    try:
        if not camera.isOpened():
            return _open_problem(device, backend)
        ok, _ = camera.read()
        return None if ok else f"{_upper_first(camera_name(device))} opened but gave no picture."
    finally:
        camera.release()
