# QA handoff: Phase 15, the camera station (capture, send, recover)

| Field           | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| Date            | 2026-10-19                                                                  |
| Feature         | phase-15-camera-station                                                     |
| Branch          | `main` @ `f40e6fe` plus uncommitted Phase 15 changes                        |
| Spec / prompt   | `camera-yolo-integration.md` Phase 15; `docs/ROADMAP.md` Phase 15           |
| Written by      | Claude                                                                      |
| Previous report | `qa/reports/2026-10-19-phase-14-cv-core-run2.md` (FAIL: S6, a handoff step) |

## 1. What changed

- **The camera station now sends scans.** `python -m cpoint_cv run webcam | folder <dir> | file
<image>` (in `cv/`) asks the app which batch is at Preparation, prints "Next scan goes to
  B-…", captures one section (Space at the webcam; every image in order for a folder), runs
  yolo-v1 and posts the scan. It prints the app's answer: batch, section number and verdict. The
  app still decides every verdict.
- **Nothing is lost when something fails.** Each capture is saved to `cv/out/spool/` before it's
  sent. No answer or a 5xx is retried 4 times with backoff, then the capture waits and is sent
  later, in order. A refused token stops the station with the fix. A scan the app refuses moves to
  `cv/out/failed/` with `reason.txt`.
- **`python -m cpoint_cv doctor`** checks the model and checksum, Python and packages, the camera,
  the app, the token and the clock, and says what to fix.
- **App (additive, D-051):** `POST /api/v1/scans` takes an optional `captureId` (UUID). The same
  device sending it again gets `200` with the first scan and `"duplicate": true`; nothing new is
  stored. A new scan's `201` now includes `"duplicate": false`. Another device's `captureId` gets
  `409`. Migration `scan_capture_id` adds one nullable column.
- **Defect types (D-052):** the System Admin adds `crease` and `scratch` and turns off
  `abrasion` and `dirt` in Settings (no code; steps below). The simulator's unknown class is now
  `sim-unknown` instead of `scratch`.
- No page changes. The Camera page is still the Phase 3 placeholder (Phase 16 replaces it).

## 2. Files touched

| File                                                                                                                                                                    | Change                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `cv/cpoint_cv/{station,client,transport,retry,spool,sources,triggers,encode,doctor,env,logs}.py`                                                                        | New: the station                                                                    |
| `cv/cpoint_cv/{cli,config,payload}.py`                                                                                                                                  | `run` and `doctor` commands; server/station/camera settings; `captureId`, `batchId` |
| `cv/tests/*.py`                                                                                                                                                         | 77 new tests (133 in all), with fakes for HTTP, camera and model                    |
| `cv/config.example.toml`, `cv/.env.example`, `cv/README.md`                                                                                                             | New settings, the token file, run/doctor/failure docs, Settings steps               |
| `prisma/schema.prisma`, `prisma/migrations/20261019090000_scan_capture_id/`                                                                                             | `Scan.captureId` (nullable, unique)                                                 |
| `src/server/validators/scan.validator.ts`, `src/server/controllers/scan.controller.ts`, `src/server/services/scan-ingest.service.ts`, `src/server/models/scan.model.ts` | `captureId`: validate, look up, store; 200 on a repeat                              |
| `src/server/lib/leather-scan.ts`, `scripts/cv-simulate.ts`                                                                                                              | Unknown class `sim-unknown`                                                         |
| `tests/unit/{scan-ingest,cv-contract,demo-seed}.test.ts`, `tests/fixtures/cv-payload.json`, `tests/e2e/cv.spec.ts`                                                      | Tests for the above; e2e uses `sim-unknown`                                         |
| `docs/API.md`, `docs/DECISIONS.md`, `docs/*.md`                                                                                                                         | D-050, D-051, D-052, ROADMAP, STATUS, SESSION_LOG                                   |

Database migration in this change: **yes** (name: `20261019090000_scan_capture_id`)

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # applies scan_capture_id
npm run dev            # app on http://localhost:3000 (use PORT=3001 if 3000 is taken)
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change (Windows, PowerShell):

1. The station venv is `cv/.venv` on Dylan's laptop (torch 2.6.0+cu124, ultralytics 8.4.103) and
   the model is `cv/models/yolo-v1.pt`. If either is missing, follow "Set up" in `cv/README.md`.
2. **Device token:** sign in as `admin@cpoint.local`, open **API tokens**, create a token named
   `QA station` with scope `scans:create`, and copy it (it's shown once). Or from the repo root run
   `npm run cv:token`.
3. Create `cv/.env` (copy `cv/.env.example`) with `CV_DEVICE_TOKEN=<the token>`. If the app is on
   port 3001, add `CV_BASE_URL=http://localhost:3001`. Also set the token in the PowerShell window
   used for `curl.exe`: `$env:CV_DEVICE_TOKEN="<the token>"`.
4. **Photos:** copy the five photos from Dylan's `Sample Photos (CAP2)` folder into a new folder
   `cv/out/qa/` (any JPEG leather photos work; simulator images from
   `storage/uploads/scans/2026/10/` also work but show no real defects). Don't commit them.
5. Make sure at least one batch is **in progress at Preparation** before S3 (as
   `manager@cpoint.local`: Batches → New batch → Start), unless the scenario says otherwise.

Existing automated tests that cover this area (run these too):

```bash
npm run test
cd cv; .venv/Scripts/python -m pytest; .venv/Scripts/ruff check .; .venv/Scripts/ruff format --check .; .venv/Scripts/mypy
npm run build && npx playwright test tests/e2e/cv.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs: a batch at Preparation (step 5), the token (steps 2–3), the photos in
`cv/out/qa/` (step 4). **Run S3 before S4**: S3 shows what happens before the defect types are set
up, S4 sets them up.

## 5. Test scenarios

Station commands run from `cv/`. "Exit code" is the process exit code (`$LASTEXITCODE`).

| ID  | Role                        | Steps                                                                                                                                                                                                                                                                                                | Expected result                                                                                                                                                                                                                                                                                                                                                                                                          | Priority |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| S1  | none                        | `.venv/Scripts/python -m cpoint_cv doctor --no-camera` with the app running and `cv/.env` set                                                                                                                                                                                                        | Every line starts `ok`: Model file (SHA-256 `1d729fb0...` matches), Python 3.13, each pinned package, App (`... is up`), Device token (`accepted; next scan goes to B-...`), Clock (`within N s of the app`); last line "Everything the station needs is in place."; exit code 0                                                                                                                                         | High     |
| S2  | none                        | `.venv/Scripts/python -m cpoint_cv doctor` (with the camera check)                                                                                                                                                                                                                                   | Also `ok  Camera: camera 0 gives a picture`. If the laptop camera is busy (Teams, Camera app): `FAIL  Camera: Camera 0 couldn't be opened...` naming `[camera] index`; exit code 1                                                                                                                                                                                                                                       | Medium   |
| S3  | Quality Inspector (browser) | Before S4. Run `.venv/Scripts/python -m cpoint_cv run folder out/qa --interval 3`. Then sign in as the QI and open the review queue                                                                                                                                                                  | Console: "Next scan goes to B-... (roll ..., ...)" before each image, then one line per image like `<file>: B-... section N, <VERDICT> (<class> 0.NN ...)`, then "No more images to send."; exit code 0. Images with `crease` or `scratch` come back `NEEDS_REVIEW` and appear in the QI's review queue with that class shown as unknown. Latest scans (FM home or Scans) gains exactly one row per image, source Webcam | High     |
| S4  | System Admin (browser)      | Follow "Defect types for yolo-v1" in `cv/README.md`: Admin → Settings → Defect types; add `crease` (label Crease) and `scratch` (label Scratch); turn off `abrasion` and `dirt`. Then try to add `crease` again                                                                                      | The list shows crease, cut, hole, scratch active and abrasion, dirt inactive. The second `crease` is refused under the key field: `"crease" is already a defect type. Edit that one instead.`                                                                                                                                                                                                                            | High     |
| S5  | none                        | After S4, run S3's command again                                                                                                                                                                                                                                                                     | Images whose strongest detection was `crease`/`scratch` now get PASS, REWORK or REJECT (by confidence ≥ 0.60 / ≥ 0.90) instead of NEEDS_REVIEW. New rows appear in Latest scans, one per image; earlier scans are unchanged                                                                                                                                                                                              | High     |
| S6  | none                        | `.venv/Scripts/python -m cpoint_cv run webcam`. Hold a piece of leather (or anything) in view. Press **Space** once, wait for the result line, then press **Q**                                                                                                                                      | Console says "Press Space to capture this section, or Q to stop." One Space = exactly one result line and one new scan in Latest scans (label `webcam 0 #1`). Q stops with exit code 0                                                                                                                                                                                                                                   | Medium   |
| S7  | Floor Manager               | Make sure **no** batch is at Preparation (advance or complete them, or use a fresh DB without a started batch). Run `run folder out/qa --interval 3`. After the waiting message, start a batch in the app (Batches → New → Start)                                                                    | The station prints "No batch is at Preparation. Start one on the Batches page, then scan again. Waiting..." **once** and sends nothing. Within about 5 s of the batch starting it prints "Next scan goes to B-..." and sends the images                                                                                                                                                                                  | High     |
| S8  | none                        | Start `run folder out/qa --interval 5`. After the first result line, stop the app (Ctrl+C in the `npm run dev` window). Watch two more images, then press Ctrl+C in the station                                                                                                                      | Each image after the stop prints `couldn't send it (...) after 4 tries. It's saved; N waiting to send, in order.` or the "Can't reach the app at ..." waiting line (said once). On Ctrl+C: "Stopped." and "N capture(s) are saved and waiting to send...". `cv/out/spool/` holds N folders, each with `image.jpg` and `capture.json`                                                                                     | High     |
| S9  | none                        | After S8: start the app again, then `run file out/qa/<any photo>`                                                                                                                                                                                                                                    | The N spooled captures are sent **first**, oldest first (their result lines come before the new image's), then the new one. `cv/out/spool/` is empty. Latest scans shows each image once: no duplicates                                                                                                                                                                                                                  | High     |
| S10 | none                        | Duplicate guard by hand (PowerShell, repo root, a batch at Preparation): run twice `curl.exe -s -X POST http://localhost:3000/api/v1/scans -H "Authorization: Bearer $env:CV_DEVICE_TOKEN" -F "image=@cv/out/qa/<photo>.jpg" -F "detections=[]" -F "captureId=0199f0a1-7c2e-4a51-9d3f-2b8c4e6a1f00"` | First answer: `"duplicate":false` (HTTP 201). Second: the same `scanId` and `sequence` with `"duplicate":true` (add `-w "%{http_code}"` to see 200). Latest scans has one new row, not two                                                                                                                                                                                                                               | High     |
| S11 | System Admin                | Revoke the `QA station` token under API tokens. Run `run folder out/qa`, then `doctor --no-camera`                                                                                                                                                                                                   | `run` prints "The device token was refused. Ask the System Admin for a new one under API tokens and set CV_DEVICE_TOKEN." and exits with code 3; nothing is sent. `doctor` shows `FAIL  Device token:` with the same message; exit code 1. Create a new token and update `cv/.env` before continuing                                                                                                                     | High     |
| S12 | none                        | Put a text file renamed `broken.jpg` in a new folder `out/qa-bad/` together with one real photo; run `run folder out/qa-bad --interval 1`                                                                                                                                                            | For `broken.jpg`: "broken.jpg: can't be sent, the file can't be read as an image." and nothing is posted for it; the real photo is still sent; exit code 0                                                                                                                                                                                                                                                               | Medium   |
| S13 | Floor Manager               | Pinned batch closed before sending: do S8's steps until 1+ capture is spooled, then (app back up) advance that batch past Preparation in the app, then `run file out/qa/<photo>` with another batch at Preparation                                                                                   | The spooled capture prints "the app refused it: That batch isn't in progress at Preparation, so it can't receive scans. Kept in ...\out\failed\...". That folder has `reason.txt` with the message. The new photo goes to the batch now at Preparation                                                                                                                                                                   | Medium   |
| S14 | none                        | Open `cv/out/logs/station-<today>.jsonl`; search it for the token text                                                                                                                                                                                                                               | One JSON line per event (`captured`, `sent`, `send_failed`, `send_refused`, `waiting`, `stopped`) with `time`, `captureId`, `batch`, `httpStatus`, `attempts`. The token appears nowhere                                                                                                                                                                                                                                 | Medium   |
| S15 | none                        | Simulator still works: from the repo root `npm run cv:simulate -- --count 5 --interval 1`                                                                                                                                                                                                            | 5 lines with a batch, section and verdict; no errors. The simulator sends no `captureId` and is unaffected                                                                                                                                                                                                                                                                                                               | Medium   |
| S16 | none                        | Phase 14 re-run: S5 and S6 of `qa/handoffs/2026-10-19-phase-14-cv-core.md` (S6 now sets `path = "../models/yolo-v1.pt"` in the copied config)                                                                                                                                                        | As written in that handoff                                                                                                                                                                                                                                                                                                                                                                                               | Low      |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                                         | Expected                                                                                                                |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| A1  | Shoe Constructor               | Open `/camera`                                                                                        | Forbidden page, as before (unchanged)                                                                                   |
| A2  | Another device                 | Create a second token; repeat S10's `curl.exe` with the **second** token and the **same** `captureId` | `409` with "Another camera already sent a scan with this captureId. Make a new captureId for each capture." No new scan |
| A3  | No token                       | `curl.exe -s -X POST http://localhost:3000/api/v1/scans -F "image=@cv/out/qa/<photo>.jpg"`            | `401`                                                                                                                   |

## 6. Out of scope / known issues

- The Camera page still says "Not connected" 60 s after the last scan and doesn't show the model
  version. Phase 16 replaces that page; don't report it.
- `crease`/`scratch` scans sent before S4 stay as unknown-class scans (the QI decides them). Expected.
- The simulator and demo week still draw `abrasion` and `dirt`; after S4 those detections no longer
  decide a verdict (D-052). Expected.
- Verdict quality: the model is early (D-011 reads confidence as severity; Phase 16 decides the
  thresholds). Report crashes or wrong wiring, not weak detections.
- No overlap filter for duplicate boxes of one class (Phase 14 observation). Expected.
- The station's own unit tests cover a timeout after the app received the scan (retried with the
  same `captureId`), which can't be forced by hand; S10 covers the app side.
