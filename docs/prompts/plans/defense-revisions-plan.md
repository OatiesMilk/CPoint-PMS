# Plan: the panel's revisions after the defense (Phases 32 to 36)

**Status:** PLAN ONLY, waiting for Dylan's go. No code, no migrations, no git.
**Written:** 2026-11-16, from the PC copy (`D:\…\CAP2\CPoint-PMS`, `main` at 7f69dbe, #53 merged,
README and STATUS edited but uncommitted).
**Re-checked 2026-11-17 against the laptop and the vault:** the laptop's `main` was at c7d404f
(#46), seven merged PRs (#47 to #53) behind, with only two uncommitted files (STATUS's
2026-11-08 cleanup notes and an older DEMO_SCRIPT.md). None of the four features exists there in
any form, so "What exists today" below holds for both copies. The vault has no notes from the
defense (Meetings/ empty, nothing in Inbox/ after 7 Nov), so the panel's four lines are all
there is; nothing in the plan changes. Dylan pulled the laptop to 7f69dbe the same day (demo
clock migration applied), so both copies now share the plan's base (#53, D-127, highest
assumption A-51). Dylan no longer needs DEMO_SCRIPT (2026-11-17), so it is out of every phase; the PC still has an
uncommitted README edit and STATUS lines.
**Inputs read:** CLAUDE.md, docs/STATUS.md, DECISIONS (D-087, D-094, D-097 to D-099, D-104, D-112 to
D-118), the client survey, `prisma/schema.prisma`, Batches (`src/app/(app)/batches/**`,
`src/lib/production-rules.ts`, `production.service.ts`), Reports (`src/app/(app)/reports/**`,
`src/lib/report-rules.ts`), Inventory rolls. Newest Codex report: `qa/reports/2026-11-14-ci-recheck-pr50-run1.md`,
PASS, nothing unresolved. (The older `2026-11-09-no-api-tokens-run1.md` FAIL belongs to the
D-124 "no API tokens" work, which is not in the schema and has `undo-no-api-tokens.sql` beside it
on the PC; it does not block this plan. Dylan to confirm that work is dropped.)

## The four revisions in one line each

| #   | Panel's ask                                                                                     | What we build                                                                                                                                                                                                                                                                                           | Phase  |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 4   | Physically traceable roll IDs and storage locations                                             | Storage locations (rack / bin), each roll placed in one, printed QR labels for rolls and locations, a Find roll lookup, a location history per roll                                                                                                                                                     | **32** |
| 2   | A clear queue of pending batches, not "Batch 1 / Batch 2"                                       | Batches get a real code (`B-261116-2`), stay in an Inspection queue until inspected (across days), with priority, age and status                                                                                                                                                                        | **33** |
| 1   | WIP monitoring, and whether a final-product defect can be fixed and which stage it goes back to | Final-product defect types (data); the QI calls each failed pair Fixable / Not fixable and picks the stage it goes back to, and the system learns where each defect usually comes from; failed pairs broken down by defect; repair jobs sent back to a stage and re-inspected; a Work in progress board | **34** |
| 3   | Edit report details, sort and filter, print daily / weekly / monthly / custom reports           | Period picker (Day, Week, Month, Custom), sortable and filterable tables, a print layout for every report, corrections to past records with a reason                                                                                                                                                    | **35** |
| —   | "The documentation must match our system" (project goal 2)                                      | README, USER_MANUAL, API.md, master spec, the paper's figures, demo seed and CI checks updated to Phases 32 to 35                                                                                                                                                                                       | **36** |

**Why this order:** 32 stands alone and is the lowest risk. 33 must come before 34, because the
inspection result in 34 (failed pairs by defect, sent for repair) is recorded on the queue item
that 33 creates, and repaired pairs come back through the same queue. 35 goes after 32 to 34 so
the new reports, filters and print pages cover the new data in one pass. 36 closes with the docs
and figures. One phase per session, each with its own Codex QA, as usual.

---

## Phase 32 — Roll IDs you can find on the floor (revision 4)

### What exists today

- Every roll has a unique code `LR-<supplier code>-NNN` (`Roll.code @unique`, Phase 30A), an
  optional supplier tag number (`Roll.tagCode`), area, received date and a status
  (`IN_STOCK → OPEN → FINISHED`, or `CANCELLED`; `RETURNED` for old rows; `returnDecision` for over-limit rolls).
- Inventory → leather item → roll list; Capture picks leather, then roll, from a dropdown.
- **Gap:** nothing says _where_ a roll is. No location, no label, no scan-to-find, no history of
  moves. The roll exists only as a row and a count.

### Proposed changes

- **Schema (migration `roll_locations`):**
  - `StorageLocation { id, code @unique ("RACK-A-2"), name ("Rack A, shelf 2"), kind (RACK | BIN | AREA), notes?, isActive, sortOrder, createdAt }`.
  - `Roll.locationId String?` (null = "Not placed yet") and `Roll.locatedAt DateTime?`.
  - `RollLocationEvent { id, rollId, fromLocationId?, toLocationId?, reason (PLACED | MOVED | TAKEN_FOR_USE | PUT_BACK | SET_ASIDE_FOR_RETURN | RETURNED_TO_SUPPLIER), note?, byId, at }`.
  - Existing rolls: location null. Nothing is guessed.
- **Settings → Storage locations** (Floor Manager manages; Admin too if Dylan wants): add, rename,
  deactivate (only when empty), print location labels.
- **Inventory:** Add rolls asks for a location (optional, prefilled with the last one used); the
  roll list shows location and lets the FM **Move** one or many rolls (writes an event).
- **Labels:** a print page `/inventory/labels?rolls=…` and `/settings/locations/labels`, sized for
  plain A4 sticker sheets: roll code in large text, QR code, leather item, supplier, area, received
  date, tag number. The QR holds the roll's URL (`/r/LR-MLT-001`), so any phone camera opens it.
- **Find roll** (`/rolls/find`, FM and constructors with capture): type a code or tag, or scan a
  QR with the phone. Shows status, location, and the location history.
- **Capture:** the roll picker shows each roll's location ("LR-MLT-004 · Rack A-2"); a **Scan
  label** button picks the roll by its QR. Picking writes `TAKEN_FOR_USE`. Putting an empty roll
  back (exists today) asks where it was put (`PUT_BACK`).
- **Return to supplier:** marking Returned writes `SET_ASIDE_FOR_RETURN` to a chosen location
  (e.g. a "Return area"), and a later "Picked up by supplier" closes it (`RETURNED_TO_SUPPLIER`).
- **New dependencies (Dylan's OK, 2026-11-17):** `qrcode` to draw QR codes on the server (SVG, no
  network), and `jsqr` to read them in the browser where the BarcodeDetector API is missing (iOS
  Safari). Both small, no native build.
- **Files:** `prisma/schema.prisma`, new `src/server/models/location.model.ts`,
  `src/server/services/location.service.ts`, `src/server/controllers/location.controller.ts`,
  `src/app/api/v1/locations/**`, `src/app/api/v1/rolls/[id]/move/route.ts`,
  `src/app/(app)/inventory/[id]/{page,add-rolls-dialog}.tsx`, `src/app/(app)/inventory/labels/page.tsx`,
  `src/app/(app)/rolls/find/page.tsx`, `src/app/r/[code]/page.tsx`,
  `src/app/(app)/camera/capture/{start-roll-form,roll-bar}.tsx`, `src/app/(app)/admin/settings/**`,
  `src/server/policies/{permissions,navigation}.ts`, `roll.service.ts`, `demo-seed.service.ts`,
  `docs/API.md`.

### Assumptions to log (A-52 to A-56)

- A-52: a roll's code stays `LR-<supplier>-NNN`; the label prints that code, not a new one.
- A-53: locations are free-form racks, bins or areas named by CPoint; the demo uses
  "Rack A-1 … A-3, Rack B-1 … B-3, Return area". CPoint's real layout is unknown.
- A-54: rolls are labelled on plain A4 sticker paper on an office printer; no label printer.
- A-55: once a roll is finished at Capture it leaves storage for good (D-112), so its location
  closes with `TAKEN_FOR_USE`; leftover pieces are not tracked as rolls.
- A-56: the Floor Manager places and moves rolls; a constructor only picks (taken) and puts back.

### QA

- Unit: location rules (can't deactivate a non-empty location, move writes one event, history
  order), QR payload, label data.
- Codex e2e: add rolls with a location, move rolls, print labels (PDF via `page.pdf`), open
  `/r/<code>`, pick by QR at Capture with a fake camera stream showing a label image, put back,
  return-to-supplier flow, permissions per role.

---

## Phase 33 — The Inspection queue (revision 2)

### What exists today

- A batch is a check-in interval of the day (D-097), worked out from the day's plan, numbered
  "Batch 1, 2, 3" (`production-rules.ts`), stored only when finished (`ProductionCheckIn`, keyed
  by `day` + `slotAt`).
- The QI sees **today only** (Dylan 2026-10-24) and a batch **closes at midnight** (D-084,
  `finishWindow`: "write the count in the notes of today's next batch instead").
- States are worked out: upcoming, in progress, due, late, missed. No priority, no identifier
  beyond the number, nothing says what is in the batch.
- **Gap:** an inspector can't see every batch waiting, can't tell batches apart from different
  days, can't put one first, and can't track it once it slips past midnight.

### Proposed changes

- **Schema (migration `inspection_queue`):**
  - `ProductionBatch { id, code @unique, day, number, startAt, slotAt, status (UPCOMING | WAITING | INSPECTING | INSPECTED | VOID), priority (NORMAL | URGENT), priorityReason?, prioritySetById?, inspectionStartedAt?, inspectionStartedById?, createdAt }`.
  - `ProductionCheckIn.batchId @unique` (the inspection result of that batch). Existing check-ins
    get a batch row in the migration (status INSPECTED); past plan slots with no check-in get
    status VOID ("Not inspected, from before the queue") so they do not flood the queue.
  - Rows are made from the day's plan when the plan is saved, and remade while the plan can still
    change (A-36); never deleted once a batch is waiting.
- **Identifier:** `B-YYMMDD-N`, e.g. **B-261116-2**, shown with its day and times and what went
  into it: "B-261116-2 · Mon 16 Nov, 12:00–15:00 · 6 rolls (Full-grain black ×4, Suede brown ×2)".
  The rolls are the ones finished at Capture inside the batch's window (already in the data).
- **Inspection queue** (Batches becomes two tabs: **Queue** and **Today**; Queue is the QI's home):
  - Lists every WAITING and INSPECTING batch across days, oldest first, with code, day, times,
    rolls, how long it has waited ("waiting 3 h 10 min"), Late badge, and priority.
  - Order: Urgent first, then oldest waiting first.
  - **Start inspection** marks it INSPECTING with who and when (so two inspectors don't count the
    same batch); **Inspect** opens today's Finish batch form (pairs finished, failed) and sets
    INSPECTED.
  - The Floor Manager can mark a batch **Urgent** with a reason, or set it back to Normal.
  - Filters: day, status, priority; a search by code.
  - **Inspected** list below (last 7 days), so a batch can be tracked after it leaves the queue.
- **Supersedes:** "QI sees today only" (2026-10-24) and the midnight close of D-084. A batch now
  stays waiting until inspected; it is still marked Late after 30 minutes.
- **Notices, cards and the plan calendar** read the code instead of "Batch 2".
- **Files:** `prisma/schema.prisma`, `src/lib/production-rules.ts` (code, ordering, finish window),
  `src/server/models/production.model.ts`, `production.service.ts`,
  `src/server/controllers/production.controller.ts`, `src/app/api/v1/production/batches/**`,
  `src/app/(app)/batches/{page,finish-batch-dialog,actions}.tsx`, new `queue-list.tsx`,
  `src/components/features/batches/batch-notices.tsx`,
  `src/components/features/production/production-cards.tsx`, `batches/plan/plan-calendar.tsx`,
  `demo-seed.service.ts`, `.github/workflows/ci.yml` (docker SQL checks).

### Assumptions to log (A-57 to A-61)

- A-57: the batch code is `B-YYMMDD-N`; the panel asked for meaningful identifiers, CPoint has not
  named a format.
- A-58: priority is Normal or Urgent only, set by the Floor Manager; the queue's default order is
  oldest waiting first.
- A-59: a waiting batch never expires; the FM can **Void** one with a reason (no pairs made, line
  stopped) so it leaves the queue.
- A-60: Start inspection is optional; an inspector may go straight to Inspect.
- A-61: batches already past on the day this ships are not queued (VOID, "from before the queue").

### QA

- Unit: code format, queue order (urgent, then age), status changes, plan change remakes
  upcoming rows only, migration back-fill rules.
- Codex e2e: several days waiting in the queue, urgent jumps to the top, start / inspect by two
  QI sessions (second one sees "Being inspected by …"), inspect a batch from yesterday, void with
  reason, phone layout of the queue, demo clock moved across midnight.

---

## Phase 34 — Final-product defects, repairs and work in progress (revision 1)

### What exists today

- The camera checks **leather** at Preparation (Pass or Reject, final, D-093). Rolls over 10%
  defects are Returned to supplier (D-116).
- At the end of each batch the QI enters pairs finished and **how many failed inspection**, a
  number only. Nothing says why they failed, whether they can be fixed, or where they go.
- Stage monitoring was removed in Phase 23 (D-087) and the Repair Station and Salvage in Phase 25
  (D-094, C-20). Both were about leather sections, not finished shoes.
- **Gap:** no stage-level view of work in progress, no final-product defect types, no fixable /
  not fixable call, no return stage, no tracking of pairs sent back.

### Proposed changes

- **Stages are data-light:** `enum ProductionStage { PREPARATION, CONSTRUCTION, SOLE_ING, FINISHING }`.
  **Construction** replaces "Upper making" everywhere (Dylan, 2026-11-17): UI, docs and the paper's
  figures (Phase 36).
- **Final defect types (data, Settings → Final defect types):** the finished-shoe defects the QI
  finds (e.g. lifted sole, glue marks, loose stitching, scuffs; the demo list is a placeholder marked "to confirm with CPoint"),
  plus **Other** with a required note. Leather defects (cut, hole, crease, scratch) stay with the
  camera at Preparation and are not on this list (Dylan, 2026-11-17: the QI's defects are a
  separate list from the CV module's).
  `FinalDefectType { id, key @unique, label, description?, isActive, sortOrder }`.
- **Where defects come from is learned, not preset (Dylan, 2026-11-17):** nothing says in
  advance which defect is fixable or which stage it goes back to. The QI chooses both per
  finding. Once a type has at least 5 findings in the last 4 weeks, the form suggests the most
  common answer ("Usually Sole-ing (14 of 17), fixable"); the QI can always change it. The stage
  picked is where the pairs go back to be fixed, which is mostly where the defect came from; the
  report says so (A-75).
- **Inspection breakdown:** when failed pairs > 0, Inspect asks for one line per defect:
  `InspectionFinding { id, checkInId, finalDefectTypeId, pairs, remedy (FIXABLE | NOT_FIXABLE), returnStage?, note? }`.
  The lines must add up to the failed pairs (inline message names the line and the gap).
- **Repairs:** each Fixable line creates
  `RepairJob { id, code @unique ("RP-261116-2-1"), batchId, findingId, pairs, stage, status (AT_STAGE | BACK_FOR_INSPECTION | DONE), sentAt, backAt?, inspectedAt?, passedPairs?, scrappedPairs?, sentById, … }`.
  - The stage marks it **Back for inspection** (the FM or QI taps it on the board; constructors
    are not tracked per person, D-008).
  - It then appears in the **Inspection queue** (Phase 33) under its own code, and the QI enters
    passed and scrapped pairs (scrapped can also be sent back again as a new job).
  - Not fixable pairs are counted as **Scrapped** with their defect.
- **Stage assignments in the day's plan (Dylan, 2026-11-17):** the Plan dialog gets a **Stages**
  section with Preparation, Construction, Sole-ing and Finishing. For each, the FM picks the Shoe
  Constructor(s) assigned that day from the active constructors (absent ones from Attendance are
  flagged). Optional, editable all day even after the plan locks (people move between stations),
  and prefilled from the previous working day for the FM to change.
  `StageAssignment { id, day, stage, userId, assignedById, createdAt }`.
- **WIP counts from the stages:** an assigned constructor sees a **My stage** card on their phone
  (Capture stays the home; Preparation keeps Capture): "Sole-ing · pairs here now: [ ] Save". One
  shared number per stage, a snapshot of pairs at that stage now, updated any time with a
  reminder at each batch end. The FM can enter or correct it, and covers a stage with nobody
  assigned or present. `StageCount { id, day, stage, pairs, enteredById, enteredAt, batchId? }`
  (linked to the batch it was entered in, for the reports).
- **Never per person (D-008):** the board and reports show stage totals only; who entered a count
  is in the audit log only, like every other change. Assignment is not a score.
- **Repairs on the stage screens:** a repair job sent to a stage shows on that stage's card ("2
  pairs back for repair, Lifted sole") and the assigned constructors mark it **Back for
  inspection**; the FM can too.
- **Work in progress board** (`/production/wip`, FM home card, QI read-only): a column per stage
  with the latest count and when it was entered, pairs in repair there, and who is assigned (names
  for the day's assignment only, no figures beside them); Preparation also shows rolls open and
  being scanned (exists); **Waiting for inspection:** batches and repairs in the queue.
- **Reports:** Operations gets a **Work in progress** section, pairs at each stage per batch and
  per day (the bottleneck view; the survey names Upper making, now Construction, and Sole-ing as
  the slow stages), with Phase 35's periods, filters, sort and print.
- **Quota:** stays on passed pairs (C-41). A repaired pair that passes later counts on the day it
  passes (A-64).
- **Files:** `prisma/schema.prisma` (migration `final_defects_and_repairs`), new
  `src/lib/repair-rules.ts`, `src/server/{models,services,controllers}/repair.*`,
  `src/app/api/v1/repairs/**`, `src/app/api/v1/final-defect-types/**`,
  `src/app/(app)/batches/finish-batch-dialog.tsx` (breakdown lines), `src/app/(app)/production/wip/page.tsx`,
  `src/app/(app)/floor-manager/page.tsx`, `src/app/(app)/admin/settings/**`,
  `src/app/(app)/batches/plan/plan-calendar.tsx` (Stages section in the Plan dialog), new `src/app/(app)/camera/capture/my-stage.tsx`,
  `src/server/services/{bootstrap,demo-seed,ops-report}.service.ts`, Reports → Quality (defects by
  type, fixable share, repairs by stage, turnaround) and a new **Where defects come from** table:
  each final defect type against the four stages, with counts and shares for the period.

### Decided: how WIP is counted (Dylan, 2026-11-17)

The FM assigns constructors to stages in the day's plan and they enter their stage's WIP count
(above). This replaces the three options in the first draft (FM-only count, per-batch stage
tracking, repairs only). New D-entry with Phase 34.

### Assumptions to log (A-62 to A-66)

- A-62: the list of final defect types is CPoint's to set (the demo's is a placeholder); whether
  each is fixable and where it comes from is learned from the QI's findings, never preset.
- A-63: the QI decides fixable / not fixable per finding, the Floor Manager may change it until
  the repair is sent (survey Q5: "whoever is available").
- A-64: a repaired pair that passes counts toward the quota of the day it passes.
- A-65: a repair has no due time; the board shows how long it has been at the stage.
- A-66: the leather checkpoint is unchanged; Preparation in the return stage means "re-cut the
  part", not a new leather scan.
- A-72: several constructors may share a stage and keep one shared count; the latest count wins.
- A-73: a WIP count is the pairs at the stage now (a snapshot), not pairs finished since the last
  count, so it never reads as one person's output.
- A-74: the next day's stage assignment starts from the previous working day's.
- A-75: one stage per finding, where the pairs go back to be fixed; it mostly shows where the
  defect came from (a sole stain made at Sole-ing may be cleaned at Finishing).
- A-76: a suggestion needs at least 5 findings of that type in the last 4 weeks; below that the
  QI picks with no suggestion. The demo's two weeks of data include enough findings to show it.

### QA

- Unit: findings must add up, repair state changes, quota counting with repairs, WIP totals,
  assignment prefill, who may enter a stage's count.
- Codex e2e: the suggestion appears after the 5th finding of a type and can be overridden; the
  Where defects come from table matches the findings; inspect with failed pairs split across two
  defects (one fixable, one not), repair job
  appears at its stage, mark back for inspection, inspect the repair, quota moves, settings for
  final defect types, permissions, no names beside any figure; FM assigns stages in Plan, an
  assigned constructor enters a count on a phone, an unassigned one can't, FM covers a stage, the
  WIP section in Operations.

---

## Phase 35 — Reports you can correct, sort, filter and print (revision 3)

### What exists today

- Reports → Operations and Quality take a range: presets Today, 7, 14, 30 days, or a custom
  from/to up to 92 days (`report-rules.ts`). Rolls has Find, Supplier, Status and Added filters;
  Materials has Year, Month, Week, Find. CSV downloads for most tables.
- Only the **claim sheet** prints (`reports/claims/[rollId]`, a Print button); the app layout
  already hides the sidebar when printing.
- Editing: a batch can be corrected **the same day only**, with a reason (D-084); a roll can be
  removed by the FM; nothing else in a report is editable.
- **Gaps:** no calendar week or month periods, no print layout for the reports, tables can't be
  sorted, few filters, past mistakes can't be corrected.

### Proposed changes

- **Period picker on every report:** **Day** (pick a date), **Week** (Monday to Friday, picked as
  "Week 3: Nov. 16", reusing `month-weeks.ts` from Materials), **Month** (year + month), **Custom**
  (from / to). Kept in the URL so a link or a print shows the same period. Max custom range raised
  to 366 days for monthly comparisons (A-68).
- **Sort and filter:** clickable column headers (`?sort=…&dir=…`, server-side, one shared
  `SortableHeader`) on every table; filters added where they matter: supplier, leather item, roll
  status, location (32), batch status and priority (33), final defect type, remedy and stage (34).
- **Print:** a **Print** button on each report opens the same report with a print layout: CPoint
  header, report name, period, generated time, prepared by (name and role of the signed-in user),
  an optional **Remarks** box, and "Prepared by / Checked by" signature lines. Charts print as
  they are (SVG). A4 portrait, tables repeat their header on each page. Daily, weekly and monthly
  are the same pages with the period set.
- **Editing report details (the records behind the reports), always with a reason and an audit
  row:**
  - The FM can **correct a past batch** (pairs, failed, defect lines) at any time, not only the
    same day (supersedes D-084's same-day limit). The original stays in the audit log; the report
    shows "Corrected" with who, when and why.
  - The FM can **edit a roll's details**: tag number, received date, location (32), area before
    it is scanned, return note.
  - The FM can edit a **repair** record (34) until it is done.
  - Remarks and the prepared-by line on the print page are typed before printing and not saved
    (A-69).
- **Files:** `src/lib/report-rules.ts`, `src/lib/month-weeks.ts`, new
  `src/components/features/reports/{period-picker,sortable-header,print-header}.tsx`,
  `src/app/(app)/reports/**`, `src/server/services/{report,ops-report,materials,production}.service.ts`,
  the report controllers and CSV routes (same period and sort params), print CSS in
  `src/app/globals.css`, `docs/API.md`.

### Assumptions to log (A-67 to A-70)

- A-67: a week is Monday to Friday, as production works (D-105); the week label follows Materials.
- A-68: the custom range may go up to 366 days.
- A-69: print remarks are not stored; the printed paper is the record.
- A-70: only the Floor Manager corrects past records; the QI corrects only today's batch, as now.

### QA

- Unit: period math (day, week, month, custom, edges at month and year ends), sorting per column,
  filters combine, correction rules.
- Codex e2e: each report with each period, sort each table, filters, print emulation and a PDF
  per report (`page.emulateMedia({ media: 'print' })`, `page.pdf`), correct a batch from last
  week, edit a roll's details, audit rows, CSV matches the screen.

---

## Phase 36 — The documentation matches the system (project goal 2)

- Update to Phases 32 to 35: `docs/prompts/system-rebuild.md` (context, data model, rules),
  README (features and demo script), `docs/USER_MANUAL.md` (+ PDF and screenshots),
  `docs/API.md`, DESIGN.md (labels, queue, print), STATION_SETUP (labels),
  the paper's figures (system architecture and conceptual framework, last dated 2026-11-07 in the
  project files), and `docs/prompts/paper-figures.md`.
- Demo seed: locations and labels, a queue with waiting and urgent batches, a few repairs at
  different stages, final defect findings across the two weeks.
- CI docker job: SQL checks for locations, batch codes, findings and repairs.
- Sweep for "Batch 1", "Batch 2", "closes at midnight" and "Upper making" (now Construction) in
  docs, UI and the paper's figures.
- Codex: a docs QA pass like Phase 31 (each manual step done in the app).

## Every phase (unchanged rules)

- Each phase runs in its own project thread (Dylan, 2026-11-17), starting from this plan.
- Plan posted and Dylan's go before code; `npm run check` by Claude; e2e and browser tests by
  Codex from a handoff in `qa/handoffs` and `qa/CODEX_PROMPT_PHASE_<n>.md`.
- New D-entries: D-128 (locations and labels), D-129 (inspection queue, supersedes the QI's
  today-only view and D-084's midnight close), D-130 (final defects and repairs, partly reverses
  the "no repair" part of D-094 for finished shoes only), D-131 (reports and corrections,
  supersedes D-084's same-day correction).
- STATUS, SESSION_LOG, DECISIONS, ROADMAP and the vault updated after each phase; git commands
  for Dylan only after a full Codex pass.
- Rules kept: no per-person figures, defect rules as data, MVC layering, `runInTransaction` +
  `recordAudit`, guards on every page and route, phone layouts only for Capture and Batches (plus
  Find roll and the labels' QR target, A-71: they are phone pages too).

## What Dylan needs to decide before Phase 32

1. ~~Order~~ decided 2026-11-17 (Dylan): 32 → 33 → 34 → 35 → 36.
2. ~~WIP counting~~ decided 2026-11-17: stage assignments in the plan, constructors enter counts;
   the stage is called Construction.
3. ~~OK to add `qrcode` and `jsqr`~~ OK 2026-11-17 (Dylan).
4. Anything CPoint can answer quickly: their final-product defect list, their rack layout, and a
   batch code format they would recognise. Where each defect comes from is learned from the data
   (decided 2026-11-17). Without answers, the assumptions above stand and are marked for CPoint.
