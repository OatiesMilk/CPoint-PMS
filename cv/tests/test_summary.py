from pathlib import Path

import pytest

from cpoint_cv.cli import collect_images
from cpoint_cv.preview import PreviewDecision
from cpoint_cv.summary import ImageResult, summarize, to_markdown
from cpoint_cv.types import Box, Detection

BOX = Box(0.1, 0.1, 0.1, 0.1)


def result(name: str, verdict: str, *dets: tuple[str, float], ms: float = 10.0) -> ImageResult:
    return ImageResult(
        name, [Detection(k, c, BOX) for k, c in dets], PreviewDecision(verdict, None, (), ()), ms
    )


def test_counts_per_class_and_verdict() -> None:
    s = summarize(
        [
            result("a.jpg", "NEEDS_REVIEW", ("crease", 0.4), ("crease", 0.6), ("cut", 0.7)),
            result("b.jpg", "REWORK", ("cut", 0.65), ms=30.0),
            result("c.jpg", "PASS", ms=20.0),
        ]
    )
    assert (s.images, s.images_with_detections) == (3, 2)
    crease, cut = s.classes
    assert (crease.key, crease.detections, crease.images) == ("crease", 2, 1)
    assert (crease.min, crease.median, crease.max) == (0.4, 0.5, 0.6)
    assert (cut.key, cut.detections, cut.images) == ("cut", 2, 2)
    assert s.verdicts == {"PASS": 1, "REWORK": 1, "REJECT": 0, "NEEDS_REVIEW": 1}
    assert (s.ms_median, s.ms_max) == (20.0, 30.0)
    md = to_markdown(s, title="Baseline", settings_line="Settings.")
    assert "| crease | 2 | 1 | 0.40 | 0.50 | 0.60 |" in md
    assert "| NEEDS_REVIEW | 1 |" in md


def test_an_empty_run() -> None:
    s = summarize([])
    assert (s.images, s.classes, s.ms_median) == (0, [], 0.0)
    assert "| (none) |" in to_markdown(s, title="t", settings_line="s")


def test_collect_images_from_files_and_folders(tmp_path: Path) -> None:
    for name in ("b.JPG", "a.png", "notes.txt", "c.webp"):
        (tmp_path / name).write_bytes(b"x")
    (tmp_path / "sub").mkdir()
    (tmp_path / "sub" / "d.jpg").write_bytes(b"x")
    found = collect_images([tmp_path, tmp_path / "sub" / "d.jpg"])
    assert [p.name for p in found] == ["a.png", "b.JPG", "c.webp", "d.jpg"]
    with pytest.raises(FileNotFoundError, match="isn't a file or folder"):
        collect_images([tmp_path / "missing"])
