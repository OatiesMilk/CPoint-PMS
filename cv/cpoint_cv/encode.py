"""Makes sure every image the station sends is one the app accepts: JPEG, PNG or WebP (checked by
its bytes, as the app does) and at most 10 MB. Anything else is re-encoded as JPEG, stepping the
quality down until it fits. OpenCV is imported only when re-encoding is needed."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

# The app's limit (MAX_IMAGE_BYTES in src/server/validators/scan.validator.ts).
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MIME = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}

Reencoder = Callable[[bytes, int], bytes]


class ImageError(ValueError):
    """The image can't be sent. The message says why."""


def sniff(data: bytes) -> str | None:
    """``jpg``, ``png`` or ``webp`` from the first bytes, like the app's image-type check."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def jpeg_qualities(start: int) -> list[int]:
    """``start``, then 10 lower each step, down to 50 at the least."""
    return [*range(start, 50, -10), 50] if start >= 50 else [start]


def sendable(data: bytes, *, quality: int, reencode: Reencoder | None = None) -> tuple[bytes, str]:
    """The bytes to send and their kind (``jpg``, ``png`` or ``webp``)."""
    kind = sniff(data)
    if kind and len(data) <= MAX_IMAGE_BYTES:
        return data, kind
    encoder = reencode or reencode_jpeg
    for q in jpeg_qualities(quality):
        out = encoder(data, q)
        if len(out) <= MAX_IMAGE_BYTES:
            return out, "jpg"
    raise ImageError(
        "the image is still larger than 10 MB as a JPEG at quality 50. Lower [camera] width and "
        "height in cv/config.toml."
    )


def reencode_jpeg(data: bytes, quality: int) -> bytes:
    import cv2
    import numpy as np

    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise ImageError("the file can't be read as an image.")
    return encode_jpeg(image, quality)


def encode_jpeg(image: Any, quality: int) -> bytes:
    """An OpenCV frame as JPEG bytes."""
    import cv2

    ok, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ImageError("OpenCV couldn't encode the frame as JPEG.")
    return bytes(buffer.tobytes())
