# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-23
**Branch:** `main` has Phases 20 to 23 (#15), the agent-workflow docs (D-089, #16) and the demo
seed refresh (D-090, #17). The factory-visit plan (the visit notes, the brief and these doc
updates) is uncommitted, for a new branch from the latest `main` (Dylan commits; the team opens and
merges the PR, D-032).
**Agent workflow (D-089):** Claude builds; Codex runs QA and fixes failing CI checks from
`qa/CODEX_PROMPT_CI_FIX_<branch>.md` (`qa/README.md` → "CI fix loop"); every agent reads the
Obsidian vault (`C:\dev\capstone-obsidian`) first and records each change there.
**Current phase:** Phase 23, Production progression in place of stage monitoring. **QA passed**
(Codex run 2, 2026-10-22: R1 to R5; e2e 99 passed, 0 failed, 1 skipped). Run 1 failed on one
fault (wide tables were scroll boxes a keyboard couldn't reach), fixed with `ScrollRegion`. Plan:
`docs/prompts/plans/phase-23-plan.md` (1A Finish roll, 2B every 4 hours, 3B the QI only enters
check-ins, 4A 10 days, 5A a first quota from today). Follow-up 2026-10-22 (D-088): the Floor
Manager covers check-ins on a day no Quality Inspector is present. Phase 22 (Attendance) passed QA.
**Next: Phases 24 to 31 from the 23 Oct factory visit** (`docs/CPOINT_VISIT_10232026.md`), briefed
in `docs/prompts/factory-visit-changes.md` with Dylan's answers of the same day (C-1 to C-41). They
replace the old Phase 24 (materials used) of `production-progression.md`, which was never built.
**Overall:** 24 phases built (0 to 23); 8 planned (24 to 31, Phase 30 in two parts)

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
- [x] 17. The camera station window (retired by Phase 20, D-069)
- [x] 18. Capture from the website (checked in Phase 20 run 1; device checks need Dylan)
- [x] 19. Project cleanup and optimization (checked in Phase 20 run 1)
- [x] 20. Website-only camera, "Cut around or clean", supplier quality, no components (QA passed;
      device checks need Dylan)
- [x] 21. Repair Station, Floor view, constructor capture, no mkcert (QA passed; station checks
      need Dylan)
- [x] 22. Attendance (QA passed)
- [x] 23. Production progression in place of stage monitoring (QA passed)
- ~~24. Materials used, worked out from the check-ins~~ (replaced by the factory-visit plan;
  CPoint counts stock by hand)
- [ ] 24. Remove Material Requests and Procurement
- [ ] 25. Pass or Reject, a final verdict; remove the Review Queue, Repair Station and Salvage
- [ ] 26. Capture on the constructors' own phones; rolls start and finish there
- [ ] 27. Batches are the check-in intervals (lunch break, notices, failed pairs, no shoe types)
- [ ] 28. Each role sees only its modules; demo sign-in and reset on the login page
- [ ] 29. Inventory by stock count, reminders on Wednesdays and Fridays, weekly consumption
- [ ] 30. The whole-roll check (A, with real rolls) and the return to the supplier (B)
- [ ] 31. The documentation and the paper's figures match the system

## What works right now

- **Database:** 18 migrations (the latest is `production_progression`, D-082 to D-087, applied to
  the dev database on 2026-10-21; before it `attendance`, D-077; before it `user_can_capture`, D-075; before it `defect_handling`, D-070, and `drop_component_types`, D-071). UUIDv7 ids (D-018).
- **Bootstrap on start** (D-017):
  - reference data and the first System Admin;
  - demo users and inventory when `SEED_DEMO_USERS=true`. The demo constructor is a designated
    leather-roll requester.
- **Demo week** (D-026, D-090): `SEED_DEMO_WEEK=true` or `npm run demo:seed`.
  - 14 batches and about 120 scans (10 sections a roll, Capture page captures with model
    `yolo-v1-1d729fb0`, no device token), two left for review;
  - named demo accounts: Rodel Pascual (FM), Maricel Dizon (QI), Jerome Salazar (Admin), Noel
    Manalo (constructor; orders leather and may capture); four demo suppliers;
  - one past day the QI is absent: the FM captures and enters that day's check-ins (D-088);
  - nine purchase requests covering every state: received with proof, partly received (a photo
    and a PDF), ordered and late, ordered by the Floor Manager, approved in part and waiting to
    be ordered, pending (High), rejected, cancelled by the requester, and cancelled after
    ordering. Proof files are generated samples.
- **Sign-in & access** (D-016, D-024, D-025, D-031):
  - 12-hour sessions, lockout, a role × permission matrix, and server-side sign-out;
  - the leather-roll flag is read fresh on every request.
- **Modules:**
  - batches as leather rolls (D-082: Start roll, Finish roll; the old stage moves are gone) and
    the camera with the decision engine (D-011, D-020);
  - **flagged scans are decided by the Quality Inspector only** (D-028, team-confirmed). The FM
    sees them read-only;
  - the Repair Station (the Fixable board, D-021, D-022, D-070, D-073) and salvage, the inventory ledger (D-023), admin (D-024), reports (D-025).
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
- **Camera page (Phase 16, D-055; Phase 20, D-069):** badges **Capture page active** (or "Scans
  arriving" for a device token), **Simulator active** and **No recent captures**; a Model card with
  the last scan's `modelVersion` and an early-model notice (a Settings switch); "Ways to capture"
  (the Capture page; the simulator). Each scan's page shows the model and the rules used.
- **Fixable and the Repair Station (Phase 20, D-070; renamed in Phase 21, D-073):** the REWORK verdict reads **Fixable**
  everywhere a user sees it. Each defect type is **Clean before cutting** or **Cut around the
  marked area** (`handling`, Settings → Defect types → "When Fixable"; migration
  `defect_handling`, dirt → Clean). The board (`/rework`) is the **Repair Station** ("Clean the section or cut around the defect."): To handle,
  Being handled, Done, usable; each card says what the section needs.
- **Supplier quality (Phase 20, D-072):** Reports → Operations: per supplier the rolls, sections,
  Fixable %, Reject %, top defect and **High** (same rule as the attention item), worst first;
  **Rolls with the most rejects** (top 5) each with a **Claim sheet** (`/reports/claims/[batchId]`,
  Save as PDF through print; FM only; no person named). `suppliers.csv` and `supplier-rolls.csv`.
  The demo week spreads rolls over Marikina Leather Trading (more defects), Meycauayan Tannery and
  JM Leather Supply (Divisoria) (D-090).
- **Component tracking: removed** (Phase 20, D-071): no page, Settings tab, API or table
  (migration `drop_component_types`).
- **"When found" actions (D-053):** a defect type can be Fixable or Reject when found (from "A
  defect counts as found at", default 50%); other types keep the two thresholds; the worst result
  decides. Migration `defect_actions` (13 migrations).
- **`npm run demo:reset` (D-056):** dry run by default; `-- --yes` keeps the demo accounts, the
  bootstrap admin and the `CV_DEVICE_TOKEN` token, removes all test data and files, sets cut/hole
  Reject and crease/scratch Fixable when found (abrasion/dirt off) and seeds a fresh demo week. The
  dry run on the dev database found 135 test accounts, 131 tokens, 248 batches, 541 scans, 167
  requests, 172 items and 3,680 audit rows; Dylan had it run with `--yes` on 2026-10-19 (no
  backup, his call): four demo accounts, a fresh demo week of 14 batches and 293 scans.
- **Capture page (Phase 18, D-064 to D-067):** Quality → **Capture** (`/camera/capture`) for the
  QI and the FM (`camera:capture`). Live camera (a phone's back camera by default, a picker
  remembered per browser), "Next scan goes to …" refreshed every 20 s, **Capture** or Space sends
  the frame on screen; the app runs the model itself and **Last scan** shows the verdict, section,
  defects and the frame with boxes. No live boxes. A failed send retries 3 times with the same
  `captureId`, then **Send again**; a batch that left Preparation is refused before the model
  runs (`409 BATCH_MOVED`); every camera problem has its own message and fix.
  - `POST /api/v1/scans/capture` (session, not a token) → model → the same `ingestScan`. Website
    scans have no `deviceTokenId` and no person; the audit row names the user (`origin: "website"`).
  - The model: `python -m cpoint_cv export-onnx` writes `cv/models/yolo-v1.onnx` + `.json`
    (git-ignored); `onnxruntime-node` runs it on the CPU, about 0.65 s per 1920 × 1080 frame and
    1.2 s per 1536 square photo (host and Docker). `npm run cv:parity` matched the station on 7 of
    7 photos (the "rect" letterbox and OpenCV-style resize are needed for that). Missing files:
    `503 MODEL_UNAVAILABLE` and a message on the page.
  - Docker: `node:24-bookworm-slim` (ONNX Runtime has no Alpine build), 692 → 854 MB, 826 MB since
    Phase 19 (sharp's musl build left out, D-068);
    `cv/models` mounted read-only at `/app/models`. HTTPS comes from a Cloudflare Tunnel run on the
    host (D-076; mkcert and port 3443 removed in Phase 21). Still two containers.
  - **Floor view (Phase 21, D-074):** a full-screen mode of Capture for a monitor facing the
    operator: live preview, "Next scan goes to …", and after each capture a coloured frame and band
    (Pass green, Fixable orange, Reject red, Needs review blue) with the section and the bin, until
    the next capture. No sounds. Esc leaves; remembered per browser. Space on the station's
    keyboard captures (no pedal, Dylan 2026-10-20). Station guide: `docs/STATION_SETUP.md`.
  - **Constructor capture (Phase 21, D-075):** `User.canCapture`, set by the FM (Camera → Camera
    operators) or the Admin (Users → More actions); `canCaptureFor` guards Capture, its API,
    `batches/current` and the nav. They see the verdict and section, not Scans.
  - The Camera page shows "Capture page active" and "Ways to capture"; the QI home has
    **Capture sections**.
- **Model toolkit (`cv/`, Phases 14–16, D-048 to D-058; Phase 20, D-069):** the `cpoint_cv` Python
  package runs `yolo-v1.pt` (`cv/models/`, git-ignored, SHA-256 in `cv/MODEL_CARD.md`), about
  255 ms per image on Dylan's RTX 3060 at `imgsz` 1536.
  - `predict <folder>`: detections, `modelVersion` (`yolo-v1-1d729fb0`), time and a preview
    verdict; `evaluate <folder>` compares preview verdicts with `labels.csv` (D-058, 5 of 5 on
    the five sample photos, a small check); `export-onnx` writes the website's model files.
  - The station app (window, `run`, `doctor`, spool) was retired in Phase 20 (D-069). Device
    tokens and the token scan API stay for the simulator; a repeated `captureId` still returns the
    first scan (D-051). `DEDICATED_CAMERA` scans from before still show.
- **Attendance (Phase 22, D-077 to D-081):** Production → **Attendance** for the Floor Manager
  (the Admin views it). One day at a time: every active user on that day with a role badge and a
  Present tick, Find, a role filter and the 15-row pager, **Mark everyone present** and **Save
  attendance (N changes)**. Today and 7 days back are editable; older days are locked, the future
  refused. A stale save is `409 STALE`. The FM home has an **Attendance** card. `workforceFor` is
  the only worker count (constructors present / on the roster); Phase 23 reads it. No per-person
  history, count or streak anywhere (D-008). 12 demo Shoe Constructors (random passwords) and a
  week of attendance in the demo week; `demo:reset` keeps them.
- **Production progression (Phase 23, D-082 to D-087):** replaces stage monitoring.
  - **Schedule** (Production → Schedule and quota, FM): shift start and end, every 1 to 4 hours,
    working days; changes apply from tomorrow. Bootstrap default 08:00 to 17:00 every 4 hours,
    Monday to Saturday: check-ins at **12:00, 16:00 and 17:00**.
  - **Check-ins** (Production, the **QI**; the **FM only on a day attendance shows no QI present**,
    D-088): pairs finished since the previous check-in, per active
    shoe type, with notes; Due, Late after 30 minutes, Missed at midnight; one entry per slot
    (`409 STALE`); a same-day **Correct** needs a reason and the audit keeps both counts. The
    constructors present are read from attendance at save (never blocking).
  - **Daily quota** per shoe type for the whole line (FM), with a **suggestion** from the last 10
    full working days and **Use suggestion**; a first quota applies today, a change tomorrow.
  - **Production page:** today's check-ins, today against the quota with the pace, the last 14
    working days (chart and table) with one sentence for each short day ("Below quota by 18
    pairs. 3 of 12 Shoe Constructors were absent."). Never a name.
  - **Homes:** Next check-in (QI); Today's production replaces Batches by stage (FM).
  - **Operations report:** a Production section, KPI tiles Pairs made, Of quota, Rolls finished,
    Rolls at Preparation; "3 of the last 5 working days were below quota"; `production.csv`
    replaces `stages.csv`.
  - **Rolls:** Start roll (FM), **Finish roll** (FM or QI) with the hint "All 10 pieces scanned.
    Finish this roll?" on the batch and Capture pages; old batches past Preparation read "Started
    before rolls were tracked" and can be finished. The target quota left the batch form.
  - Demo week: quotas and the QI's check-ins (one late, one missed); its three short days line up
    with the absences. `demo:reset` clears check-ins, quotas and saved schedules.
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`.
- **Pagination** (D-047): every list that can grow pages at 15 rows with one pager; Settings
  and the leather-roll requesters have a Find box.
- **Form messages** (D-038): every message names the field and the fix; errors sit under their
  field, focus goes to the first invalid one, and a summary shows at 3 or more.
- **Quality:**
  - 714 unit tests pass (Vitest; 646 before Phase 23), plus 81 model-toolkit tests (pytest; they also pass without
    OpenCV or torch, as in CI).
  - Phase 20 (Codex, 2026-10-20, run 1, which also covered Phases 18 and 19): 56 of 69 passed, 4
    failed, 9 blocked; e2e 75 passed, 10 failed, 1 skipped (86). The app faults were old wording
    (a "Rework" button in Review, "the camera decided rework" in Override, "need rework" and "in
    repair" on Operations), no inline "Fixable must start below Reject" message in Settings →
    Thresholds, and "Sections scanned" in the Rolls CSV header. All ten e2e failures were stale
    tests. All fixed (lint, typecheck, 591 unit tests and build pass); e2e not re-run yet. Three
    blocked checks (P20 Q3, P18 S7, P19 S5) move to a throwaway `cpoint-qa` Docker stack in run 2;
    six still need Dylan's devices (P18 S3, S12 to S15, S18).
  - Phase 20 run 2 (Codex, 2026-10-20): 14 of 14 browser scenarios passed (R1 to R10, A1, and U1
    to U3 in a throwaway `cpoint-qa` stack, which unblocked P20 Q3, P18 S7 and P19 S5). E2E 81
    passed, 4 failed, 1 skipped. All four were test problems: two long tests hit the 30 s limit
    under the parallel run (the reset test and close-short; now 60 s), the Defect types row was on
    page 2 (now found with the Find box), and the smoke item code was too long with no reorder
    level. Fixed; lint, typecheck, 591 unit tests and build pass.
  - Phase 20 run 3 (Codex, 2026-10-20): two full e2e runs, each 84 passed, 1 failed, 1 skipped.
    The reset and close-short tests passed both times (the 60 s limit was right). The one failure
    was the Defect types test looking up rows by class key, but a row is named by its label; it now
    matches the key in the row's text.
  - Phase 20 run 4 (Codex, 2026-10-20): **PASS**. The fixed test passed alone; the full e2e suite
    85 passed, 0 failed, 1 skipped (the capture API test that needs missing model files).
  - Test data clean-up (2026-10-20, Dylan asked): the dev database was backed up to
    `storage/backups/before-cleanup-2026-10-20.dump` (git-ignored), then `npm run demo:reset -- --yes`
    removed 85 test accounts, 96 tokens, 182 batches, 223 scans, 95 requests, 109 items, 2,123 audit
    rows and the test shoe types, suppliers and defect types, and seeded a fresh demo week (14
    batches, 308 scans, 9 requests). The throwaway `cpoint-qa` stack (containers, volumes, network)
    was removed.
  - Phase 23 (Codex, 2026-10-22): run 1 FAIL, 45 of 46 scenarios, e2e 90 passed, 5 failed, 1
    skipped (one fault: wide tables not keyboard-reachable). Run 2 **PASS**: R1 to R5, e2e 99
    passed, 0 failed, 1 skipped.
  - Phase 22 (Codex, 2026-10-21): run 1 FAIL, 16 of 18 scenarios, e2e 92 passed, 2 failed, 1
    skipped (the summary dropped "· 0 others present"; the handoff named the wrong saver; two
    `auth.spec.ts` tests assumed untouched demo accounts). Run 2 **PASS**: R1 to R4, e2e 94 passed,
    0 failed, 1 skipped. Codex removed the attendance it added to the dev database both times.
  - Phase 21 (Codex, 2026-10-20): **PASS**, 29 of 31 scenarios; e2e 87 passed, 0 failed, 1
    skipped. Blocked: R4 (no batch with an open Fixable section at completion in the dev data) and
    F3 (the fake camera only gives Pass, so orange and red need real leather). Docker without
    certificates: health 200, only port 3000. Clean-up afterwards: backup
    `storage/backups/before-cleanup-2026-10-20-phase21.dump`, then `demo:reset -- --yes` removed 18
    test accounts, 20 tokens, 52 batches, 347 scans, 28 requests, 1,099 audit rows and the test
    types; fresh demo week (14 batches, 313 scans, 9 requests); Codex's `p21-floor` stack removed.
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

0. Dylan: commit the factory-visit plan on a new branch from the latest `main` (git commands from
   Claude) and open the PR (D-032).
1. Phase 24 in a new session: "Read `docs/prompts/factory-visit-changes.md` and run Phase 24. Stop
   for my approval before writing code." Don't run the old Phase 24 of `production-progression.md`.
2. Dylan: book time at the station for Phase 30A (two or three real rolls, two phones, a ruler and
   an A4 sheet). It can run any time after Phase 24.
3. Dylan (D-090): back up, then `npm run demo:reset -- --yes` for the new demo week.
4. Dylan, at the real station (`docs/STATION_SETUP.md`): the open device checks (F3, P18 S3, P18
   S18, R4) change with Phases 25 and 26 (two outcomes, no Repair Station, the constructors'
   phones), so they fit best with Phase 30A. Revoke the "Simulator" token first (it was pasted in
   chat).
5. Optional (Dylan's call): delete the two backups in `storage/backups/` and the old `certs/`
   files; `docker image prune -a -f` frees about 8.4 GB of unused Supabase images.

Later:

- Many open questions below close as Phases 24 to 31 land (procurement in 24; the review, repair,
  thresholds and salvage ones in 25; the roll and capture ones in 26; the check-in ones in 27).
  Each phase updates this list.

## Blockers

- None for the demo.

## Open questions / assumptions awaiting client confirmation

- Decided (Dylan, 2026-10-23, the factory visit; brief C-1 to C-41): the five modules go, Pass or
  Reject only and the camera's verdict is final, allowed constructors capture on their own phones,
  a batch is a check-in interval that carries on after lunch, failed pairs are recorded, stock is
  counted by hand with reminders on Wednesdays and Fridays, a cut from 3 inches is Not accepted, a
  roll over 10% defects is marked Return to supplier and the FM decides. Each phase records its
  D-entries.
- Decided (Dylan, 2026-10-23, the follow-ups): a scratch has no length limit (C-39); lunch is the
  only break (C-40); the daily quota counts only the pairs that passed inspection (C-41).
- The brief's other ASSUMPTIONS (A-1 to A-26) are confirmed or changed in Step 1 of their phase and
  added here when built.
- Decided (D-082 to D-087, Dylan 2026-10-21): a batch ends with Finish roll; check-ins every 4
  hours (12:00, 16:00, 17:00); only the QI enters them; the suggestion averages 10 full days; a
  first quota applies today. Tell CPoint that stage monitoring is gone.
- Decided (D-088, Dylan 2026-10-22): the FM enters the check-ins on a day attendance shows no QI
  present; with a QI present, or attendance not taken, only the QI can. Tell CPoint.
- ASSUMPTION (D-084): Late starts 30 minutes after a check-in's time; a check-in can be entered
  until midnight and corrected the same day only.
- ASSUMPTION (D-082): a roll gives about 10 pieces (the Finish hint). Phase 26 removes the hint:
  roll sizes vary and a section is a shot (C-33).
- ASSUMPTION (D-083): Monday to Saturday are working days for production (D-037's urgency still
  counts Monday to Friday).

- Closed (D-078; Dylan, 2026-10-23, C-38): every Shoe Constructor gets an account from the System
  Admin.
- Decided (D-077 to D-079, Dylan 2026-10-21): attendance is present or absent only (no reasons),
  taken by the Floor Manager for today and 7 days back, viewed by the Admin. Tell CPoint it is a
  one-day log book with no per-person history.
- Decided (D-028, team-confirmed 2026-10-05): only the QI resolves flagged (NEEDS_REVIEW) scans;
  the FM can't. This differs from survey Q5 ("whoever is available"), so tell CPoint. If no QI is
  on shift, flagged scans wait.
- Decided (D-031, team, 2026-10-05; survey Q14): every constructor can request materials, and only
  the allowed one(s), usually whoever orders leather, can request leather rolls. The FM approves
  all requests.
- Decided (D-011, team-confirmed; D-053, Dylan 2026-10-19): a defect type set to Fixable or Reject
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
- Closed (D-071, Dylan 2026-10-20): component tracking is out of scope.
- Decided (D-073 to D-076, Dylan 2026-10-20): the board is the Repair Station; Floor view with
  colour-coded bins (`docs/STATION_SETUP.md`); allowed constructors capture; HTTPS through a
  Cloudflare Tunnel. Tell CPoint about the bins and the station setup.
- Decided (D-069 to D-072, Dylan 2026-10-20): the station app retired, capture on the website only,
  no camera check button; "Fixable" and "Cut around or clean" with a Clean / Cut around setting per
  defect type; Supplier quality with a printable claim sheet per roll. Tell CPoint about the new
  wording.
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
- Decided (D-064 to D-067, Dylan 2026-10-19): server inference with ONNX Runtime on the CPU,
  `node:24-bookworm-slim`, mkcert with a listener in `app` on 3443, live video without boxes,
  QI and FM capture, a Capture nav item, and the station's batch rule (the brief's "current
  batch" was replaced on purpose).
- ASSUMPTION (D-067): a phone or tablet's captures are `PHONE`, a PC's `WEBCAM`, read from the
  browser. Tell CPoint if they want another split.
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
- `npm audit`: 9 highs, all in dev tooling (the Prisma CLI and eslint-config-next, D-027);
  none from `onnxruntime-node`.
- `onnxruntime-node` downloads a CUDA build on Linux unless `ONNXRUNTIME_NODE_INSTALL=skip`
  (set in the Dockerfile and CI). Dylan's old mkcert files are still in `certs/` (git-ignored, no
  longer used since D-076); delete them and run `mkcert -uninstall` when convenient.
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
