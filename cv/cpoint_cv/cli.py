"""The model toolkit's commands (cv/README.md).

- ``predict <image-or-folder>``: run the model, print what it saw, the ``modelVersion``, the time
  taken and a *preview* of the app's verdict. ``--json`` gives one line per image, which
  ``npm run cv:parity`` compares with the website's ONNX model. Posts nothing.
- ``evaluate <folder>``: compare preview verdicts with ``labels.csv`` and write a report.
- ``export-onnx``: write the model as ONNX, with a JSON beside it, for the website's Capture page
  (Phase 18, D-064).

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
    active = ", ".join(sorted(p.active_keys)) or "none"
    inactive = ", ".join(sorted(p.inactive_keys)) or "none"
    actions = ", ".join(f"{k} {v.lower()}" for k, v in sorted(p.actions.items()))
    when_found = (
        f"; when found at {p.found_at_or_above:.2f}: {actions}"
        if actions
        else '; no "When found" actions (by confidence only)'
    )
    return (
        f"Preview settings: reject at {p.reject_at_or_above:.2f}, rework at "
        f"{p.rework_at_or_above:.2f}{when_found}; active types: {active}; inactive: {inactive}. "
        f"Confidence floor {config.mapper.confidence_floor:.2f}, imgsz {config.model.imgsz}, "
        f"device {config.model.device}."
    )


NO_ACTIONS_WARNING = (
    "warning: [preview.actions] is empty, so the preview decides by confidence only. If any "
    'defect type has a "When found" action in Admin > Settings, copy found_at_or_above and '
    "[preview.actions] into the config (cv/config.example.toml has the demo's), or the preview "
    "won't match the app."
)


def preview_warning(config: Config) -> str | None:
    """A warning when the preview has no actions: since D-053 the app usually has some."""
    return None if config.preview.actions else NO_ACTIONS_WARNING


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
    if warning := preview_warning(config):
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
            unknown = (
                f", unknown to the app: {', '.join(preview.unknown_keys)}"
                if (preview.unknown_keys)
                else ""
            )
            print(
                f"{image.name}  {output.inference_ms:.0f} ms  preview {preview.verdict} "
                f"({top}{unknown})"
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

    if warning := preview_warning(config):
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

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    handler = args.handler
    return int(handler(args))
