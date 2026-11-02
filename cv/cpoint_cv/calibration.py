"""Finding a sheet of known size in a photo, for the scale (Phase 30B). Imports OpenCV, so it is
only imported by the ``calibrate`` and ``measure`` commands, never by the tests' pure modules.

The sheet is the largest rectangle that stands out from the table: a white paper on a darker
table, or a dark leather piece on a lighter one. Both are tried on a few views of the photo (grey,
lightness, saturation); the winner is the largest blob that is nearly a rectangle and has the
sheet's shape. Its two sides in pixels against the sheet's two sides in inches give pixels per
inch. The phone looks straight down from its fixed height (C-24), so perspective is ignored.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .measure import MeasureError, Scale

#: Work on a copy this wide; the sides are scaled back to the full photo.
WORK_WIDTH = 1200
#: The blob's area ÷ its rectangle's area. A rough leather edge still clears this.
MIN_FILL = 0.85
#: The found long ÷ short side may differ from the sheet's by this much.
ASPECT_TOLERANCE = 0.08
#: Pixels (on the working copy) the sheet must keep from every edge of the frame.
EDGE_GAP = 3
#: The sheet covers between these shares of the frame.
MIN_SHARE, MAX_SHARE = 0.03, 0.92


class CalibrationError(MeasureError):
    """The sheet wasn't found. The message says how to retake the photo."""


@dataclass(frozen=True)
class SheetFound:
    image_width: int
    image_height: int
    long_px: float
    short_px: float
    px_per_in: float
    #: The rectangle's corners in full-size pixels, for the overlay.
    corners: tuple[tuple[float, float], ...]
    #: Found long ÷ short side against the sheet's.
    aspect_found: float
    aspect_sheet: float
    view: str

    @property
    def scale(self) -> Scale:
        return Scale.from_pixels(self.px_per_in, self.image_width, self.image_height)

    @property
    def width_in(self) -> float:
        return self.image_width / self.px_per_in


def _cv2() -> Any:
    try:
        import cv2
    except ImportError:
        raise CalibrationError(
            "OpenCV isn't installed. Run: pip install -r cv/requirements.txt"
        ) from None
    return cv2


def read_image(path: Path) -> Any:
    """The photo as OpenCV reads it, turned by its EXIF orientation as the model sees it."""
    cv2 = _cv2()
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise CalibrationError(f"{path} couldn't be read as an image.")
    return image


def image_size(path: Path) -> tuple[int, int]:
    """(width, height) after the EXIF turn."""
    height, width = read_image(path).shape[:2]
    return int(width), int(height)


def find_sheet(path: Path, sheet: tuple[float, float]) -> SheetFound:
    """The sheet of size ``sheet`` (short, long inches) in the photo at ``path``."""
    cv2 = _cv2()
    import numpy as np

    image = read_image(path)
    full_h, full_w = image.shape[:2]
    factor = min(1.0, WORK_WIDTH / full_w)
    small = cv2.resize(image, None, fx=factor, fy=factor, interpolation=cv2.INTER_AREA)
    h, w = small.shape[:2]
    frame_area = float(w * h)

    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB)
    views = {
        "grey": cv2.cvtColor(small, cv2.COLOR_BGR2GRAY),
        "lightness": lab[:, :, 0],
        "saturation": hsv[:, :, 1],
    }
    sheet_aspect = sheet[1] / sheet[0]
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 9))

    best: tuple[float, Any, str] | None = None
    for name, view in views.items():
        blurred = cv2.GaussianBlur(view, (7, 7), 0)
        _, bright = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        for polarity, mask in (("bright", bright), ("dark", cv2.bitwise_not(bright))):
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for contour in contours:
                area = float(cv2.contourArea(contour))
                if not MIN_SHARE * frame_area <= area <= MAX_SHARE * frame_area:
                    continue
                # The sheet has a gap at every edge; a shape that runs off the frame is the table.
                bx, by, bw, bh = cv2.boundingRect(contour)
                if (
                    bx <= EDGE_GAP
                    or by <= EDGE_GAP
                    or bx + bw >= w - EDGE_GAP
                    or by + bh >= h - EDGE_GAP
                ):
                    continue
                rect = cv2.minAreaRect(contour)
                rw, rh = rect[1]
                if rw <= 0 or rh <= 0 or area / (rw * rh) < MIN_FILL:
                    continue
                aspect = max(rw, rh) / min(rw, rh)
                if abs(aspect - sheet_aspect) / sheet_aspect > ASPECT_TOLERANCE:
                    continue
                if best is None or area > best[0]:
                    best = (area, rect, f"{name}, {polarity}")

    if best is None:
        raise CalibrationError(
            f"No sheet of {sheet[0]:g} x {sheet[1]:g} in was found in {path.name}. Lay it flat "
            "on the table, all of it in the frame with a gap at every edge, and nothing on top "
            "of it; then take the photo again."
        )
    _, rect, view_name = best
    rw, rh = rect[1]
    long_px, short_px = max(rw, rh) / factor, min(rw, rh) / factor
    px_per_in = (long_px / sheet[1] + short_px / sheet[0]) / 2
    corners = tuple(
        (float(x) / factor, float(y) / factor) for x, y in np.asarray(cv2.boxPoints(rect))
    )
    return SheetFound(
        image_width=int(full_w),
        image_height=int(full_h),
        long_px=long_px,
        short_px=short_px,
        px_per_in=px_per_in,
        corners=corners,
        aspect_found=long_px / short_px,
        aspect_sheet=sheet_aspect,
        view=view_name,
    )


def save_sheet_overlay(path: Path, found: SheetFound, out_dir: Path) -> Path:
    """The photo with the found sheet outlined and the scale written on it."""
    cv2 = _cv2()
    import numpy as np

    image = read_image(path)
    points = np.asarray(found.corners, dtype=np.int32).reshape((-1, 1, 2))
    thickness = max(4, image.shape[1] // 300)
    cv2.polylines(image, [points], True, (0, 200, 0), thickness)
    text = f"{found.px_per_in:.1f} px/in, width seen {found.width_in:.2f} in"
    cv2.putText(
        image,
        text,
        (40, 40 + thickness * 20),
        cv2.FONT_HERSHEY_SIMPLEX,
        thickness / 3,
        (0, 200, 0),
        thickness,
    )
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{path.stem}-sheet.jpg"
    cv2.imwrite(str(out), image)
    return out
