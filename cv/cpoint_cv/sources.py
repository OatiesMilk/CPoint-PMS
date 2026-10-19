"""Frame sources: where each leather section's picture comes from.

- ``WebcamSource``: one frame per trigger from an OpenCV camera, never a stream;
- ``FolderSource``: every image in a folder, in name order, so a demo runs on real photos;
- ``FileSource``: one image, for debugging.

Only ``WebcamSource`` imports OpenCV, when it opens the camera.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
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


class WebcamSource:
    def __init__(
        self, index: int, width: int, height: int, *, warmup_frames: int, jpeg_quality: int
    ) -> None:
        try:
            import cv2
        except ImportError:
            raise SourceError(
                "OpenCV isn't installed. Run: pip install -r cv/requirements.txt"
            ) from None
        self._cv2: Any = cv2
        self._index = index
        self._quality = jpeg_quality
        self._count = 0
        self._camera: Any = cv2.VideoCapture(index)
        if not self._camera.isOpened():
            raise SourceError(
                f"Camera {index} couldn't be opened. Check it's plugged in and not in use by "
                "another app (Camera, Teams, Zoom), or change [camera] index in cv/config.toml."
            )
        self._camera.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self._camera.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        for _ in range(warmup_frames):  # let exposure and white balance settle
            self._camera.read()
        w = int(self._camera.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self._camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.description = f"webcam {index} at {w} x {h}"

    def capture(self) -> Frame | None:
        # Drop frames the driver buffered while waiting, so the picture is from the trigger.
        for _ in range(2):
            self._camera.grab()
        ok, image = self._camera.read()
        if not ok or image is None:
            raise SourceError(
                f"Camera {self._index} stopped giving frames. Check the cable, then restart."
            )
        self._count += 1
        return Frame(encode_jpeg(image, self._quality), f"webcam {self._index} #{self._count}")

    def remaining(self) -> int | None:
        return None

    def close(self) -> None:
        self._camera.release()


def probe_camera(index: int) -> str | None:
    """For ``doctor``: None when the camera opens and gives a frame, else what's wrong."""
    try:
        import cv2
    except ImportError:
        return "OpenCV isn't installed. Run: pip install -r cv/requirements.txt"
    camera: Any = cv2.VideoCapture(index)
    try:
        if not camera.isOpened():
            return (
                f"Camera {index} couldn't be opened. Check it's plugged in and not in use by "
                "another app, or change [camera] index in cv/config.toml."
            )
        ok, _ = camera.read()
        return None if ok else f"Camera {index} opened but gave no picture."
    finally:
        camera.release()
