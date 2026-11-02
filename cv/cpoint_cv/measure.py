"""Measuring defects in inches (Phase 30B). Pure Python: no numpy or OpenCV, so CI runs the tests.

The scale comes from the width the phone sees across the frame, in inches (``width_in``), which
``calibrate`` reads off a sheet of known size. A detection's box and its mask outline are fractions
of the image, so with the image's height-to-width ratio they convert straight to inches.

Per defect: the box area and diagonal, the outline's area (shoelace) and longest span. Per shot:
the union of its defects, overlaps counted once (C-35), by box and by outline. Per roll: the sum of
the shots' unions over the roll's entered area (D-103), and whether that is more than 10% (strict,
C-9). A cut counts as long from 3 inches (C-37).
"""

from __future__ import annotations

import csv
import itertools
import math
import tomllib
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from pathlib import Path

from .detector import Detector
from .mapper import MapperConfig, map_with_sources
from .types import Point

SQ_IN_PER_SQ_FT = 144.0
#: A roll with more defect area than this share of its area is over the limit (C-9). Strict.
RETURN_SHARE = 0.10
#: A cut from this length is Not accepted (C-37).
LONG_CUT_IN = 3.0
#: Row height of the outline raster, in inches. 0.01 in is far finer than any mask edge.
RASTER_STEP_IN = 0.01

#: Known sheet sizes in inches (short side, long side).
SHEET_SIZES: dict[str, tuple[float, float]] = {
    "a4": (8.27, 11.69),
    "letter": (8.5, 11.0),
}


class MeasureError(ValueError):
    """A measuring input is wrong. The message names the file or value and the fix."""


# ───────────── Scale ─────────────


@dataclass(frozen=True)
class Scale:
    """Inches across the frame's width, and the frame's height ÷ width."""

    width_in: float
    aspect: float  # height / width of the image, e.g. 4032 / 3024

    def __post_init__(self) -> None:
        if not (self.width_in > 0 and math.isfinite(self.width_in)):
            raise MeasureError(
                f"The width the phone sees must be above 0 inches, not {self.width_in}."
            )
        if not (self.aspect > 0 and math.isfinite(self.aspect)):
            raise MeasureError(f"The image's height ÷ width must be above 0, not {self.aspect}.")

    @property
    def height_in(self) -> float:
        return self.width_in * self.aspect

    def to_inches(self, point: Point) -> Point:
        """A point in image fractions → inches from the top-left corner."""
        return (point[0] * self.width_in, point[1] * self.height_in)

    @staticmethod
    def from_pixels(px_per_in: float, image_width: int, image_height: int) -> Scale:
        if px_per_in <= 0:
            raise MeasureError(f"Pixels per inch must be above 0, not {px_per_in}.")
        if image_width <= 0 or image_height <= 0:
            raise MeasureError(f"The image size {image_width} x {image_height} isn't usable.")
        return Scale(image_width / px_per_in, image_height / image_width)


def parse_sheet_size(text: str) -> tuple[float, float]:
    """``a4``, ``letter`` or ``WxH`` in inches (``8.5x11``) → (short side, long side)."""
    key = text.strip().lower()
    if key in SHEET_SIZES:
        return SHEET_SIZES[key]
    parts = key.split("x")
    try:
        a, b = (float(p) for p in parts)
    except ValueError:
        raise MeasureError(
            f'The sheet size "{text}" isn\'t one we know. Write a4, letter, or the size in '
            "inches as WxH, for example 8.5x11."
        ) from None
    if a <= 0 or b <= 0:
        raise MeasureError(f'Both sides of the sheet size "{text}" must be above 0 inches.')
    return (min(a, b), max(a, b))


# ───────────── Geometry ─────────────


def shoelace_area(points: Sequence[Point]) -> float:
    """The area inside a closed outline (any orientation; the last point joins the first)."""
    if len(points) < 3:
        return 0.0
    total = 0.0
    for (x0, y0), (x1, y1) in zip(points, [*points[1:], points[0]], strict=True):
        total += x0 * y1 - x1 * y0
    return abs(total) / 2


def _cross(o: Point, a: Point, b: Point) -> float:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def convex_hull(points: Iterable[Point]) -> list[Point]:
    """Andrew's monotone chain; the hull's corners, counter-clockwise."""
    pts = sorted(set(points))
    if len(pts) <= 2:
        return pts
    lower: list[Point] = []
    for p in pts:
        while len(lower) >= 2 and _cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    upper: list[Point] = []
    for p in reversed(pts):
        while len(upper) >= 2 and _cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def longest_span(points: Sequence[Point]) -> float:
    """The largest distance between two points of an outline (its length along the defect)."""
    hull = convex_hull(points)
    best = 0.0
    for i, a in enumerate(hull):
        for b in hull[i + 1 :]:
            best = max(best, math.dist(a, b))
    return best


Rect = tuple[float, float, float, float]  # x0, y0, x1, y1


def union_area_rects(rects: Sequence[Rect]) -> float:
    """The area covered by rectangles, overlaps counted once (exact, by slicing at every edge)."""
    xs = sorted({x for r in rects for x in (r[0], r[2])})
    total = 0.0
    for left, right in itertools.pairwise(xs):
        spans = sorted((r[1], r[3]) for r in rects if r[0] <= left and r[2] >= right)
        covered, top, bottom = 0.0, -math.inf, -math.inf
        for y0, y1 in spans:
            if y0 > bottom:
                covered += max(0.0, bottom - top)
                top, bottom = y0, y1
            else:
                bottom = max(bottom, y1)
        covered += max(0.0, bottom - top)
        total += covered * (right - left)
    return total


def _row_intervals(polygon: Sequence[Point], y: float) -> list[tuple[float, float]]:
    """Where a horizontal line at ``y`` is inside the polygon (even-odd rule)."""
    xs: list[float] = []
    for (x0, y0), (x1, y1) in zip(polygon, [*polygon[1:], polygon[0]], strict=True):
        if (y0 <= y < y1) or (y1 <= y < y0):
            xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
    xs.sort()
    return [(xs[i], xs[i + 1]) for i in range(0, len(xs) - 1, 2)]


def union_area_polygons(polygons: Sequence[Sequence[Point]], step: float = RASTER_STEP_IN) -> float:
    """The area covered by outlines, overlaps counted once: rows ``step`` apart, exact along each
    row. With inches in and ``step`` 0.01 in, the error is far below a mask's own edge."""
    shapes = [p for p in polygons if len(p) >= 3]
    if not shapes:
        return 0.0
    top = min(y for p in shapes for _, y in p)
    bottom = max(y for p in shapes for _, y in p)
    total = 0.0
    y = top + step / 2
    while y < bottom:
        intervals = sorted(iv for p in shapes for iv in _row_intervals(p, y))
        covered, start, end = 0.0, -math.inf, -math.inf
        for a, b in intervals:
            if a > end:
                covered += max(0.0, end - start)
                start, end = a, b
            else:
                end = max(end, b)
        covered += max(0.0, end - start)
        total += covered * step
        y += step
    return total


# ───────────── Defects, shots, the roll ─────────────


@dataclass(frozen=True)
class DefectInput:
    """One detection as the model gave it, in image fractions: top-left box and optional outline."""

    class_key: str
    confidence: float
    x: float
    y: float
    width: float
    height: float
    polygon: tuple[Point, ...] | None = None


@dataclass(frozen=True)
class DefectMeasure:
    class_key: str
    confidence: float
    box_rect_in: Rect
    box_w_in: float
    box_h_in: float
    box_area_sq_in: float
    diagonal_in: float
    outline_in: tuple[Point, ...] | None
    outline_area_sq_in: float | None
    span_in: float | None
    centre: Point  # box centre, image fractions

    @property
    def in_centre(self) -> bool:
        """Whether the box's centre is in the middle third of the frame both ways."""
        return all(1 / 3 <= c <= 2 / 3 for c in self.centre)


def measure_defect(d: DefectInput, scale: Scale) -> DefectMeasure:
    x0, y0 = scale.to_inches((d.x, d.y))
    x1, y1 = scale.to_inches((d.x + d.width, d.y + d.height))
    w, h = x1 - x0, y1 - y0
    outline = tuple(scale.to_inches(p) for p in d.polygon) if d.polygon else None
    has_outline = outline is not None and len(outline) >= 3
    return DefectMeasure(
        class_key=d.class_key,
        confidence=d.confidence,
        box_rect_in=(x0, y0, x1, y1),
        box_w_in=w,
        box_h_in=h,
        box_area_sq_in=w * h,
        diagonal_in=math.hypot(w, h),
        outline_in=outline if has_outline else None,
        outline_area_sq_in=shoelace_area(outline) if outline and has_outline else None,
        span_in=longest_span(outline) if outline and has_outline else None,
        centre=(d.x + d.width / 2, d.y + d.height / 2),
    )


@dataclass(frozen=True)
class ShotMeasure:
    name: str
    scale: Scale
    defects: list[DefectMeasure]
    union_box_sq_in: float
    #: By outline; a defect with no outline counts by its box.
    union_outline_sq_in: float


def measure_shot(name: str, defects: Sequence[DefectInput], scale: Scale) -> ShotMeasure:
    measured = [measure_defect(d, scale) for d in defects]
    rects = [m.box_rect_in for m in measured]
    outlines: list[Sequence[Point]] = []
    for m in measured:
        if m.outline_in is not None:
            outlines.append(m.outline_in)
        else:
            x0, y0, x1, y1 = m.box_rect_in
            outlines.append(((x0, y0), (x1, y0), (x1, y1), (x0, y1)))
    return ShotMeasure(
        name=name,
        scale=scale,
        defects=measured,
        union_box_sq_in=union_area_rects(rects),
        union_outline_sq_in=union_area_polygons(outlines),
    )


def is_over_limit(share: float) -> bool:
    """More than 10% of the roll (C-9). Exactly 10% isn't over."""
    return round(share, 6) > RETURN_SHARE


def is_long_cut(length_in: float) -> bool:
    """3 inches or longer (C-37), to the hundredth: 2.99 isn't, 3.00 is."""
    return round(length_in, 2) >= LONG_CUT_IN


@dataclass(frozen=True)
class RollMeasure:
    code: str
    area_sq_ft: float
    shots: list[ShotMeasure]
    defect_box_sq_ft: float
    defect_outline_sq_ft: float

    @property
    def share_box(self) -> float:
        return self.defect_box_sq_ft / self.area_sq_ft

    @property
    def share_outline(self) -> float:
        return self.defect_outline_sq_ft / self.area_sq_ft


def measure_roll(code: str, area_sq_ft: float | None, shots: Sequence[ShotMeasure]) -> RollMeasure:
    if area_sq_ft is None or not math.isfinite(area_sq_ft) or area_sq_ft <= 0:
        raise MeasureError(
            f"Roll {code} has no area above 0 sq ft. Put area_sq_ft in its roll.toml "
            "(the area the Floor Manager entered in Inventory)."
        )
    return RollMeasure(
        code=code,
        area_sq_ft=area_sq_ft,
        shots=list(shots),
        defect_box_sq_ft=sum(s.union_box_sq_in for s in shots) / SQ_IN_PER_SQ_FT,
        defect_outline_sq_ft=sum(s.union_outline_sq_in for s in shots) / SQ_IN_PER_SQ_FT,
    )


# ───────────── roll.toml and ruler.csv ─────────────


@dataclass(frozen=True)
class RollFile:
    """``roll.toml`` beside the shots: the roll's code and entered area, and how to get the scale.

    The scale is one of: ``width_in`` (from ``calibrate``), ``calibration_photo`` (a photo of a
    sheet of ``sheet`` size, in this folder), or ``calibrate_each = true`` (every shot has the sheet
    or the piece of that size in it, and each shot is calibrated from itself).
    """

    code: str
    area_sq_ft: float
    width_in: float | None = None
    calibration_photo: Path | None = None
    calibrate_each: bool = False
    sheet: tuple[float, float] = SHEET_SIZES["a4"]
    skip: frozenset[str] = field(default_factory=frozenset)


def load_roll_file(folder: Path) -> RollFile:
    path = folder / "roll.toml"
    if not path.is_file():
        raise MeasureError(
            f"{path} wasn't found. Make it with npm run cv:roll-photos, or write code and "
            "area_sq_ft in it by hand (cv/README.md, Measure defects)."
        )
    try:
        data = tomllib.loads(path.read_text(encoding="utf-8"))
    except tomllib.TOMLDecodeError as error:
        raise MeasureError(f"{path} isn't valid TOML: {error}") from None

    code = data.get("code")
    if not isinstance(code, str) or not code.strip():
        raise MeasureError(f'{path}: write the roll\'s code, for example code = "LR-MLT-001".')
    area = data.get("area_sq_ft")
    if isinstance(area, bool) or not isinstance(area, int | float) or area <= 0:
        raise MeasureError(
            f"{path}: area_sq_ft must be a number above 0 (the roll's area in square feet), "
            f"not {area!r}."
        )
    width = data.get("width_in")
    if width is not None and (isinstance(width, bool) or not isinstance(width, int | float)):
        raise MeasureError(f"{path}: width_in must be a number of inches, not {width!r}.")
    photo = data.get("calibration_photo")
    if photo is not None and not isinstance(photo, str):
        raise MeasureError(f"{path}: calibration_photo must be a file name, not {photo!r}.")
    sheet_text = data.get("sheet", "a4")
    if not isinstance(sheet_text, str):
        raise MeasureError(f'{path}: sheet must be a4, letter or "WxH", not {sheet_text!r}.')
    skip = data.get("skip", [])
    if not isinstance(skip, list) or not all(isinstance(s, str) for s in skip):
        raise MeasureError(f"{path}: skip must be a list of file names.")
    each = bool(data.get("calibrate_each", False))
    if width is None and photo is None and not each:
        raise MeasureError(
            f"{path}: say how to get the scale. Write width_in (from python -m cpoint_cv "
            "calibrate), calibration_photo, or calibrate_each = true."
        )
    return RollFile(
        code=code.strip(),
        area_sq_ft=float(area),
        width_in=float(width) if width is not None else None,
        calibration_photo=folder / photo if photo else None,
        calibrate_each=each,
        sheet=parse_sheet_size(sheet_text),
        skip=frozenset([*skip, *([photo] if photo else [])]),
    )


@dataclass(frozen=True)
class RulerLength:
    photo: str
    class_key: str
    inches: float


def load_ruler(folder: Path) -> list[RulerLength]:
    """``ruler.csv`` (photo, class, inches): each defect's length by the ruler. Optional."""
    path = folder / "ruler.csv"
    if not path.is_file():
        return []
    rows: list[RulerLength] = []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = {"photo", "class", "inches"} - set(reader.fieldnames or [])
        if missing:
            raise MeasureError(
                f"{path} needs the columns photo, class, inches "
                f"(missing: {', '.join(sorted(missing))})."
            )
        for line, row in enumerate(reader, start=2):
            try:
                inches = float(row["inches"])
            except (TypeError, ValueError):
                raise MeasureError(
                    f'{path} line {line}: inches must be a number, not "{row["inches"]}".'
                ) from None
            if inches <= 0:
                raise MeasureError(f"{path} line {line}: inches must be above 0.")
            rows.append(RulerLength(row["photo"].strip(), row["class"].strip(), inches))
    return rows


# ───────────── Against the ruler ─────────────


@dataclass(frozen=True)
class RulerCheck:
    ruler: RulerLength
    defect: DefectMeasure | None
    class_matches: bool

    @property
    def diagonal_error(self) -> float | None:
        return None if self.defect is None else self.defect.diagonal_in - self.ruler.inches

    @property
    def span_error(self) -> float | None:
        if self.defect is None or self.defect.span_in is None:
            return None
        return self.defect.span_in - self.ruler.inches

    def right_side(self, length: float | None) -> bool | None:
        """Whether a measured length falls on the same side of the 3-inch line as the ruler's."""
        if length is None:
            return None
        return is_long_cut(length) == is_long_cut(self.ruler.inches)


def match_ruler(ruler: Sequence[RulerLength], shots: Sequence[ShotMeasure]) -> list[RulerCheck]:
    """Each ruler length against the longest defect of its class on its photo (any class when the
    model named it otherwise, flagged)."""
    by_name = {s.name: s for s in shots}
    checks: list[RulerCheck] = []
    for r in ruler:
        shot = by_name.get(r.photo)
        if shot is None or not shot.defects:
            checks.append(RulerCheck(r, None, False))
            continue
        same = [d for d in shot.defects if d.class_key == r.class_key]
        pool = same or shot.defects
        best = max(pool, key=lambda d: d.span_in if d.span_in is not None else d.diagonal_in)
        checks.append(RulerCheck(r, best, bool(same)))
    return checks


def mean_abs(values: Iterable[float | None]) -> float | None:
    found = [abs(v) for v in values if v is not None]
    return sum(found) / len(found) if found else None


# ───────────── One folder ─────────────


@dataclass(frozen=True)
class FolderResult:
    roll: RollMeasure
    checks: list[RulerCheck]
    calibrations: list[Calibration]
    notes: list[str]


def measure_folder(
    folder: Path,
    roll_file: RollFile,
    detector: Detector,
    mapper: MapperConfig,
    *,
    size_of: Callable[[Path], tuple[int, int]],
    calibrate_photo: Callable[[Path, tuple[float, float]], tuple[float, float]],
) -> FolderResult:
    """Runs the model on the folder's shots and measures them.

    ``size_of`` gives an image's (width, height) as the model sees it; ``calibrate_photo`` gives
    (width seen in inches, pixels per inch) for a photo with the sheet in it. Both are passed in so
    the tests need no OpenCV.
    """
    from .sources import collect_images

    shots_paths = [p for p in collect_images([folder]) if p.name not in roll_file.skip]
    if not shots_paths:
        raise MeasureError(f"{folder} has no shots (jpg, jpeg, png, webp or bmp) to measure.")

    fixed: tuple[float, float | None, str] | None = None
    if roll_file.width_in is not None:
        fixed = (roll_file.width_in, None, "width_in")
    elif roll_file.calibration_photo is not None:
        if not roll_file.calibration_photo.is_file():
            raise MeasureError(f"The calibration photo {roll_file.calibration_photo} wasn't found.")
        sheet_width, sheet_ppi = calibrate_photo(roll_file.calibration_photo, roll_file.sheet)
        fixed = (sheet_width, sheet_ppi, roll_file.calibration_photo.name)

    shots: list[ShotMeasure] = []
    calibrations: list[Calibration] = []
    notes: list[str] = []
    for path in shots_paths:
        w, h = size_of(path)
        ppi: float | None
        if fixed is not None:
            width_in, ppi, source = fixed
        else:
            width_in, ppi = calibrate_photo(path, roll_file.sheet)
            source = "itself"
        scale = Scale(width_in, h / w)
        calibrations.append(Calibration(path.name, source, width_in, ppi))
        output = detector.detect(path)
        defects = [
            DefectInput(
                class_key=d.class_key,
                confidence=d.confidence,
                x=d.box.x,
                y=d.box.y,
                width=d.box.width,
                height=d.box.height,
                polygon=raw.polygon,
            )
            for d, raw in map_with_sources(output.detections, detector.names, mapper)
        ]
        if defects and all(d.polygon is None for d in defects):
            notes.append(f"{path.name}: the model gave boxes only, so the outline uses the box.")
        shots.append(measure_shot(path.name, defects, scale))

    ruler = load_ruler(folder)
    unknown = sorted({r.photo for r in ruler} - {s.name for s in shots})
    if unknown:
        notes.append(f"ruler.csv names photos that aren't among the shots: {', '.join(unknown)}.")
    roll = measure_roll(roll_file.code, roll_file.area_sq_ft, shots)
    return FolderResult(roll, match_ruler(ruler, shots), calibrations, notes)


# ───────────── The report ─────────────


def _f(value: float | None, digits: int = 2) -> str:
    return "—" if value is None else f"{value:.{digits}f}"


def _signed(value: float | None) -> str:
    return "—" if value is None else f"{value:+.2f}"


def _yes(value: bool | None) -> str:
    return "—" if value is None else ("yes" if value else "**no**")


@dataclass(frozen=True)
class Calibration:
    """How a shot's scale was found, for the report."""

    shot: str
    source: str  # "width_in", a photo name, or "itself"
    width_in: float
    px_per_in: float | None = None
    note: str = ""


def recommendation(checks: Sequence[RulerCheck]) -> str:
    box = mean_abs(c.diagonal_error for c in checks)
    outline = mean_abs(c.span_error for c in checks)
    if box is None and outline is None:
        return (
            "No defect was matched to a ruler length, so this run can't say whether the box or "
            "the outline is closer. Photos with real cuts the model finds are needed."
        )
    if outline is None:
        return (
            f"Only boxes were available (no outlines): the box diagonal is off by {box:.2f} in on "
            "average."
        )
    if box is None:
        return f"Only outlines were available: off by {outline:.2f} in on average."
    closer = "outline" if outline < box else "box"
    return (
        f"The **{closer}** is closer to the ruler: the outline's longest span is off by "
        f"{outline:.2f} in on average, the box diagonal by {box:.2f} in."
    )


def area_answer(roll: RollMeasure) -> str:
    """How much more the boxes count than the outlines. A thin or slanted defect's box is mostly
    clean leather, so the box overstates the area the 10% rule reads."""
    if roll.defect_outline_sq_ft <= 0:
        return "no defect area, so box and outline can't be compared."
    times = roll.defect_box_sq_ft / roll.defect_outline_sq_ft
    over = (
        " Only the box puts this piece over 10%."
        if is_over_limit(roll.share_box) and not is_over_limit(roll.share_outline)
        else ""
    )
    return (
        f"the boxes cover {times:.1f} times the outlines' area. A thin or slanted defect's box is "
        f"mostly clean leather, so the share reads higher by box (D-106 measures by box: watch "
        f"slanted cuts).{over}"
    )


def to_markdown(
    roll: RollMeasure,
    checks: Sequence[RulerCheck],
    calibrations: Sequence[Calibration],
    *,
    date: str,
    model_version: str,
    settings_line: str,
    notes: Sequence[str] = (),
) -> str:
    lines = [
        f"# Measuring defects: roll {roll.code} ({date})",
        "",
        f"Model `{model_version}`. {settings_line}",
        "",
        "Phase 30B check. D-106: defects are measured by the box (length = its diagonal, area = "
        "each shot's union of boxes). Lengths in inches, areas in square inches "
        "unless said. Box = the detection's box (its diagonal is the length); outline = the mask "
        "outline (its longest span is the length). Overlapping defects on one shot are counted "
        "once (C-35).",
        "",
    ]
    if notes:
        lines += ["## Notes", "", *[f"- {n}" for n in notes], ""]

    lines += [
        "## Scale",
        "",
        "| Shot | From | Width seen (in) | Pixels per inch | Note |",
        "| --- | --- | ---: | ---: | --- |",
    ]
    for cal in calibrations:
        lines.append(
            f"| {cal.shot} | {cal.source} | {cal.width_in:.2f} | {_f(cal.px_per_in, 1)} | "
            f"{cal.note} |"
        )

    lines += [
        "",
        "## Defects found",
        "",
        "| Shot | Class | Conf. | Box w x h | Diagonal | Box area | Outline area | Span | Where |",
        "| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |",
    ]
    for s in roll.shots:
        for d in s.defects:
            lines.append(
                f"| {s.name} | {d.class_key} | {d.confidence:.2f} | {d.box_w_in:.2f} x "
                f"{d.box_h_in:.2f} | {d.diagonal_in:.2f} | {d.box_area_sq_in:.2f} | "
                f"{_f(d.outline_area_sq_in)} | {_f(d.span_in)} | "
                f"{'centre' if d.in_centre else 'edge'} |"
            )
        if not s.defects:
            lines.append(f"| {s.name} | nothing found | | | | | | | |")
    if not roll.shots:
        lines.append("| (no shots) | | | | | | | | |")

    lines += ["", "## Against the ruler", ""]
    if checks:
        lines += [
            "| Shot | Ruler | Matched | Diagonal | Off | Span | Off | 3-inch side (box) | "
            "3-inch side (outline) |",
            "| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |",
        ]
        for c in checks:
            m = c.defect
            matched = (
                "nothing found"
                if m is None
                else (
                    m.class_key
                    if c.class_matches
                    else f"{m.class_key} (ruler says {c.ruler.class_key})"
                )
            )
            lines.append(
                f"| {c.ruler.photo} | {c.ruler.inches:.2f} | {matched} | "
                f"{_f(m.diagonal_in if m else None)} | {_signed(c.diagonal_error)} | "
                f"{_f(m.span_in if m else None)} | {_signed(c.span_error)} | "
                f"{_yes(c.right_side(m.diagonal_in if m else None))} | "
                f"{_yes(c.right_side(m.span_in if m else None))} |"
            )
    else:
        lines.append("No ruler.csv beside the shots, so nothing to compare.")

    centre = [c for c in checks if c.defect is not None and c.defect.in_centre]
    edge = [c for c in checks if c.defect is not None and not c.defect.in_centre]

    def where(group: Sequence[RulerCheck]) -> str:
        if not group:
            return "none"
        return (
            f"{len(group)}: box off {_f(mean_abs(c.diagonal_error for c in group))}, "
            f"outline off {_f(mean_abs(c.span_error for c in group))} on average"
        )

    long_line = [c for c in checks if c.defect is not None]
    holds_box = all(c.right_side(c.defect.diagonal_in if c.defect else None) for c in long_line)
    holds_outline = all(
        c.right_side(c.defect.span_in if c.defect else None) is not False for c in long_line
    )

    lines += [
        "",
        "## Per shot and the roll",
        "",
        "| Shot | Defects | Union by box | Union by outline |",
        "| --- | ---: | ---: | ---: |",
        *[
            f"| {s.name} | {len(s.defects)} | {s.union_box_sq_in:.2f} | "
            f"{s.union_outline_sq_in:.2f} |"
            for s in roll.shots
        ],
        "",
        f"Roll {roll.code}: area {roll.area_sq_ft:.3f} sq ft (entered). Defect area "
        f"{roll.defect_box_sq_ft:.4f} sq ft by box, {roll.defect_outline_sq_ft:.4f} sq ft by "
        f"outline: **{roll.share_box:.1%}** by box, **{roll.share_outline:.1%}** by outline. "
        "Over 10% (Return to supplier, C-9): "
        f"by box {'yes' if is_over_limit(roll.share_box) else 'no'}, "
        f"by outline {'yes' if is_over_limit(roll.share_outline) else 'no'}.",
        "",
        "## Answers",
        "",
        f"- Box or outline: {recommendation(checks)}",
        f"- Centre and edges: centre {where(centre)}; edges {where(edge)}.",
        "- The 3-inch line (C-37): "
        + (
            "no defect was matched, so it isn't tested."
            if not long_line
            else (
                f"by box it {'holds' if holds_box else 'does not hold'}, by outline it "
                f"{'holds' if holds_outline else 'does not hold'}, on "
                f"{len(long_line)} matched defect(s)."
            )
        ),
        f"- The share on this piece: {roll.share_box:.1%} by box, {roll.share_outline:.1%} by "
        "outline.",
        f"- Area: {area_answer(roll)}",
        "",
        "This changes nothing in the app. The outline is shown for comparison only (D-106).",
        "",
    ]
    return "\n".join(lines)
