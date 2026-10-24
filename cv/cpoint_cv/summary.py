"""Per-folder numbers for ``predict``: detections per class, their confidence spread, and how many
images the app would pass or reject under the preview's settings. Pure."""

from __future__ import annotations

import statistics
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

from .preview import VERDICTS, PreviewDecision
from .types import Detection


@dataclass(frozen=True)
class ImageResult:
    name: str
    detections: list[Detection]
    preview: PreviewDecision
    inference_ms: float


@dataclass(frozen=True)
class ClassStats:
    key: str
    detections: int
    images: int
    min: float
    median: float
    max: float


@dataclass(frozen=True)
class Summary:
    images: int
    images_with_detections: int
    classes: list[ClassStats]
    verdicts: dict[str, int]
    ms_median: float
    ms_max: float


def summarize(results: Sequence[ImageResult]) -> Summary:
    confidences: dict[str, list[float]] = {}
    images_per_class: Counter[str] = Counter()
    for r in results:
        for d in r.detections:
            confidences.setdefault(d.class_key, []).append(d.confidence)
        images_per_class.update({d.class_key for d in r.detections})

    classes = [
        ClassStats(
            key=key,
            detections=len(values),
            images=images_per_class[key],
            min=min(values),
            median=round(statistics.median(values), 4),
            max=max(values),
        )
        for key, values in sorted(confidences.items(), key=lambda kv: (-len(kv[1]), kv[0]))
    ]
    counts = Counter(r.preview.verdict for r in results)
    times = [r.inference_ms for r in results]
    return Summary(
        images=len(results),
        images_with_detections=sum(1 for r in results if r.detections),
        classes=classes,
        verdicts={v: counts.get(v, 0) for v in VERDICTS},
        ms_median=round(statistics.median(times), 1) if times else 0.0,
        ms_max=round(max(times), 1) if times else 0.0,
    )


def to_markdown(summary: Summary, *, title: str, settings_line: str) -> str:
    lines = [
        f"# {title}",
        "",
        settings_line,
        "",
        f"Images: {summary.images}, with at least one detection: "
        f"{summary.images_with_detections}. Time per image: median {summary.ms_median} ms, "
        f"slowest {summary.ms_max} ms.",
        "",
        "## Detections per class",
        "",
        "| Class | Detections | Images | Lowest | Median | Highest |",
        "| --- | ---: | ---: | ---: | ---: | ---: |",
    ]
    lines += [
        f"| {c.key} | {c.detections} | {c.images} | {c.min:.2f} | {c.median:.2f} | {c.max:.2f} |"
        for c in summary.classes
    ] or ["| (none) | 0 | 0 | | | |"]
    lines += [
        "",
        "## Preview verdicts (what the app would decide; not the app's decision)",
        "",
        "| Verdict | Images |",
        "| --- | ---: |",
    ]
    lines += [f"| {v} | {n} |" for v, n in summary.verdicts.items()]
    return "\n".join(lines) + "\n"
