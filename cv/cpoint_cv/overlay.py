"""Overlay images for the team's review: each detection's mask outline and box with its label."""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from pathlib import Path

from .types import Detection, RawDetection


def _colour(key: str) -> tuple[int, int, int]:
    digest = hashlib.md5(key.encode(), usedforsecurity=False).digest()
    return (64 + digest[0] % 192, 64 + digest[1] % 192, 64 + digest[2] % 192)


def save_overlay(
    image_path: Path,
    mapped: Sequence[tuple[Detection, RawDetection]],
    out_dir: Path,
    caption: str,
) -> Path:
    """Draws what would be sent: each mapped detection's box and label, and its mask outline."""
    import cv2
    import numpy as np

    image = cv2.imread(str(image_path))
    if image is None:
        raise ValueError(f"{image_path.name} couldn't be read as an image.")
    h, w = image.shape[:2]
    thickness = max(2, round(min(w, h) / 400))
    layer = image.copy()

    for d, raw in mapped:
        colour = _colour(d.class_key)
        polygon = raw.polygon
        if polygon:
            points = np.array([[px * w, py * h] for px, py in polygon], dtype=np.int32)
            cv2.fillPoly(layer, [points], colour)
        x0, y0 = int(d.box.x * w), int(d.box.y * h)
        x1, y1 = int((d.box.x + d.box.width) * w), int((d.box.y + d.box.height) * h)
        cv2.rectangle(image, (x0, y0), (x1, y1), colour, thickness)
        label = f"{d.class_key} {d.confidence:.2f}"
        cv2.putText(
            image,
            label,
            (x0, max(y0 - 2 * thickness, 12 * thickness)),
            cv2.FONT_HERSHEY_SIMPLEX,
            thickness / 3,
            colour,
            thickness,
        )
    image = cv2.addWeighted(layer, 0.35, image, 0.65, 0)
    cv2.putText(
        image,
        caption,
        (12, 16 * thickness),
        cv2.FONT_HERSHEY_SIMPLEX,
        thickness / 3,
        (255, 255, 255),
        thickness,
    )

    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{image_path.stem}.overlay.jpg"
    cv2.imwrite(str(out), image)
    return out
