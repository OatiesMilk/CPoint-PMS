# Roadmap: System Rebuild

Do one phase per Claude Code session. Each phase ends with the quality gates in
`docs/prompts/system-rebuild.md` passing, the docs updated, and a commit and push of the working
branch, which the team merges into `main` by pull request (D-032). Phases 0–8 were built on
`system-rebuild`, now merged. Tick the boxes as they're done.

## Phase 0 — Foundation

- [x] `system-rebuild` branch created from the branch containing these docs, and pushed
- [x] ui-craft §9 run: legacy identity (logo, Figtree, sidebar, light/dark) captured in `DESIGN.md` + `src/styles/tokens.css`
- [x] Laravel/PHP code removed (keep `public/images/cpoint-logo.jpg`, `docs/`, `.claude/`, `CLAUDE.md`); `.gitignore` and `.claude/launch.json` updated for Next.js
- [x] Next.js (App Router, TS strict) + Tailwind + shadcn/ui scaffolded with the folder structure from the master spec
- [x] ESLint (with layer import restrictions), Prettier, Husky + lint-staged, Vitest, Playwright configured
- [x] Multi-stage `Dockerfile` (standalone, non-root, healthcheck), `.dockerignore`, `docker-compose.yml` (`app` + `db`)
- [x] `/api/health` checks DB connectivity
- [x] GitHub Actions CI: lint → typecheck → test → build
- [x] `.env.example`, README (dev + demo workflows), `CLAUDE.md` Commands section filled in

## Phase 1 — Data & auth

- [x] Full Prisma schema + first migration + indexes
- [x] Seed: 4 role accounts, shoe types, defect types, CV settings, sample supplier
- [x] Auth.js credentials login, hashed passwords, inactive users blocked
- [x] Policies (`can(user, permission)`) + middleware; 401/403/404 pages
- [x] App shell: sidebar with role-based nav, theme toggle (no flash), logged-in user menu
- [x] AuditLog helper used by every mutation
- [x] e2e: each role logs in and sees only its nav

## Phase 2 — Batches & stages

- [x] Batch list (filter by status/stage/shoe type), create, edit, cancel (the stage filter became
      a status filter in Phase 23)
- [x] Advance stage (no skipping; going backwards needs a reason) with `BatchStageLog`
      (**replaced in Phase 23, D-082**: a batch is one roll, Start roll then Finish roll)
- [x] Batch detail: stage timeline with durations (kept as History for old batches)
- [x] Unit tests for stage transitions

## Phase 3 — CV skeleton

- [x] Device API tokens (hashed, scoped, revocable)
- [x] `POST /api/v1/scans` + `GET /api/v1/batches/current` documented in `docs/API.md`
- [x] Decision engine (pure, unit-tested): ≥0.90 REJECT, 0.60–0.89 REWORK, <0.60 PASS, unknown class → NEEDS_REVIEW; thresholds configurable
- [x] Unknown class keys stored and flagged
- [x] Image storage via `StorageService` on the `uploads` volume
- [x] `npm run cv:simulate` generates realistic scans
- [x] Override any decision (QI + FM) with a reason; review queue for NEEDS_REVIEW scans
- [x] Scan detail with bounding-box overlay
- [x] "Latest scans" widget on the FM and QI overviews (5s polling)
- [x] Camera placeholder page

## Phase 4 — Rework & salvage

- [x] Rework tickets created automatically from REWORK (**done in Phase 3**); board OPEN → IN_PROGRESS → DONE
- [x] Salvage items created automatically from REJECT (**done in Phase 3**); assign to a later batch or discard
- [x] Batch counts service (usable = passed + rework done) shown on batch detail
- [x] Unit tests for counts

## Phase 5 — Inventory

- [x] Items CRUD with category, unit, reorder level (no delete: deactivate keeps the history)
- [x] Movements (IN/OUT/ADJUST) are the only way quantity changes
- [x] Low-stock alerts on the FM overview
- [x] Optionally consume a leather roll when creating a batch

## Phase 6 — Admin

- [x] Users CRUD, deactivate, reset password (temporary password, forced change, sessions ended)
- [x] Defect types, CV thresholds, shoe types, suppliers management (+ unknown classes panel)
- [x] Audit log viewer with filters
- [x] Component types table + "Coming soon" page; Constructor placeholder home (components
      removed in Phase 20, D-071)

## Phase 7 — Dashboards & reports

- [x] FM overview and QI overview (as specified in the master spec)
- [x] Daily summary (Manila day), defect analytics, AI agreement rate
- [x] Stage-duration / bottleneck chart (**replaced in Phase 23** by pairs per day against the quota)
- [x] CSV export
- [x] No per-person metrics anywhere (checked: report payload unit test + UI review, D-025)

## Phase 8 — Hardening & demo

- [x] Playwright smoke test per role covering the main flows (+ axe on every page)
- [x] ui-craft audit across all screens, findings fixed (`docs/UI_AUDIT.md`)
- [x] Demo seed: realistic week of data (D-026)
- [x] Clean `docker compose up --build` on a fresh machine, following the README word for word
      (sandbox: one documented base-image build arg; the CI docker job is the clean-runner check)
- [x] Panel-ready README: architecture diagram, ERD, setup, demo script

## Phase 9 — Procurement & review access

- [x] Review access: only the Quality Inspector decides flagged scans, enforced in the service
      (403), Floor Manager read-only on the scan and in the queue (D-028)
- [x] Purchase requests: schema, lifecycle (approve / reject with reason / cancel / receive into
      inventory), timeline, remarks, conditional updates and audit on every change (D-029)
- [x] Designated requesters, chosen by the Floor Manager or the System Admin, effective on the
      person's next request without signing out (D-030)
- [x] Views: list with status tabs and filters, request form with a stock-aware picker, detail
      with stock then and now, FM home card, Inventory "Requested" badge, constructor home
- [x] API under `/api/v1/procurement/**`, documented in `docs/API.md`
- [x] Seeds: demo constructor designated; the demo week has one request in each state
- [x] Tests: unit (rules, permissions, service, designation, seed), e2e journeys and access,
      axe smoke on the new pages
- [x] Client follow-up (D-031): every Shoe Constructor requests materials; only those the FM or
      Admin allows request leather rolls (also when typed); D-028 confirmed by the team

## Phase 10 — Operations reports

- [x] Floor Manager's Reports lands on **Operations**: key figures vs the previous period, "what
      needs attention", the line by stage with late batches, flow, time in each stage, repair
      station, materials at risk, purchasing, suppliers, and the checkpoint before cutting in brief
- [x] **Quality** tab kept for the FM; it is the Quality Inspector's only report, now with the
      repair station on top and a Pareto on defects
- [x] API: `/reports/operations`, `/reports/repairs`, three new CSVs (D-033)
- [x] Tests: unit (rules, service, no person keys), e2e updated for the new tabs
- [ ] Floor Manager home still shows the inspection split; decide whether it should lead with
      operations too
- [x] Layout adapts to narrower windows (D-034): icon-rail sidebar, auto-fit grids, wrapping
      button groups, tables scroll in their card

## Phase 11 — Material requests: naming, remarks, urgency, specific messages

Brief: `docs/prompts/material-requests.md`, Phase 11. Phases 12 and 13 are in the same file.

- [x] Naming (D-035): Shoe Constructors see **Material requests** (nav, titles, buttons, empty
      states, "My material requests" on their home); the Floor Manager and Admin see
      **Procurement**. One role → label map (`requestLabelsFor`); URLs, permissions and tables
      unchanged
- [x] Remarks replace the justification (D-036): optional Remarks box, saved as the first remark
      in the create transaction; migration copies old justifications into remarks, then drops the
      column
- [x] Automatic urgency (D-037): Needed by is required (today to 180 days ahead); High / Medium /
      Low from working days left, computed on read, never stored; badge with icon, label and days
      left; Pending sorted by needed-by date; urgency filter; High count on the FM home card and in
      the Operations report; `PurchasePriority` dropped
- [x] Specific messages system-wide (D-038): every validator message names the field and the fix;
      form-level alerts are built from the field messages; server field errors land on the exact
      input; focus moves to the first invalid field; a summary appears at 3 or more errors
- [x] Tests: unit (urgency bands and ranges, label map, first remark, validator-message sweep,
      field-error paths); e2e specs updated and extended
- [ ] E2E and browser checks are run by Codex through `qa/handoffs/` (not run in the build
      session)
- [ ] Docker demo-week check not run in this session

## Phase 12 — Item-level decisions guided by stock

Brief: `docs/prompts/material-requests.md`, Phase 12.

- [x] Per-item decisions (D-039): each line has `decision`, `rejectionReason`, `decidedById` and
      `decidedAt`; the decision panel lists every item with Approve or Reject (reason required),
      "Approve all remaining" and "Save decisions" in one transaction; the request status is
      derived from the items (`deriveRequestStatus`)
- [x] "Reject whole request" stays as the shortcut: one reason, every item rejected
- [x] Migration `20261013030000_purchase_line_decisions`: decided requests get their status copied
      onto their lines; rejected ones copy the reason to each line
- [x] The requester and the history show the result per item: "1 of 2 items approved", each
      rejected item with its reason, and one timeline event listing the items
- [x] Stock guidance (D-040): stock now and when requested next to each item; "Still in stock"
      badge above 2× the reorder level (`WELL_STOCKED_FACTOR`, one constant); well-stocked items
      pre-selected Reject with the reason filled in, low or out-of-stock items pre-selected
      Approve, items not in inventory "Not in inventory" with nothing selected; never decided
      automatically
- [x] Receiving adds only approved items to stock; a rejected item is no longer "requested" in
      Inventory or the Operations report
- [x] Tests: unit (status derivation for all-approved, mixed, all-rejected and still-pending; a
      concurrent decision; the well-stocked rule at exactly 2× and just above; reorder level 0;
      service and validator-message cases); e2e scenarios written (nails high, adhesive low; an
      undecided item; receive after a mixed decision)
- [ ] E2E and browser checks are run by Codex through `qa/handoffs/` (not run in the build
      session)
- [ ] Docker demo-week check not run in this session (the seed changed: one request is now
      decided item by item)

## Phase 13 — Ordering, delivery with proof, and the remaining gaps

Brief: `docs/prompts/material-requests.md`, Phase 13.

- [x] Ordering (D-041): "Mark as ordered" on an approved request with a supplier from Settings, an
      optional reference number, a required expected delivery date (today or later) and an optional
      note; one order per request; the request moves to ORDERED
- [x] "Delivery late" (D-041): ordered or partly received past the expected date; a badge in the
      list and on the request, a Delivery filter, and a line on the Floor Manager's home card
- [x] Deliveries (D-042): "Record delivery" takes a quantity per approved item (prefilled with
      what is outstanding, 0 allowed), the delivery date, proof files and a note; each quantity of
      an inventory item posts stock IN through the ledger in the same transaction; anything
      outstanding leaves the request PARTIALLY_RECEIVED; over-delivery is refused under the item
- [x] Close short (D-042): a partly received request is closed with a reason; it ends as received,
      marked "Closed short", and the history keeps what never arrived
- [x] Proof of delivery (D-042): required; JPEG, PNG, WebP or PDF by their bytes, 10 MB each, 5 per
      upload; stored under server-generated keys; served from a guarded route (FM, Admin, the
      requester on their own request) as private, `nosniff`, with a safe file name; never deleted,
      corrected by adding another file
- [x] Cancel after approval (D-043): the Floor Manager, with a reason, while nothing has arrived;
      after a delivery the page says to use Close short
- [x] Copy to a new request (D-044): on the requester's own rejected or cancelled request; the form
      opens prefilled, rejected items unticked with their reasons; both requests link to each other
- [x] Floor Manager restock (D-045): from Procurement → New or "Request" on a low inventory item;
      decided through the same item-by-item step; marked "Raised by Floor Manager"; no leather-roll
      OK needed
- [x] Views: seven status tabs with counts; the request page shows the order, each delivery with
      proof thumbnails or a PDF link, and what is still to come; the home card shows pending (with
      High), waiting to be ordered and late deliveries; the Operations report counts by the new
      statuses
- [x] Migration `20261013090000_purchase_ordering_deliveries`: two new statuses, order and
      closing fields, `PurchaseDelivery`, `PurchaseDeliveryLine`, `PurchaseAttachment`; each
      request received before the change becomes one delivery without proof; the stock movement
      moves from the request line to the delivery line
- [x] Demo week: nine requests, including one partly received with a photo and a PDF, one late
      delivery, one cancelled after ordering and one raised by the Floor Manager
- [x] Tests: unit (every move and refusal, receipt arithmetic in hundredths, late flag, file
      sniffing for all four types and a renamed program, service, validator-message and seed
      cases); e2e scenarios written (order → short delivery with proof → close short; a refused
      file; cancel an ordered request and copy it; copy with rejected items; FM-raised and late)
- [x] Browser checks by Codex through `qa/handoffs/`: run 1 (47 of 54 manual, one app fault
      fixed), run 2 (13 of 13 manual), runs 3–5 (e2e and axe; the last failures were test and
      test-server issues, fixed)
- [x] Docker demo-week check passed (2026-10-14, throwaway stack)

## Phase 14 — Camera YOLO model: intake and the inference core

Brief: `docs/prompts/camera-yolo-integration.md`, Phase 14. No app behaviour changes.

- [x] Model card (`cv/MODEL_CARD.md`): file, SHA-256, versions, task, classes, `imgsz`, metrics,
      intended use, limits and the AGPL-3.0 note; the file matched the brief
- [x] Layout (D-048, D-049): `cv/` with the `cpoint_cv` package, pinned `requirements.txt` and
      `requirements-dev.txt`, `config.example.toml`, `README.md`, `tests/` and a git-ignored
      `models/`; `*.pt`, `*.onnx` and `cv/models/*` ignored by git, `cv/` excluded from Docker
- [x] Detector port: `YoloDetector` (loads and warms up once; `imgsz` and device from config) and
      `FakeDetector`
- [x] Mapper: class keys from the model's own names plus an optional rename map, centre boxes to
      clipped top-left boxes, a confidence floor (0.25), sorted, at most 50, 4 decimals
- [x] `python -m cpoint_cv predict <image-or-folder>`: detections, `modelVersion`, time, a
      labelled preview of the app's verdict, a folder summary, overlays and a Markdown summary
- [x] Contract test on both sides: `tests/fixtures/cv-payload.json` written by pytest from the
      mapper, parsed by Vitest with `ingestFieldsSchema`
- [x] Station checks (ruff, mypy strict, pytest) pass without torch, also in a new CI job
- [x] Checks by Codex (runs 1–2): 9 of 10, camera e2e 8/8; the S6 failure was a handoff step, fixed
- [x] Baseline on five sample photos (`cv/MODEL_CARD.md`): 4 of 5 go to review today only
      because `crease`/`scratch` are unknown; a clear cut scored 0.51. A smoke test, not an
      evaluation; Phase 16's `evaluate` needs a larger held-out set

## Phase 15 — Camera station: capture, send, recover

Brief: `docs/prompts/camera-yolo-integration.md`, Phase 15. One additive contract field.

- [x] Frame sources (D-050): `run webcam` (one frame per Space press, Q stops), `run folder <dir>`
      (every image in order, `--interval`), `run file <image>`
- [x] Batch awareness: asks `GET /api/v1/batches/current` before each capture, prints
      "Next scan goes to B-…", pins that `batchId`; with no batch it waits and captures nothing
- [x] Sending: JPEG/PNG/WebP under 10 MB (quality steps down), `source` from config (folder replay
      too), `modelVersion`, `capturedAt` at capture; prints the app's verdict and section
- [x] Errors: 401/403 stop with the fix; 413/422/409 to `out/failed/` with the app's message;
      network and 5xx retried with backoff and jitter, then the spool, sent later in order
- [x] No silent duplicates (D-051): optional `captureId`, migration `scan_capture_id`; a repeat
      from the same device answers 200 with the first scan and writes nothing
- [x] Classes (D-052): Settings steps to add `crease` and `scratch` and turn off `abrasion` and
      `dirt` (`cv/README.md`); the simulator's unknown key is `sim-unknown`
- [x] Logging: JSON lines per event, never the token
- [x] `python -m cpoint_cv doctor`: model and checksum, versions, camera, app, token, clock
- [x] Unit tests with mocked HTTP: client statuses, retries, spool, payload, station loop, doctor
      (133 station tests, 508 app tests)
- [x] Codex: folder replay shows on the Camera page, Latest scans and the review queue
      (runs 1 and 2, `qa/reports/2026-10-19-phase-15-camera-station*.md`)

## Phase 16 — Camera page, a small model check, clean data and the demo

Brief: `docs/prompts/camera-yolo-integration.md`, Phase 16, plus Dylan's clean-data request.
Plan: `docs/prompts/plans/phase-16-plan.md`; Dylan took every recommended option.

- [x] Camera page: states for no captures, no batch, not connected, **station connected**
      (waiting), simulator and station active, each with its own copy; the model of the last scan;
      the early-model notice (a setting, D-055); "Connect the camera station" with the token,
      `doctor` and `run`
- [x] Station check-in (D-054): a waiting station asks for the batch every 20 s; no new endpoint
- [x] Confidence isn't severity (D-053): a "When found" action per defect type and "A defect
      counts as found at" in Settings; the worst outcome decides; migration `defect_actions`;
      snapshot and scan page show the rules used; the Python preview matches
- [x] Scan detail shows the model and the rules used
- [x] `evaluate` (D-058): `labels.csv`, verdict table, per-class precision and recall, a sweep;
      `cv/reports/2026-10-19-yolo-v1.md` on the five photos, labelled a small check (5 of 5)
- [x] Station: duplicate-box filter and IP camera URL (D-057); no ONNX (timings are fine)
- [x] Simulator and demo week use the model's classes (from Settings for the demo week)
- [x] `npm run demo:reset` (D-056): keeps the accounts and the station's token, removes test
      data and files, sets the yolo-v1 defect types, seeds a fresh demo week; dry run by default
- [x] Model swap runbook and demo script with the station/server/browser layout (`cv/README.md`)
- [x] Tests: 537 app unit tests, 156 station tests; the e2e tests post their own rule types
- [x] `npm run demo:reset -- --yes` run on the dev database (Dylan's word, 2026-10-19)
- [x] Codex: every Camera page state, Settings actions, the reset and the station check-in
      (run 1: 19 of 21, two stale-config/test failures fixed; run 2: 4 of 4, axe on every live
      state)

## Phase 17 — The camera station window

> **Retired by Phase 20 (D-069).** Capture happens on the website; the window, its launcher and
> the station runtime were removed. Kept here as history.

Brief: `docs/prompts/camera-station-window.md`. Plan: `docs/prompts/plans/phase-17-plan.md`; Dylan took every
recommended option (Tkinter, preview at 960 and 4 a second, Capture sends the frame on screen,
failures block Start, a `.cmd` launcher plus a `shortcut` command, the Camera page copy updated).

- [x] A desktop shortcut (`python -m cpoint_cv shortcut`) or `cv/CPoint Camera.cmd` opens the
      window without a terminal; with no `cv/.venv` or a missing package it names the setup step
      (D-063)
- [x] **Check this machine** lists every check as pass, warning or fail with its fix, the GPU
      included; Start stays off while a check fails (D-061)
- [x] The camera picker lists cameras that give a picture, takes an address (DroidCam's
      `http://<IP>:4747/video`) and offers DirectShow; the choice is saved in
      `cv/station-window.json`, never with a password (D-062)
- [x] Start shows a live preview with boxes labelled as a preview; Capture sends one scan through
      the spool and `captureId` path and shows the app's verdict and section number; Stop frees
      the camera; camera, model and HTTP run off the UI thread (D-059, D-060)
- [x] No batch keeps Capture off with the app's message; a refused token stops with the fix;
      unsent captures show as "waiting to send"; a dropped camera reconnects for 30 s, then stops
- [x] `run webcam`, `doctor`, `predict` and `evaluate` still work; `doctor` has the GPU line and
      warnings; CI's station job needs no display (225 station tests, also without OpenCV, torch
      or Pillow); no app contract change
- [x] Camera page "Connect the camera station" points at the shortcut and the window
- [ ] Codex: the window by hand with the laptop webcam and the iPhone through DroidCam (by number
      and by address), every state and check, and the negatives
      (`qa/handoffs/2026-10-19-phase-17-camera-window.md`)

## Phase 18 — Capture from the website

Brief: `docs/prompts/camera-capture-page.md`. Plan: `docs/prompts/plans/phase-18-plan.md`; Dylan took every
recommended option (server inference, bookworm-slim, mkcert with a listener in `app`, live video
without boxes, QI and FM, its own nav item, the station's batch rule).

- [x] A signed-in QI (or FM) opens Capture, picks a camera, sees the live picture, presses Capture
      or Space, and gets the app's verdict and section number, with no other application (D-067)
- [x] The model runs in the `app` container (ONNX Runtime, D-064); compose still has two
      services; the model file is never in git or the image (mounted at `/app/models`)
- [x] The detections match `cpoint_cv` within the tolerance: `npm run cv:parity` 7 of 7 photos
      (five samples and two 16:9 crops); the mapper fixture is exact in CI
- [x] No batch keeps Capture off; a retry never makes a second scan; one press makes one scan; a
      batch that left Preparation is refused before the model runs (`BATCH_MOVED`)
- [x] Camera permission refused, no camera, camera busy, model missing and a non-HTTPS address
      each show their own message and fix
- [x] HTTPS on the LAN: `docker/https.mjs` on 3443 with an mkcert certificate (D-065);
      `npm run dev:https` for development (both removed in Phase 21: Cloudflare Tunnel, D-076)
- [x] The station (`POST /api/v1/scans` with a token) and the Phase 17 window are unchanged; no
      person on scans (D-066); the Camera page shows "Capture page active" and "Ways to capture"
- [x] Tests: 590 app unit tests (53 new), 231 station tests; Docker image builds and runs the model
- [ ] Codex: the page on the server PC (localhost) and the iPhone in Safari over HTTPS, every
      state, `cv:parity`, and the negatives (`qa/handoffs/2026-10-19-phase-18-capture-page.md`)

## Phase 19 — Project cleanup and optimization

Brief: `docs/prompts/project-cleanup.md`. Plan: `docs/prompts/plans/phase-19-plan.md`; Dylan took
every recommended option (commit Phase 18 first, move off OneDrive, keep CUDA torch, Docker build
cache only, move the old plans, keep the QA screenshots). No behaviour change (D-068).

- [x] The folder's size and file count measured before and after: 8.49 GB / 89,533 files →
      6.68 GB / 87,196 files (`.next` 2.18 GB → 0.33 GB after one build); Docker build cache
      13.0 GB → 0.9 GB
- [x] Every gate passes; no flow, verdict, permission or API contract changes
- [x] Prompts and plans moved from the root to `docs/prompts/` and `docs/prompts/plans/`; live
      references updated (CLAUDE.md, ROADMAP, README, `cv/MODEL_CARD.md`, the handoff template)
- [x] README "Keeping the folder small"; `npm run clean`; clone into `C:\dev`
- [x] Docker image 854 → 826 MB (sharp's musl build left out); a throwaway stack is healthy
- [x] CI caches Playwright's Chromium by version
- [x] Nothing deleted from Dylan's machine, Docker or the repository without his word, except
      `.next` and `tsconfig.tsbuildinfo` (re-created by the build; see the session log)
- [x] Dylan: move the folder to `C:\dev\CPoint-PMS` and re-create `cv/.venv` (README); checked
      on 2026-10-20
- [ ] Codex: folded into the Phase 20 handoff (its Docker checks)

## Phase 20 — Website-only camera, "Cut around or clean", supplier quality, no components

Asked by Dylan on 2026-10-20 (five changes). Plan: `docs/prompts/plans/phase-20-plan.md`; Dylan
took every recommended option and no "Ready to capture" line (D-069 to D-072).

- [x] The CPoint Camera app and the station runtime (`run`, `doctor`, spool) are gone; `cv/` is
      the model toolkit (`predict`, `evaluate`, `export-onnx`); the Camera page has no station
      states (D-069)
- [x] No camera check button on the Capture page; the page already checks camera, model and batch
      (D-069)
- [x] "Rework" reads Fixable everywhere a user sees it; the board is Cut around or clean; each
      defect type is Clean or Cut around (migration `defect_handling`) and the board shows it
      (D-070)
- [x] The FM's Operations report has Supplier quality (rolls, Fixable %, Reject %, top defect,
      High) and the rolls with the most rejects, each with a printable claim sheet; two CSVs
      (D-072)
- [x] Component tracking removed: page, Settings tab, API and table (migration
      `drop_component_types`, D-071)
- [x] Typecheck, lint, unit tests, build, ruff, mypy and pytest pass; e2e specs updated and two new
      ones written (not run, project rule)
- [ ] Codex: `qa/handoffs/2026-10-20-phase-20-website-camera-and-reports.md`

## Phase 21 — Repair Station, Floor view, constructor capture, no mkcert

Asked by Dylan on 2026-10-20 after Phase 20 passed QA. Plan: `docs/prompts/plans/phase-21-plan.md`
(A, B and C as recommended; D-073 to D-076).

- [x] The board is named Repair Station everywhere; the page says "Clean the section or cut around
      the defect." (D-073)
- [x] Floor view on the Capture page: full-screen live preview, verdict frame and band until the
      next capture, Esc leaves, remembered per browser, no sounds (D-074)
- [x] "Can capture at the camera" for Shoe Constructors, set by the FM (Camera → Camera operators)
      or the Admin (Users); Capture, its API and the nav follow it (migration `user_can_capture`,
      D-075)
- [x] mkcert, the HTTPS listener and port 3443 removed; README "Reach the site with Cloudflare
      Tunnel" and `docs/STATION_SETUP.md` (D-076)
- [x] Typecheck, lint, unit tests (605) and build pass; e2e specs updated and new ones written
      (not run, project rule)
- [x] Codex: `qa/handoffs/2026-10-20-phase-21-repair-station-floor-view.md` (PASS, 29 of 31; R4 and
      F3 blocked)
- [ ] Dylan: a real station check (a second laptop on a quick tunnel, the webcam and a pedal)

## Phase 22 — Attendance

Asked by Dylan on 2026-10-21 (brief `docs/prompts/production-progression.md`). Plan:
`docs/prompts/plans/phase-22-plan.md` (1A, 2A, 3A as recommended; D-077 to D-081).

- [x] `AttendanceDay` and `AttendanceMark` (migration `attendance`), saved in one transaction
      with one audit row; a changed `updatedAt` is `409 STALE` (D-077, D-079)
- [x] Rules in `src/lib/attendance-rules.ts`: the roster (D-078), the edit window (D-079) and
      `workforceFor`, the only worker count (D-080)
- [x] Production → Attendance (`/attendance`): one day at a time, Find, role filter, 15-row pager,
      Mark everyone present, Save attendance (N changes), unsaved-changes prompt; read-only for the
      Admin and for locked days
- [x] Floor Manager home: the Attendance card
- [x] `GET /api/v1/attendance`, `PUT /api/v1/attendance/{day}` (`docs/API.md`)
- [x] Demo: 12 demo Shoe Constructors and a week of attendance; `demo:reset` keeps them (D-081)
- [x] Nothing shows a per-person figure (D-008)
- [x] Lint, typecheck, unit tests (646) and build pass; `tests/e2e/attendance.spec.ts` written and
      `auth.spec.ts` nav lists updated (not run, project rule)
- [x] Codex: run 1 FAIL (one app fault, the "· 0 others present" summary; three test or handoff
      mistakes), all fixed; run 2 PASS (e2e 94 passed, 0 failed, 1 skipped)

## Phase 23 — Production progression in place of stage monitoring

Asked by Dylan on 2026-10-21 (brief `docs/prompts/production-progression.md`). Plan:
`docs/prompts/plans/phase-23-plan.md` (1A Finish roll, **2B every 4 hours**, **3B the QI only**,
4A 10 working days, 5A a first quota from today; D-082 to D-087).

- [x] `ProductionSchedule`, `DailyQuota`, `ProductionCheckIn`, `ProductionCount` (migration
      `production_progression`); a slot takes one entry (`409 STALE`), every save audited
- [x] Rules in `src/lib/production-rules.ts`: slots, states (Late after 30 minutes, Missed at
      midnight), progress and pace, the quota suggestion, the shortfall sentence
- [x] A batch is one roll: Start roll, Finish roll (FM and QI, `batch:finish`), cancel; the stage
      moves are gone from the UI, the API and the rules (D-082, supersedes D-019's lifecycle)
- [x] Finish hint "All 10 pieces scanned. Finish this roll?" on the batch and Capture pages
- [x] Production (`/production`): today's check-ins with Enter count and Correct (QI), today
      against the quota, the last 14 working days with a chart and the shortfall sentences
- [x] Schedule and quota (`/production/plan`, FM): a schedule change from tomorrow, a quota per
      shoe type with the suggestion and Use suggestion, history of both (15 per page)
- [x] Homes: Next check-in (QI); Today's production replaces Batches by stage (FM)
- [x] Reports → Operations: a Production section, new KPI tiles, a below-quota attention item;
      `production.csv` replaces `stages.csv`; the stage sections are gone
- [x] Bootstrap default schedule (08:00 to 17:00, every 4 hours, Mon to Sat); demo week quotas and
      check-ins whose three short days line up with the absences; `demo:reset` clears them
- [x] Nothing per person (D-008): day rows carry no name; the only name is who entered a check-in
- [x] Lint, typecheck, unit tests and build pass; `tests/e2e/production.spec.ts` written and the
      batch, outcome, report, smoke and nav specs updated (not run, project rule)
- [x] Follow-up (Dylan 2026-10-22, D-088): the Floor Manager covers check-ins on a day no Quality
      Inspector is present
- [x] Codex: run 1 FAIL (one fault, wide tables not keyboard-reachable), fixed; run 2 PASS (e2e
      99 passed, 0 failed, 1 skipped)

## Phases 24 to 31 — What CPoint asked for on the 23 October 2026 factory visit

Asked by CPoint on the factory visit (`docs/CPOINT_VISIT_10232026.md`); Dylan answered the
questions the same day. Brief: `docs/prompts/factory-visit-changes.md` (confirmed rules C-1 to
C-38, assumptions A-1 to A-26, each phase's **Done when**). It replaces the old Phase 24
(materials used, worked out from the check-ins) of `docs/prompts/production-progression.md`, which
was never built. Each phase gets its own criteria here when its plan is approved.

- [ ] Phase 24: remove Material Requests and Procurement
- [ ] Phase 25: Pass or Reject, a final verdict; remove the Review Queue, Repair Station and
      Salvage
- [ ] Phase 26: capture on the constructors' own phones; rolls start and finish there; Reports →
      Rolls
- [ ] Phase 27: batches are the check-in intervals (lunch break, on-screen notices, pairs finished
      and failed, no shoe types)
- [ ] Phase 28: each role sees only its modules; demo sign-in and reset on the login page
- [ ] Phase 29: inventory by stock count, reminders on Wednesdays and Fridays, weekly consumption
- [ ] Phase 30A: can the camera measure a whole roll? A check with real rolls (`cv/` only)
- [ ] Phase 30B: cuts from 3 inches Not accepted; a roll over 10% defects marked Return to
      supplier, the FM decides
- [ ] Phase 31: the documentation and the paper's figures match the system
