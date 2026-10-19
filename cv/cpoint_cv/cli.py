"""The camera station's commands.

- ``predict <image-or-folder>``: run the model, print what it saw, the ``modelVersion``, the time
  taken and a *preview* of the app's verdict. Posts nothing.
- ``run webcam | folder <dir> | file <image>``: the station. Captures one section at a time, runs
  the model and sends each scan to the app, which decides the verdict.
- ``doctor``: checks the model, packages, GPU, camera, app, token and clock, and says what to fix.
- ``export-onnx``: write the model as ONNX, with a JSON beside it, for the website's Capture page
  (Phase 18, D-064).
- ``window``: the station window: check this machine, pick the camera, live preview, Capture and
  Stop (D-059). ``shortcut`` puts it on the desktop (D-063).
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

from .client import ScanClient
from .config import CV_DIR, Config, ConfigError, load_config
from .doctor import check_app, check_camera, check_gpu, check_model, check_python
from .env import BASE_URL_VAR, TOKEN_VAR, station_env
from .logs import StationLog
from .mapper import map_with_sources
from .model_info import model_version, sha256_file
from .preview import preview_verdict
from .retry import Backoff
from .sources import collect_images
from .spool import Spool
from .station import Station
from .summary import ImageResult, summarize, to_markdown

__all__ = ["build_parser", "collect_images", "main", "make_client"]


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


def make_client(config: Config, env: Mapping[str, str]) -> ScanClient | None:
    """The app client with the device token, or None when CV_DEVICE_TOKEN isn't set."""
    token = env.get(TOKEN_VAR, "").strip()
    if not token:
        return None
    from .transport import UrllibTransport

    return ScanClient(
        config.server.base_url,
        token,
        UrllibTransport(),
        timeout=config.server.timeout_seconds,
        backoff=Backoff(
            config.server.attempts,
            config.server.backoff_seconds,
            config.server.max_backoff_seconds,
        ),
    )


def _run(args: argparse.Namespace) -> int:
    env = station_env()
    try:
        config = load_config(args.config, env)
    except ConfigError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2
    client = make_client(config, env)
    if client is None:
        print(
            f"error: {TOKEN_VAR} isn't set. As the System Admin, create a device token under API "
            f"tokens (or run npm run cv:token), then put {TOKEN_VAR}=... in cv/.env.",
            file=sys.stderr,
        )
        return 2
    version = _model_version(config)
    if version is None:
        return 2

    from .sources import FileSource, FolderSource, FrameSource, SourceError, WebcamSource
    from .triggers import IntervalTrigger, KeyTrigger, Trigger

    source: FrameSource
    trigger: Trigger
    try:
        if args.source == "webcam":
            source = WebcamSource(
                config.camera.device,
                config.camera.width,
                config.camera.height,
                warmup_frames=config.camera.warmup_frames,
                jpeg_quality=config.station.jpeg_quality,
                backend=config.camera.backend,
            )
            trigger = KeyTrigger(idle_seconds=config.station.check_in_seconds)
        elif args.path is None:
            print(
                f"error: give the {args.source} to send, e.g. run {args.source} <path>.",
                file=sys.stderr,
            )
            return 2
        elif args.source == "folder":
            source = FolderSource(args.path)
            interval = (
                args.interval if args.interval is not None else config.station.interval_seconds
            )
            trigger = IntervalTrigger(interval)
        else:
            source = FileSource(args.path)
            trigger = IntervalTrigger(0)
    except SourceError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    from .yolo_detector import ModelError, YoloDetector

    try:
        detector = YoloDetector(config.model, config.mapper.confidence_floor)
    except ModelError as error:
        source.close()
        print(f"error: {error}", file=sys.stderr)
        return 2

    station = Station(
        config=config,
        source=source,
        trigger=trigger,
        detector=detector,
        client=client,
        spool=Spool(config.station.spool_dir, config.station.failed_dir),
        log=StationLog(config.station.log_dir),
        model_version=version,
    )
    try:
        return station.run()
    except KeyboardInterrupt:
        print("Stopped.")
        return 130


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


def _doctor(args: argparse.Namespace) -> int:
    env = station_env()
    try:
        config = load_config(args.config, env)
    except ConfigError as error:
        print(f"FAIL  Config: {error}")
        return 1
    print(
        f"Config: {config.source_file}. App: {config.server.base_url} "
        f"(from [server] base_url or {BASE_URL_VAR})."
    )
    checks = [check_model(config), *check_python(), check_gpu(config.model.device)]
    if not args.no_camera:
        from .sources import probe_camera

        checks.append(
            check_camera(
                config.camera.device,
                lambda device: probe_camera(device, config.camera.backend),
            )
        )
    checks += check_app(make_client(config, env))
    for check in checks:
        print(check.line())
    failed = [c for c in checks if not c.ok]
    warnings = sum(1 for c in checks if c.status == "warn")
    also = (
        f" Read the {warnings} warning(s): it works, but slower or with a risk." if warnings else ""
    )
    print(
        f"\nEverything the station needs is in place.{also}"
        if not failed
        else f"\n{len(failed)} check(s) failed. Fix them from the top, then run doctor again."
    )
    return 1 if failed else 0


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


def _window(args: argparse.Namespace) -> int:
    from .window.app import safe_main

    return safe_main(args.config)


def _shortcut(_args: argparse.Namespace) -> int:
    from .shortcut import create_shortcut

    made, message = create_shortcut()
    print(message if made else f"error: {message}", file=sys.stdout if made else sys.stderr)
    return 0 if made else 1


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

    run = commands.add_parser(
        "run", help="Capture sections, run the model and send each scan to the app."
    )
    run.add_argument(
        "source",
        choices=("webcam", "folder", "file"),
        help="webcam: Space captures one section; folder: every image in order; file: one image",
    )
    run.add_argument("path", nargs="?", type=Path, help="The folder or image (folder and file)")
    run.add_argument(
        "--interval",
        type=float,
        metavar="SECONDS",
        help="Seconds between images in folder replay (default: [station] interval_seconds)",
    )
    run.add_argument("--config", type=Path, help="Config file (default: cv/config.toml)")
    run.set_defaults(handler=_run)

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

    doctor = commands.add_parser("doctor", help="Check the station can run and say what to fix.")
    doctor.add_argument("--config", type=Path, help="Config file (default: cv/config.toml)")
    doctor.add_argument(
        "--no-camera", action="store_true", help="Skip the camera check (folder replay only)"
    )
    doctor.set_defaults(handler=_doctor)

    export = commands.add_parser(
        "export-onnx",
        help="Write the model as ONNX with a JSON beside it, for the website's Capture page.",
    )
    export.add_argument("--config", type=Path, help="Config file (default: cv/config.toml)")
    export.set_defaults(handler=_export_onnx)

    window = commands.add_parser(
        "window", help="Open the station window: check, camera, live preview, Capture and Stop."
    )
    window.add_argument("--config", type=Path, help="Config file (default: cv/config.toml)")
    window.set_defaults(handler=_window)

    shortcut = commands.add_parser(
        "shortcut", help="Put a CPoint Camera shortcut to the station window on the desktop."
    )
    shortcut.set_defaults(handler=_shortcut)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    handler = args.handler
    return int(handler(args))
