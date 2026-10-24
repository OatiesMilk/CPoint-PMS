"""``evaluate``: compare the model's preview verdicts with what a person expected, per photo.

The expected results live in ``labels.csv`` beside the photos::

    file,expected_verdict,classes
    IMG_6742.jpg,REJECT,cut;scratch
    IMG_6750.jpg,PASS,

``expected_verdict`` is PASS or REJECT (D-093); ``classes`` lists the defect types a person sees on
the photo (separated by ``;``, empty when it's clean). The report shows a verdict table, per-class
precision and recall by photo, and how the verdicts shift as the found-at value moves. It changes
nothing in the app: Settings stay what the admin sets. Pure, apart from ``run_cases``, which calls
the detector.
"""

from __future__ import annotations

import csv
import io
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, replace
from pathlib import Path

from .detector import Detector
from .mapper import MapperConfig, map_detections
from .preview import VERDICTS, PreviewConfig, preview_verdict
from .types import Detection

LABELS_FILE = "labels.csv"
# The verdicts before Phase 25 and what they became (Fixable → Pass, Needs review → Reject).
RETIRED_VERDICTS = {"REWORK": "PASS", "NEEDS_REVIEW": "REJECT"}
SWEEP = (0.5, 0.6, 0.7, 0.8, 0.9)
# Photos up to this many make the report a small check, said in its first line.
SMALL_CHECK = 30


class LabelError(ValueError):
    """labels.csv is missing, malformed or names a photo that isn't there. Says which row."""


@dataclass(frozen=True)
class Label:
    file: str
    expected: str
    classes: frozenset[str]


@dataclass(frozen=True)
class Case:
    label: Label
    detections: list[Detection]
    inference_ms: float


def parse_labels(text: str) -> list[Label]:
    rows = list(csv.DictReader(io.StringIO(text.lstrip("﻿"))))
    if not rows:
        raise LabelError(
            f"{LABELS_FILE} has no rows. Its first line is file,expected_verdict,classes, then "
            "one line per photo."
        )
    missing = {"file", "expected_verdict"} - set(rows[0].keys())
    if missing:
        raise LabelError(
            f"{LABELS_FILE} needs the columns file,expected_verdict,classes; "
            f"{', '.join(sorted(missing))} is missing from the first line."
        )
    labels: list[Label] = []
    seen: set[str] = set()
    for line, row in enumerate(rows, start=2):
        file = (row.get("file") or "").strip()
        expected = (row.get("expected_verdict") or "").strip().upper()
        if not file:
            raise LabelError(f"{LABELS_FILE} line {line}: the file name is empty.")
        if file in seen:
            raise LabelError(f"{LABELS_FILE} line {line}: {file} is listed twice.")
        if expected in RETIRED_VERDICTS:
            raise LabelError(
                f"{LABELS_FILE} line {line}: {expected} for {file} is no longer a verdict (D-093). "
                f"Write {RETIRED_VERDICTS[expected]} instead: a section is PASS or REJECT."
            )
        if expected not in VERDICTS:
            raise LabelError(
                f"{LABELS_FILE} line {line}: expected_verdict for {file} must be one of "
                f"{', '.join(VERDICTS)}; got {expected or 'nothing'}."
            )
        classes = frozenset(c.strip() for c in (row.get("classes") or "").split(";") if c.strip())
        seen.add(file)
        labels.append(Label(file, expected, classes))
    return labels


def load_labels(folder: Path, labels_file: Path | None = None) -> list[Label]:
    path = labels_file or folder / LABELS_FILE
    if not path.is_file():
        raise LabelError(
            f"{path} wasn't found. Put a {LABELS_FILE} beside the photos (see cv/README.md, "
            '"Small model check").'
        )
    labels = parse_labels(path.read_text(encoding="utf-8"))
    absent = [label.file for label in labels if not (folder / label.file).is_file()]
    if absent:
        raise LabelError(
            f"{LABELS_FILE} lists photos that aren't in {folder}: {', '.join(absent)}."
        )
    return labels


def run_cases(
    folder: Path, labels: Sequence[Label], detector: Detector, mapper: MapperConfig
) -> list[Case]:
    cases: list[Case] = []
    for label in labels:
        output = detector.detect(folder / label.file)
        detections = map_detections(output.detections, detector.names, mapper)
        cases.append(Case(label, detections, output.inference_ms))
    return cases


def verdicts(cases: Sequence[Case], preview: PreviewConfig) -> list[str]:
    return [preview_verdict(c.detections, preview).verdict for c in cases]


@dataclass(frozen=True)
class ClassScore:
    key: str
    true_pos: int
    false_pos: int
    false_neg: int

    @property
    def precision(self) -> float | None:
        found = self.true_pos + self.false_pos
        return self.true_pos / found if found else None

    @property
    def recall(self) -> float | None:
        there = self.true_pos + self.false_neg
        return self.true_pos / there if there else None


def class_scores(cases: Sequence[Case]) -> list[ClassScore]:
    """By photo: did the model find the class on a photo where a person sees it?"""
    keys = sorted(
        {k for c in cases for k in c.label.classes}
        | {d.class_key for c in cases for d in c.detections}
    )
    scores: list[ClassScore] = []
    for key in keys:
        tp = fp = fn = 0
        for c in cases:
            found = any(d.class_key == key for d in c.detections)
            there = key in c.label.classes
            tp += found and there
            fp += found and not there
            fn += there and not found
        scores.append(ClassScore(key, tp, fp, fn))
    return scores


@dataclass(frozen=True)
class SweepRow:
    setting: str
    counts: Counter[str]
    matches: int


def sweep(cases: Sequence[Case], preview: PreviewConfig) -> list[SweepRow]:
    """How the verdicts shift as "A defect counts as found at" moves, with today's outcomes."""
    expected = [c.label.expected for c in cases]

    def row(setting: str, config: PreviewConfig) -> SweepRow:
        got = verdicts(cases, config)
        return SweepRow(
            setting, Counter(got), sum(g == e for g, e in zip(got, expected, strict=True))
        )

    return [row(f"Found at {t:.2f}", replace(preview, found_at_or_above=t)) for t in SWEEP]


def _pct(value: float | None) -> str:
    return "—" if value is None else f"{value * 100:.0f}%"


def to_markdown(
    cases: Sequence[Case],
    preview: PreviewConfig,
    *,
    model_version: str,
    date: str,
    settings_line: str,
    floor: float,
) -> str:
    n = len(cases)
    got = verdicts(cases, preview)
    matched = sum(g == c.label.expected for g, c in zip(got, cases, strict=True))
    lines = [f"# Model check: {model_version} ({date})", ""]
    if n <= SMALL_CHECK:
        lines += [
            f"> **Small check on {n} photo{'s' if n != 1 else ''}.** It shows the model working "
            "with the app's rules end to end; it doesn't measure the model. Treat every number "
            "below as an example, not an accuracy figure.",
            "",
        ]
    lines += [
        settings_line,
        "",
        f"The preview matched the expected verdict on **{matched} of {n}** photos. Nothing here "
        "changes the app: the found-at value and the outcomes stay what the System Admin sets in "
        "Settings.",
        "",
        "## Per photo",
        "",
        "| Photo | Expected | Preview | Found (confidence) | Match |",
        "| ----- | -------- | ------- | ------------------ | :---: |",
    ]
    for c, g in zip(cases, got, strict=True):
        found = ", ".join(f"{d.class_key} {d.confidence:.2f}" for d in c.detections) or "nothing"
        lines.append(
            f"| {c.label.file} | {c.label.expected} | {g} | {found} | "
            f"{'yes' if g == c.label.expected else 'no'} |"
        )

    lines += [
        "",
        "## Verdicts: expected (rows) against preview (columns)",
        "",
        "| Expected | " + " | ".join(VERDICTS) + " |",
        "| -------- | " + " | ".join("---:" for _ in VERDICTS) + " |",
    ]
    for e in VERDICTS:
        row = [
            sum(1 for c, g in zip(cases, got, strict=True) if c.label.expected == e and g == v)
            for v in VERDICTS
        ]
        lines.append(f"| {e} | " + " | ".join(str(x) for x in row) + " |")

    lines += [
        "",
        f"## Per class, by photo (confidence floor {floor:.2f})",
        "",
        "A class counts as found on a photo when the model reports it at least once. Precision: of "
        "the photos where it was found, how many really have it. Recall: of the photos that have "
        "it, on how many it was found.",
        "",
        "| Class | Found and there | Found, not there | Missed | Precision | Recall |",
        "| ----- | --------------: | ---------------: | -----: | --------: | -----: |",
    ]
    for s in class_scores(cases):
        lines.append(
            f"| {s.key} | {s.true_pos} | {s.false_pos} | {s.false_neg} | "
            f"{_pct(s.precision)} | {_pct(s.recall)} |"
        )

    rows = sweep(cases, preview)
    header = "| Setting | " + " | ".join(VERDICTS) + " | Match |"
    rule = "| ------- | " + " | ".join("---:" for _ in VERDICTS) + " | ---: |"
    lines += [
        "",
        "## How the verdicts shift",
        "",
        "With today's outcomes, moving “A defect counts as found at”:",
        "",
        header,
        rule,
        *(
            f"| {r.setting} | "
            + " | ".join(str(r.counts.get(v, 0)) for v in VERDICTS)
            + f" | {r.matches} of {n} |"
            for r in rows
        ),
        "",
    ]
    return "\n".join(lines)
