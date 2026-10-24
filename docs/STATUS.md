# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-24
**Branch:** `main` has Phase 25 (#21, CI green). Uncommitted, for a new branch from the latest
`main` (Dylan commits): the Phase 25 QA run 1 fixes and Codex's report.
**Agent workflow (D-089, D-092):** Claude builds and fixes every failure, failing CI checks
included; Codex only tests and reports; every agent reads the Obsidian vault
(`C:\dev\capstone-obsidian`) first and records each change there.
**Current phase:** Phase 25, Pass or Reject (D-093, D-094). **Merged; QA run 1 FAIL, fixes
ready for run 2** (report `qa/reports/2026-10-24-phase-25-pass-or-reject.md`, run 2 prompt
`qa/CODEX_PROMPT_PHASE_25_RUN2.md`). Run 1: 22 of 24 scenarios, e2e 71 passed, 1 failed. No app
fault in the Pass or Reject rule, the removals, Settings or reports. Migration `pass_or_reject` is
applied to the dev database. Phase 24 passed QA (18 of 18) on 2026-10-23.
**Then: Phases 26 to 31 from the 23 Oct factory visit** (`docs/CPOINT_VISIT_10232026.md`, brief
`docs/prompts/factory-visit-changes.md`, C-1 to C-41).
**Overall:** 26 phases built (0 to 25); 6 planned (26 to 31, Phase 30 in two parts)

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
- [x] 9. Procurement & review access (procurement removed in Phase 24, D-091)
- [x] 10. Operations reports
- [x] 11. Material requests: naming, remarks, urgency, specific messages (removed in Phase 24)
- [x] 12. Item-level decisions guided by stock (removed in Phase 24)
- [x] 13. Ordering, delivery with proof, and the remaining gaps (removed in Phase 24)
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
- [x] 24. Remove Material Requests and Procurement (QA passed, 18 of 18)
- [x] 25. Pass or Reject, a final verdict; remove the Review Queue, Repair Station and Salvage
      (merged; QA run 1 FAIL, fixes ready)
- [ ] 26. Capture on the constructors' own phones; rolls start and finish there
- [ ] 27. Batches are the check-in intervals (lunch break, notices, failed pairs, no shoe types)
- [ ] 28. Each role sees only its modules; demo sign-in and reset on the login page
- [ ] 29. Inventory by stock count, reminders on Wednesdays and Fridays, weekly consumption
- [ ] 30. The whole-roll check (A, with real rolls) and the return to the supplier (B)
- [ ] 31. The documentation and the paper's figures match the system

## What works right now

- **Pass or Reject (Phase 25, D-093, D-094):**
  - every section is **Pass** or **Reject** and the camera's verdict is final: no review, no
    override, no correction (C-21). `aiVerdict` and `finalVerdict` are both kept and always equal;
  - each defect type has an outcome, **Usable** or **Not accepted** ("When found", a required
    choice in Settings → Defect types). A detection at or above "A defect counts as found at"
    (50%) gives its type's outcome; any Not accepted → Reject, otherwise Pass. An unknown class →
    Reject, listed under Settings → Unknown classes (the Admin home says when some are waiting);
  - Settings → Thresholds keeps found-at and the early-model notice; the two confidence
    thresholds are gone (old keys get a named 422);
  - rejected sections are reported **for salvage**: Reports → Quality (Scanned, Pass, Reject (for
    salvage)), Operations (Reject rate KPI, a For salvage card, Supplier quality by Reject % with
    Pass %); the CSVs follow. The system moves no leather (A-11);
  - Capture and Floor view show green Pass ("Goes on to cutting") or red Reject ("Set aside for
    salvage"); `docs/STATION_SETUP.md` has two bins;
  - removed: `/review`, `/rework`, `/salvage` (404), their APIs, `POST /scans/{id}/decision`,
    `/reports/repairs`, five permissions, three nav items, the tables `rework_tickets` and
    `salvage_items`, and the scan status and override columns. Their audit rows stay as history;
  - migration `pass_or_reject` converts first (A-10): Fixable → Pass, Needs review → Reject, a
    pending scan takes its converted camera verdict; a type's Rework → Usable, Reject or no action
    → Not accepted;
  - a new database gets crease and scratch Usable, cut, hole, abrasion and dirt Not accepted
    (A-13 and plan question 3); `demo:reset` sets cut and hole Not accepted, crease and scratch Usable, abrasion and
    dirt off;
  - the `cv/` preview, `predict` and `evaluate` use the same rule (`[preview.outcomes]`; old keys
    in a local `config.toml` warn).
- The bullets below are from before Phase 25. Where they mention Fixable, Needs review, the
  Repair Station, Salvage, review or two thresholds, Phase 25 replaced them.
- **Database:** 20 migrations (the latest is `pass_or_reject`, D-093/D-094; before it
  `drop_procurement`, D-091; before it
  `production_progression`, D-082 to D-087, applied to the dev database on 2026-10-21; before it `attendance`, D-077; before it `user_can_capture`, D-075; before it `defect_handling`, D-070, and `drop_component_types`, D-071). UUIDv7 ids (D-018).
- **Bootstrap on start** (D-017):
  - reference data and the first System Admin;
  - demo users and inventory when `SEED_DEMO_USERS=true`.
- **Demo week** (D-026, D-090): `SEED_DEMO_WEEK=true` or `npm run demo:seed`.
  - 14 batches and about 120 scans (10 sections a roll, Capture page captures with model
    `yolo-v1-1d729fb0`, no device token), two left for review;
  - named demo accounts: Rodel Pascual (FM), Maricel Dizon (QI), Jerome Salazar (Admin), Noel
    Manalo (constructor; may capture); four demo suppliers;
  - one past day the QI is absent: the FM captures and enters that day's check-ins (D-088);
  - two deliveries in the week as plain stock IN ("Delivery from …"); no requests (D-091).
- **Sign-in & access** (D-016, D-024, D-025):
  - 12-hour sessions, lockout, a role × permission matrix, and server-side sign-out;
  - the Shoe Constructor has no permission in the matrix (D-091); the camera switch (D-075) is
    read fresh on every request, and their home shows Capture or who grants it.
- **Modules:**
  - batches as leather rolls (D-082: Start roll, Finish roll; the old stage moves are gone) and
    the camera with the decision engine (D-011, D-020);
  - **flagged scans are decided by the Quality Inspector only** (D-028, team-confirmed). The FM
    sees them read-only;
  - the Repair Station (the Fixable board, D-021, D-022, D-070, D-073) and salvage, the inventory ledger (D-023), admin (D-024), reports (D-025).
- **Material requests and Procurement: removed** (Phase 24, D-091): no page, API, permission,
  table, leather-roll switch or seed row; `/procurement` answers 404. Stock movements that
  deliveries posted stay with their reason text. The FM home, Inventory and Operations have no
  request parts; `stock.csv` has no "Open request".
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
  has a Find box.
- **Form messages** (D-038): every message names the field and the fix; errors sit under their
  field, focus goes to the first invalid one, and a summary shows at 3 or more.
- **Quality:**
  - 519 unit tests pass (Vitest; 588 before Phase 25, the difference is the deleted review, repair
    and salvage tests; 716 before Phase 24), plus 81 model-toolkit tests (pytest; they also pass
    without OpenCV or torch, as in CI). 521 since the Phase 25 QA fixes.
  - Phase 25 (Codex, 2026-10-24, run 1): FAIL, 22 of 24 scenarios, e2e 71 passed, 1 failed, 1
    skipped. Fixes: the Production check-in e2e test matched earlier runs' rows by a fixed note
    (now a note of its own per run); Space right after entering Floor view sent no picture with
    "Press Capture again" (now it waits for a frame and says "The camera is still starting. Wait a
    moment, then press Space again."); two handoff expectations were wrong (the daily CSV starts
    "Date (Manila)"; the demo week has at least one unknown-class section, seven in that run).
    CI on PR #21: run 1 failed (two e2e locators, the docker job's old counts), fixed, run 2
    green.
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

1. Dylan: commit the Phase 25 QA fixes and Codex's report on a new branch from the latest `main`
   (git commands in this session's reply) and open the PR (D-032).
2. Codex: Phase 25 run 2 from `qa/CODEX_PROMPT_PHASE_25_RUN2.md`.
3. Dylan: delete the two QA folders Codex couldn't remove
   (`%TEMP%\cpoint-qa-uploads-phase25-…`).
4. After run 2 passes: back up, then `npm run demo:reset -- --yes` for a fresh demo week.
5. Phase 26 in a new session: "Read `docs/prompts/factory-visit-changes.md` and run Phase 26. Stop
   for my approval before writing code."
6. Dylan: book time at the station for Phase 30A (two or three real rolls, two phones, a ruler and
   an A4 sheet). The open device checks (F3, P18 S3, P18 S18) fit best there. Revoke the
   "Simulator" token first (it was pasted in chat).
7. Optional (Dylan's call): delete the backups in `storage/backups/` and the old `certs/` files;
   `docker image prune -a -f` frees about 8.4 GB of unused Supabase images.

Later:

- Many open questions below close as Phases 25 to 31 land (the procurement ones closed in 24; the
  review, repair, thresholds and salvage ones in 25; the roll and capture ones in 26; the check-in ones in 27).
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
- ASSUMPTION (D-083): Monday to Saturday are working days for production.

- Closed (D-078; Dylan, 2026-10-23, C-38): every Shoe Constructor gets an account from the System
  Admin.
- Decided (D-077 to D-079, Dylan 2026-10-21): attendance is present or absent only (no reasons),
  taken by the Floor Manager for today and 7 days back, viewed by the Admin. Tell CPoint it is a
  one-day log book with no per-person history.
- Closed (D-093, Dylan 2026-10-24, C-21): nobody reviews or overrides a scan; the camera's
  verdict is final (replaces D-028).
- Confirmed (A-10, DQ-2): old scans are converted, Fixable → Pass and Needs review → Reject; a
  pending scan takes its converted camera verdict.
- ASSUMPTION (A-11, D-093): rejected sections are only reported "for salvage"; the system tracks
  no salvage stock or reuse.
- Decided (A-12, Dylan 2026-10-24): an unknown class rejects the section and is listed under
  Settings → Unknown classes until the Admin sets it up.
- Decided (Dylan 2026-10-24, plan question 3): a defect type with no "when found" action before Phase 25
  (abrasion, dirt, test types) became Not accepted; the Admin can change it.
- Closed, module removed (Phase 24, D-091): the material-request questions of D-029, D-031,
  D-037, D-039, D-040, D-041, D-042, D-044, D-045 and survey Q14 (who orders leather rolls).
- Decided (D-093, Dylan 2026-10-24, C-11, C-12, C-19, A-13): each defect type is Usable or Not accepted from
  50% confidence; the two thresholds of D-011 are gone. cut and hole Not accepted, crease and
  scratch Usable (a scratch at any length, C-39).
- ASSUMPTION: one scan = one leather section of the roll.
- ASSUMPTION: the sign-in lockout (5 tries / 15 minutes) and the 12-hour session suit factory
  shifts. Confirm the shift length.
- Closed (D-094, C-19, C-20): the Repair Station and Salvage are removed; D-021/D-022 no longer
  apply.
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
  "unknown", reject their sections and show under Settings → Unknown classes until the Admin adds
  them under Settings → Defect types (D-093).

## Known test observations

- Fixed: full e2e runs crashed Chromium late in the run, because helper pages were never closed.
  They're closed now; three local and two Docker full runs since passed 64/64.
- The single admin sign-in timeout seen once earlier was probably the same resource exhaustion. It
  hasn't recurred since the fix. Watch CI.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- On Dylan's PC another project's Vite server often holds port 3000. Start this app with
  `PORT=3001` then (`npm run dev -- --port` doesn't work here).
- Proof-of-delivery files from before Phase 24 may remain under `UPLOADS_DIR/pod` (nothing reads
  them since D-091); `demo:reset` removes them with the scan images.
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
