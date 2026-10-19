# Camera station (`cv/`)

A Python process that runs on the camera machine, outside Docker (D-003, D-048). It runs the YOLO
model on one leather section at a time and reports what the model saw to the app through the
existing camera contract (`POST /api/v1/scans`, see `docs/API.md`). The app decides every verdict.

Phase 14 (this folder today) is the inference core: load the model, run it on images, and show the
detections, the `modelVersion` and a **preview** of the verdict the app would give. It posts
nothing. Phase 15 adds capture and sending; Phase 16 the evaluation report and demo script.

```
cpoint_cv/
  detector.py       the Detector port and FakeDetector (no torch)
  yolo_detector.py  YoloDetector, the only module that imports ultralytics/torch
  mapper.py         model output → the app's detections (class keys, boxes, floor, top 50)
  payload.py        the multipart text fields the station will send
  preview.py        Python port of the app's rule (D-011), for predict's preview only
  config.py         config.toml + environment overrides
  model_info.py     SHA-256 and modelVersion
  summary.py        per-folder numbers; overlay.py draws boxes and masks
models/             model files (git-ignored); see MODEL_CARD.md for the checksum
tests/              pytest; runs without torch
```

## Set up (Windows, Python 3.13)

Use `py -3.13` (plain `python` may open the Microsoft Store).

```bash
cd cv
py -3.13 -m venv .venv
.venv/Scripts/python -m pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124
.venv/Scripts/python -m pip install -r requirements.txt -r requirements-dev.txt
copy config.example.toml config.toml
```

The first install line gets the NVIDIA (CUDA 12.4) build of torch. Without an NVIDIA GPU, skip it
and keep `device = "cpu"`. In `config.toml` (git-ignored), set `device = "cuda:0"` to use the GPU.

Put the model at `cv/models/yolo-v1.pt`. Check it's the right file: `predict` warns when its
SHA-256 doesn't match `[model] sha256`.

## Run the model on images

```bash
.venv/Scripts/python -m cpoint_cv predict path/to/photos --save-overlay out/overlays --summary-md out/baseline.md
```

Per image it prints the time taken, each detection (class key, confidence, box) and the preview
verdict, then a summary: detections per class with their confidence spread, and how many images
would be PASS, REWORK, REJECT or NEEDS_REVIEW. `--json` prints one JSON line per image instead.
Keep photos and `out/` out of git (`out/` is ignored).

The preview copies the app's rule using the thresholds and defect types under `[preview]` in the
config. Copy them from Admin → Settings to match the app. The station never sends a verdict.

## Settings

Every setting is in `config.example.toml` with a comment. These environment variables override
the file: `CPOINT_CV_CONFIG` (another file), `CPOINT_CV_MODEL_PATH`, `CPOINT_CV_MODEL_DEVICE`,
`CPOINT_CV_MODEL_IMGSZ`, `CPOINT_CV_CONFIDENCE_FLOOR`.

- `confidence_floor` (0.25) drops noise before anything is sent. It isn't the app's PASS threshold.
- `[mapper.rename]` sends a model class under another key, e.g. `crease = "wrinkle"`.

## Checks

```bash
.venv/Scripts/ruff check .
.venv/Scripts/ruff format --check .
.venv/Scripts/mypy
.venv/Scripts/python -m pytest
```

CI runs the same four without torch. `tests/test_contract_fixture.py` writes and checks
`tests/fixtures/cv-payload.json` at the repo root, which `tests/unit/cv-contract.test.ts` parses
with the app's validator. To change it on purpose: `CPOINT_CV_UPDATE_FIXTURE=1` before `pytest`.
