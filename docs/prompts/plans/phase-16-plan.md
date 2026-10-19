# Phase 16 plan: Camera page, a small model check, clean data and the demo

Status: **waiting for Dylan's approval.** No code has been written.

## 1. Setup results

- **Where we are:** Phase 15 and its QA fixes are merged (`main` @ `57694eb`, PRs #9 and #10). The
  only untracked files are `camera-yolo-integration.md` (the prompt file) and `phase-15-plan.md`
  (old plan, can be deleted).
- **Newest QA report:** `qa/reports/2026-10-19-phase-15-camera-station-run2.md`, verdict FAIL, 5 of 6.
  The one failure was a wrong expectation in our handoff (the QI home card counts today only, and
  no `scratch` scan was taken today). I checked it against `STATUS.md` and the report: there is no
  app fault to fix. The next handoff will say "today only" wherever it mentions that card.
- **Carried from the Phase 15 thread:** clean out E2E data but keep the accounts; evaluate on the
  five sample photos and call it a small check; the open decisions listed in section 4.

## 2. What I'll build

### A. Clean, freshly organised data (`npm run demo:reset`)

A rerunnable script that goes through the service and model layers, in one transaction, and
writes one audit row for the reset itself.

- **Keeps:** the bootstrap System Admin and the four demo accounts (`DEMO_USERS`); shoe types,
  suppliers and inventory items that the bootstrap or demo seed define; all defect types; the
  CV thresholds.
- **Removes:** every other account (the throwaway E2E constructors and admins), batches, scans
  and detections, repair tickets, salvage, stock movements, purchase requests with their remarks,
  timelines and proof files, the audit log, and the scan and proof files on disk under
  `UPLOADS_DIR`. Shoe types, suppliers and inventory items that E2E tests added are removed too.
- **Resets:** stock to each item's starting level, the camera's chosen batch, and the
  leather-roll requester flag to the demo default.
- **Applies D-052 as data:** adds `crease` and `scratch` if missing, turns `abrasion` and `dirt`
  off. Idempotent, so it also fixes up a fresh Docker database.
- **Then** seeds a fresh demo week (`--with-demo-week`, on by default).
- **Safety:** refuses to run without `--yes`, refuses when `NODE_ENV=production`, and prints what
  it will remove (counts) before it does anything. The README tells you to `pg_dump` first.
  I'll run it on your dev database only after you say so.

### B. The simulator and demo week use the model's own classes

- The demo week draws classes from the **active defect types in the database**, so it follows
  Settings instead of a hardcoded list (`KNOWN_CLASSES` goes).
- The simulator can't read the database (it only talks to the API), so it uses the yolo-v1
  classes by default with a `--classes crease,cut,hole,scratch` override. `sim-unknown` stays.
- The synthetic leather image gets drawings for crease and scratch.

### C. Camera page (replaces the Phase 3 placeholder copy; same layout and tokens)

States, each with its own copy: no captures yet, no batch at Preparation, not connected,
**station connected and waiting** (see heartbeat below), simulator active, station active.

- Shows the model version of the last scan, and the early-model notice: _"Early model (yolo-v1).
  Results are for testing; the Quality Inspector checks every flagged section."_ The name comes
  from the scan's `modelVersion`; whether the notice shows is a setting (see question 3).
- "Connect a camera" becomes "Connect the camera station": create a token under API tokens, put
  it in `CV_DEVICE_TOKEN`, run `python -m cpoint_cv doctor`, then `python -m cpoint_cv run webcam`.
  The simulator line stays.
- Scan detail already shows the model version (`scans/[id]/page.tsx:223`); I'll check it reads
  clearly and label it "Model".

### D. Station heartbeat, with no new endpoint

The app already stamps a device token's `lastUsedAt` (at most once a minute) whenever it's used.
While the station waits for Space, it calls `GET /api/v1/batches/current` every 20 s, which keeps
that stamp fresh and also refreshes the "Next scan goes to …" line if someone changes the batch.
The Camera page shows "Connected, waiting for the next section" when a `scans:create` token was
used in the last 2 minutes and no scan came in the last minute. No contract change; one decision
entry.

### E. Confidence is not severity (needs your pick, question 1)

My recommendation, as data: each defect type gets an optional **action** in Settings (Rework or
Reject). If set, any detection of that class at or above a new **"Counts as found at"** setting
(default 0.50) gives that action, and the worst action wins. Types with no action keep today's
confidence rule (D-011). Unknown classes still go to review (D-028). Example defaults, which you
can change in Settings: hole → Reject, cut → Reject, crease → Rework, scratch → Rework.

- Five photos: the clear cut at 0.51 would no longer pass.
- Schema: `DefectType.action` (nullable) and `CvSettings.foundAtOrAbove`; one migration. The
  decision engine, the Python preview, the scan's `thresholdsSnapshot` and the Settings screen
  change; old scans keep the rule they were decided with.
- A new decision entry supersedes part of D-011.

### F. Station changes (small)

- **Overlap filter:** the same class with boxes overlapping by IoU ≥ 0.7 counts once (the
  highest confidence kept). Config `overlap_iou`, 0 turns it off.
- **IP camera:** `camera.device` accepts an index or a URL (`rtsp://…`, `http://…`); OpenCV
  opens both. `doctor` checks it.
- **No ONNX export:** 255 ms on the GPU and 780 ms on the CPU per capture is fine for one capture
  per key press.

### G. Small model check (`python -m cpoint_cv evaluate <folder>`)

Reads `labels.csv` in the folder (`file,expected_verdict,classes`, classes separated by `;`),
runs the model, and writes `cv/reports/<date>-yolo-v1.md`: verdict confusion table, per-class
precision and recall by image at the chosen floor, and a sweep of 0.5 to 0.9. The report opens
with "Small check on 5 photos. It shows the integration works; it doesn't measure the model."
It changes nothing in the app. You'd fill in the five labels (I'll draft them from the baseline for
you to correct).

### H. Docs

- `cv/README.md`: the model swap runbook (drop in `yolo-v2.pt`, config, `doctor`, `evaluate`,
  new classes in Settings, compare reports, switch) and the demo script.
- Demo script: reset, start the app, create a token, start a batch, run the station on the
  sample folder, watch the Camera page, resolve a flagged scan as the QI, see the repair ticket
  and the salvage item. Plus the layout for the panel: the station PC at the line, the server in
  the office, browsers anywhere on the LAN.
- STATUS, ROADMAP, DECISIONS (D-053 onward), SESSION_LOG, API.md (heartbeat note), and a QA
  handoff covering every Camera page state and the reset.

## 3. Rules kept

MVC layering, guards on every page and route, `runInTransaction` + `recordAudit` for every
mutation (including the reset), tokens only in the UI, no per-person data, defect types and
actions as data. Two containers only; the station stays outside Docker.

## 4. Questions (one word each; my pick first)

1. **Confidence vs severity:** per-class action (recommended) / keep D-011 and tune thresholds /
   keep D-011 and only document it.
2. **Heartbeat via `batches/current`:** yes (recommended) / no.
3. **Early-model notice:** a Settings switch (recommended) / always shown when the version starts
   with `yolo-v1` (hardcoded, not advised).
4. **Labels for the check:** `labels.csv` (recommended) / folder names.
5. **API tokens in the reset:** keep tokens made by kept accounts and still active (recommended,
   so your station's token keeps working) / remove all.
6. **Overlap filter and IP camera URL:** build both (recommended) / skip.

## 5. Gates

App: `npm run check` (lint, typecheck, unit tests, build). Station: ruff, the type checker,
pytest. E2E and browser tests: **not run (Codex)**, in the handoff. No branch, commit or push
without your word.
