import math
from pathlib import Path

import pytest

from cpoint_cv.detector import FakeDetector
from cpoint_cv.mapper import MapperConfig
from cpoint_cv.measure import (
    DefectInput,
    MeasureError,
    RulerLength,
    Scale,
    is_long_cut,
    is_over_limit,
    load_roll_file,
    load_ruler,
    longest_span,
    match_ruler,
    measure_defect,
    measure_folder,
    measure_roll,
    measure_shot,
    parse_sheet_size,
    shoelace_area,
    to_markdown,
    union_area_polygons,
    union_area_rects,
)
from cpoint_cv.types import RawDetection

# A 20 x 15 in frame: 4000 x 3000 px at 200 px per inch.
SCALE = Scale(width_in=20.0, aspect=0.75)


def test_scale_from_pixels_and_inches() -> None:
    s = Scale.from_pixels(200, 4000, 3000)
    assert s.width_in == pytest.approx(20.0)
    assert s.height_in == pytest.approx(15.0)
    assert s.to_inches((0.5, 0.5)) == pytest.approx((10.0, 7.5))


def test_scale_refuses_zero() -> None:
    with pytest.raises(MeasureError, match="above 0 inches"):
        Scale(0, 1)
    with pytest.raises(MeasureError, match="Pixels per inch"):
        Scale.from_pixels(0, 10, 10)


def test_sheet_sizes() -> None:
    assert parse_sheet_size("A4") == (8.27, 11.69)
    assert parse_sheet_size("letter") == (8.5, 11.0)
    assert parse_sheet_size("11x8.5") == (8.5, 11.0)
    with pytest.raises(MeasureError, match=r"8\.5x11"):
        parse_sheet_size("legal-ish")


def test_shoelace_area_of_a_square_either_way_round() -> None:
    square = [(0.0, 0.0), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0)]
    assert shoelace_area(square) == pytest.approx(4.0)
    assert shoelace_area(list(reversed(square))) == pytest.approx(4.0)
    assert shoelace_area([(0.0, 0.0), (1.0, 1.0)]) == 0.0


def test_longest_span_is_the_far_corners() -> None:
    assert longest_span([(0.0, 0.0), (3.0, 0.0), (3.0, 4.0), (0.0, 4.0), (1.0, 1.0)]) == (
        pytest.approx(5.0)
    )


def test_a_defect_in_inches_by_box_and_outline() -> None:
    # A 3 x 0.3 in box at (2, 3) in, with a thin outline along its middle.
    outline = ((0.1, 0.2), (0.25, 0.2), (0.25, 0.22), (0.1, 0.22))
    d = DefectInput("cut", 0.9, 0.1, 0.2, 0.15, 0.02, outline)
    m = measure_defect(d, SCALE)
    assert (m.box_w_in, m.box_h_in) == pytest.approx((3.0, 0.3))
    assert m.diagonal_in == pytest.approx(math.hypot(3.0, 0.3))
    assert m.box_area_sq_in == pytest.approx(0.9)
    assert m.outline_area_sq_in == pytest.approx(0.9)
    assert m.span_in == pytest.approx(math.hypot(3.0, 0.3))
    assert not m.in_centre


def test_overlapping_boxes_count_once() -> None:
    a = (0.0, 0.0, 2.0, 2.0)
    b = (1.0, 1.0, 3.0, 3.0)
    assert union_area_rects([a, b]) == pytest.approx(7.0)
    assert union_area_rects([a, a]) == pytest.approx(4.0)
    assert union_area_rects([]) == 0.0


def test_overlapping_outlines_count_once() -> None:
    a = [(0.0, 0.0), (2.0, 0.0), (2.0, 2.0), (0.0, 2.0)]
    b = [(1.0, 1.0), (3.0, 1.0), (3.0, 3.0), (1.0, 3.0)]
    assert union_area_polygons([a, b]) == pytest.approx(7.0, abs=0.02)
    triangle = [(0.0, 0.0), (2.0, 0.0), (0.0, 2.0)]
    assert union_area_polygons([triangle]) == pytest.approx(2.0, abs=0.02)


def test_a_shot_without_outlines_uses_the_box() -> None:
    d1 = DefectInput("cut", 0.9, 0.0, 0.0, 0.1, 0.1)  # 2 x 1.5 in
    d2 = DefectInput("cut", 0.8, 0.05, 0.05, 0.1, 0.1)  # overlaps a quarter
    shot = measure_shot("a.jpg", [d1, d2], SCALE)
    assert shot.union_box_sq_in == pytest.approx(3.0 + 3.0 - 0.75)
    assert shot.union_outline_sq_in == pytest.approx(shot.union_box_sq_in, abs=0.03)


def test_ten_percent_is_strict() -> None:
    assert not is_over_limit(0.10)
    assert is_over_limit(0.1001)
    assert not is_over_limit(0.0999)


def test_the_three_inch_line() -> None:
    assert not is_long_cut(2.99)
    assert is_long_cut(3.00)
    assert is_long_cut(2.996)  # 3.00 to the hundredth
    assert not is_long_cut(2.5)


def test_roll_share_and_refused_area() -> None:
    # 14.4 sq in = 0.1 sq ft of defects on a 0.649 sq ft piece.
    shot = measure_shot("a.jpg", [DefectInput("cut", 0.9, 0.0, 0.0, 0.24, 0.08)], SCALE)
    assert shot.union_box_sq_in == pytest.approx(4.8 * 1.2)
    roll = measure_roll("LR-MLT-001", 0.649, [shot, shot])
    assert roll.defect_box_sq_ft == pytest.approx(2 * 5.76 / 144)
    assert roll.share_box == pytest.approx(0.08 / 0.649)
    for bad in (None, 0.0, -1.0):
        with pytest.raises(MeasureError, match="LR-MLT-001 has no area"):
            measure_roll("LR-MLT-001", bad, [shot])


def test_a_slanted_line_box_overstates_the_area() -> None:
    from cpoint_cv.measure import area_answer

    # A thin line from corner to corner of a 4 x 4 in box (0.2 x 0.2667 of the frame).
    line = ((0.1, 0.1), (0.102, 0.1), (0.302, 0.3667), (0.3, 0.3667))
    shot = measure_shot("a.jpg", [DefectInput("cut", 0.9, 0.1, 0.1, 0.202, 0.2667, line)], SCALE)
    roll = measure_roll("X", 0.649, [shot])
    assert roll.defect_box_sq_ft > 10 * roll.defect_outline_sq_ft
    assert is_over_limit(roll.share_box) and not is_over_limit(roll.share_outline)
    assert "Only the box puts this piece over 10%." in area_answer(roll)


def test_roll_toml(tmp_path: Path) -> None:
    (tmp_path / "roll.toml").write_text(
        'code = "LR-MLT-001"\narea_sq_ft = 0.649\ncalibrate_each = true\nsheet = "letter"\n',
        encoding="utf-8",
    )
    roll = load_roll_file(tmp_path)
    assert (roll.code, roll.area_sq_ft, roll.calibrate_each, roll.sheet) == (
        "LR-MLT-001",
        0.649,
        True,
        (8.5, 11.0),
    )
    (tmp_path / "roll.toml").write_text('code = "X"\narea_sq_ft = 0\nwidth_in = 18\n', "utf-8")
    with pytest.raises(MeasureError, match="area_sq_ft must be a number above 0"):
        load_roll_file(tmp_path)
    (tmp_path / "roll.toml").write_text('code = "X"\narea_sq_ft = 1\n', "utf-8")
    with pytest.raises(MeasureError, match="say how to get the scale"):
        load_roll_file(tmp_path)
    (tmp_path / "roll.toml").unlink()
    with pytest.raises(MeasureError, match="cv:roll-photos"):
        load_roll_file(tmp_path)


def test_calibration_photo_is_skipped_as_a_shot(tmp_path: Path) -> None:
    (tmp_path / "roll.toml").write_text(
        'code = "X"\narea_sq_ft = 1\ncalibration_photo = "sheet.jpg"\n', "utf-8"
    )
    assert "sheet.jpg" in load_roll_file(tmp_path).skip


def test_ruler_csv(tmp_path: Path) -> None:
    assert load_ruler(tmp_path) == []
    (tmp_path / "ruler.csv").write_text("photo,class,inches\na.jpg,cut,2.5\n", "utf-8")
    assert load_ruler(tmp_path) == [RulerLength("a.jpg", "cut", 2.5)]
    (tmp_path / "ruler.csv").write_text("photo,class,inches\na.jpg,cut,two\n", "utf-8")
    with pytest.raises(MeasureError, match="line 2: inches must be a number"):
        load_ruler(tmp_path)
    (tmp_path / "ruler.csv").write_text("photo,inches\na.jpg,2\n", "utf-8")
    with pytest.raises(MeasureError, match="missing: class"):
        load_ruler(tmp_path)


def test_ruler_match_prefers_the_class_and_flags_another() -> None:
    cut = DefectInput("cut", 0.9, 0.1, 0.1, 0.15, 0.01)  # 3 in long
    scratch = DefectInput("scratch", 0.9, 0.5, 0.5, 0.25, 0.01)  # 5 in long
    shot = measure_shot("a.jpg", [cut, scratch], SCALE)
    checks = match_ruler(
        [RulerLength("a.jpg", "cut", 2.9), RulerLength("a.jpg", "hole", 5)], [shot]
    )
    assert checks[0].defect is not None and checks[0].defect.class_key == "cut"
    assert checks[0].class_matches
    # 2.9 by the ruler, 3.0 by the box: the wrong side of the 3-inch line.
    assert checks[0].right_side(checks[0].defect.diagonal_in) is False
    assert checks[1].defect is not None and checks[1].defect.class_key == "scratch"
    assert not checks[1].class_matches
    nothing = match_ruler([RulerLength("b.jpg", "cut", 1)], [shot])
    assert nothing[0].defect is None and nothing[0].diagonal_error is None


def _folder(tmp_path: Path, extra: str = "width_in = 20\n") -> Path:
    (tmp_path / "roll.toml").write_text(
        f'code = "LR-MLT-001"\narea_sq_ft = 0.649\n{extra}', encoding="utf-8"
    )
    for name in ("cut-2.5in.jpg", "cut-3.5in.jpg"):
        (tmp_path / name).write_bytes(b"not read by the fake")
    (tmp_path / "ruler.csv").write_text(
        "photo,class,inches\ncut-2.5in.jpg,cut,2.5\ncut-3.5in.jpg,cut,3.5\n", "utf-8"
    )
    return tmp_path


def test_measure_folder_with_the_fake_detector(tmp_path: Path) -> None:
    # A cut 2.5 in along x (0.125 of 20 in), thin, in the middle of the frame, with an outline.
    poly = ((0.4375, 0.5), (0.5625, 0.5), (0.5625, 0.505), (0.4375, 0.505))
    # The box is taller than the line (0.3 in), so its diagonal overshoots and the span doesn't.
    raw = RawDetection(1, 0.8, 0.5, 0.5025, 0.125, 0.02, poly)
    detector = FakeDetector({0: "crease", 1: "cut"}, [raw])
    folder = _folder(tmp_path)
    # Only the first photo has a ruler length here (the fake gives both photos the same cut).
    (folder / "ruler.csv").write_text("photo,class,inches\ncut-2.5in.jpg,cut,2.5\n", "utf-8")
    result = measure_folder(
        folder,
        load_roll_file(folder),
        detector,
        MapperConfig(),
        size_of=lambda _: (4000, 3000),
        calibrate_photo=lambda *_: pytest.fail("width_in is set, so nothing is calibrated"),
    )
    assert len(detector.calls) == 2
    assert [c.width_in for c in result.calibrations] == [20.0, 20.0]
    [first] = result.checks
    assert first.defect is not None and first.defect.in_centre
    assert first.span_error == pytest.approx(0.0, abs=0.01)
    assert first.diagonal_error == pytest.approx(math.hypot(2.5, 0.3) - 2.5, abs=0.01)

    report = to_markdown(
        result.roll,
        result.checks,
        result.calibrations,
        date="2026-11-02",
        model_version="yolo-v1-test",
        settings_line="Test settings.",
        notes=result.notes,
    )
    assert "# Measuring defects: roll LR-MLT-001 (2026-11-02)" in report
    assert "| cut-2.5in.jpg | 2.50 | cut |" in report
    assert "The **outline** is closer to the ruler" in report
    assert "D-106" in report


def test_measure_folder_calibrates_each_shot(tmp_path: Path) -> None:
    folder = _folder(tmp_path, 'calibrate_each = true\nsheet = "letter"\n')
    seen: list[tuple[str, tuple[float, float]]] = []

    def calibrate(path: Path, sheet: tuple[float, float]) -> tuple[float, float]:
        seen.append((path.name, sheet))
        return (18.9, 160.0)

    result = measure_folder(
        folder,
        load_roll_file(folder),
        FakeDetector({0: "cut"}),
        MapperConfig(),
        size_of=lambda _: (3024, 4032),
        calibrate_photo=calibrate,
    )
    assert seen == [("cut-2.5in.jpg", (8.5, 11.0)), ("cut-3.5in.jpg", (8.5, 11.0))]
    assert all(c.source == "itself" for c in result.calibrations)
    assert all(c.defect is None for c in result.checks)
    report = to_markdown(
        result.roll,
        result.checks,
        result.calibrations,
        date="2026-11-02",
        model_version="m",
        settings_line="",
    )
    assert "nothing found" in report
    assert "can't say whether the box or the outline is closer" in report


def test_measure_folder_with_no_shots(tmp_path: Path) -> None:
    (tmp_path / "roll.toml").write_text('code = "X"\narea_sq_ft = 1\nwidth_in = 20\n', "utf-8")
    with pytest.raises(MeasureError, match="has no shots"):
        measure_folder(
            tmp_path,
            load_roll_file(tmp_path),
            FakeDetector({}),
            MapperConfig(),
            size_of=lambda _: (1, 1),
            calibrate_photo=lambda *_: (1.0, 1.0),
        )


def test_cli_parses_the_new_commands() -> None:
    from cpoint_cv.cli import build_parser

    args = build_parser().parse_args(["calibrate", "a.jpg", "--size", "letter"])
    assert args.size == "letter"
    args = build_parser().parse_args(["measure", "f", "--width-in", "18.9"])
    assert args.width_in == pytest.approx(18.9)
    assert build_parser().parse_args(["calibrate", "a.jpg"]).size == "a4"
