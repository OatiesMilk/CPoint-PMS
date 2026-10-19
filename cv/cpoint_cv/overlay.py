"""Overlay images for the team's review: each detection's mask outline and box with its label.

``draw_boxes`` is shared with the station window's live preview, so the preview shows the boxes
exactly as ``predict --save-overlay`` does. The colours are one per class, never the verdict
colours: a box is what the model saw, not the app's decision (D-060).
"""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .types import Detection, RawDetection

# Box colours (OpenCV's BGR order) chosen away from the verdict hues: no green (pass), orange
# (rework), red (reject) or blue (review), and no brand yellow. A class always gets the same one.
BOX_COLOURS = (
    (238, 211, 34),  # cyan
    (250, 139, 167),  # violet
    (252, 171, 240),  # pink-magenta
    (245, 245, 245),  # white
    (180, 180, 120),  # slate teal
    (200, 160, 255),  # rose
)
LABEL_BACKGROUND = (18, 24, 27)  # the ink token, so labels read on any leather


def _colour(key: str) -> tuple[int, int, int]:
    # Two classes may share a colour; the label always names the class. yolo-v1's four get four.
    digest = hashlib.sha256(key.encode()).digest()
    return BOX_COLOURS[int.from_bytes(digest) % len(BOX_COLOURS)]


def line_thickness(width: int, height: int) -> int:
    return max(2, round(min(width, height) / 400))


def draw_boxes(image: Any, detections: Sequence[Detection]) -> None:
    """Draws each detection's box and "class 0.87" label on an OpenCV image, in place."""
    import cv2

    h, w = image.shape[:2]
    thickness = line_thickness(w, h)
    for d in detections:
        colour = _colour(d.class_key)
        x0, y0 = int(d.box.x * w), int(d.box.y * h)
        x1, y1 = int((d.box.x + d.box.width) * w), int((d.box.y + d.box.height) * h)
        cv2.rectangle(image, (x0, y0), (x1, y1), colour, thickness)
        label = f"{d.class_key} {d.confidence:.2f}"
        scale = max(0.5, thickness / 3)
        (tw, th), base = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, scale, 1)
        top = y0 - th - base - 2 * thickness
        if top < 0:  # no room above the box: put the label just inside it
            top = y0
        cv2.rectangle(
            image,
            (x0, top),
            (x0 + tw + 4 * thickness, top + th + base + 2 * thickness),
            LABEL_BACKGROUND,
            -1,
        )
        cv2.putText(
            image,
            label,
            (x0 + 2 * thickness, top + th + thickness),
            cv2.FONT_HERSHEY_SIMPLEX,
            scale,
            colour,
            1,
            cv2.LINE_AA,
        )


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
    thickness = line_thickness(w, h)
    layer = image.copy()

    for d, raw in mapped:
        polygon = raw.polygon
        if polygon:
            points = np.array([[px * w, py * h] for px, py in polygon], dtype=np.int32)
            cv2.fillPoly(layer, [points], _colour(d.class_key))
    draw_boxes(image, [d for d, _ in mapped])
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
