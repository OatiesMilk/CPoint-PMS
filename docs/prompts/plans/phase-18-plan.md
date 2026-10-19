# Phase 18 plan: capture from the website

> Plan only. No code is written until Dylan approves. Source brief: `camera-capture-page.md`.

## 1. Setup results

- **Git:** `main` @ `95d80a8`, which is Phase 17 merged as PR #12, so Phase 18 builds on a clean
  `main`. Untracked: `camera-capture-page.md`, `phase-16-plan.md`, `phase-17-plan.md` (docs only).
  `docs/STATUS.md` still says Phase 17 is uncommitted; the wrap-up corrects it.
- **Newest QA report:** `qa/reports/2026-10-19-phase-16-camera-page-run2.md`, **PASS WITH
  ISSUES**, 4 of 4, with no app fault. **Phase 17 has no report yet** (its handoff
  `qa/handoffs/2026-10-19-phase-17-camera-window.md` hasn't been run). Nothing to fix first; if a
  Phase 17 report lands before I start building, I fix its failures first.

## 2. What I read and what the capture path reuses

| Piece                 | File                                                                            | Reused as                                                                                        |
| --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| The one decision path | `src/server/services/scan-ingest.service.ts` (`ingestScan`)                     | Unchanged logic. Its `device` argument becomes an **origin**: a device token or the website      |
| Batch rule            | `camera.service.ts` (`resolveCameraBatch`, `NO_BATCH_MESSAGE`)                  | The Capture page shows and pins the batch exactly as the station does (D-020, D-050)             |
| Decision engine       | `src/lib/decision-engine.ts`, `scan-decision.service.ts`                        | Untouched. The website never decides a verdict                                                   |
| Validation            | `scan.validator.ts` (`ingestFieldsSchema`, `MAX_IMAGE_BYTES`, `MAX_DETECTIONS`) | Same fields for the capture route, minus `detections` and `modelVersion` (the server makes them) |
| Image checks          | `server/lib/image-type.ts` (`sniffImageType`), storage service                  | Same byte check and storage                                                                      |
| Image decoding        | `sharp` (already a dependency, 0.35.5)                                          | Decodes the JPEG and letterboxes it for the model                                                |
| Mapping rules         | `cv/cpoint_cv/mapper.py`                                                        | Ported to TypeScript line for line: floor 0.25, renames, clip, round to 4, IoU 0.7, top 50       |
| Model output          | `cv/cpoint_cv/yolo_detector.py`                                                 | Boxes from the box head only (`Results.boxes`); masks ignored, as today                          |
| Guards                | `policies/guard.ts`, `permissions.ts`, `navigation.ts`                          | `requirePermission` on the page, `requireApiPermission` on the route, a new `camera:capture`     |
| Camera page           | `src/app/(app)/camera/page.tsx`, `camera.service.ts` (`cameraStatus`)           | Gains "from the Capture page" and a "Capture from this browser" route in the steps               |
| Station               | `POST /api/v1/scans` with a device token, `cpoint_cv`                           | **Unchanged.** The Phase 17 window keeps working as the fallback                                 |

## 3. Answers to your five questions (each with my recommendation)

### 3.1 Server or browser inference → **server, in the `app` container**

- **Why server:** the app already decides verdicts (D-011); with the model on the server the
  image and its detections come from the same place, so nobody signed in can post a made-up
  detection list. The browser only sends a photo. It also keeps one copy of the pre- and
  post-processing, works the same on the iPhone and every PC, and the page downloads nothing big.
- **Browser (not recommended):** `onnxruntime-web` would make each browser download the model
  (about 45 MB as FP32 ONNX) and the WASM runtime, and the app would have to trust detections a
  browser sends. A QI can already override verdicts, but a forged list would look like the AI's
  call in the record, which is worse for the panel.
- **What `node:24-alpine` means:** `onnxruntime-node` (1.30.0) ships prebuilt binaries for
  Windows, macOS and **glibc** Linux only. Alpine uses musl, so the binding fails to load there.
  **The runner (and build) stage moves to `node:24-bookworm-slim`.** Cost:
  - image size: Debian slim is about 50–70 MB bigger than Alpine, plus about 30–40 MB for the
    Linux x64 ONNX Runtime library (I copy only `bin/napi-*/linux/x64`, not the 300 MB package
    with every platform). I'll measure the real number in the Docker build and report it;
  - Prisma's engine on Debian needs `openssl` from apt (one line), and the `adduser` line changes
    to Debian's syntax;
  - CI's Docker job and the demo stack build the same way; `NODE_IMAGE` stays a build argument.
- **Time per capture:** the Python station takes about 780 ms on your laptop's CPU at 1536. ONNX
  Runtime on the CPU is usually as fast or faster, but Docker Desktop's WSL VM gets fewer cores, so
  I expect **about 1 to 2 seconds per capture** in Docker. The first build step measures it on your
  laptop (a small `npm run cv:bench` script) and the number goes in `MODEL_CARD.md`. One capture
  per section at a few seconds each is fine; the page shows "Checking the section…" meanwhile.
  Captures run one at a time on the server (a simple queue), so two people pressing together just
  wait a second longer and each gets their own scan.
- **No GPU in Docker.** `npm run dev` on the host could later use DirectML on Windows; not in
  this phase.

### 3.2 HTTPS on the LAN for the iPhone → **an mkcert certificate served by a small HTTPS listener inside the `app` container**

- Safari only opens the camera on `localhost` or a trusted HTTPS address. `localhost:3000` keeps
  working on the PC that runs the app.
- **How:** you run `mkcert` once on the server PC to make a local certificate authority and a
  certificate for its LAN IP and name (e.g. `192.168.1.20`, `cpoint.local`). The certificate and
  key go in `certs/` (git-ignored, never in the image), mounted read-only into `app`. The
  entrypoint starts a ~60-line Node HTTPS proxy (`docker/https.mjs`, no new dependency) on port
  **3443** next to `server.js` on 3000 only when the files are there. Still two containers (D-003).
- **The iPhone:** AirDrop `rootCA.pem` from mkcert, install the profile, then turn on full trust
  in Settings → General → About → Certificate Trust Settings. Other PCs import the same root once.
  The handoff has every step with screenshots for Codex to fill in.
- **Dev mode:** `npm run dev:https` runs `next dev --experimental-https` with the same mkcert files
  on `0.0.0.0`, so you can demo from your laptop without Docker.
- **Rejected:** Caddy or nginx would be a third container (D-003); a self-signed certificate
  without a trusted root doesn't open the camera on iOS.

### 3.3 Live preview → **the live camera picture, no live boxes**

- Live boxes need the model running continuously: in the browser (the download and trust problem
  above) or as many server calls at 1–2 s each, which isn't live and would slow real captures.
- So the page shows the plain live video. After Capture, the frame that was sent appears in **Last
  scan** with the app's boxes and verdict, which is what matters. No preview means no preview
  verdict to confuse with the app's (D-060 stays true by construction).

### 3.4 Who may capture → **QI and FM** (a new `camera:capture` permission)

- The same roles as `camera:manage` (choosing the camera's batch). Capturing judges nothing, and
  the FM can cover Preparation when no QI is on shift; flagged scans still wait for the QI (D-028).
  Admin doesn't capture (doesn't work the line). If you want QI only, it's a one-line change.
- **No person on the scan (D-008):** website scans have `deviceTokenId = null` and no new column.
  The audit row records the user as the actor, as every other mutation does.

### 3.5 Where the page sits in the nav → **its own item, "Capture", under Quality right after Camera**

- `/camera/capture`. It's the page the person at Preparation lives on, so it's one click away.
  The Camera page gets a **Capture from this browser** button, and the QI home gets a Capture card.

## 4. Design

### 4.1 Flow

```
Capture page (client component)
  getUserMedia(1920×1080, back camera on phones) → <video>
  Capture / Space → draw the frame on a canvas → JPEG (0.92) + captureId (crypto.randomUUID)
                    + capturedAt (press time) + batchId (the batch shown) + source
      │ multipart, session cookie
      ▼
POST /api/v1/scans/capture → scanController.capture (requireApiPermission("camera:capture"))
  → capture.service: sniff image → modelRunner.detect(bytes) (queued) → mapDetections
  → ingestScan({ …, detections, modelVersion }, { kind: "website", userId })
  → 201 { scan, detections, model }  (200 + duplicate: true for a repeated captureId)
```

### 4.2 The model in TypeScript (`src/server/lib/cv/`)

- `letterbox.ts` (pure math): scale = min(1536/w, 1536/h), centred padding with grey 114, and the
  inverse that maps model boxes back to fractions of the original image.
- `yolo-output.ts` (pure): reads the end-to-end head's `[1, 300, 6 + 32]` output (x1, y1, x2, y2,
  score, class, mask coefficients), keeps score ≥ floor, ignores the mask outputs, returns centre
  boxes like `RawDetection`.
- `mapper.ts` (pure): `to_box`, `class_key_for`, `iou`, floor, sort, same-class IoU 0.7 filter,
  top 50, identical to `mapper.py`, including the rounding.
- `model-runner.ts`: the port (`detect(image): { detections, inferenceMs }`) and the
  `onnxruntime-node` adapter, the only file that imports it. Loaded lazily on first use, warmed up
  once, one run at a time. A `FakeModelRunner` serves the unit tests, so CI never loads ONNX.
- `model-info.ts`: reads the model's sidecar `yolo-v1.json` (`names`, `imgsz`, `modelVersion`,
  ONNX SHA-256). `onnxruntime-node` doesn't expose ONNX metadata, so the export writes it beside the
  file. `modelVersion` stays `yolo-v1-1d729fb0` (the weights' version), so reports treat station and
  website scans as one model; the ONNX checksum is recorded in `MODEL_CARD.md`.

### 4.3 Exporting the model (`cv/`, one new command)

- `python -m cpoint_cv export-onnx` on your laptop: Ultralytics export with `imgsz=1536`, a fixed
  input, the recorded opset, then writes `cv/models/yolo-v1.onnx` and `yolo-v1.json`. Both stay
  git-ignored (D-049).
- Note on small differences: the `.pt` path pads to the nearest multiple of 32, the fixed ONNX input
  pads to a full square. Same weights, so results agree closely but not bit for bit; hence a
  tolerance below.

### 4.4 Parity (the two must agree)

- **In CI:** `tests/fixtures/mapper-parity.json`, made by a pytest helper from synthetic raw
  detections through `mapper.py` (edge cases: clipping, rounding, same-class overlap, more than 50,
  renames). A Vitest test runs the TS mapper on the same input and must match exactly. No photo, no
  model in git.
- **On your laptop (Codex):** `npm run cv:parity -- <image>` runs the ONNX model and compares with
  `python -m cpoint_cv predict <image> --json`: same class keys, confidence within 0.02, box edges
  within 0.01 of the image size. Run on the five sample photos; the result goes in the model card.

### 4.5 The model file in Docker

- `docker-compose.yml`: `./cv/models:/app/models:ro` bind mount on `app`, and
  `CV_MODEL_PATH=/app/models/yolo-v1.onnx`. Never in the image: `.dockerignore` keeps `cv`, `*.pt`
  and `*.onnx` out. Locally `.env` sets `CV_MODEL_PATH=cv/models/yolo-v1.onnx`.
- **Missing model:** the Capture page shows "The camera model isn't installed on the server. Put
  `yolo-v1.onnx` and `yolo-v1.json` in `cv/models/` (see cv/README.md), then restart the app." and
  keeps Capture off; the API answers **503 `MODEL_UNAVAILABLE`** with the same message.
- **Swap:** export the new model, replace the two files, restart `app`. The Camera page's Model
  card shows the new version after the next scan.
- New decision D-064 amends D-049: model files stay out of git and the image, but the app reads
  the ONNX file from a mounted folder at run time.

### 4.6 `ingestScan` without a token

- `device: { id }` becomes `origin: { kind: "device"; tokenId } | { kind: "website"; userId }`.
- `deviceTokenId` = the token for the station, `null` for the website. Audit actor = `DEVICE` or
  `USER`, `scan.create` either way, with `origin: "website"` in the audit detail.
- **captureId repeat check:** a repeat returns the first scan when it came from the same origin
  kind (same token, or both from the website). A station's captureId sent from the website, or the
  other way round, is the existing 409. captureIds are random UUIDs made in the browser, so they
  can't be guessed.
- `source`: the page sends `PHONE` on a phone or tablet and `WEBCAM` otherwise. No migration: both
  values exist.

### 4.7 The batch (D-020, D-050)

- The page shows "Next scan goes to B-2026-0017 · roll LR-0042 · School Shoe" and refreshes it
  every 20 s and when the tab comes back into view (the existing `GET /api/v1/batches/current`).
- Capture sends the **batch it showed**, like the station (D-050), because the section on the
  table came from that roll. If that batch has left Preparation, the app's 409 is shown in plain
  words, the page loads the new batch and says "B-2026-0017 has left Preparation. The next scan
  goes to B-2026-0018. Press Capture again." (The brief said "goes to the current batch and says
  so"; that contradicts D-050. See question 6.)
- No batch at Preparation: Capture is off and the page shows `NO_BATCH_MESSAGE` with a link to
  Batches.

### 4.8 The Capture page's states (every one designed, tokens only)

| State                | What the person sees                                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not a secure address | "The camera only works on a secure address. Open https://<this server>:3443/camera/capture, or use this page on the server PC at localhost." Capture off          |
| Asking permission    | "Allow the camera when your browser asks."                                                                                                                        |
| Permission denied    | Per browser: Safari "Settings → Apps → Safari → Camera → Allow", Chrome "the camera icon in the address bar → Allow". A **Try again** button                      |
| No camera            | "No camera was found. Plug in a webcam, or open this page on your phone."                                                                                         |
| Camera busy          | "Another app is using this camera. Close it (DroidCam or the camera station window), then Try again."                                                             |
| Model missing        | The message in 4.5. Live video still shows, Capture off                                                                                                           |
| No batch             | `NO_BATCH_MESSAGE`, link to Batches, Capture off                                                                                                                  |
| Ready                | Live video, camera picker (`enumerateDevices`, saved per browser), batch line, model version, **Capture** and "Space also captures"                               |
| Sending / checking   | The frozen frame with "Checking the section…", Capture off (one press, one scan)                                                                                  |
| Sent                 | Last scan: verdict badge (icon + label + verdict colour), section number, batch, defects found with confidence, the frame with boxes, **Open scan →**             |
| Batch moved          | The 4.7 message, with the new batch                                                                                                                               |
| Failed to send       | Retries a network error or 5xx three times with the same captureId. Then "Not sent: the server didn't answer. **Send again**" (same captureId, so never a double) |
| Refused              | The app's message (e.g. the image too large), and the capture is dropped                                                                                          |

Desktop first: video and Last scan side by side, stacking under `xl:` (D-034). The verdict colours
appear only in Last scan; boxes use the class colours from `overlay.py`, never verdict hues.

### 4.9 Camera page

- A website scan in the last minute shows **Camera active** "from the Capture page" (the current
  `camera` state, with `device` null read as the Capture page).
- "Connect the camera station" becomes **Ways to capture**: 1. this website's Capture page (button), 2. the camera station window (the existing steps).

## 5. Files to add or change

- **Model (server):** `src/server/lib/cv/{letterbox,yolo-output,mapper,model-info,model-runner}.ts`,
  `src/server/services/capture.service.ts`, `package.json` (`onnxruntime-node`; scripts `cv:bench`,
  `cv:parity`, `dev:https`), `scripts/cv-bench.ts`, `scripts/cv-parity.ts`.
- **API:** `src/app/api/v1/scans/capture/route.ts` (one-liner), `scan.controller.ts` (`capture`),
  `scan.validator.ts` (`captureFieldsSchema`), `scan-ingest.service.ts` (origin), `permissions.ts`
  (`camera:capture`), `server/lib/errors.ts` (503 helper if missing).
- **Page:** `src/app/(app)/camera/capture/page.tsx` (guarded server page), `capture-client.tsx`
  plus small parts (camera picker, last scan, state messages), `src/lib/capture-rules.ts` (pure:
  which state, messages, phone detection), `navigation.ts`, Camera page and QI home links.
- **Station (`cv/`):** `export-onnx` command, `tests/test_export.py`, the parity fixture helper.
- **Docker:** `Dockerfile` (bookworm-slim, openssl, only Linux x64 ONNX binaries), `docker/https.mjs`,
  `docker/entrypoint.sh`, `docker-compose.yml` (model mount, `certs` mount, port 3443),
  `.gitignore` (`certs/`), `.env.example` (`CV_MODEL_PATH`, `HTTPS_PORT`).
- **Docs:** `docs/API.md`, `cv/README.md`, `cv/MODEL_CARD.md`, `README.md` (HTTPS on the LAN),
  `docs/ROADMAP.md` (Phase 18), `STATUS.md`, `SESSION_LOG.md`, `DECISIONS.md` (D-064 onward),
  the QA handoff.

## 6. Risks and mitigations

| Risk                                    | Mitigation                                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Alpine can't load `onnxruntime-node`    | Move to `node:24-bookworm-slim`; the Docker build is a gate this phase                                      |
| Image grows                             | Copy only the Linux x64 runtime; report the before/after size                                               |
| CPU time in Docker                      | Measured first; one run at a time; a clear "Checking…" state. If it's over ~3 s, I tell you before going on |
| A forged detection list                 | Not possible: the server runs the model; the browser only sends a photo                                     |
| iOS Safari camera                       | HTTPS with a trusted root, `playsinline muted`, back camera by default, a plain message for each refusal    |
| Model missing in Docker                 | 503 and the page message; `/api/health` stays healthy (the rest of the app works)                           |
| Two people capturing at once            | Server queue; each scan locks its batch row as today, so sequence numbers never clash                       |
| Auth cookies over HTTPS and HTTP        | The proxy forwards `X-Forwarded-Proto/Host`; `trustHost` is on. Sign-in over 3443 is a handoff scenario     |
| Tab closed before a failed send retries | Said in the failed state. No browser spool this phase (the station keeps its spool)                         |
| Size of `npm ci` in CI                  | `onnxruntime-node` adds about 300 MB unpacked; acceptable, noted                                            |

## 7. Test plan

- **Unit (Vitest, run by me):** letterbox and its inverse; output decoding (floor, mask outputs
  ignored); the mapper parity fixture; `capture.service` with the fake runner (detections reach
  `ingestScan`, model missing → 503, one run at a time); `ingestScan` origins (website scan has no
  token, repeat captureId from the website returns the first scan, a station id from the website
  is 409); the capture route's permissions (QI and FM yes, Admin and constructor 403, signed out
  401); `capture-rules` state and message picks.
- **Station (pytest, ruff, mypy):** the export command with a fake exporter; the fixture helper.
- **Gates I run:** `npm run lint`, `typecheck`, `test`, `build`; the station's checks; the Docker
  image build (no `up`). `npm run cv:bench` on your laptop if the model file is there.
- **Codex (not run by me):** a new e2e spec for the Capture page with a fake camera (Chromium's
  `--use-fake-device-for-media-stream`); by hand: the server PC on localhost, the iPhone in Safari
  over HTTPS, every state in 4.8, `cv:parity` on the five photos, and a negative per feature
  (Admin can't open the page, a refused permission, a pulled model file, a closed batch).

## 8. Questions (one word each; my pick first)

1. **Inference:** server (recommended) / browser
2. **Base image:** move to `node:24-bookworm-slim` (recommended, needed for server inference) / keep Alpine
3. **HTTPS:** mkcert + HTTPS listener in the `app` container on 3443 (recommended) / something else
4. **Live preview:** live video only, boxes after Capture (recommended) / live boxes in the browser
5. **Who captures:** QI and FM (recommended) / QI only
6. **Nav:** own "Capture" item under Quality (recommended) / a tab on the Camera page
7. **Batch change between seeing and pressing:** keep the shown batch like the station, D-050
   (recommended) / send to the current batch and say so (the brief's wording)
