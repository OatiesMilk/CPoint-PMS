# Model toolkit (`cv/`)

The Python tools for the YOLO model that the website's **Capture** page runs (Quality → Capture,
Phase 18). The app runs the model itself, as ONNX, on the server (D-064). This folder is where the
model is checked and exported. It runs on a PC with Python, outside Docker, and never posts scans.

- `predict`: run the model on photos and show the detections, the `modelVersion` and a
  **preview** of the verdict the app would give. Posts nothing.
- `evaluate`: compare the preview verdicts with what a person expected (`labels.csv`) and write a
  report to `reports/`. Posts nothing (D-058).
- `export-onnx`: write `models/yolo-v1.onnx` and `models/yolo-v1.json`, the files the website
  reads (D-064).

The CPoint Camera station app and its `run` and `doctor` commands were retired in Phase 20
(D-069): capture happens on the website.

```
cpoint_cv/
  cli.py            the three commands
  detector.py       the Detector port and FakeDetector (no torch)
  yolo_detector.py  YoloDetector, the only module that imports ultralytics/torch
  mapper.py         model output → the app's detections (class keys, boxes, floor, top 50)
  preview.py        Python port of the app's rule (D-053, D-093), for the preview only
  evaluate.py       labels.csv, the verdict table, per-class scores and the sweep (D-058)
  onnx_export.py    the ONNX file and the JSON beside it
  config.py         config.toml + environment overrides
  model_info.py     SHA-256 and modelVersion
  sources.py        finds the photos; summary.py: per-folder numbers; overlay.py: boxes and masks
  payload.py        the scan contract's text fields, for the contract fixture test only
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

## Run the model on photos

```bash
.venv/Scripts/python -m cpoint_cv predict path/to/photos --save-overlay out/overlays --summary-md out/baseline.md
```

Per photo it prints the time taken, each detection (class key, confidence, box) and the preview
verdict, then a summary: detections per class with their confidence spread, and how many photos
would be PASS or REJECT (D-093). `--json` prints one JSON line per photo instead
(what `npm run cv:parity` compares). Keep photos and `out/` out of git (`out/` is ignored).

The preview copies the app's rule using the found-at value, the defect types and their outcomes
under `[preview]` and `[preview.outcomes]` in the config: a found Not accepted type, or a class
the app doesn't know, rejects the section; otherwise it passes. Copy them from Admin → Settings
to match the app. The app decides the real verdict. A config from before Phase 25 with
`reject_at_or_above`, `rework_at_or_above` or `[preview.actions]` still loads, with a warning that
names each one; replace them with `[preview.outcomes]`.

## Defect types for yolo-v1 (D-052, D-053, D-093)

The model reports `crease`, `cut`, `hole` and `scratch`. On the demo database `npm run demo:reset`
sets the defect types for it. On any other database, do it by hand once, signed in as the System
Admin, in **Admin → Settings → Defect types**:

1. **Add** `crease` (label `Crease`, "Fold or crease line in the leather") and `scratch` (label
   `Scratch`, "Scratch on the grain"), with the keys exactly as the model reports them.
2. **Turn off** `abrasion` and `dirt` (the model never reports them). Past scans are kept.
3. Leave `cut` and `hole` on.
4. Set **When found**: `cut` and `hole` → **Not accepted (Reject)**, `crease` and `scratch` →
   **Usable (Pass)**. Keep **A defect counts as found at** at 50% under **Thresholds**.

Until step 1, every `crease` or `scratch` is an unknown class, so its section is rejected and the
class is listed under Settings → Unknown classes (A-12). Then copy the same lists,
`found_at_or_above` and `[preview.outcomes]` into `config.toml` (the example already has them) so
`predict` and `evaluate` preview what the app will decide.

## Settings

Every setting is in `config.example.toml` with a comment: `[model]`, `[mapper]` and `[preview]`.
These environment variables override the file: `CPOINT_CV_CONFIG` (another file),
`CPOINT_CV_MODEL_PATH`, `CPOINT_CV_MODEL_DEVICE`, `CPOINT_CV_MODEL_IMGSZ`,
`CPOINT_CV_CONFIDENCE_FLOOR`. An old `config.toml` with the station's `[server]`, `[station]`,
`[camera]` or `[window]` sections still loads; those sections are ignored.

- `confidence_floor` (0.25) drops noise. It isn't the app's PASS threshold.
- `[mapper.rename]` reports a model class under another key, e.g. `crease = "wrinkle"`.
- `overlap_iou` (0.7): two boxes of the same class that overlap this much are one defect reported
  twice, so only the more confident is kept (D-057). 0 keeps every box.

`export-onnx` copies the three `[mapper]` settings into the JSON beside the model, so the website
maps detections the same way.

## Small model check (D-058)

Put a `labels.csv` beside the photos, one line per photo, saying what a person sees:

```
file,expected_verdict,classes
IMG_6320.jpg,PASS,crease
IMG_6742.jpg,REJECT,cut;scratch
```

`expected_verdict` is PASS or REJECT; an old REWORK or NEEDS_REVIEW is refused with the value to
write instead (Fixable became Pass, Needs review became Reject). `classes` lists the defect types on
the photo, separated by `;` (empty when it's clean). Then:

```bash
.venv/Scripts/python -m cpoint_cv evaluate "path/to/photos"
```

It writes `reports/<date>-<model>.md`: each photo's expected and preview verdict, a verdict table,
per-class precision and recall by photo, and how the verdicts shift as **A defect counts as found
at** moves. With 30 photos or fewer the report says it's a small check: it shows
the model working with the app's rules, not how accurate it is. It changes nothing in the app.

The current report is `reports/2026-10-19-yolo-v1.md` (the five sample photos; their labels were
drafted from the photos in Phase 16 and still need a person's check). It was written under the
earlier rule; run `evaluate` again after changing that folder's `labels.csv` to PASS and REJECT.

## Capture from the website (export-onnx)

The website reads `cv/models/yolo-v1.onnx` and `cv/models/yolo-v1.json` (`CV_MODEL_PATH` points
at the `.onnx`; in Docker, `cv/models/` is mounted at `/app/models`). Export them once, and again
after every new model:

```bash
.venv/Scripts/python -m pip install -r requirements-export.txt
.venv/Scripts/python -m cpoint_cv export-onnx
```

It writes the ONNX file (dynamic input size, FP32) and the JSON: the class names, `imgsz`,
stride, the ONNX file's SHA-256, the `[mapper]` floor, overlap and renames from your config, and
the `modelVersion` of the `.pt` weights, so `predict` and the website read as one model. Both
files are git-ignored. Restart the app to load them.

The app pads a photo only to the next multiple of 32 and resizes it with OpenCV's bilinear rule,
as Ultralytics does in `predict`. Check they agree on your photos:

```bash
.venv/Scripts/python -m cpoint_cv predict <folder> --json > ../storage/py.jsonl
cd .. && npm run cv:parity -- <folder> --compare storage/py.jsonl
```

Each photo should say `agrees` (same classes in order, confidence ±0.02, box edges ±0.01). The
five sample photos and two 16:9 crops agreed on 2026-10-19.

## Swap in a new model

No app code changes. For example, for `yolo-v2.pt`:

1. Copy it to `cv/models/yolo-v2.pt`. Keep `yolo-v1.pt` until you switch.
2. Make a second config (`copy config.toml config-v2.toml`) and set `[model] path`,
   `name = "yolo-v2"`, `imgsz` (the size it was trained at) and `sha256`
   (`certutil -hashfile models\yolo-v2.pt SHA256`). Record them in `MODEL_CARD.md`.
3. Run `predict photos --config config-v2.toml`: it lists the model's classes. For any class the
   app doesn't know, add a defect type under **Admin → Settings → Defect types** with that exact
   key and its **When found** action, and turn off types the new model never reports. Until then
   its detections go to the Quality Inspector's review queue.
4. Run `evaluate` for both models on the same labelled photos (`--config config-v2.toml --out
reports/<date>-yolo-v2.md`) and compare the two reports.
5. To switch, run `export-onnx --config config-v2.toml`, set `CV_MODEL_PATH` to
   `cv/models/yolo-v2.onnx` (Docker: `/app/models/yolo-v2.onnx`), restart the app and run
   `npm run cv:parity` on a few photos. Make `config-v2.toml` your `config.toml`. Every scan
   records its `modelVersion`, so the Camera page and each scan show which model judged it.
   Switching back is the same steps with the old file.

## Checks

```bash
.venv/Scripts/ruff check .
.venv/Scripts/ruff format --check .
.venv/Scripts/mypy
.venv/Scripts/python -m pytest
```

CI runs the same four without torch, OpenCV or a network. Two tests share a fixture with the
app's unit tests, in `tests/fixtures/` at the repo root:

- `tests/test_mapper_parity_fixture.py` writes `cv-mapper-parity.json`;
  `tests/unit/cv-mapper-parity.test.ts` runs the website's TypeScript mapper on the same input and
  must get the same detections.
- `tests/test_contract_fixture.py` writes `cv-payload.json`, the text fields of
  `POST /api/v1/scans`; `tests/unit/cv-contract.test.ts` parses it with the app's validator.

To change either on purpose: `CPOINT_CV_UPDATE_FIXTURE=1` before `pytest`.
