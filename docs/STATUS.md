# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-11-09 (demo clock, D-125; demo data D-123, D-124; Phase 31 still waits for D4)
**Branch:** `main` at c5b1848 has everything through Phase 30F (#41 to #45).
**Uncommitted (laptop, `C:\dev\CPoint-PMS`):** Phase 31, the documentation and the paper's
figures. Plan `docs/prompts/plans/phase-31-plan.md`, handoff `qa/handoffs/2026-11-07-phase-31-docs.md`,
prompt `qa/CODEX_PROMPT_PHASE_31.md`. Also the two UAT case lists in `qa/uat/` (Dylan's go to
include them).

- **Phase 31 (built 2026-11-07, Dylan's go):** the master spec's context, domain rules, roles,
  data model and CV contract rewritten to the system as built, with "Changed since the rebuild";
  README (features, accounts, the demo script by role, the diagrams, the demo week), `docs/API.md`
  (every route checked against `src/app/api`; two `PATCH` rows made explicit), DESIGN, STATION_SETUP,
  `cv/README.md`, `cv/MODEL_CARD.md`, CLAUDE.md, AGENTIC_WORKFLOW, UI_AUDIT; removed phases marked
  in ROADMAP; this file shortened (the long "What works right now" list is in git history at
  c5b1848 and in SESSION_LOG). One code comment: `cv/cpoint_cv/preview.py`'s docstring (D-108).
  The paper's figures dated 2026-11-07 already match; their facts are in
  `docs/prompts/paper-figures.md`.
- Checks: `npm run check` passed (**708 unit tests**, build OK); `cv/` ruff, ruff format, mypy and
  pytest (102) passed. The brief's sweep: every remaining hit is history (DECISIONS, SESSION_LOG,
  old briefs and plans, the visit notes, "removed" notes) or the old-scan note on a scan's page.
- **Review of the latest changes (2026-11-07):** 30F's 97 files read; no guard changed, no raw
  colours outside the tokens; no fault found.
- **Codex run 1 FAIL** (`qa/reports/2026-11-07-phase-31-run1.md`): the in-app browser was
  unavailable, so 8 of 9 were blocked; D3 failed on README's "19.2 in across", which was an
  example (the width depends on the camera's height; the fake camera gives 16.0 in). README and
  STATION_SETUP now say so. Run 2 runs every scenario headless: `qa/CODEX_PROMPT_PHASE_31_RUN2.md`.
- **Codex run 2 FAIL, fixed** (`qa/reports/2026-11-07-phase-31-run2.md`, headless): D1, D3, D7,
  D8, D9 passed; D2, D5, D6 failed on wording (Attendance card, roll statuses, the roster count,
  when High shows, the cut row, STATION_SETUP's fixed 19.2 in); D4 blocked (Saturday). README and
  STATION_SETUP now quote the app. Next: `qa/CODEX_PROMPT_PHASE_31_RUN3.md` (D2, D5, D6; D4 on a
  weekday).
- **Codex run 3 FAIL, fixed** (`qa/reports/2026-11-07-phase-31-run3.md`, Sunday): D5 and D6
  passed; D2 failed only on Plan days' "3 of 5 rolls scanned", now an example ("a count such as 2
  of 3 rolls scanned · 1 returned"); D4 blocked. Next: `qa/CODEX_PROMPT_PHASE_31_RUN4.md` on a
  weekday (D2 step 2 and D4).
- **Codex run 4 PASS WITH ISSUES** (`qa/reports/2026-11-08-phase-31-run4.md`, Sunday): D2's Plan
  days example matches the calendar exactly; D4 blocked (weekends have no batches). Every scenario
  but D4 has now passed.
- **Small demo rolls (D-123, merged #47):** the demo week's rolls are 4 to 7 sq ft, scanned in 1
  to 3 minutes, 3 to 6 shots of 16 × 12 in; the demo suppliers are Marikina Supplier A and B,
  Bulacan Supplier A and B.
- **Varied damage on the demo rolls (D-124, built 2026-11-09, uncommitted):** the three damaged
  rolls get a random mix of holes, scratches, creases and long cuts up to 11% to 16% (worked out
  with the app's own measuring code), and one roll stays just under at 7% to 9%. `npm run check`
  passed. Handoff `qa/handoffs/2026-11-09-small-demo-rolls.md` (S7), prompt
  `qa/CODEX_PROMPT_SMALL_DEMO_ROLLS.md`.
- **Demo clock (D-125, built 2026-11-09, uncommitted):** Change time in the Demo mode band moves the
  whole app to a Manila date and time and keeps ticking; Back to real time. One migration
  (`demo_clock`). `npm run check` passed. Handoff `qa/handoffs/2026-11-09-demo-clock.md`.
  Codex run 1 FAIL (the migration wasn't applied on the PC; setup, not code). Run 2 **PASS WITH
  ISSUES** (`qa/reports/2026-11-09-demo-clock-run2.md`): C4, C5, C7 to C10 passed; C6's shot
  blocked (no camera in the in-app browser; the timer followed the clock); the full e2e run had 8
  dev-server time-outs, each spec passed alone. Next: Dylan takes one shot on his phone with the
  clock moved, then the git commands.
- **Next:** Codex D4 only (README "3. Quality Inspector") on a weekday, with 30F-3 run 4; Codex run 4 for 30F-3 on a weekday with today
  planned; then git commands for Phase 31.
- **Agent workflow (D-089, D-092):** Claude builds and fixes every failure, failing CI checks
  included; Codex only tests and reports; every agent reads the Obsidian vault first.
- **Overall:** every planned phase is built (0 to 31); Phase 31 waits for QA.

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
- [ ] 31. The documentation and the paper's figures match the system (built 2026-11-07,
      uncommitted; Codex run 1 next)

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
- **Batches (Phases 27, 30E-2):** the FM plans each weekday on a calendar (rolls, quota of passed
  pairs, every 4 hours or once a day, shift; Non-working / Holiday); lunch left out; the QI
  finishes each batch with pairs finished and failed; on-screen notices; Recent days with the
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
- **Database:** the latest migration is `demo_clock` (D-125); `prisma/migrations/` lists them all.
  UUIDv7 ids (D-018).

## Next step (exact)

1. Dylan: paste `qa/CODEX_PROMPT_PHASE_31_RUN4.md` into Codex (a weekday).
2. Dylan, on a weekday with today planned: `qa/CODEX_PROMPT_PHASE_30F_3_RUN3.md` again as run 4
   (Batches, the plan line, the full suite; the Plan days cells from #44 too).
3. After both pass: Claude gives the Phase 31 git commands.
4. Dylan: time a roll by hand at the factory and compare with Reports → Rolls' Scanning time.
5. Dylan, at the station: capture a few real knife cuts on scrap leather (2.5, 3 and 4 in) with
   the card to check the 3-inch line on real cuts.
6. Optional: fresh screenshots for README (the ones in `docs/screenshots/` predate Phase 25 and
   30F, so README no longer embeds them); delete `%TEMP%\cpoint-qa-uploads-phase26` and the two
   Phase 25 folders; the backups in `storage/backups/`, the old `certs/` files and
   `docker image prune -a -f` (about 8.4 GB).

## Blockers

- None for the demo.

## Open questions / assumptions awaiting client confirmation

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
