# Camera station (`cv/`)

A Python process that runs on the camera machine, outside Docker (D-003, D-048). It runs the YOLO
model on one leather section at a time and reports what the model saw to the app through the
existing camera contract (`POST /api/v1/scans`, see `docs/API.md`). The app decides every verdict.

It has four commands:

- `predict`: run the model on photos and show the detections, the `modelVersion` and a
  **preview** of the verdict the app would give. Posts nothing (Phase 14).
- `run`: the station. It captures one section at a time from the webcam, a folder or a file,
  runs the model and sends each scan to the app, surviving network and server failures (Phase 15).
- `evaluate`: compares the preview verdicts with what a person expected (`labels.csv`) and writes
  a report to `reports/`. Posts nothing (Phase 16).
- `doctor`: checks everything the station needs and says what to fix.

The model swap runbook and the demo script are at the end.

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
  preview.py        Python port of the app's rule (D-011, D-053), for the preview only
  evaluate.py       labels.csv, the verdict table, per-class scores and the sweep (D-058)
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

The preview copies the app's rule using the thresholds, actions and defect types under
`[preview]` in the config. Copy them from Admin → Settings to match the app. The station never
sends a verdict.

## Defect types for yolo-v1 (D-052, D-053)

On the demo database `npm run demo:reset` does all of this for you (see the demo script). On any
other database, do it by hand once.

The model reports `crease`, `cut`, `hole` and `scratch`. The app starts with `cut`, `hole`,
`abrasion` and `dirt`, so until this is done every `crease` or `scratch` sends the scan to the
Quality Inspector's review queue. Do it once per database, signed in as the System Admin:

1. Open **Admin → Settings → Defect types**.
2. **Add** a defect type with key `crease` (exactly as the model sends it), label `Crease`, and a
   short description such as "Fold or crease line in the leather".
3. **Add** a defect type with key `scratch`, label `Scratch`, description "Scratch on the grain".
4. **Turn off** `abrasion` and `dirt` (the model never reports them). Turning a type off keeps
   every past scan; it only stops the type from deciding new ones.
5. Leave `cut` and `hole` on.
6. Set **When found** on each type (Edit): `cut` and `hole` → **Reject when found**, `crease` and
   `scratch` → **Rework when found**. Under **Thresholds**, keep **A defect counts as found at**
   at 50%. The model's confidence says how sure it is a defect is there, not how bad it is, so the
   type decides the result (D-053). A type left on **By confidence** keeps the two thresholds.

Running the steps again changes nothing: a key can't be added twice, and a type that's already off
stays off. Then copy the same lists, `found_at_or_above` and `[preview.actions]` into
`config.toml` (the example already has them) so `predict` and `evaluate` preview what the app
will decide.

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
  per press, never a stream. While it waits it checks in with the app every 20 s, so the Camera
  page shows **Station connected** between captures, and it says at once if someone changed the
  batch (D-054).
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

**An IP camera** on the network works too: set `[camera] url` to its stream address (for example
`rtsp://192.168.1.50:554/stream1`), or `CPOINT_CV_CAMERA_URL` in `cv/.env` when the address holds
a password. It replaces `[camera] index`; `doctor` checks it, and logs show it without the user
name and password (D-057).

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
`CPOINT_CV_CONFIDENCE_FLOOR`, `CV_BASE_URL`, `CPOINT_CV_CAMERA_URL`. `CV_DEVICE_TOKEN`, `CV_BASE_URL` and `CPOINT_CV_CAMERA_URL` can also be in
`cv/.env`; a variable set in the shell wins.

- `confidence_floor` (0.25) drops noise before anything is sent. It isn't the app's PASS threshold.
- `[mapper.rename]` sends a model class under another key, e.g. `crease = "wrinkle"`.
- `overlap_iou` (0.7): two boxes of the same class that overlap this much are one defect reported
  twice, so only the more confident is sent (D-057). 0 sends every box.
- `[station] check_in_seconds` (20): how often a waiting station checks in. 0 turns it off.

## Small model check (D-058)

Put a `labels.csv` beside the photos, one line per photo, saying what a person sees:

```
file,expected_verdict,classes
IMG_6320.jpg,REWORK,crease
IMG_6742.jpg,REJECT,cut;scratch
```

`expected_verdict` is PASS, REWORK, REJECT or NEEDS_REVIEW; `classes` lists the defect types on
the photo, separated by `;` (empty when it's clean). Then:

```bash
.venv/Scripts/python -m cpoint_cv evaluate "path/to/photos"
```

It writes `reports/<date>-<model>.md`: each photo's expected and preview verdict, a verdict table,
per-class precision and recall by photo, and how the verdicts shift as **A defect counts as found
at** or the thresholds move. With 30 photos or fewer the report says it's a small check: it shows
the model working with the app's rules, not how accurate it is. It changes nothing in the app.

The current report is `reports/2026-10-19-yolo-v1.md` (the five sample photos; their labels were
drafted from the photos in Phase 16 and still need a person's check).

## Swap in a new model

No app code changes. For example, for `yolo-v2.pt`:

1. Copy it to `cv/models/yolo-v2.pt`. Keep `yolo-v1.pt` until you switch.
2. Make a second config (`copy config.toml config-v2.toml`) and set `[model] path`,
   `name = "yolo-v2"`, `imgsz` (the size it was trained at) and `sha256`
   (`certutil -hashfile models\yolo-v2.pt SHA256`). Record them in `MODEL_CARD.md`.
3. Run `doctor --config config-v2.toml` and fix anything it reports.
4. Run `predict photos --config config-v2.toml`: it lists the model's classes. For any class the
   app doesn't know, add a defect type under **Admin → Settings → Defect types** with that exact
   key and its **When found** action, and turn off types the new model never reports. Until then
   its detections go to the Quality Inspector's review queue.
5. Run `evaluate` for both models on the same labelled photos (`--config config-v2.toml --out
reports/<date>-yolo-v2.md`) and compare the two reports.
6. To switch, make `config-v2.toml` your `config.toml` and restart the station. Every scan records
   its `modelVersion`, so the Camera page and each scan show which model judged it. Switching back
   is the same steps with the old file.

## Demo script

**Layout:** the camera station is a PC at the Preparation table, with the camera; the app (Docker
or `npm run dev`) runs on a server in the office; anyone opens the app in a browser on the same
network. The station only needs to reach the server's address (`CV_BASE_URL`). For the panel, all
three can be one laptop.

In Windows PowerShell, type `npm.cmd` instead of `npm` for commands with `--` flags (for example
`npm.cmd run cv:simulate -- --count 2`); PowerShell's `npm` drops the flags.

1. **Clean data.** From the repo root, back up the database
   (`docker compose exec db pg_dump -U cpoint cpoint_pms > backup.sql`), run `npm run demo:reset`
   to see what it would remove, then `npm run demo:reset -- --yes`. It keeps the accounts and the
   station's token, sets the defect types above and seeds a fresh demo week (D-056).
2. **Start the app** (`npm run dev`, or `docker compose up -d`). If `CV_DEVICE_TOKEN` wasn't set
   before the reset, create a token under **API tokens** and put it in `cv/.env`.
3. **Start a batch**: as the Floor Manager, Batches → New, then **Start** at Preparation.
4. **Check the station**: `.venv/Scripts/python -m cpoint_cv doctor`.
5. **Run it**: `.venv/Scripts/python -m cpoint_cv run folder "path/to/photos" --interval 5`, or
   `run webcam` and press Space for each section.
6. **Watch the Camera page**: the badge reads **Camera station active**, the last capture shows
   with its boxes, the Model card names `yolo-v1-…` with the early-model notice, and "Scans go to"
   names the batch. With `run webcam` and no press for a minute, it reads **Station connected**.
7. **Resolve a flagged scan as the Quality Inspector**: send a scan with a class the app doesn't
   know, e.g. `npm.cmd run cv:simulate -- --count 3 --classes qa-unknown` (turning a type off
   doesn't do it: an inactive type is ignored, not flagged). Open **Review**, open the scan and
   decide it.
8. **See what came of it**: a Rework scan opens a repair ticket (**Rework** board) and a Reject scan
   a salvage item (**Salvage**); each scan's page shows the model and the rules it was decided with.

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
