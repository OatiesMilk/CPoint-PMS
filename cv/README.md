# Camera station (`cv/`)

A Python process that runs on the camera machine, outside Docker (D-003, D-048). It runs the YOLO
model on one leather section at a time and reports what the model saw to the app through the
existing camera contract (`POST /api/v1/scans`, see `docs/API.md`). The app decides every verdict.

It has three commands:

- `predict`: run the model on photos and show the detections, the `modelVersion` and a
  **preview** of the verdict the app would give. Posts nothing (Phase 14).
- `run`: the station. It captures one section at a time from the webcam, a folder or a file,
  runs the model and sends each scan to the app, surviving network and server failures (Phase 15).
- `doctor`: checks everything the station needs and says what to fix.

Phase 16 adds the evaluation report and the demo script.

```
cpoint_cv/
  detector.py       the Detector port and FakeDetector (no torch)
  yolo_detector.py  YoloDetector, the only module that imports ultralytics/torch
  mapper.py         model output → the app's detections (class keys, boxes, floor, top 50)
  payload.py        the multipart text fields the station sends
  station.py        the run loop: batch, trigger, capture, spool, detect, send (D-050)
  sources.py        webcam, folder and file frame sources; triggers.py: Space key or a timer
  client.py         the app's API: current batch and scan upload, with retries (retry.py)
  transport.py      the HTTP port (standard library only); spool.py: the outbox on disk
  encode.py         keeps every image a JPEG, PNG or WebP under 10 MB
  doctor.py         the station checks; env.py: CV_DEVICE_TOKEN and CV_BASE_URL; logs.py
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
copy .env.example .env
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

## Defect types for yolo-v1 (D-052)

The model reports `crease`, `cut`, `hole` and `scratch`. The app starts with `cut`, `hole`,
`abrasion` and `dirt`, so until this is done every `crease` or `scratch` sends the scan to the
Quality Inspector's review queue. Do it once per database, signed in as the System Admin:

1. Open **Admin → Settings → Defect types**.
2. **Add** a defect type with key `crease` (exactly as the model sends it), label `Crease`, and a
   short description such as "Fold or crease line in the leather".
3. **Add** a defect type with key `scratch`, label `Scratch`, description "Scratch on the grain".
4. **Turn off** `abrasion` and `dirt` (the model never reports them). Turning a type off keeps
   every past scan; it only stops the type from deciding new ones.
5. Leave `cut` and `hole` as they are.

Running the steps again changes nothing: a key can't be added twice, and a type that's already off
stays off. Then copy the same list into `[preview]` in `config.toml` (the example already has it)
so `predict` previews what the app will decide.

Scans that arrived before step 2 keep their `crease`/`scratch` detections as unknown classes;
the Quality Inspector decides those, as for any flagged scan.

## Run the station

Prepare once:

1. As the System Admin, create a device token under **API tokens** (scope `scans:create`), or run
   `npm run cv:token` from the repo root. Put it in `cv/.env` as `CV_DEVICE_TOKEN=…`. The station
   never prints or logs it.
2. If the app isn't at `http://localhost:3000`, set `CV_BASE_URL` in `cv/.env` (for example
   `http://localhost:3001`).
3. Run `.venv/Scripts/python -m cpoint_cv doctor` and fix anything marked `FAIL`, top first. Add
   `--no-camera` when you'll only replay a folder.

Then start a batch in the app (Batches → Start) and run one of:

```bash
.venv/Scripts/python -m cpoint_cv run webcam
.venv/Scripts/python -m cpoint_cv run folder path/to/photos --interval 3
.venv/Scripts/python -m cpoint_cv run file path/to/photo.jpg
```

- **webcam:** press **Space** to capture the section under the camera, **Q** to stop. One picture
  per press, never a stream.
- **folder:** sends every image in the folder in name order, one every `--interval` seconds, then
  stops. Use it to demo with real leather photos and no camera.
- **file:** sends one image, for debugging.

Before each capture the station asks the app which batch is at Preparation and prints
"Next scan goes to B-2026-0007 (roll LR-0042, School Shoe)". It sends that batch's id with the
scan, so a section always lands in the roll it was cut from. With no batch at Preparation it says
so, waits, and captures nothing. After each scan it prints the app's answer: the batch, the
section number and the verdict the app decided. The station never decides a verdict itself.

Every scan is sent as `source` = `[station] scan_source` (`WEBCAM` by default; folder replay too),
`modelVersion` (e.g. `yolo-v1-1d729fb0`), `capturedAt` (when it was captured, not sent) and a new
`captureId`.

### When something fails

| What happened                          | What the station does                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| The token is refused (401/403)         | Stops and says to ask the System Admin for a new token. Unsent captures stay saved.                                    |
| No batch is at Preparation             | Says so once, asks again every 5 s, captures nothing.                                                                  |
| The app refuses a scan (413, 422, 409) | Moves it to `out/failed/<capture>/` with `reason.txt` holding the app's message (it names the field), then carries on. |
| No answer, or a server error (5xx)     | Tries 4 times in all, waiting up to 1 s, 2 s and 4 s between, then keeps it in `out/spool/` to send later, in order.   |

Every capture is written to `out/spool/` **before** it is sent and removed only once the app has
it, so stopping the station, a crash or a dropped network loses nothing: the next run sends what's
waiting first, oldest first. Retrying never makes a second scan, because each capture carries its
`captureId` and the app answers a repeat with the first scan (D-051).

Each event is a JSON line in `out/logs/station-YYYY-MM-DD.jsonl`: time, capture id, batch,
detections, inference time, HTTP status, attempts and the outcome.

## Settings

Every setting is in `config.example.toml` with a comment: the model, the mapper, the preview,
`[server]` (address, timeout, retries), `[station]` (source, JPEG quality, interval, folders) and
`[camera]` (index, resolution). These environment variables override the file: `CPOINT_CV_CONFIG`
(another file), `CPOINT_CV_MODEL_PATH`, `CPOINT_CV_MODEL_DEVICE`, `CPOINT_CV_MODEL_IMGSZ`,
`CPOINT_CV_CONFIDENCE_FLOOR`, `CV_BASE_URL`. `CV_DEVICE_TOKEN` and `CV_BASE_URL` can also be in
`cv/.env`; a variable set in the shell wins.

- `confidence_floor` (0.25) drops noise before anything is sent. It isn't the app's PASS threshold.
- `[mapper.rename]` sends a model class under another key, e.g. `crease = "wrinkle"`.

## Checks

```bash
.venv/Scripts/ruff check .
.venv/Scripts/ruff format --check .
.venv/Scripts/mypy
.venv/Scripts/python -m pytest
```

CI runs the same four without torch, OpenCV or a network: the station's tests use fakes for the
HTTP, camera and model. `tests/test_contract_fixture.py` writes and checks
`tests/fixtures/cv-payload.json` at the repo root, which `tests/unit/cv-contract.test.ts` parses
with the app's validator. To change it on purpose: `CPOINT_CV_UPDATE_FIXTURE=1` before `pytest`.
