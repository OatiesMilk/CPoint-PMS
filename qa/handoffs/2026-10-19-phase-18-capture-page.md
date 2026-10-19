# QA handoff: Phase 18, capture from the website

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Date            | 2026-10-19                                                               |
| Feature         | phase-18-capture-page                                                    |
| Branch          | `main` (uncommitted, on top of `95d80a8`)                                |
| Spec / prompt   | `camera-capture-page.md`; `docs/ROADMAP.md` Phase 18; `phase-18-plan.md` |
| Written by      | Claude                                                                   |
| Previous report | `qa/reports/2026-10-19-phase-16-camera-page-run2.md` (Phase 17 not run)  |

## 1. What changed

- **Quality Inspector and Floor Manager:** a new **Capture** page (sidebar: Quality → Capture,
  `/camera/capture`). It shows the live camera, says which batch the next scan goes to, and
  **Capture** (or Space) sends the frame on screen. The app runs the model itself and shows the
  verdict, section number, defects found and the frame with its boxes under **Last scan**. No other
  application is needed.
- The page has a message and a fix for each problem: not a secure address, camera permission
  refused, no camera, camera busy, model not installed, no batch at Preparation, the batch moved.
- A failed send is retried with the same capture id; it never makes a second scan.
- **Camera page:** "Capture page active" when the last scan came from the page; the steps card is
  now "Ways to capture" with the website first; a **Capture from this browser** button.
- **QI home:** a **Capture sections** button.
- **Other PCs and phones** use `https://<server IP>:3443/camera/capture` with an mkcert certificate.
- **System Admin and Shoe Constructor:** no Capture page (403 on the API, `/forbidden` on the page).
- Docker: the image is now Debian slim (was Alpine), mounts `cv/models` and `certs`, and listens on
  3443 when a certificate is there.
- The Python camera station and the Phase 17 window are unchanged.

## 2. Files touched

| File                                                                                 | Change                                                            |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `src/server/lib/cv/{mapper,yolo-output,model-info,model-runner}.ts`                  | New: the model in the app (ONNX Runtime)                          |
| `src/server/services/capture.service.ts`                                             | New: repeat check, model check, batch check, then `ingestScan`    |
| `src/server/services/scan-ingest.service.ts`                                         | `ingestScan` takes an origin: a device token or the website       |
| `src/server/controllers/scan.controller.ts`, `src/app/api/v1/scans/capture/route.ts` | New `POST /api/v1/scans/capture`                                  |
| `src/server/validators/scan.validator.ts`                                            | `captureFieldsSchema`                                             |
| `src/server/policies/permissions.ts`, `navigation.ts`                                | `camera:capture` (FM, QI); the Capture nav item                   |
| `src/app/(app)/camera/capture/*`                                                     | New page, client and Last scan card                               |
| `src/lib/capture-rules.ts`                                                           | Camera problems, messages, retries, phone detection               |
| `src/app/(app)/camera/page.tsx`, `quality-inspector/page.tsx`                        | Links, "Capture page active", "Ways to capture"                   |
| `src/components/features/app-shell/sidebar.tsx`                                      | Capture icon; only the longest matching item is marked            |
| `src/server/lib/env.ts`, `.env.example`, `next.config.ts`                            | `CV_MODEL_PATH`, `HTTPS_PORT`, `DEV_ORIGINS`; ONNX runtime traced |
| `Dockerfile`, `docker/entrypoint.sh`, `docker/https.mjs`, `docker-compose.yml`       | Bookworm slim, HTTPS listener, model and certs mounts             |
| `cv/cpoint_cv/onnx_export.py`, `cli.py`, `requirements-export.txt`                   | `python -m cpoint_cv export-onnx`                                 |
| `scripts/cv-parity.ts`, `package.json`                                               | `npm run cv:parity`, `npm run dev:https`, `onnxruntime-node`      |
| `tests/unit/*`, `cv/tests/*`, `tests/fixtures/cv-mapper-parity.json`                 | Unit tests and the shared mapper fixture                          |
| `tests/e2e/capture.spec.ts`, `tests/e2e/cv-helpers.ts`                               | New e2e spec (not run by Claude), `adminApi`                      |

Database migration in this change: **no**.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # apply migrations
npm run demo:seed      # optional: a past week of data (empty DB only)
npm run dev            # app on http://localhost:3000
```

Health check: `http://localhost:3000/api/health` returns OK. If port 3000 is taken on Dylan's
laptop, start with `PORT=3001`.

Extra steps for this change:

1. **The model files.** On Dylan's laptop they already exist: `cv/models/yolo-v1.onnx` and
   `cv/models/yolo-v1.json`. If not, run (in `cv/`):
   `.venv/Scripts/python -m pip install -r requirements-export.txt` then
   `.venv/Scripts/python -m cpoint_cv export-onnx`. Restart the app afterwards.
2. **Defect types.** The model's classes are `crease`, `cut`, `hole`, `scratch`. Run
   `npm run demo:reset -- --yes` only if Dylan agrees; otherwise check Settings → Defect types has
   all four active (`cv/README.md`, "Defect types for yolo-v1").
3. **A batch at Preparation:** Batches → New batch → Start production (Floor Manager).
4. **HTTPS for the iPhone (scenarios S12–S15).** Dylan's laptop has no mkcert yet:
   - `winget install FiloSottile.mkcert`, then `mkcert -install`;
   - find the laptop's LAN IP with `ipconfig` (on the iPhone hotspot it's `172.20.10.x`);
   - in the repo: `mkcert -cert-file certs/cert.pem -key-file certs/key.pem localhost 127.0.0.1 <IP>`;
   - trust the root on the iPhone: `mkcert -CAROOT` shows the folder; AirDrop `rootCA.pem` to the
     iPhone, open it, Settings → General → VPN & Device Management → Install, then Settings →
     General → About → Certificate Trust Settings → full trust;
   - **with Docker:** `docker compose up --build -d`, then `https://<IP>:3443/camera/capture`;
   - **or in development:** put `DEV_ORIGINS=<IP>` in `.env`, then `npm run dev:https` and open
     `https://<IP>:3000/camera/capture`.
   - Windows Firewall may ask to allow Node or Docker on private networks: allow it.
5. **The parity check (S16).** In `cv/`:
   `.venv/Scripts/python -m cpoint_cv predict "C:/Users/micro/OneDrive/Pictures/Sample Photos (CAP2)" --json > ../storage/py.jsonl`,
   then at the repo root:
   `npm run cv:parity -- "C:/Users/micro/OneDrive/Pictures/Sample Photos (CAP2)" --compare storage/py.jsonl`.

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/capture.spec.ts tests/e2e/cv.spec.ts tests/e2e/smoke.spec.ts
```

`capture.spec.ts` uses Chromium's fake camera. Its full-capture tests skip themselves when
`cv/models/yolo-v1.onnx` is missing, and a "no model" test runs instead.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs:

- At least one batch in progress at Preparation (S1–S9). Note its code.
- The laptop webcam, and the iPhone on the same network for S12–S15.
- A piece of leather or a photo of one on a screen to point the camera at.

## 5. Test scenarios

| ID  | Role | Steps                                                                                                                                                                                                                   | Expected result                                                                                                                                                                                                                               | Priority |
| --- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | QI   | Sign in. On the home page click **Capture sections**.                                                                                                                                                                   | `/camera/capture` opens; the sidebar marks **Capture** only (not Camera too); "Next scan goes to B-…" with the roll and shoe type of the batch at Preparation                                                                                 | High     |
| S2  | QI   | On the Capture page, allow the camera when Chrome asks.                                                                                                                                                                 | The live picture shows; **Camera** lists the laptop camera; **Model** says `yolo-v1-1d729fb0 runs on the server`; Capture is on with "Space also captures."                                                                                   | High     |
| S3  | QI   | Point at the leather and click **Capture**.                                                                                                                                                                             | The frozen frame shows "Checking the section…" for about a second, then **Last scan** shows a verdict badge (icon + label), "Section #N · B-…", the defects with percentages, and the frame with boxes; **Open scan** opens that scan         | High     |
| S4  | QI   | Press Space (focus on the page, not on a button). Then Tab to the Capture button and press Space once.                                                                                                                  | Each press makes exactly one new scan (section number goes up by one each time, never by two)                                                                                                                                                 | High     |
| S5  | QI   | Open the scan from S3 (Open scan).                                                                                                                                                                                      | Source is Webcam; the model is `yolo-v1-1d729fb0`; no device name; Admin → Audit log (as Admin) shows `scan.create` by the inspector                                                                                                          | Medium   |
| S6  | FM   | Sign in as the Floor Manager; open Quality → Capture; capture one section.                                                                                                                                              | Same as S2–S3; the FM may capture                                                                                                                                                                                                             | High     |
| S7  | QI   | Batches: as the FM, move every batch out of Preparation (or complete them). Wait up to 20 s on the Capture page as the QI.                                                                                              | "No batch is at Preparation, so Capture is off." with a Start a batch link; Capture is disabled with "Capture is off until a batch is at Preparation."                                                                                        | High     |
| S8  | QI   | With batch A shown on the Capture page, as the FM in another browser advance batch A past Preparation (keep batch B at Preparation), then immediately press Capture as the QI (within 20 s, before the page refreshes). | No scan saved; the amber note "The batch you saw has left Preparation, so this section wasn't saved. The next scan goes to B-(B). Press Capture again."; the batch line now shows B; the next Capture goes to B                               | High     |
| S9  | QI   | Open the Camera page within a minute of a capture.                                                                                                                                                                      | Badge "Capture page active"; "Sections are being captured on the Capture page. Last scan … ago."; card "Ways to capture" lists the website first; **Capture from this browser** button                                                        | Medium   |
| S10 | QI   | Rename `cv/models/yolo-v1.json` to `yolo-v1.json.bak`, reload the Capture page. Rename it back afterwards.                                                                                                              | Red alert "The camera model isn't installed on the server. Put yolo-v1.onnx and yolo-v1.json in cv/models/ …"; the live video still shows; Capture is off with "Capture is off until the model is installed."                                 | High     |
| S11 | QI   | In Chrome, block the camera for the site (camera icon in the address bar → Block), reload. Then click **Try again** after allowing it.                                                                                  | "This browser isn't allowed to use the camera." with the address-bar steps; after allowing and Try again, the live picture returns                                                                                                            | High     |
| S12 | QI   | On another PC or the iPhone, open `http://<IP>:3000/camera/capture` (plain http).                                                                                                                                       | "The camera only works on a secure address." naming `https://<IP>:3443/camera/capture`; no Try again button; Capture off                                                                                                                      | High     |
| S13 | QI   | iPhone, Safari, `https://<IP>:3443/camera/capture` (after the certificate steps). Sign in as the QI. Tap Allow for the camera.                                                                                          | No certificate warning; the back camera shows; the Camera list has the iPhone's cameras                                                                                                                                                       | High     |
| S14 | QI   | iPhone: tap **Capture**.                                                                                                                                                                                                | Last scan shows the verdict and section; the scan's source is Phone                                                                                                                                                                           | High     |
| S15 | QI   | iPhone: Settings → Apps → Safari → Camera → Deny; reload the page.                                                                                                                                                      | "This browser isn't allowed to use the camera." with the iPhone steps (Settings → Apps → Safari → Camera → Allow). Set it back to Allow afterwards                                                                                            | Medium   |
| S16 | —    | Run the parity check (section 3, step 5).                                                                                                                                                                               | Every photo says `agrees`; the last line says "All 5 photos agree with the station"                                                                                                                                                           | High     |
| S17 | QI   | Send a capture with the network off: on the laptop open DevTools → Network → Offline, press Capture, wait for the error, then set Online and click **Send again**.                                                      | "Not sent: the server didn't answer. … Nothing was saved twice."; after Send again one scan is saved (section number up by one only); Capture is off while the failed capture waits, with "Send the last capture again first, or discard it." | High     |
| S18 | QI   | Open the Camera picker while DroidCam (or the Phase 17 station window) holds the laptop camera, choose it.                                                                                                              | "Another app is using this camera." with what to close; Try again works once it's closed                                                                                                                                                      | Low      |
| S19 | —    | The station still works: `cd cv && .venv/Scripts/python -m cpoint_cv run folder "<Sample Photos (CAP2)>" --interval 2` with the device token.                                                                           | Scans arrive as before; the Camera page shows Camera station active                                                                                                                                                                           | Medium   |
| S20 | —    | Docker: `docker compose up --build -d` with the model in `cv/models` and no `certs`. Open `http://localhost:3000/camera/capture` as the QI and capture. `docker compose logs app`                                       | Capture works in Docker; the log says "No certificate in /app/certs: HTTPS is off"; `docker compose ps` shows two services                                                                                                                    | Medium   |
| S21 | QI   | Run axe on `/camera/capture` for the QI and the FM (the e2e spec does it for the FM) and with the camera blocked.                                                                                                       | No WCAG 2.1 A/AA violations                                                                                                                                                                                                                   | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                  | Expected                                      |
| --- | ------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------- |
| A1  | System Admin                   | Sidebar; `/camera/capture`                                                     | No Capture item; the URL goes to `/forbidden` |
| A2  | Shoe Constructor               | `/camera/capture`                                                              | `/forbidden`                                  |
| A3  | System Admin (API)             | `POST /api/v1/scans/capture` with a session cookie and a JPEG                  | `403 FORBIDDEN`                               |
| A4  | Signed out                     | `POST /api/v1/scans/capture`                                                   | `401 UNAUTHENTICATED`                         |
| A5  | A device token                 | `POST /api/v1/scans/capture` with `Authorization: Bearer cpt_…` and no session | `401` (the route takes sessions only)         |

## 6. Out of scope / known issues

- No live boxes on the Capture page, on purpose (D-067). Boxes appear on the captured frame only.
- No offline queue in the browser: a capture not sent when the tab closes is lost, and the page
  says so by keeping it in "Send again" until then.
- In Docker, ONNX Runtime prints a warning at start about a telemetry id; it is harmless.
- The layout follows the desktop design (D-034); on the iPhone it stacks but isn't a phone design.
- The first capture after the app starts takes about a second longer (the model loads).
- Do not test `onnxruntime-web` or GPU use: the model runs on the server CPU (D-064).
