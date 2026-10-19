# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-19
**Branch:** `main` @ `dac8599` (Phase 16 merged as PR #11). Phase 17 is on the `main` checkout,
uncommitted (Dylan decides when to branch and commit; the team opens and merges the PR, D-032).
**Current phase:** Phase 17, the camera station window (built; waiting for Codex's hands-on run).
Brief: `camera-station-window.md`; plan: `phase-17-plan.md`.
**Overall:** 18 / 18 phases built

## Phase progress

- [x] 0. Foundation
- [x] 1. Data & auth
- [x] 2. Batches & stages
- [x] 3. CV skeleton
- [x] 4. Rework & salvage
- [x] 5. Inventory
- [x] 6. Admin
- [x] 7. Dashboards & reports
- [x] 8. Hardening & demo
- [x] 9. Procurement & review access
- [x] 10. Operations reports
- [x] 11. Material requests: naming, remarks, urgency, specific messages
- [x] 12. Item-level decisions guided by stock
- [x] 13. Ordering, delivery with proof, and the remaining gaps
- [x] 14. Camera YOLO model: intake and the inference core
- [x] 15. Camera station: capture, send, recover
- [x] 16. Camera page, a small model check, clean data and the demo
- [x] 17. The camera station window (Codex run pending)

## What works right now

- **Database:** 13 migrations (the latest is `defect_actions`: a "When found" action per defect type and two CV settings, D-053, D-055). UUIDv7 ids (D-018).
- **Bootstrap on start** (D-017):
  - reference data and the first System Admin;
  - demo users and inventory when `SEED_DEMO_USERS=true`. The demo constructor is a designated
    leather-roll requester.
- **Demo week** (D-026): `SEED_DEMO_WEEK=true` or `npm run demo:seed`.
  - 14 batches and about 290 scans, two left for review;
  - nine purchase requests covering every state: received with proof, partly received (a photo
    and a PDF), ordered and late, ordered by the Floor Manager, approved in part and waiting to
    be ordered, pending (High), rejected, cancelled by the requester, and cancelled after
    ordering. Proof files are generated samples.
- **Sign-in & access** (D-016, D-024, D-025, D-031):
  - 12-hour sessions, lockout, a role × permission matrix, and server-side sign-out;
  - the leather-roll flag is read fresh on every request.
- **Modules:**
  - batches (D-019) and the camera with the decision engine (D-011, D-020);
  - **flagged scans are decided by the Quality Inspector only** (D-028, team-confirmed). The FM
    sees them read-only;
  - rework & salvage (D-021, D-022), the inventory ledger (D-023), admin (D-024), reports (D-025).
- **Material requests / Procurement** (D-029, D-031, D-035 to D-045):
  - constructors see "Material requests", the FM and Admin "Procurement" (one label map);
  - every Shoe Constructor sends requests (1–10 items, with the stock snapshot, a required
    needed-by date and an optional first remark); **leather rolls** only by constructors the FM
    or Admin allows, also when typed;
  - urgency (High / Medium / Low) is worked out from the needed-by date by working days, shown
    as a badge, sorted and filterable; closed requests have none;
  - the FM approves or rejects **each item** (a reason for every rejection), saved together; the
    request is approved if at least one item is, rejected if every item is (D-039);
  - each item shows the stock now and when requested; an item above 2× its reorder level is
    flagged "Still in stock" and starts on Reject, a low one on Approve; the FM confirms every
    item (D-040);
  - the requester sees "1 of 2 items approved" and the reason on each rejected item;
  - the FM marks an approved request **as ordered**: a supplier from Settings, an optional
    reference, a required expected date; one order per request; nothing is sent to the supplier
    (D-041);
  - an ordered or partly received request past its expected date shows **Delivery late** (badge,
    filter, home card);
  - **Record delivery** takes a quantity per approved item (never more than outstanding), the
    delivery date and at least one **proof file** (JPEG, PNG, WebP or PDF, checked by its bytes,
    10 MB each); what arrived is posted as stock IN through the ledger; a short delivery leaves
    the request **Partly received** (D-042);
  - **Close short** ends a partly received request with a reason and keeps what never arrived;
  - proof files are private (FM, Admin, the requester on their own request) and never deleted;
  - the FM cancels an approved or ordered request **with a reason** until something arrives
    (D-043);
  - **Copy to a new request** on your own rejected or cancelled request; rejected items start
    unticked with their reasons (D-044);
  - the FM raises a request themselves (Procurement → New, or **Request** on a low inventory
    item), marked "Raised by Floor Manager", and approves it (D-045);
  - every request has a timeline and remarks;
  - the FM home card (to decide, to order, late), an Inventory "Requested" badge and "My
    requests" on the constructor home;
  - who may request leather rolls is chosen by the FM (Procurement tab) or the Admin (Users).
- **Camera page (Phase 16, D-054, D-055):** badges for Not connected, **Station connected**
  (the station checks in every 20 s while it waits for Space, through `batches/current`), Simulator
  active and Camera station active; a Model card with the last scan's `modelVersion` and an
  early-model notice (a Settings switch); "Connect the camera station" steps. Each scan's page shows
  the model and the rules used.
- **"When found" actions (D-053):** a defect type can be Rework or Reject when found (from "A
  defect counts as found at", default 50%); other types keep the two thresholds; the worst result
  decides. Migration `defect_actions` (13 migrations).
- **`npm run demo:reset` (D-056):** dry run by default; `-- --yes` keeps the demo accounts, the
  bootstrap admin and the `CV_DEVICE_TOKEN` token, removes all test data and files, sets cut/hole
  Reject and crease/scratch Rework when found (abrasion/dirt off) and seeds a fresh demo week. The
  dry run on the dev database found 135 test accounts, 131 tokens, 248 batches, 541 scans, 167
  requests, 172 items and 3,680 audit rows; Dylan had it run with `--yes` on 2026-10-19 (no
  backup, his call): four demo accounts, a fresh demo week of 14 batches and 293 scans.
- **Camera station window (Phase 17, D-059 to D-063):** `python -m cpoint_cv window`, or the
  **CPoint Camera** desktop shortcut (`python -m cpoint_cv shortcut`, to `cv/CPoint Camera.cmd`,
  which names the missing setup step when `cv/.venv` or a package is missing). Tkinter; the window
  runs the same `Station` loop on a worker thread.
  - **Check this machine:** `doctor`'s checks plus the GPU, each pass, warning or fail with its
    fix; failures block Start, warnings (no GPU → CPU, another package version, no batch, a clock
    2–5 minutes off) don't;
  - camera picker: numbers that give a picture, an address (DroidCam `http://<IP>:4747/video`),
    Default or DirectShow (`[camera] backend`); saved in `cv/station-window.json` (git-ignored),
    never with a password;
  - live preview at 960, up to 4 a second, boxes in class colours under a "Preview" banner, no
    verdict; Capture (or Space) sends the frame on screen at the press through the spool and
    `captureId` path at 1536; Last scan shows the app's verdict and section; "N waiting to send";
  - no batch keeps Capture off; a refused token stops with the fix; a dropped camera reconnects
    for 30 s, then stops; Stop frees the camera;
  - measured on the RTX 3060 for a frame in memory: about 35 ms at 960 and 55 ms at 1536.
- **Camera station (Phases 14–16, D-048 to D-058):** the `cpoint_cv` Python package in `cv/` runs
  `yolo-v1.pt` (`cv/models/`, git-ignored, SHA-256 in `cv/MODEL_CARD.md`), about 255 ms per image
  on Dylan's RTX 3060 and 780 ms on the CPU at `imgsz` 1536.
  - `predict <folder>`: detections, `modelVersion` (`yolo-v1-1d729fb0`), time and a preview verdict;
  - `run webcam | folder <dir> | file <image>`: asks which batch is at Preparation, captures one
    section per Space press (or every image in a folder), runs the model and posts the scan with
    that `batchId`, a `captureId` and `capturedAt`; prints the app's verdict. Captures wait in
    `cv/out/spool/` until the app has them; network errors and 5xx are retried, then sent later
    in order; refused scans go to `cv/out/failed/`; a refused token stops it (D-050);
  - `doctor`: model and checksum, versions, the GPU, camera, app, token and clock; `warn` lines
    don't fail it (D-061);
  - the app answers a repeated `captureId` with the first scan (200, `duplicate: true`), so
    retries never double a scan (D-051);
  - defect types: add `crease` and `scratch`, turn off `abrasion` and `dirt` in Settings, per
    database (`cv/README.md`, D-052), or run `demo:reset`. The simulator's unknown class is
    `sim-unknown`; the simulator and demo week now draw the model's classes;
  - same-class duplicate boxes (IoU ≥ 0.7) are sent once; `[camera] url` opens an IP camera
    (D-057);
  - `evaluate <folder>` compares preview verdicts with `labels.csv` (D-058):
    `cv/reports/2026-10-19-yolo-v1.md`, 5 of 5 on the five sample photos, labelled a small check;
  - `cv/README.md` has the model swap runbook and the demo script (station PC at the line, server
    in the office, browsers anywhere on the network).
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`.
- **Pagination** (D-047): every list that can grow pages at 15 rows with one pager; Settings
  and the leather-roll requesters have a Find box.
- **Form messages** (D-038): every message names the field and the fix; errors sit under their
  field, focus goes to the first invalid one, and a summary shows at 3 or more.
- **Quality:**
  - 537 unit tests pass (Vitest), plus 225 station tests (pytest; they also pass without OpenCV,
    torch or Pillow, as in CI). Phase 17's window is tested by hand (Codex, pending).
  - Phase 16 (Codex, 2026-10-19, run 1): 19 of 21 passed, the app end to end with the real
    station. S14 failed because Dylan's local `cv/config.toml` lacked the "When found" preview
    settings (now added; `predict`/`evaluate` warn when they're missing); one e2e assertion was
    stale (fixed); A4 axe was blocked on the connected states. Run 2: 4 of 4, including axe with 0
    violations on Station connected, Camera station active and Simulator active for every role,
    and the e2e admin and cv specs 14/14. No app fault remains. The e2e tests post their own
    `e2e-rule-*` defect types, so they don't depend on Settings.
  - Phase 15 (Codex, 2026-10-19, run 1): 18 of 19 scenarios passed, the model end to end on the
    website. The two failures (an e2e test still using `crease` as unknown, and `attempts` missing
    on refused log lines) and a duplicate `crease` row in Defects by type are fixed. Run 2: 5 of 6;
    the fixes all passed (e2e cv.spec 8/8, no duplicate-key warning, one row per type). The one
    failure was a wrong expectation in the handoff: the QI home card counts today only, and no
    `scratch` scan was taken today. No app fault remains. 75 e2e tests exist, with axe (WCAG 2.1 A/AA) on every page of every
    role and on the new procurement screens;
  - Phase 14 (Codex, 2026-10-19, runs 1–2): 9 of 10 scenarios passed, including the camera e2e
    spec 8/8 and the contract test. The one failure (S6) was a wrong step in the handoff, now fixed;
    S6 itself is not re-run. The missing-model message now names the config file and its folder;
  - Phase 13 in a browser (Codex, 2026-10-14): run 1 passed 47 of 54 manual checks, with one
    app fault (a chosen proof file could disappear) and six blocked. Run 2, after the fix, passed
    13 of 13, covering the fix and the six blocked scenarios. No known app fault remains;
  - Phase 13 e2e (Codex run 5, 2026-10-14): three parallel runs of 45: 44/1, 45/0, 45/0. The
    one failure was the full request-to-delivery test running past 30 s under load; it now has
    60 s (not re-run; CI runs it on the PR). The earlier colour-contrast and connection-reset
    findings were test and test-server issues and are fixed;
  - Docker demo-week check passed on 2026-10-14 (throwaway stack): 9 requests across every
    state, proof files on the uploads volume, stock equals the ledger, no second seed on restart;
  - ui-craft audit in `docs/UI_AUDIT.md`, now with a Phase 9 section;
  - CI checks the Docker stack with the demo week.

## Next step (exact)

1. Dylan: branch, commit and push Phase 17 and open the PR (D-032). `phase-16-plan.md` is old and
   can be deleted; `phase-17-plan.md` is this phase's plan.
2. Codex: run `qa/handoffs/2026-10-19-phase-17-camera-window.md` (the window by hand with the
   laptop webcam and the iPhone through DroidCam). Fix its failures before new work.
3. Dylan: after the demo, revoke the "Simulator" token (it was pasted in chat) and make a new one.
   Before the panel, `npm run demo:reset -- --yes` gives a clean week again.
4. `camera-station-window.md` is finished once Codex passes. Next work comes from the client
   follow-ups below (or, later, controlling the station from the Camera page).

Later:

- Phase 18 idea (Dylan, 2026-10-19, parked): capture from the QI's dashboard instead of a second
  app. A browser Capture page; the model as ONNX in the app container (`onnxruntime-node`, no
  third container, D-003); HTTPS on the LAN so other PCs and the iPhone's Safari may use the camera;
  decide who captures (QI only, or the FM too). Prompt written: `camera-capture-page.md` (Dylan to review, then run it as Phase 18).

- Apply CPoint's answers to the open questions below.
- Component tracking, once CPoint gives the component counts per shoe type.
- Optional for procurement: CSV export and monthly counts by status and category (never per
  person).

## Blockers

- None for the demo.

## Open questions / assumptions awaiting client confirmation

- Decided (D-028, team-confirmed 2026-10-05): only the QI resolves flagged (NEEDS_REVIEW) scans;
  the FM can't. This differs from survey Q5 ("whoever is available"), so tell CPoint. If no QI is
  on shift, flagged scans wait.
- Decided (D-031, team, 2026-10-05; survey Q14): every constructor can request materials, and only
  the allowed one(s), usually whoever orders leather, can request leather rolls. The FM approves
  all requests.
- Decided (D-011, team-confirmed; D-053, Dylan 2026-10-19): a defect type set to Rework or Reject
  "when found" gets that result from 50% confidence; other types: ≥ 90% → REJECT, 60–89% →
  REWORK, below 60% → PASS; an unknown class key → NEEDS_REVIEW. Confirm with CPoint which defect
  gets which action (the demo uses cut and hole → Reject, crease and scratch → Rework).
- ASSUMPTION: one scan = one leather section of the roll; reworked sections aren't re-scanned.
- ASSUMPTION: the sign-in lockout (5 tries / 15 minutes) and the 12-hour session suit factory
  shifts. Confirm the shift length.
- Decided (D-021/D-022, team-confirmed): salvage reused in a batch is shown separately, and a
  batch can be completed with repairs open ("In repair"). Still to confirm with CPoint.
- Decided (D-041, D-042, D-045; Dylan 2026-10-13): one order per request; a proof file is
  required for every delivery; the Floor Manager may approve their own request. Tell CPoint, and
  confirm a receipt or delivery note is always on hand when goods arrive.
- ASSUMPTION (D-029, D-044): requests aren't edited after they're sent (cancel, then copy to a new
  one); an order isn't edited after it's marked.
- ASSUMPTION (D-041): an expected delivery date can be up to 365 days ahead, and "late" starts the
  day after it, counting calendar days (not working days).
- ASSUMPTION (D-037, team 2026-10-10): urgency bands are High 0–3 working days or overdue,
  Medium 4–7, Low 8 or more; working days are Monday to Friday; holidays aren't skipped. Confirm
  all three with CPoint (does the factory work Saturdays?).
- ASSUMPTION (D-040, team 2026-10-13): an item is "still well stocked" above 2× its reorder
  level, and an item with no reorder level gets no stock guidance. Confirm the factor with CPoint.
- Decided (D-039, team 2026-10-13): the FM decides every item of a request in one save; a request
  can't be left half decided.
- Open (survey Q14): who orders leather rolls. Today only the Floor Manager can mark a request
  as ordered and record deliveries.
- ASSUMPTION (D-026): the demo week's stage times match the survey.
- Unknown: components per shoe type. Blocks component tracking only.
- Decided (D-052, Dylan 2026-10-19): defect types follow the model's own classes. `crease` and
  `scratch` are added and `abrasion` and `dirt` turned off in Settings, by hand per database; the
  bootstrap is unchanged; `demo:reset` applies it. The simulator and demo week draw the model's
  classes.
- Decided (D-050, D-051, Dylan 2026-10-19): Space captures one section; folder replay sends the
  default source (`WEBCAM`); scans carry an optional `captureId` so retries are safe.
- Decided (D-054 to D-058, Dylan 2026-10-19): station check-in through `batches/current`; the
  early-model notice is a setting; `demo:reset`; the duplicate-box filter and IP camera URL;
  `evaluate` with `labels.csv`, run on the five photos as a small check.
- Decided (D-059 to D-063, Dylan 2026-10-19): a Tkinter station window on the camera PC (not the
  website); the preview at 960 and 4 a second, Capture sends the frame on screen at full size;
  failures block Start, warnings don't; the camera choice in a git-ignored file; a `.cmd` launcher
  and a `shortcut` command.
- ASSUMPTION (D-061): a clock 2 to 5 minutes off is only a warning, because the app accepts those
  scans; only more than 5 minutes ahead blocks Start.
- ASSUMPTION (D-058): the five photos' expected verdicts in `labels.csv` were drafted by Claude
  from the photos; Dylan to confirm.
- Decided (D-049, Dylan 2026-10-19): model files stay out of git (`cv/models/`), not Git LFS.
- Pending: the new YOLO training photos will change the defect classes. They arrive as
  "unknown", go to the QI's review queue, and are added under Settings → Defect types.

## Known test observations

- Fixed: full e2e runs crashed Chromium late in the run, because helper pages were never closed.
  They're closed now; three local and two Docker full runs since passed 64/64.
- The single admin sign-in timeout seen once earlier was probably the same resource exhaustion. It
  hasn't recurred since the fix. Watch CI.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- On Dylan's PC another project's Vite server often holds port 3000. Start this app with
  `PORT=3001` then (`npm run dev -- --port` doesn't work here).
- Proof-of-delivery files are stored under `UPLOADS_DIR` (`./storage/uploads/pod/` locally, the
  `uploads` volume in Docker), beside the scan images. Back them up with the database.
- Local `.env` needs `AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD` and `DEMO_USER_PASSWORD`. With demo
  users on, `admin@cpoint.local` uses `DEMO_USER_PASSWORD`.
- `npm audit`: 4 unreachable highs in the Prisma CLI's dependencies (D-027).
- Cloud sandbox only:
  - Build Docker with `--build-arg NODE_IMAGE=<local base image>`, then `up -d`.
  - Use `-p <name>` (and other `DB_PORT`/`APP_PORT` values) for a throwaway stack beside the dev
    DB.
- After `npm run db:migrate`, run `npm run db:generate`.
- E2E:
  - `PLAYWRIGHT_CHROMIUM_PATH` without downloadable browsers.
  - Against Docker: `E2E_BASE_URL`, plus that stack's `DEMO_USER_PASSWORD` and `DATABASE_URL`
    (the helpers write to the DB).
  - The e2e tests create their own Shoe Constructor accounts, so the demo constructor's flag is
    never toggled by tests.
