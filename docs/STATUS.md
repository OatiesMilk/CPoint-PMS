# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-11-24 (Phase 39 merged as #65 and #66; the `docker` check for no repair at Preparation passes)
**Branch:** `main` at 539762d (#66, Phase 39; #65 before it). On `main`, the CI run for #66 failed only `e2e` `batches.spec.ts:346`, because it ran at 00:23 Manila (the known 00:00 to 01:00 window); the rerun on 2026-11-24 passed, so CI is green on `main`. `docs/DEMO_SCRIPT.md` is
Dylan's file and stays out of git.

- **Phase 38 (D-136, merged #64):** the Preparation card on Batches → Work in progress lists the camera's leather
  defects on today's finished rolls (rolls per type, as Reports → Rolls; "Returned to supplier: N rolls."; a none line),
  and no repair goes back to Preparation (`REPAIR_STAGES`: Construction, Sole-ing, Finishing; API refuses it with 422).
  No migration; legacy Preparation rows are still reported (A-115). Codex: run 1 FAIL (demo clock a day ahead), run 2 found one
  real test bug (origin-cell index, fixed), run 3 **PASS WITH ISSUES** (`qa/reports/2026-11-23-phase-38-run3.md`: final-defects 8 of 8;
  Corrections and Reports time out at sign-in only in the six-worker full run and pass alone). Plan
  `docs/prompts/plans/phase-38-preparation-camera-defects-plan.md`, handoff `qa/handoffs/2026-11-23-phase-38-preparation-camera-defects.md`.
  **To tell CPoint:** repairs never go back to Preparation. The CI `docker` SQL check for it is in the Phase 39 plan.
- **Phase 37 (D-135, merged #64, demo data only):** the demo seed shows a live Work in progress board (finished repairs, three Back
  for inspection, one At stage each at Construction, Sole-ing and Finishing; Finishing's count today left at 10:30, A-111);
  `npm run demo:reset` and `demo:seed` now follow the demo clock. Codex: run 1 PASS WITH ISSUES, run 2 PASS
  (`qa/reports/2026-11-23-phase-37-run1.md`, `-run2.md`). Plan `docs/prompts/plans/phase-37-wip-demo-data-plan.md`, handoff
  `qa/handoffs/2026-11-23-phase-37-wip-demo-data.md`. Manual screenshot 21 retaken and `USER_MANUAL.pdf` rebuilt (39 pages).
- **Phase 39 (docs only, merged #65, #66):** the close-out (STATUS and ROADMAP say Phases 37 and 38 merged; the two `docker` SQL
  checks from `qa/phase-39-ci-no-preparation-repairs.patch` are in `ci.yml` and pass, no finding or repair job at PREPARATION); plan
  `docs/prompts/plans/phase-39-closeout-plan.md`.
- **Phase 36 (built 2026-11-22, D-134, docs only; the one code change is demo data, see run 1):** the master spec, README (features,
  demo script, ER diagram), `docs/USER_MANUAL.md`, STATION_SETUP, CLAUDE.md and DESIGN swept for Phases 32
  to 35B; `docs/API.md` checked against every route (no gaps); `docs/DEMO_SCRIPT.md` rewritten for the four
  revisions (demo clock at 17:05, ends with Reset demo data); the architecture and conceptual-framework
  figures redrawn (2026-11-22, NEW chips; facts in `docs/prompts/paper-figures.md`); the `docker` CI job has
  SQL checks for storage locations and roll moves; one stale comment fixed. Plan
  `docs/prompts/plans/phase-36-docs-plan.md`, handoff `qa/handoffs/2026-11-22-phase-36-docs.md`, prompt
  `qa/CODEX_PROMPT_PHASE_36.md`.
- **Phase 36 Codex run 1 PASS WITH ISSUES** (`qa/reports/2026-11-22-phase-36-run1.md`; D7 passed; 7 scenarios with limits; D8 FAIL, D9 and D10 blocked): D8's one failure was real, the demo seed made no `MOVED` roll move (LR-001 has no rolls left by the last working day), fixed in `demo-seed.service.ts` and the storage block passes on a fresh seed; D10's two Mermaid blocks render (Claude); D9's figures weren't on the laptop (copied to the vault's `Inbox/figures-2026-11-22/`); timing, camera capture and print preview need a hand rehearsal on a weekday with phones. Next: `qa/CODEX_PROMPT_PHASE_36_RUN2.md`.
- **Manual screenshots and PDF done (2026-11-22, Claude, no Codex needed):** the 12 screenshots (files 15 to 26)
  were taken from the demo data in the cloud container with headless Chromium (1366 px desktop, 390 px phone, both at 2x, the
  existing manual's look; the print one is a real Chromium A4 PDF), saved to `docs/screenshots/manual/`, and
  `docs/USER_MANUAL.pdf` was rebuilt from the manual (35 pages, Chromium print). `qa/CODEX_PROMPT_PHASE_36_SCREENSHOTS.md`
  is no longer needed. Two captions were corrected to match the shots (19 and 25).
- **Phase 36 Codex run 2 PASS WITH ISSUES** (`qa/reports/2026-11-22-phase-36-run2.md`): D8 passed (15 of 15, `MOVED` 2), D9 figures fine; F1 (the "92 handlers" source) answered in `docs/prompts/paper-figures.md` (92 route handlers in 77 files).
- **Still to do for Phase 36:** Dylan rehearses the demo once by hand with phones, the marker card and a stopwatch; then the git commands.
- **Last merged features:** Phase 39 close-out and the CI check for no repair at Preparation (#65, #66), Phases 37 and 38 Work in progress demo data and Preparation's camera defects (#64, D-135, D-136), Phase 36 docs, figures and demo (#62, D-134), 35B corrections to past records (#61, D-133), 35A reports by period (#59, D-132),
  the Overview clean-up (#58, D-131), Phase 34 final defects, repairs and work in progress (#56, #57, D-130),
  Phase 33 the Inspection queue (#55, D-129), Phase 32 roll locations (#54, D-128). The run-by-run QA detail
  is in `SESSION_LOG.md`.
- **Main CI:** #66's `docker` job passed; its `e2e` job failed only in the 00:00 to 01:00 Manila window and passed on the rerun (2026-11-24); green after #64 (run 151) and #65; earlier runs green after #54, #62 and #63; the `e2e` flake `admin.spec.ts:136` and the
  `batches.spec.ts` 00:00 to 01:00 Manila window are known (see Known test observations).
- **Older items still open:** Phase 31's Codex run for D4 (README "3. Quality Inspector") on a weekday and the
  30F-3 Batches checks (run 4); Phase 31's docs were merged (#46) and Phase 36 supersedes part of them.
- **Agent workflow (D-089, D-092):** Claude builds and fixes every failure, failing CI checks included; Codex
  only tests and reports; every agent reads the Obsidian vault first.
- **Overall:** every planned phase is built and merged (0 to 39); only Dylan's hand rehearsal of the demo and the questions for CPoint are left.

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
      (QA passed, run 3)
- [x] 26. Capture on the constructors' own phones; rolls start and finish there (QA passed, run 2)
- [x] 27. Batches are the check-in intervals (lunch break, notices, failed pairs, no shoe types)
      (QA passed, run 5; merged #25)
- [x] 28. Each role sees only its modules; demo sign-in and reset on the login page (QA passed,
      run 2; merged #26)
- [x] 29. Stock updated on one sheet, reminders on Wednesdays and Fridays, Reports → Materials
      (QA passed, run 2; merged #27)
- [x] 30A. Leather rolls come from Inventory, each with its own area; picked at Capture; ticked
      Fully used at Finish batch (QA passed, run 4; merged #28, #29)
- [x] 30B. The measuring check: a cut in inches, on a letter-size piece of leather (`cv/` only);
      measured by the box, D-106 (QA passed, run 4; merged #30, #31)
- [x] 30C. Cuts from 3 inches Not accepted; a roll over 10% defects marked Return to supplier
      (D-110; QA passed, run 3; merged #34)
- [x] 30E-1. The constructor picks the leather, then the roll; a roll leaves stock at Finish roll;
      the QI counts pairs only (D-111 to D-113; QA passed, run 3; merged, CI green)
- [x] 30E-2. A planning calendar: rolls to be used, quota, check-in interval and shift per day;
      Non-working / Holiday (D-114, D-115; QA passed, run 3; merged #36)
- [x] Reports by roll: a roll over the limit is Returned to supplier; reports count whole rolls
      (D-116, D-117; QA passed, run 3; merged #37)
- [x] 30D. Roll counts on Capture, the calendar and Materials; the team's last QA notes (D-118;
      QA passed, run 2; merged #38)
- [x] Scale marker: a printed card read on every shot replaces the tap calibration (D-120; QA passed,
      run 4; merged #39)
- [x] The card once per roll and a scanning timer per roll (D-121; QA passed, run 3; merged #40)
- [x] The System Admin reaches only the administration modules; no Camera page (D-119; QA
      passed, run 2; merged #41)
- [x] 30F. A polished look on shadcn/ui and Radix (D-122): 30F-1 (#42), 30F-2 (#43), 30F-3 (#45)
      and the Plan days follow-up (#44) merged; the 30F-3 Batches checks (Codex run 4) wait for a
      weekday
- [x] 31. The documentation and the paper's figures match the system (built 2026-11-07; merged #46;
      superseded in part by Phase 36)
- [x] 32. Roll IDs and storage locations you can find on the floor (defense revision 4; built
      2026-11-17, D-128; QA passed, run 3; merged #54, CI green)
- [x] 33. The Inspection queue with real batch codes (defense revision 2; built 2026-11-19, D-129;
      QA passed, run 6; merged #55)
- [x] 34. Final defects, repairs and work in progress (defense revision 1; built 2026-11-20, D-130;
      QA passed, run 4; merged #56, #57)
- [x] Overview clean-up (the Floor Manager's home, D-131; QA passed, run 2; merged #58)
- [x] 35A. Reports by period, sort, filter and print (D-132; built 2026-11-21; QA passed, run 3; merged #59)
- [x] 35B. Corrections to past records (D-133; built 2026-11-21; QA passed, run 5; merged #61)
- [x] 38. Preparation shows the camera's defects; no repair goes back to Preparation (D-136; built 2026-11-23; QA PASS WITH ISSUES, run 3; merged #64, CI green)
- [x] 37. Work in progress demo data (D-135; built 2026-11-23; QA passed, run 2; merged #64)
- [x] 39. Close-out after Phases 37 and 38; CI checks no repair is at Preparation (docs only; merged #65, #66)
- [x] 36. The documentation, the figures and the demo match the system (D-134; built 2026-11-22; QA passed
      with Codex run 2; merged #62; the hand rehearsal with phones is Dylan's, not a code check)

## What works right now

The system as built, by module. The master spec (`docs/prompts/system-rebuild.md`) has the rules,
`docs/API.md` every route, README the demo script; each phase's detail is in SESSION_LOG and its
D-entries.

- **Access (D-100, D-119):** constructor Capture; QI Batches; FM Overview, Batches, Attendance,
  Reports, Inventory; Admin Overview, Users, Settings, API tokens, Audit log. Lockout after 5 tries
  for 15 minutes, 12-hour sessions, server-side sign-out. Demo sign-in and reset behind
  `DEMO_LOGIN_TOOLS` (D-101).
- **Capture (Phases 26, 30E, D-120, D-121):** a constructor the Admin allows picks the leather,
  then the roll, and scans it on a phone; the marker card on the first shot sets the scale; the
  model runs on the server (ONNX Runtime); Pass or Reject, final; a cut from 3 in Not accepted;
  Finish roll takes it off stock and works out the defect share; over 10% → Returned to supplier;
  a scanning timer; roll counts against the day's plan; Floor view for a station monitor.
- **Batches (Phases 27, 30E-2, 33):** the FM plans each weekday on a calendar (rolls, quota of
  passed pairs, every 4 hours or once a day, shift; Non-working / Holiday); lunch left out; every
  batch has a code (B-261116-2) and waits in the Inspection queue until the QI inspects it (pairs
  finished and failed) or the FM voids it; Urgent first; on-screen notices; Recent days with the
  reason for each short day.
- **Inventory (Phases 29, 30A):** leather rolls added with their area; the Update stock sheet
  (Added, Used, Correction); reminders on Wednesday and Friday; low stock.
- **Attendance (Phase 22):** one day at a time, today and 7 days back; no per-person history.
- **Reports (D-116, D-117, D-118):** Operations, Quality, Rolls (claim sheet, supplier quality,
  scanning time), Materials (weeks of the month), CSV; whole rolls, never per person.
- **Settings:** defect types (outcome, length limit, flat share), found-at and the return limit,
  suppliers with codes, the lunch break; API tokens for the simulator; the audit log.
- **Look (Phase 30F, D-122):** tokens, shared page header, KPI tiles, states, phone layouts for
  Capture and Batches.
- **Database:** the latest migration is `final_defects_and_repairs` (D-130, Phase 34); `prisma/migrations/` lists them all.
  UUIDv7 ids (D-018).

## Next step (exact)

0. Dylan: rehearse the demo once by hand (a weekday, phones, the marker card, a stopwatch, the print preview) from
   `docs/DEMO_SCRIPT.md` and tell Claude anything that needs fixing.
   - Also: take the "To ask or tell CPoint" block under Open questions to CPoint.
   - Also: delete `qa/phase-39-ci-no-preparation-repairs.patch` (already in `ci.yml`, merged #66).
1. Optional, on a weekday with today planned: `qa/CODEX_PROMPT_PHASE_30F_3_RUN3.md` again as run 4
   (Batches, the plan line, the full suite; the Plan days cells from #44 too). Phase 31 merged (#46).
2. Dylan: time a roll by hand at the factory and compare with Reports → Rolls' Scanning time.
3. Dylan, at the station: capture a few real knife cuts on scrap leather (2.5, 3 and 4 in) with
   the card to check the 3-inch line on real cuts.
4. Optional: fresh screenshots for README (the ones in `docs/screenshots/` predate Phase 25 and
   30F, so README no longer embeds them); delete `%TEMP%\cpoint-qa-uploads-phase26` and the two
   Phase 25 folders. Done 2026-11-08: the 15 older backups (only
   `before-reset-2026-11-04.dump` is kept), `certs/`, `mkcert -uninstall`, the Phase 26 temp
   folder; `docker image prune -a -f` freed 0 B (nothing unused left).

## Blockers

- None for the demo.

## Open questions / assumptions awaiting client confirmation

**To ask or tell CPoint** (all are existing entries below; none is new):

- **Ask:** their real list of final defects (A-62, the five are placeholders); their rack layout (A-53) and a batch code format
  they recognise (A-57); whether the Quality Inspector may also correct older batches (A-70); their rule for repairs that keep
  failing (A-88); whether a capture constructor really stays at Preparation all day (A-96).
- **Tell:** repairs never go back to Preparation, and the board's Preparation card shows the camera's leather defects (D-136).

- Decided (Dylan, 2026-11-23, D-136): at Preparation the defects are the camera's, on the raw roll; no repair goes
  back to Preparation (the camera already filtered the leather). The board's Preparation card counts rolls per
  defect type (as Reports → Rolls) and the Capture page's My stage card doesn't show the list. Tell CPoint.
- ASSUMPTION (A-113, D-136): the Preparation card counts rolls per leather defect type finished today, the same
  count as Reports → Rolls; CPoint hasn't asked for another measure (the number of detections).
- ASSUMPTION (A-114, D-136): constructors without Capture access may still be assigned to Preparation (A-96
  unchanged); only repairs are barred from it. Amends A-75: a fixable pair goes back to Construction, Sole-ing or
  Finishing.
- ASSUMPTION (A-115, D-136): a finding or repair from before Phase 38 that names Preparation is never hidden (a
  Preparation column in Where defects come from only while the period has such pairs); no data is migrated.
- ASSUMPTION (A-70, D-133): only the Floor Manager corrects past records; the Quality Inspector only on the
  inspection day. **To ask CPoint:** should anyone else (the Quality Inspector) correct an older batch?
- ASSUMPTION (A-103, D-133): a corrected batch shows "Corrected" on its day in Operations; who and why stay on
  the batch and in the audit.
- ASSUMPTION (A-104, A-107, D-133): a roll's area changes only before Finish roll (the defect share and the
  return mark are worked out from it); a roll from before Phase 30A has no area to correct.
- ASSUMPTION (A-105, A-108, D-133): a repair's inspection is correctable while the pairs it sent back are At
  stage; it keeps the original inspection time and inspector, its passed pairs stay on the day first inspected,
  and the correction is marked only in the audit log.
- ASSUMPTION (A-106, A-110, D-133): a removed roll's details can't change; a kept roll's return note can't be
  emptied (Keep needs a reason).
- ASSUMPTION (A-109, D-133): the Floor Manager corrects a past batch even when a Quality Inspector is present
  today.

- ASSUMPTION (A-67, D-132): a week in Reports is a week of the month, as Materials (D-109); a month's weekly
  prints add up to its monthly print.
- ASSUMPTION (A-68, D-132): a custom range may be up to 366 days.
- ASSUMPTION (A-69, D-132): Remarks and signatures on a print are not saved; the paper is the record.
- ASSUMPTION (A-100, D-132): CSVs follow the period and filters, not the sort.
- ASSUMPTION (A-101, D-132): the defect filters change the three defect cards, not the key figures.
- ASSUMPTION (A-102, D-132): a printed Rolls report holds up to 500 rows.
- ASSUMPTION (A-97, D-131): the plan banner is hidden on the Floor Manager's Overview only, because the
  Plan today row there says the same thing; every other page keeps it.
- ASSUMPTION (A-98, D-131): Attendance's "Not taken yet today" prompt stays in its own card, not in Needs
  attention.
- ASSUMPTION (A-99, D-131): with both rows due, Plan today is the primary button and Update stock secondary.

- Decided (Dylan, 2026-11-20, D-130): the Work in progress board is a third tab on Batches; a
  constructor assigned to a stage but without camera access still gets My stage on Capture; one
  stage per constructor per day; a repair that fails again can be scrapped or sent back with no
  limit. Tell CPoint. **To ask CPoint:** their real list of final defects (the five are
  placeholders) and their rule for repairs that keep failing.
- ASSUMPTION (A-62, D-130): final defect types are a separate list from the camera's leather defect
  types; `OTHER` always exists and needs a note.
- ASSUMPTION (A-63, D-130, amended): the QI decides Fixable and the stage; the Floor Manager may move
  a job or mark it Not fixable after all until the stage marks it Back.
- ASSUMPTION (A-64, D-130): passed = finished − failed + repaired pairs that passed that day.
- ASSUMPTION (A-65, A-90, D-130): a repair has no due time (never Late) and is not in the tab
  title's due count; it waits in the Queue.
- ASSUMPTION (A-66, D-130): leather defects and the camera checkpoint are unchanged.
- ASSUMPTION (A-72, A-73, D-130): one shared count per stage, latest wins; an assigned constructor
  or the Floor Manager enters it; who entered it is in the audit log only.
- ASSUMPTION (A-74, D-130): an empty day's stages are suggested from the last working day (up to two
  weeks back) and stored only when saved.
- ASSUMPTION (A-75, A-76, D-130): the stage is where a fixable pair goes back to; a Not fixable
  pair has none. The hint needs 5 findings in the last 4 weeks and never fills the form (a tie goes
  to Fixable, then the earlier stage).
- ASSUMPTION (A-86, D-130): a constructor is at one stage a day (amended by A-95).
- ASSUMPTION (A-95, D-130, Addendum 1): constructors with Capture access are always at Preparation; the
  Floor Manager can't move one (to move one, the Admin first removes their Capture access).
- ASSUMPTION (A-96, D-130): constructors without Capture access may be assigned to any stage,
  Preparation included. **To ask CPoint:** is a capture constructor really at Preparation all day, one station per person?
- ASSUMPTION (A-87, D-130): a Fixable finding creates its repair job at once.
- ASSUMPTION (A-88, D-130): a repair that fails again is scrapped or sent back again, with no limit.
- ASSUMPTION (A-89, D-130): failed pairs from before Phase 34 have no reasons and show as "Reason
  not recorded"; nothing is backfilled.
- ASSUMPTION (A-91, D-130): a stage count from an earlier day shows "Not counted today"; a stage
  nobody is assigned to is counted by the Floor Manager.
- ASSUMPTION (A-93, A-94, D-130): failed pairs and lines can be corrected on the inspection day until
  a repair from the batch is Back for inspection; a repair's inspection can't be corrected until
  Phase 35.

- Decided (Dylan, 2026-11-19, D-129): batches keep `B-` and old `B-`/`R-` roll codes are renamed
  `LR-…` (old code kept); only Open / Inspecting / Inspected / Void is stored; every old batch gets
  a code; a batch is corrected on the day it was inspected (until Phase 35). Tell CPoint.
- ASSUMPTION (A-57, D-129): the batch code is `B-YYMMDD-N`; CPoint hasn't named a format.
- ASSUMPTION (A-58, D-129): priority is Normal or Urgent only, set by the Floor Manager; the queue
  is Urgent first, then the oldest.
- ASSUMPTION (A-59, D-129): a waiting batch never expires; the FM voids one with a reason.
- ASSUMPTION (A-60, D-129): Start inspection is optional; an inspector may go straight to Inspect.
- ASSUMPTION (A-61, D-129): batches that ended before the queue began and were never finished are
  Void "Not inspected, from before the queue".
- ASSUMPTION (A-81, D-129): a batch inspected on a later day counts on its own day in the reports.
- ASSUMPTION (A-82, D-129): who may inspect follows today's attendance (D-088), whatever the
  batch's day.
- ASSUMPTION (A-83, D-129): a batch's rolls are those whose scan finished at Capture inside it.
- ASSUMPTION (A-84, D-129): the Floor Manager can always mark Urgent and Void; inspects only when
  covering (D-088).
- ASSUMPTION (A-85, D-129): an old roll with no supplier is renamed `LR-OLD-NNN`; its former code
  stays searchable.

- Decided (Dylan, 2026-11-17, D-128): the Floor Manager manages storage locations under Inventory;
  the QR holds the plain code (`LR-…`, `LOC:…`), read in the app; returned rolls are tracked until
  Picked up by supplier; Put back asks where, prefilled. Tell CPoint.
- ASSUMPTION (A-52, D-128): a roll's code stays `LR-<supplier>-NNN`; the label prints that code.
- ASSUMPTION (A-53, D-128): CPoint has not confirmed its rack layout, so rack/bin naming (e.g.
  R1-B3) is a placeholder; the demo's R1-B1 to R2-B3 and RETURN are placeholders only.
- ASSUMPTION (A-54, D-128): labels print on plain A4 sticker paper from an office printer (no label
  printer); the 3 × 7 sheet (70 × 42.3 mm) is a placeholder until CPoint names its paper.
- ASSUMPTION (A-55, D-128): a roll picked at Capture leaves storage; a passed roll is used up and
  never returns to a place; leftover pieces aren't tracked.
- ASSUMPTION (A-56, D-128): the Floor Manager places and moves rolls; a constructor only picks,
  puts back, and sets a returned roll aside right after Finish roll.
- ASSUMPTION (A-71): Find roll is a phone page like Capture.
- ASSUMPTION (A-77, D-128): a roll Returned to supplier stays in storage until the supplier takes
  it; its status stays Finished, only its place changes.
- ASSUMPTION (A-78, D-128): the location history shows no names; the audit log keeps the actor.
- ASSUMPTION (A-79, D-128): a location's code can't change once rolls were kept there (it is on
  labels); its name can.
- ASSUMPTION (A-80, D-128): the QR holds the plain code, read in the app, not a URL.

- Decided (Dylan, 2026-11-04 and 06, D-119): the System Admin has only the administration
  modules; the Camera page is removed, not moved to the Floor Manager, who sees every shot from
  Reports → Rolls. Tell CPoint.
- Decided (Dylan, 2026-11-05, D-121): the factory cameras are fixed, so the card is read once per
  roll at its first shot; a scanning timer per roll from Start scanning to Finish roll, lunch left
  out, minutes per roll only, no manual time entered. Tell CPoint.
- ASSUMPTION (A-49, D-121): a roll left open overnight doesn't count the night (from 17:00, or its
  start if later, to 08:00 the next day); time on the same day counts even after 17:00 (overtime,
  evening tests; run 1 F1).
- ASSUMPTION (A-50, D-121): a later card reading replaces the roll's scale for the shots after it.
- ASSUMPTION (A-51, D-121): each picture size needs its own card reading.
- Decided (Dylan, 2026-11-04, D-120): a printed ArUco card (4x4_50 id 0, 2.00 in) read on every
  shot replaces the tap calibration, with no fallback; no card, no shot; the card lies flat on the
  leather. Tell CPoint to keep the card at the station.
- ASSUMPTION (A-46, D-120): a defect box whose centre is on the card (square, white border and
  caption) is ignored; the card isn't leather.
- ASSUMPTION (A-47, D-120): the leather under the card isn't checked on that shot; the constructor
  moves the card between shots if a spot matters.
- ASSUMPTION (A-48, D-120): every new Capture shot is measured, so A-42 now applies only to old
  rolls and simulator shots.
- Decided (Dylan, 2026-11-04, D-118): rolls used = passed by the camera; rolls checked = every roll
  scanned; returned = failed the scan; pairs finished unchanged; Capture shows rolls scanned
  against the plan for today and the next days. Pairs per roll and On hand at week end dropped.
- ASSUMPTION (A-44, D-118): Capture's counter counts every roll finished today, passed or
  returned; the days ahead are planned days only.
- ASSUMPTION (A-45, D-118): a removed roll counts on its removal day; rolls from before Phase 30A
  were never in stock and are left out of Removed (other).
- Decided (Dylan, 2026-11-04, D-113): no color; each roll keeps its own area, entered by the FM when
  added; the constructor picks the leather, then the roll (choice (a)). Planning (30E-2): the FM
  plans any day from a calendar: rolls to be used (one total, an estimate; constructors may start
  more and reports compare), quota and check-in interval. "Go" on the rest of the plan, so these
  are Claude's recommendations, to confirm with CPoint:
- ASSUMPTION (A-31, D-112): a roll over the limit still shows its Defect % and Too many defects,
  for the Floor Manager's information only; the claim sheet stays.
- ASSUMPTION (A-33, D-112): Remove still works on a roll in stock or being scanned (−1); a scanned
  roll can't be removed, since it is already off stock.
- ASSUMPTION (A-35, D-113): old rolls stay as history; rolls in stock stay pickable; scanned rolls
  not yet ticked leave stock in the migration.
- Decided (Dylan, 2026-11-04, 30E-2): every working day must have a plan (no copying; an FM is
  always at the factory to plan); with none, no batches and the start-of-day notice. The FM can mark
  a weekday as a Non-working day / Holiday (no batches, no notice).
- ASSUMPTION (A-36, 30E-2): a day's plan can change until its first batch is finished; lunch stays
  the Admin's, from tomorrow; a holiday mark has no name and can be undone (Dylan: no names).
- ASSUMPTION (A-37, 30E-2): the start-of-day notice is the FM's only, from 00:00 on a working day
  until the plan is saved (banner, bell, FM home); the QI reads "The Floor Manager plans them
  first."
- ASSUMPTION (A-38): 30E before 30D, in two sessions (30E-1 rolls and color, 30E-2 planning).
- Decided (Dylan, 2026-11-04, 30E-2, D-114, D-115): a month calendar; click a weekday to plan it
  (weekends not selectable, no working-days ticks); the check-in interval is every 4 hours or once
  at the end of the day only; the shift is in each day's plan (08:00 to 17:00 prefilled); planned
  against scanned on the calendar, Batches and Operations; no switch-over date, the migration
  converts the old schedule and quota. A-39 is withdrawn: converted days keep their interval as
  history.
- ASSUMPTION (A-40, D-114): a day can be planned up to the end of the third month ahead.
- ASSUMPTION (A-41, D-114): a Non-working / Holiday day has no stock reminder either.
- Decided (Dylan, 2026-11-04, D-116): the system flags a roll over 10% defects of its area and
  marks it Returned to supplier; "for salvage", the 8-week trend and Per 100 pairs go. Tell CPoint.
- ASSUMPTION (A-42, D-116): a roll that couldn't be measured (no phone setup or no area) reads
  Scanning passed.
- Decided (Dylan, 2026-11-04, D-117): the reports count whole rolls, passed or returned, not
  sections; no Rejected sections, Rolls open, Rolls finished or Defect area. Tell CPoint.
- ASSUMPTION (A-43, D-117): a supplier reads High only with at least 5 rolls in the range.
- Decided (Dylan, 2026-11-03, Phase 30C plan, D-110): a cut is Not accepted from 3 in by its box
  diagonal; each cut from 3 in counts a flat 1% of its roll "for now", shorter cuts nothing; holes
  and scratches by box area; phones calibrated once on Capture by tapping a sheet's corners. Tell
  CPoint how the 10% is worked out.
- ASSUMPTION (A-27, D-110): the Floor Manager's Returned or Keep is final; a mistake goes through
  Remove. Keep needs a reason, Returned a day and an optional note.
- ASSUMPTION (A-28, D-110): a roll with any shot from an uncalibrated phone is Not measured and isn't
  marked; the Floor Manager can still return it.
- ASSUMPTION (A-29, D-110): a returned roll leaves stock (OUT −1, "returned to supplier") like a
  fully used one and is reported apart from it.
- ASSUMPTION (A-30, D-110): creases count by box area, like scratches.
- Decided (Dylan, 2026-10-26, Phase 30A plan): each roll's area is entered by the FM, never added
  up from the shots (D-103, changes C-33); rolls come from Inventory, picked at Capture, ticked
  Fully used at Finish batch by whoever finishes it; a roll can't be ticked before it's scanned;
  supplier codes from initials, editable; area 0.1 to 200 sq ft; Correct ticks or unticks; the FM
  removes any roll not fully used; Defect % reads "To be implemented" (D-104). Tell CPoint.
- ASSUMPTION (D-104): someone on the line tells the QI which rolls are fully used; the system
  doesn't track how much of a roll each batch used.
- ASSUMPTION (D-104, A-10): leather counts on an existing database keep their number but have no
  roll records until the FM adds the rolls (or `demo:reset`); the bootstrap's demo inventory has 0
  leather rolls.
- ASSUMPTION (D-104): an empty roll put back at Capture returns to Not scanned with no movement;
  Remove on a roll that is being scanned or scanned takes it out of stock (−1).
- ASSUMPTION: the demo week ticks a roll Fully used at a batch on a later day than its scan, so the
  last day's scanned rolls stay Scanned for the demo.
- Decided (Dylan, 2026-10-25, Phase 29 plan): no deliveries to receive, the FM enters + or − per
  item; a leather roll item has a supplier, other materials don't; pairs that failed inspection
  count as made; a partial save clears the reminder; days left from the last 4 weeks; a
  Correction with a reason that isn't use (D-102). Tell CPoint the sheet replaces the item
  dialogs.
- ASSUMPTION (D-102): the sheet has three boxes per item (Added, Used, Correction) instead of the
  plan's one box with a type, so a delivery and the week's use go in one save.
- ASSUMPTION (D-102): "May run out before the next update" compares days left with the days to
  the next reminder day; an item whose first stock entry is less than 28 days ago is paced from
  that day.
- ASSUMPTION (D-102): the demo week's updates are saved at 16:30 on Wednesday and Friday.
- Decided (Dylan, 2026-10-25, Phase 28 plan): the Scans list is removed (A-26); the FM home cards as
  the brief lists them, with Rolls today; the flag is `DEMO_LOGIN_TOOLS`; one flat sidebar per role
  (D-100, D-101). Tell CPoint the QI's phone opens on Batches and the Admin no longer sees
  production pages.
- ASSUMPTION (A-23, D-101): the demo tools need both `DEMO_LOGIN_TOOLS` and `SEED_DEMO_USERS`; a
  production build may reset only from the login page while the flag is on.
- ASSUMPTION (D-100): "Rolls today" counts the sections checked today, those rejected (for
  salvage), and the rolls open now.
- ASSUMPTION (D-100): the Admin's Camera page keeps the last capture's photo, so the image route
  also takes `camera:view`.
- Decided (Dylan, 2026-10-24, Phase 26 plan): several rolls open at once with a Roll dropdown at
  Capture; a roll finishes only at Capture once fully scanned; the FM cancels any open roll with a
  reason, anyone with camera access an empty one; no stages; the supplier is required; Capture is
  the constructor's home (D-095).
- Decided (Dylan, 2026-10-24, D-095): the Roll dropdown lists every open roll, not only the person's own, and
  starts on the one this browser last used (else the newest this person started, else the only
  one).
- Decided (Dylan, 2026-10-24, D-095): a cancelled roll's shots are left out of the reports.
- Decided (Dylan, 2026-10-24, D-095): new roll codes are `R-YYYY-NNNN`; older rolls keep `B-`.
- ASSUMPTION (D-095): the device and simulator payload's `batchId` is now `rollId`, and without one
  a scan goes to the roll open longest; the scans filter is `?roll=` (old `?batch=` links don't
  filter).
- ASSUMPTION (A-10): old rolls are converted, Planned and In progress → Open, Completed →
  Finished; who started them stays the FM who created them.
- ASSUMPTION: the demo week's leather OUT on each roll reads "Laid out as R-…" (demo data only;
  Phase 29 replaces stock with counts).
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
- Decided (Dylan, 2026-10-24, Phase 27 plan): default lunch 11:00 to 12:00, set by the System
  Admin (Settings → Lunch break); the QI sees today's batches only; the QI keeps the Overview home
  until Phase 28; the quota suggestion is the average passed pairs per full working day (D-097 to
  D-099). Tell CPoint: batches replace the 12:00, 16:00 and 17:00 check-ins, and shoe types are
  gone.
- ASSUMPTION (D-097, A-2): the last batch of the day ends at the shift end even when it is shorter
  than the others (every 3 hours gives 08:00–12:00, 12:00–15:00 and a 2-hour 15:00–17:00).
- ASSUMPTION (D-098, A-9): the notices are on screen only (banner, bell, tab title) while the app is
  open; nothing reaches a closed browser or a locked phone.
- ASSUMPTION (D-098): Late starts 30 minutes after a batch's end (kept from D-084), and Finish batch
  opens 10 minutes before it (C-28).
- ASSUMPTION (D-097): a lunch the Admin saves outside tomorrow's shift is refused; one that falls
  outside a later shift change is ignored by the batches and the plan page says so.
- Decided (D-082 to D-087, Dylan 2026-10-21): a batch ends with Finish roll; check-ins every 4
  hours (12:00, 16:00, 17:00); only the QI enters them; the suggestion averages 10 full days; a
  first quota applies today. Tell CPoint that stage monitoring is gone.
- Decided (D-088, Dylan 2026-10-22): the FM enters the check-ins on a day attendance shows no QI
  present; with a QI present, or attendance not taken, only the QI can. Tell CPoint.
- ASSUMPTION (D-084): Late starts 30 minutes after a check-in's time; a check-in can be entered
  until midnight and corrected the same day only.
- Closed (D-095, C-33): the 10-pieces hint is gone; roll sizes vary and a section is a shot.
- Decided (Dylan, 2026-11-02, D-107): a repeat schedule or lunch save is skipped; the team's other
  notes become Phase 30D after 30C; weeks on Materials are picked by date ("Week of 26 Oct").
- Decided (Dylan, 2026-11-02, D-108): no unknown defect classes; a class with no defect type is
  ignored (replaces A-12); past scans rejected only by one became Pass; Materials weeks read
  "Week 1: Nov. 2" (week of the month). Tell CPoint the Admin must add a new model's classes.
- To check (team QA): their Materials screenshot showed Pairs finished 0 in every week, even with 8
  rolls used. Taken on a groupmate's PC; check on that database before 30D.
- Decided (Dylan, 2026-11-02, D-105): production works Monday to Friday, 08:00 to 17:00 (replaces
  D-083's Monday to Saturday); the FM may set a shorter shift inside that window; stock reminders
  Monday to Friday. Tell CPoint.

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

- After `npm run db:generate` (a schema change), restart `npm run dev`: a dev server started
  before it keeps the old database client in memory (Phase 33 run 1: "reading 'findMany'").
- The dev overlay's "Encountered a script tag while rendering React component" (the theme script
  in `src/app/layout.tsx`, since Phase 0) doesn't stop pages.

- Fixed: full e2e runs crashed Chromium late in the run, because helper pages were never closed.
  They're closed now; three local and two Docker full runs since passed 64/64.
- `batches.spec.ts` needs a batch due today, so it fails between 00:00 and 01:00 Manila (16:00 to
  17:00 UTC), in CI too. Rerun the job after that hour; no code fault (Phase 30A run 5).
- The single admin sign-in timeout seen once earlier was probably the same resource exhaustion. It
  hasn't recurred since the fix. Watch CI.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- PowerShell drops a bare `--`, so `npm run demo:reset -- --yes` only dry-runs there. Use
  `npm run demo:reset '--' --yes` in PowerShell.
- On Dylan's PC another project's Vite server often holds port 3000. Start this app with
  `PORT=3001` then (`npm run dev -- --port` doesn't work here).
- Proof-of-delivery files from before Phase 24 may remain under `UPLOADS_DIR/pod` (nothing reads
  them since D-091); `demo:reset` removes them with the scan images.
- Local `.env` needs `AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD` and `DEMO_USER_PASSWORD`. With demo
  users on, `admin@cpoint.local` uses `DEMO_USER_PASSWORD`.
- `npm audit`: 9 highs, all in dev tooling (the Prisma CLI and eslint-config-next, D-027);
  none from `onnxruntime-node`.
- `onnxruntime-node` downloads a CUDA build on Linux unless `ONNXRUNTIME_NODE_INSTALL=skip`
  (set in the Dockerfile and CI). The old mkcert files in `certs/` were deleted on 2026-11-08 (unused
  since D-076); Dylan ran `mkcert -uninstall` the same day.
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
