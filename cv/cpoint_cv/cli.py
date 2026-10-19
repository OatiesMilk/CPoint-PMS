"""``python -m cpoint_cv predict <image-or-folder>``: run the model, print what it saw, the
``modelVersion``, the time taken and a *preview* of the app's verdict. Posts nothing."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from .config import Config, ConfigError, load_config
from .mapper import map_with_sources
from .model_info import model_version, sha256_file
from .preview import preview_verdict
from .summary import ImageResult, summarize, to_markdown

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def collect_images(paths: Sequence[Path]) -> list[Path]:
    """Images named directly, plus every image in a named folder (not its subfolders), sorted."""
    images: list[Path] = []
    for path in paths:
        if path.is_dir():
            images += sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES)
        elif path.is_file():
            images.append(path)
        else:
            raise FileNotFoundError(f"{path} isn't a file or folder.")
    return images


def settings_line(config: Config) -> str:
    p = config.preview
    active = ", ".join(sorted(p.active_keys)) or "none"
    inactive = ", ".join(sorted(p.inactive_keys)) or "none"
    return (
        f"Preview settings: reject at {p.reject_at_or_above:.2f}, rework at "
        f"{p.rework_at_or_above:.2f}; active types: {active}; inactive: {inactive}. "
        f"Confidence floor {config.mapper.confidence_floor:.2f}, imgsz {config.model.imgsz}, "
        f"device {config.model.device}."
    )


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

    if not config.model.path.is_file():
        where = config.source_file or Path("the config file")
        print(
            f"error: the model file {config.model.path} wasn't found. Check [model] path in "
            f"{where}: a relative path is read from that file's folder ({where.parent}).",
            file=sys.stderr,
        )
        return 2
    sha = sha256_file(config.model.path)
    version = model_version(config.model.name, sha)
    if config.model.sha256 and config.model.sha256 != sha:
        print(
            f"warning: {config.model.path.name} doesn't match [model] sha256 in the config.\n"
            f"  expected {config.model.sha256}\n  found    {sha}\n"
            "  Check you have the right file, then update sha256 and cv/MODEL_CARD.md.",
            file=sys.stderr,
        )
    try:
        detector = YoloDetector(config.model, config.mapper.confidence_floor)
    except ModelError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    versions = ", ".join(f"{k} {v}" for k, v in runtime_versions().items())
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m cpoint_cv", description=__doc__)
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
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    handler = args.handler
    return int(handler(args))
