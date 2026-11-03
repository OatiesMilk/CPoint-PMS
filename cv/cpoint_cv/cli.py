"""The model toolkit's commands (cv/README.md).

- ``predict <image-or-folder>``: run the model, print what it saw, the ``modelVersion``, the time
  taken and a *preview* of the app's verdict. ``--json`` gives one line per image, which
  ``npm run cv:parity`` compares with the website's ONNX model. Posts nothing.
- ``evaluate <folder>``: compare preview verdicts with ``labels.csv`` and write a report.
- ``export-onnx``: write the model as ONNX, with a JSON beside it, for the website's Capture page
  (Phase 18, D-064).
- ``calibrate <photo>``: find a sheet of known size (A4 or letter) and print the width the phone
  sees, for the scale (Phase 30B).
- ``measure <folder>``: measure a roll's defects in inches against its entered area and the
  ruler, and write a report (Phase 30B). Posts nothing.

The station app and its ``run`` and ``doctor`` commands were retired in Phase 20 (D-069): capture
happens on the website.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from .config import CV_DIR, Config, ConfigError, load_config
from .mapper import map_with_sources
from .model_info import model_version, sha256_file
from .preview import preview_verdict
from .sources import collect_images
from .summary import ImageResult, summarize, to_markdown

__all__ = ["build_parser", "collect_images", "main"]


def settings_line(config: Config) -> str:
    p = config.preview

    def keys(outcome: str) -> str:
        return ", ".join(sorted(k for k in p.active_keys if p.outcomes.get(k) == outcome)) or "none"

    inactive = ", ".join(sorted(p.inactive_keys)) or "none"
    return (
        f"Preview settings: found at {p.found_at_or_above:.2f}; Not accepted (Reject): "
        f"{keys('NOT_ACCEPTED')}; Usable (Pass): {keys('USABLE')}; inactive: {inactive}; "
        "other classes: ignored. "
        f"Confidence floor {config.mapper.confidence_floor:.2f}, imgsz {config.model.imgsz}, "
        f"device {config.model.device}."
    )


NO_TYPES_WARNING = (
    "warning: [preview] active_keys is empty, so the preview ignores every detection, as the "
    "app does for a class with no defect type. Copy the defect types and their outcomes from "
    "Admin > Settings into [preview] and [preview.outcomes] (cv/config.example.toml has the "
    "demo's), or the preview won't match the app."
)


def preview_warnings(config: Config) -> list[str]:
    """Warnings about the preview settings: retired keys by name, and no defect types at all."""
    found = list(config.warnings)
    if not config.preview.active_keys:
        found.append(NO_TYPES_WARNING)
    return found


def _model_version(config: Config) -> str | None:
    """The model's ``modelVersion``, warning when the file isn't the one in the config. None (after
    printing what to fix) when the file is missing."""
    if not config.model.path.is_file():
        where = config.source_file or Path("the config file")
        print(
            f"error: the model file {config.model.path} wasn't found. Check [model] path in "
            f"{where}: a relative path is read from that file's folder ({where.parent}).",
            file=sys.stderr,
        )
        return None
    sha = sha256_file(config.model.path)
    if config.model.sha256 and config.model.sha256 != sha:
        print(
            f"warning: {config.model.path.name} doesn't match [model] sha256 in the config.\n"
            f"  expected {config.model.sha256}\n  found    {sha}\n"
            "  Check you have the right file, then update sha256 and cv/MODEL_CARD.md.",
            file=sys.stderr,
        )
    return model_version(config.model.name, sha)


def _predict(args: argparse.Namespace) -> int:
    try:
        config = load_config(args.config)
        images = collect_images(args.paths)
    except (ConfigError, FileNotFoundError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    if not images:
        print("error: no images found (jpg, jpeg, png, webp or bmp).", file=sys.stderr)
        return 2

    from .yolo_detector import ModelError, YoloDetector, runtime_versions

    version = _model_version(config)
    if version is None:
        return 2
    try:
        detector = YoloDetector(config.model, config.mapper.confidence_floor)
    except ModelError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    versions = ", ".join(f"{k} {v}" for k, v in runtime_versions().items())
    for warning in preview_warnings(config):
        print(warning, file=sys.stderr)
    if not args.json:
        print(f"Model {version} ({detector.task}), classes {dict(detector.names)}")
        print(versions)
        print(settings_line(config))
        print("Verdicts below are a PREVIEW of the app's rule (D-011), not the app's decision.\n")

    results: list[ImageResult] = []
    for image in images:
        output = detector.detect(image)
        pairs = map_with_sources(output.detections, detector.names, config.mapper)
        detections = [d for d, _ in pairs]
        preview = preview_verdict(detections, config.preview)
        results.append(ImageResult(image.name, detections, preview, output.inference_ms))

        if args.json:
            print(
                json.dumps(
                    {
                        "image": image.name,
                        "modelVersion": version,
                        "inferenceMs": round(output.inference_ms, 1),
                        "detections": [d.to_contract() for d in detections],
                        "previewVerdict": preview.verdict,
                    }
                )
            )
        else:
            top = (
                f"highest {detections[0].class_key} {detections[0].confidence:.2f}"
                if detections
                else "nothing found"
            )
            ignored = (
                f", ignored: {', '.join(preview.ignored_keys)}" if preview.ignored_keys else ""
            )
            print(
                f"{image.name}  {output.inference_ms:.0f} ms  preview {preview.verdict} "
                f"({top}{ignored})"
            )
            for d in detections:
                b = d.box
                print(
                    f"    {d.class_key:<10} {d.confidence:.4f}  "
                    f"x {b.x:.4f} y {b.y:.4f} w {b.width:.4f} h {b.height:.4f}"
                )
        if args.save_overlay:
            caption = f"{version}  preview {preview.verdict}"
            from .overlay import save_overlay

            save_overlay(image, pairs, args.save_overlay, caption)

    summary = summarize(results)
    if not args.json:
        print(
            f"\n{len(results)} images, median {summary.ms_median} ms, slowest {summary.ms_max} ms"
        )
        for c in summary.classes:
            print(
                f"  {c.key:<10} {c.detections:>4} detections in {c.images:>3} images, "
                f"confidence {c.min:.2f} to {c.max:.2f} (median {c.median:.2f})"
            )
        print("  preview: " + ", ".join(f"{v} {n}" for v, n in summary.verdicts.items()))
    if args.summary_md:
        args.summary_md.parent.mkdir(parents=True, exist_ok=True)
        args.summary_md.write_text(
            to_markdown(
                summary,
                title=f"Baseline: {version}",
                settings_line=f"{settings_line(config)} Runtime: {versions}.",
            ),
            encoding="utf-8",
        )
    return 0


def _evaluate(args: argparse.Namespace) -> int:
    from datetime import date

    from .evaluate import LabelError, load_labels, run_cases, to_markdown

    try:
        config = load_config(args.config)
        labels = load_labels(args.folder, args.labels)
    except (ConfigError, LabelError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    from .yolo_detector import ModelError, YoloDetector

    version = _model_version(config)
    if version is None:
        return 2
    try:
        detector = YoloDetector(config.model, config.mapper.confidence_floor)
    except ModelError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    for warning in preview_warnings(config):
        print(warning, file=sys.stderr)
    today = date.today().isoformat()
    cases = run_cases(args.folder, labels, detector, config.mapper)
    report = to_markdown(
        cases,
        config.preview,
        model_version=version,
        date=today,
        settings_line=settings_line(config),
        floor=config.mapper.confidence_floor,
    )
    out = args.out or CV_DIR / "reports" / f"{today}-{config.model.name}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(report, encoding="utf-8")
    matched = sum(
        preview_verdict(c.detections, config.preview).verdict == c.label.expected for c in cases
    )
    print(f"The preview matched the expected verdict on {matched} of {len(cases)} photos.")
    print(f"Report: {out}")
    return 0


def _export_onnx(args: argparse.Namespace) -> int:
    from .onnx_export import ExportError, export_onnx

    try:
        config = load_config(args.config)
        onnx_path, info = export_onnx(config)
    except (ConfigError, ExportError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    print(f"Wrote {onnx_path} and {info.name}.")
    print(
        "Restart the app to load it. In Docker, cv/models/ is mounted into the app container "
        '(cv/README.md, "Capture from the website").'
    )
    return 0


def _calibrate(args: argparse.Namespace) -> int:
    from .calibration import CalibrationError, find_sheet, save_sheet_overlay
    from .measure import MeasureError, parse_sheet_size

    try:
        sheet = parse_sheet_size(args.size)
        images = collect_images(args.paths)
    except (MeasureError, FileNotFoundError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    if not images:
        print("error: no images found (jpg, jpeg, png, webp or bmp).", file=sys.stderr)
        return 2
    failed = 0
    for image in images:
        try:
            found = find_sheet(image, sheet)
        except CalibrationError as error:
            print(f"{image.name}: {error}", file=sys.stderr)
            failed += 1
            continue
        print(
            f"{image.name}: sheet {sheet[0]:g} x {sheet[1]:g} in found ({found.view}), "
            f"{found.long_px:.0f} x {found.short_px:.0f} px, shape {found.aspect_found:.3f} "
            f"(sheet {found.aspect_sheet:.3f}); {found.px_per_in:.1f} px per inch; the phone "
            f"sees {found.width_in:.2f} in across a {found.image_width} px wide frame."
        )
        if args.save_overlay:
            print(f"    overlay: {save_sheet_overlay(image, found, args.save_overlay)}")
    if failed == len(images):
        return 2
    print(
        "\nPut the width in the roll's roll.toml as width_in, or measure with --width-in. "
        "It holds while the phone stays at the same height and zoom."
    )
    return 0


def _measure(args: argparse.Namespace) -> int:
    from dataclasses import replace
    from datetime import date

    from .measure import MeasureError, load_roll_file, measure_folder, parse_sheet_size
    from .measure import to_markdown as measure_markdown

    if args.out and len(args.folders) > 1:
        print(
            "error: --out takes one folder; leave it out to write one report per roll.",
            file=sys.stderr,
        )
        return 2
    try:
        config = load_config(args.config)
        rolls = [(folder, load_roll_file(folder)) for folder in args.folders]
        if args.width_in is not None:
            rolls = [(f, replace(r, width_in=args.width_in)) for f, r in rolls]
        if args.size:
            sheet = parse_sheet_size(args.size)
            rolls = [(f, replace(r, sheet=sheet)) for f, r in rolls]
    except (ConfigError, MeasureError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    from .calibration import CalibrationError, find_sheet, image_size
    from .yolo_detector import ModelError, YoloDetector

    version = _model_version(config)
    if version is None:
        return 2
    try:
        detector = YoloDetector(config.model, config.mapper.confidence_floor)
    except ModelError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    def calibrate_photo(path: Path, sheet: tuple[float, float]) -> tuple[float, float]:
        found = find_sheet(path, sheet)
        return found.width_in, found.px_per_in

    today = date.today().isoformat()
    status = 0
    for folder, roll_file in rolls:
        try:
            result = measure_folder(
                folder,
                roll_file,
                detector,
                config.mapper,
                size_of=image_size,
                calibrate_photo=calibrate_photo,
            )
        except (MeasureError, CalibrationError) as error:
            print(f"error: {folder}: {error}", file=sys.stderr)
            status = 2
            continue
        report = measure_markdown(
            result.roll,
            result.checks,
            result.calibrations,
            date=today,
            model_version=version,
            settings_line=settings_line(config),
            notes=result.notes,
        )
        out = args.out or CV_DIR / "reports" / f"{today}-{result.roll.code}-measure.md"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(report, encoding="utf-8")
        found = sum(len(s.defects) for s in result.roll.shots)
        print(
            f"Roll {result.roll.code}: {len(result.roll.shots)} shots, {found} defects; "
            f"{result.roll.share_box:.1%} by box, {result.roll.share_outline:.1%} by outline. "
            f"Report: {out}"
        )
    return status


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m cpoint_cv",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    commands = parser.add_subparsers(dest="command", required=True)
    predict = commands.add_parser(
        "predict", help="Run the model on images and preview the app's verdicts. Posts nothing."
    )
    predict.add_argument("paths", nargs="+", type=Path, help="Image files or folders")
    predict.add_argument("--config", type=Path, help="Config file (default: cv/config.toml)")
    predict.add_argument(
        "--save-overlay", type=Path, metavar="DIR", help="Save overlay images here"
    )
    predict.add_argument(
        "--summary-md", type=Path, metavar="FILE", help="Write the folder summary as Markdown"
    )
    predict.add_argument("--json", action="store_true", help="One JSON line per image")
    predict.set_defaults(handler=_predict)

    evaluate = commands.add_parser(
        "evaluate",
        help="Compare preview verdicts with labels.csv and write a report. Posts nothing.",
    )
    evaluate.add_argument("folder", type=Path, help="The photos, with labels.csv beside them")
    evaluate.add_argument(
        "--labels", type=Path, metavar="FILE", help="Another labels file (default: labels.csv)"
    )
    evaluate.add_argument(
        "--out",
        type=Path,
        metavar="FILE",
        help="Where to write the report (default: cv/reports/<date>-<model>.md)",
    )
    evaluate.add_argument("--config", type=Path, help="Config file (default: cv/config.toml)")
    evaluate.set_defaults(handler=_evaluate)

    export = commands.add_parser(
        "export-onnx",
        help="Write the model as ONNX with a JSON beside it, for the website's Capture page.",
    )
    export.add_argument("--config", type=Path, help="Config file (default: cv/config.toml)")
    export.set_defaults(handler=_export_onnx)

    calibrate = commands.add_parser(
        "calibrate",
        help="Find a sheet of known size in a photo and print the width the phone sees.",
    )
    calibrate.add_argument("paths", nargs="+", type=Path, help="Photos with the sheet in them")
    calibrate.add_argument(
        "--size",
        default="a4",
        help="The sheet: a4 (8.27x11.69, the default), letter (8.5x11) or WxH in inches",
    )
    calibrate.add_argument(
        "--save-overlay", type=Path, metavar="DIR", help="Save each photo with the sheet outlined"
    )
    calibrate.set_defaults(handler=_calibrate)

    measure = commands.add_parser(
        "measure",
        help="Measure the defects on a roll's shots in inches and write a report. Posts nothing.",
    )
    measure.add_argument(
        "folders", nargs="+", type=Path, help="One folder per roll, each with its roll.toml"
    )
    measure.add_argument(
        "--width-in", type=float, metavar="W", help="The width the phone sees, from calibrate"
    )
    measure.add_argument(
        "--size", help="The calibration sheet's size (a4, letter or WxH); overrides roll.toml"
    )
    measure.add_argument(
        "--out",
        type=Path,
        metavar="FILE",
        help="Where to write the report (default: cv/reports/<date>-<roll>-measure.md)",
    )
    measure.add_argument("--config", type=Path, help="Config file (default: cv/config.toml)")
    measure.set_defaults(handler=_measure)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    handler = args.handler
    return int(handler(args))
