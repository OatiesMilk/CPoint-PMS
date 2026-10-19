import pytest

from cpoint_cv.mapper import MapperConfig, class_key_for, iou, map_detections, to_box
from cpoint_cv.types import Box, RawDetection

NAMES = {0: "crease", 1: "cut", 2: "hole", 3: "scratch"}


def raw(
    index: int, conf: float, cx: float = 0.5, cy: float = 0.5, w: float = 0.1, h: float = 0.1
) -> RawDetection:
    return RawDetection(class_index=index, confidence=conf, cx=cx, cy=cy, w=w, h=h)


def test_centre_box_becomes_top_left() -> None:
    assert to_box(0.5, 0.4, 0.2, 0.1) == Box(x=0.4, y=0.35, width=0.2, height=0.1)


@pytest.mark.parametrize(
    ("cx", "cy", "w", "h", "expected"),
    [
        (0.02, 0.5, 0.1, 0.1, Box(x=0.0, y=0.45, width=0.07, height=0.1)),  # left edge
        (0.98, 0.5, 0.1, 0.1, Box(x=0.93, y=0.45, width=0.07, height=0.1)),  # right edge
        (0.5, 0.01, 0.1, 0.1, Box(x=0.45, y=0.0, width=0.1, height=0.06)),  # top edge
        (0.5, 0.99, 0.1, 0.1, Box(x=0.45, y=0.94, width=0.1, height=0.06)),  # bottom edge
        (0.5, 0.5, 1.4, 1.2, Box(x=0.0, y=0.0, width=1.0, height=1.0)),  # bigger than the image
    ],
)
def test_boxes_are_clipped_to_the_image(
    cx: float, cy: float, w: float, h: float, expected: Box
) -> None:
    assert to_box(cx, cy, w, h) == expected


def test_rounding_never_pushes_a_box_past_the_far_edge() -> None:
    # Each of these lands within a rounding step of the right and bottom edges.
    for cx in (0.987654, 0.99995, 0.123456 + 0.876544 / 2):
        box = to_box(cx, cx, 0.3, 0.3)
        assert box is not None
        assert box.x + box.width <= 1 + 1e-9
        assert box.y + box.height <= 1 + 1e-9


def test_a_box_entirely_outside_the_image_is_dropped() -> None:
    assert to_box(1.2, 0.5, 0.1, 0.1) is None
    assert to_box(0.5, 0.5, 0.0, 0.1) is None


def test_class_keys_come_from_the_models_names_then_the_rename() -> None:
    assert class_key_for(0, NAMES, {}) == "crease"
    assert class_key_for(0, NAMES, {"crease": "wrinkle"}) == "wrinkle"
    assert class_key_for(1, NAMES, {"crease": "wrinkle"}) == "cut"


def test_an_index_the_model_doesnt_name_stays_visible_as_unknown() -> None:
    assert class_key_for(7, NAMES, {}) == "class_7"


def test_floor_drops_noise_and_keeps_the_boundary() -> None:
    out = map_detections(
        [raw(1, 0.25), raw(2, 0.2499), raw(3, 0.9)], NAMES, MapperConfig(confidence_floor=0.25)
    )
    assert [(d.class_key, d.confidence) for d in out] == [("scratch", 0.9), ("cut", 0.25)]


def test_sorted_by_confidence_and_capped() -> None:
    many = [raw(1, 0.3 + i / 100) for i in range(60)]
    out = map_detections(
        many, NAMES, MapperConfig(confidence_floor=0.0, max_detections=50, overlap_iou=0)
    )
    assert len(out) == 50
    assert out[0].confidence == pytest.approx(0.89)
    assert [d.confidence for d in out] == sorted((d.confidence for d in out), reverse=True)
    assert min(d.confidence for d in out) == pytest.approx(0.4)  # the weakest ten were dropped


def test_confidence_and_box_are_rounded_to_four_decimals() -> None:
    (d,) = map_detections(
        [raw(2, 0.876543, cx=0.333333, cy=0.666667, w=0.111111, h=0.222222)],
        NAMES,
        MapperConfig(),
    )
    assert d.confidence == 0.8765
    assert d.box == Box(x=0.2778, y=0.5556, width=0.1111, height=0.2222)


def test_nothing_found_is_an_empty_list() -> None:
    assert map_detections([], NAMES, MapperConfig()) == []
    assert map_detections([raw(1, 0.1)], NAMES, MapperConfig()) == []


# ───────────── the overlap filter (one defect reported twice) ─────────────


def test_drops_a_same_class_copy_of_a_box_and_keeps_the_stronger() -> None:
    raw = [
        RawDetection(3, 0.60, cx=0.50, cy=0.50, w=0.20, h=0.10),
        RawDetection(3, 0.63, cx=0.51, cy=0.50, w=0.20, h=0.10),
        RawDetection(1, 0.55, cx=0.50, cy=0.50, w=0.20, h=0.10),  # a cut in the same place stays
    ]
    out = map_detections(raw, NAMES, MapperConfig())
    assert [(d.class_key, d.confidence) for d in out] == [("scratch", 0.63), ("cut", 0.55)]


def test_keeps_separate_boxes_of_one_class_and_can_be_turned_off() -> None:
    raw = [
        RawDetection(3, 0.60, cx=0.2, cy=0.2, w=0.1, h=0.1),
        RawDetection(3, 0.63, cx=0.7, cy=0.7, w=0.1, h=0.1),
    ]
    assert len(map_detections(raw, NAMES, MapperConfig())) == 2
    twice = [RawDetection(3, 0.6, cx=0.5, cy=0.5, w=0.2, h=0.1)] * 2
    assert len(map_detections(twice, NAMES, MapperConfig(overlap_iou=0))) == 2
    assert len(map_detections(twice, NAMES, MapperConfig())) == 1


def test_iou() -> None:
    a = Box(0.0, 0.0, 0.2, 0.2)
    assert iou(a, a) == 1.0
    assert iou(a, Box(0.5, 0.5, 0.1, 0.1)) == 0.0
    assert round(iou(a, Box(0.1, 0.0, 0.2, 0.2)), 4) == round(0.02 / 0.06, 4)
