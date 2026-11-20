# Plan: Phase 33, the Inspection queue with real batch codes (defense revision 2)

**Status:** BUILT 2026-11-19 (D-129; npm run check passed, 822 unit tests); waits for Codex run 1. Was: plan only; the build waited until Phase 32
(roll locations, QR labels, Find roll) passes Codex QA and Dylan commits it (Dylan, 2026-11-18).
**2026-11-19:** Phase 32 passed (run 3) and is merged (#54, `main` at 42a2c1e). Dylan answered §7:
every question is answered (§7: B- for batches with old roll codes updated, lifecycle stored,
old batches get codes, correct on the inspection day, A-81 to A-85). The build waits only for his
go and his OK to create the branch.
**Written:** 2026-11-18 on the laptop (`C:\dev\CPoint-PMS`, `main` at 7f69dbe with Phase 32
uncommitted on top).
**Brief:** no separate brief exists in `docs/prompts/`. The brief is the Phase 33 section of
`docs/prompts/plans/defense-revisions-plan.md`, together with the panel's own line in the vault
(`Inbox/Defense revisions 2026-11-16.md`, revision 2): _"Provide a clear queue of pending batches
so inspectors can identify, prioritize, and track multiple batches awaiting inspection. Don't just
put 'Batch 1' / 'Batch 2'."_
**Inputs read:** vault CLAUDE.md, Rules.md, Home.md, "CPoint commands and where to look",
"Defense revisions (32 to 36)", Daily 2026-11-18; repo CLAUDE.md, STATUS, the defense plan,
`prisma/schema.prisma` (DayPlan, ProductionCheckIn, Roll), `src/lib/production-rules.ts`,
`src/server/services/production.service.ts`, `src/app/(app)/batches/page.tsx`, permissions,
docs/API.md (production), the CI docker checks, the unit and e2e test lists.
**Newest Codex report (triage only):** `qa/reports/2026-11-18-phase-32-roll-locations-run1.md`,
FAIL (F1 label sheet splits across two A4 pages, F2 bulk move audit has a blank Before, F3 the
returns spec's claim-sheet locator). All three are Phase 32 findings, fixed in Phase 32's own
thread, and none touches Batches. Nothing in it blocks this plan, and this plan changes no Phase
32 file's Phase 32 behaviour.

---

## 1. Goal

An inspector opens Batches and sees **every batch still waiting for inspection, across days**,
each with a real code such as **B-261116-2**, its day and times, what went into it, how long it
has waited and its priority. The inspector can tell batches apart, take the most urgent one first,
and still find a batch after it leaves the queue. "Batch 1 / Batch 2" no longer appears on its own
anywhere a batch is named.

## 2. What exists today (verified in the code)

- A batch has **no row of its own**. `batchesFor()` (`src/lib/production-rules.ts:180`) works the
  day's batches out from the `DayPlan` (shift, interval) and the lunch break, numbered from 1.
  The label is built there: `` `Batch ${i + 1} · …` `` (line 244).
- A batch is only stored once finished, as a `ProductionCheckIn` keyed by `@@unique([day, slotAt])`
  (`prisma/schema.prisma:677`). `slotAt` (the batch's end) is the only identifier. The API takes
  `{ slotAt, pairs, failedPairs?, notes? }` (`POST /api/v1/production/check-ins`).
- The state is worked out from the clock, never stored (`batchState`, line 272): Upcoming,
  In progress, Due, Late (30 min after its end, D-084), Missed (the Manila day is over, nothing
  saved), Finished.
- `finishWindow` (line 316) refuses a batch after midnight: _"Batch N of <day> closed at midnight.
  Write the count in the notes of today's next batch instead."_ `correctCheckIn` refuses anything
  not from today.
- `productionToday` loads **today only**; the page comment says _"The Quality Inspector sees today
  only (Dylan 2026-10-24)"_ (`batches/page.tsx`).
- "Batch N" is written in: `production-rules.ts` (label, finish window, notices),
  `production.service.ts` (describeBatches, alreadyFinished, audit `batch: batch.label`),
  `production.validator.ts` (pairs messages), `batches/page.tsx`, `finish-batch-dialog.tsx`,
  `plan/plan-calendar.tsx`, `batch-notices.tsx`, `production-cards.tsx`.
- Note: the defense plan lists `src/app/api/v1/production/batches/**`. That folder doesn't exist.
  The production routes are `check-ins`, `check-ins/[id]`, `days`, `plans`, `plans/[day]`,
  `plans/[day]/non-working` and `today`. Phase 33 adds `batches/**` (below).

**The gap the panel saw:** nothing names a batch beyond its number, nothing shows yesterday's
unfinished batch (it becomes Missed at midnight and can't be finished), and there is no priority
or "being inspected" mark.

## 3. Approach

### 3.1 Schema (one migration, `inspection_queue`)

New model `ProductionBatch` (table `production_batches`):

| Field                                                | Type                 | Note                                      |
| ---------------------------------------------------- | -------------------- | ----------------------------------------- |
| `id`                                                 | uuid v7              | D-018                                     |
| `code`                                               | String `@unique`     | `B-YYMMDD-N`, e.g. `B-261116-2` (A-57)    |
| `day`                                                | Date                 | Manila day                                |
| `number`                                             | Int                  | 1, 2, 3 within the day (kept for order)   |
| `startAt`, `slotAt`                                  | DateTime             | `slotAt` = its end, as today              |
| `status`                                             | enum `BatchStatus`   | `OPEN`, `INSPECTING`, `INSPECTED`, `VOID` |
| `priority`                                           | enum `BatchPriority` | `NORMAL`, `URGENT`                        |
| `priorityReason`, `prioritySetById`, `prioritySetAt` | optional             | FM's Urgent mark                          |
| `inspectionStartedAt`, `inspectionStartedById`       | optional             | Start inspection                          |
| `voidReason`, `voidedById`, `voidedAt`               | optional             | A-59                                      |
| `createdAt`, `updatedAt`                             | DateTime             | `updatedAt` for stale checks              |

`@@unique([day, slotAt])`, `@@unique([day, number])`, `@@index([status, priority])`.
`ProductionCheckIn` gets `batchId String? @unique` → `ProductionBatch` (the batch's inspection
result). It stays nullable in the migration and is filled by the back-fill. Existing
`@@unique([day, slotAt])` on check-ins stays.

**Change from the defense plan (new decision, for Dylan's OK):** store only the lifecycle (`OPEN`,
`INSPECTING`, `INSPECTED`, `VOID`), not `UPCOMING` / `WAITING`. Upcoming, In progress, Waiting
and Late stay **worked out from the clock**, as `batchState` does now. Reason: the demo clock
(D-125) moves the app's time back and forward. A stored "Waiting" would be wrong after the clock
moves back, and a stored status would need a job to flip it at each batch's end. There is no
scheduler in the app.

**Migration back-fill (SQL in the migration, unit-tested as a pure function where possible):**

- Every existing `ProductionCheckIn` gets a batch row (status `INSPECTED`), with `number` worked
  out from its day's plan. If the plan no longer yields that slot, `number` is the check-in's order
  within its day.
- **Every old batch gets a row and a code too (Dylan, 2026-11-19: update old data to match).**
  Past plan slots with no check-in get a row with status `VOID` and the reason "Not inspected,
  from before the queue", so they have a code in history and Recent days but don't fill the
  queue (A-61). The rows need the TypeScript batch rules, so the back-fill runs as a one-time
  step on deploy (a script called from the migration's follow-up, idempotent), not in SQL.
  Today's and future planned days get `OPEN` rows the same way.
- Rows for today and future planned days are made by the app on first read (3.2), not in SQL,
  because the batches depend on the TypeScript batch rules and the lunch break.

### 3.2 When batch rows are made and remade

- **On plan save** (`writeDay`, `saveDayPlan`, `markNonWorking`, `clearNonWorking`): in the same
  transaction, make the day's rows from `batchesFor()`. While the day's plan can still change
  (A-36: until its first batch is finished), the `OPEN` rows with no check-in are replaced. A row
  that is `INSPECTING`, `INSPECTED` or `URGENT` is never deleted.
- **Lunch break saved** (`saveLunchBreak`, from tomorrow): remake the `OPEN` rows of planned days
  from tomorrow on.
- **On read** (`productionToday`, the queue): `ensureBatchRows(day)` makes rows for a planned day
  that has none (days planned before the migration, demo data). It is idempotent on
  `(day, slotAt)`, so two readers at once don't clash (insert … on conflict do nothing).
- Each remake writes `recordAudit` in the plan's transaction (`production.batches.remake`, with
  the codes before and after).

### 3.3 Rules (`src/lib/production-rules.ts`, pure, unit-tested)

- `batchCode(day, number)` → `B-261116-2`.
- `queueState(batch, now)`: Upcoming / In progress / Waiting (from its end) / Late (30 min after
  its end, D-084 kept) / Being inspected / Inspected / Void. **No Missed at midnight** for batches
  made by the queue.
- `queueOrder`: Urgent first, then the oldest end first, then the number.
- `waitingFor(batch, now)` → "waiting 3 h 10 min".
- `finishWindow` keeps "opens 10 minutes before the end" (C-28) and **drops the midnight close**
  for queued batches (supersedes D-084's midnight close, D-129).
- Labels and notices use the code: "B-261116-2 is due. Finish it now."

### 3.4 Services, models, controllers, API

- `src/server/models/production.model.ts`: `listQueue({ status, priority, day, q })`,
  `findBatch`, `findBatchByCode`, `upsertBatchRows`, `replaceOpenBatchRows`, `setBatchStatus`,
  `setBatchPriority`, `voidBatch`, all with `updatedAt` checks for stale writes.
- `src/server/services/production.service.ts`:
  - `inspectionQueue(viewer, filters, now)`: OPEN past their end and INSPECTING, across days, in
    queue order, each with code, day label, times, rolls in it, wait, Late, priority, who started
    inspecting. Plus **Inspected** for the last 7 days.
  - Rolls in a batch: rolls whose scan was finished at Capture (`Roll.finishedAt`) inside the
    batch's start and end, grouped by leather item: "6 rolls (Full-grain black ×4, Suede brown
    ×2)". Read-only, from data that already exists.
  - `startInspection(batchId, actor)`: OPEN → INSPECTING. A second inspector sees "Being
    inspected by <name> since 14:05". Optional (A-60).
  - `saveCheckIn` takes `batchId` (keeps `slotAt` for the old API shape, resolved to its batch),
    sets the batch INSPECTED in the same transaction, works for a past day's batch, and the audit
    records `batch: code`.
  - `setPriority(batchId, priority, reason, actor)` and `voidBatch(batchId, reason, actor)`:
    Floor Manager only.
  - `correctCheckIn`: see Q4. Proposed: a batch can be corrected on the day it was inspected
    (today's rule moved from the batch's day to the inspection's day), until Phase 35 replaces it.
  - `productionDays` (Recent days, Operations report, CSV): "Missed" counts only past slots with
    no row (pre-queue history); a queued batch still waiting shows as "Waiting", a voided one as
    "Void".
- `src/server/controllers/production.controller.ts`, validators in
  `src/server/validators/production.validator.ts` (priority reason 3 to 200 chars, void reason
  likewise, messages naming the field and the fix).
- New routes (one-liners, `requireApiPermission`):
  - `GET  /api/v1/production/batches?status=&priority=&day=&q=` (`production:read`)
  - `POST /api/v1/production/batches/{id}/start` (`production:checkin`)
  - `PUT  /api/v1/production/batches/{id}/priority` (`production:prioritise`, new, FM)
  - `POST /api/v1/production/batches/{id}/void` (`production:prioritise`)
  - `POST /api/v1/production/check-ins` accepts `{ batchId | slotAt, pairs, failedPairs?, notes? }`
- Every mutation in `runInTransaction` with `recordAudit` on the same `tx`
  (`production.batch.start`, `.priority`, `.void`, `production.checkin` with the code).

### 3.5 Pages and components (DESIGN.md + ui-craft; Batches is already a phone page, D-096)

- `src/app/(app)/batches/page.tsx`: two tabs, **Queue** (the Quality Inspector's home) and
  **Today**. The FM keeps Recent days under Today.
- New `src/app/(app)/batches/queue-list.tsx`: one card per waiting batch: the code large, then
  "Mon 16 Nov, 12:00–15:00", the rolls line, "waiting 3 h 10 min", badges Late / Urgent / Being
  inspected by …, and actions Start inspection and Inspect (opens Finish batch). Filters: day,
  status, priority, search by code. Below: Inspected, last 7 days. Empty state: "No batches are
  waiting for inspection."
- `finish-batch-dialog.tsx`: title and labels use the code ("Pairs finished in B-261116-2"); works
  for a batch from an earlier day (shows its day).
- New `src/components/features/batches/priority-dialog.tsx` and `void-batch-dialog.tsx` (FM):
  reason fields with inline messages that name the field.
- `batch-notices.tsx`, `production-cards.tsx`, `plan/plan-calendar.tsx`: the code in place of
  "Batch N". The calendar shows codes once a day's rows exist.
- `src/server/policies/permissions.ts`: `production:prioritise` → `FLOOR_MANAGER`.
- Copy stays short and plain (vault memory "CPoint plain copy").

### 3.6 Demo data and reset

- `src/server/services/demo-seed.service.ts`: the two weeks of check-ins get their batch rows and
  codes (through `saveCheckIn`, which now makes them). The demo leaves **two batches waiting from
  earlier days** (one marked Urgent with a reason) and one Void, so the queue isn't empty on a
  fresh demo.
- `src/server/models/demo-reset.model.ts` / `scripts/demo-reset.ts`: delete
  `production_batches` (after check-ins) and count them in the dry run.
- `.github/workflows/ci.yml` docker job: checks that every check-in has a batch, codes match
  `^B-[0-9]{6}-[0-9]+$`, at least one batch waiting after the demo seed. If Claude can't write
  `ci.yml` in that session, the exact edit goes to Dylan with the git commands.

### 3.7 Docs (in the Phase 33 wrap-up)

docs/API.md (production section), DESIGN.md (the queue card, if a new pattern), STATUS,
SESSION_LOG, DECISIONS (D-129), ROADMAP (Phase 33 row), docs/USER_MANUAL.md (Quality Inspector and
Floor Manager steps). The wider sweep for "Batch 1" and "closes at midnight" in README and the
paper's figures stays in Phase 36.

## 4. Files to change (build session)

| File                                                                                                | Change                                                                    | Phase 32 touches it?                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `prisma/schema.prisma`                                                                              | `ProductionBatch`, two enums, `ProductionCheckIn.batchId`, User relations | **yes**                                              |
| `prisma/migrations/<ts>_inspection_queue/`                                                          | new                                                                       | no (new folder)                                      |
| `src/lib/production-rules.ts`                                                                       | code, queue state/order, wait, finish window, labels, notices             | no                                                   |
| `src/server/models/production.model.ts`                                                             | batch rows, queue queries                                                 | no                                                   |
| `src/server/services/production.service.ts`                                                         | queue, start, priority, void, check-in by batch, rows on plan/lunch save  | no                                                   |
| `src/server/controllers/production.controller.ts`                                                   | new handlers                                                              | no                                                   |
| `src/server/validators/production.validator.ts`                                                     | batchId, reasons, messages with the code                                  | no                                                   |
| `src/app/api/v1/production/batches/**`                                                              | new routes                                                                | no (new)                                             |
| `src/app/api/v1/production/check-ins/route.ts`                                                      | `batchId`                                                                 | no                                                   |
| `src/server/policies/permissions.ts`                                                                | `production:prioritise`                                                   | **yes**                                              |
| `src/app/(app)/batches/page.tsx`, `actions.ts`, `finish-batch-dialog.tsx`                           | tabs, code, past day                                                      | no                                                   |
| `src/app/(app)/batches/queue-list.tsx`                                                              | new                                                                       | no                                                   |
| `src/app/(app)/batches/plan/plan-calendar.tsx`                                                      | codes                                                                     | no                                                   |
| `src/components/features/batches/batch-notices.tsx`, `priority-dialog.tsx`, `void-batch-dialog.tsx` | code; new dialogs                                                         | no                                                   |
| `src/components/features/production/production-cards.tsx` (+ `production-parts.tsx` badge)          | code, new states                                                          | no                                                   |
| `src/server/services/demo-seed.service.ts`                                                          | batch rows, waiting demo batches                                          | **yes**                                              |
| `src/server/models/demo-reset.model.ts`, `scripts/demo-reset.ts`                                    | delete and count batches                                                  | **yes**                                              |
| `.github/workflows/ci.yml`                                                                          | docker SQL checks                                                         | no                                                   |
| `tests/unit/production-rules.test.ts`, `production.service.test.ts`                                 | new cases                                                                 | no                                                   |
| `tests/unit/permissions.test.ts`, `demo-seed.test.ts`                                               | new permission, seed counts                                               | **yes**                                              |
| `tests/unit/production.validator.test.ts` (or `validator-messages.test.ts`)                         | messages                                                                  | `validator-messages` **yes**                         |
| `tests/e2e/batches.spec.ts`, new `tests/e2e/inspection-queue.spec.ts`                               | Codex runs them                                                           | no                                                   |
| `docs/API.md`, `DESIGN.md`, `docs/USER_MANUAL.md`, STATUS, SESSION_LOG, DECISIONS, ROADMAP          | wrap-up                                                                   | **yes** except USER_MANUAL (committed in #53, clean) |

## 5. Tests

**Unit (Claude, `npm run check`):**

- `batchCode` format, two-digit parts, numbers above 9.
- `queueOrder`: Urgent before Normal, then oldest end, then number; ties stable.
- `queueState` at each edge: before start, during, at end (Waiting), end + 30 min (Late), after
  midnight still Waiting (no Missed), Being inspected, Inspected, Void; with the demo clock moved
  back (state follows the clock).
- `finishWindow`: opens 10 min before the end, stays open after midnight for a queued batch.
- Plan change remakes OPEN rows only; INSPECTING / INSPECTED / URGENT rows survive; lunch change
  remakes from tomorrow.
- `ensureBatchRows` is idempotent (twice gives the same rows).
- Service: start by two inspectors (second gets the message), inspect a batch from yesterday,
  stale `updatedAt` refused, FM-only priority and void (403 for the QI), audit written in the same
  `tx` for each mutation.
- Back-fill function: check-ins map to INSPECTED rows with the right number and code.
- Validator messages name the field and the fix.

**E2E (written by Claude, run by Codex later from the handoff):**

- Several days waiting in the queue, oldest first; Urgent jumps to the top.
- Two QI sessions: Start inspection in one, the other sees "Being inspected by …".
- Inspect a batch from yesterday (demo clock moved across midnight); it leaves the queue and shows
  under Inspected.
- FM marks Urgent with a reason, sets it back to Normal, voids one with a reason; QI can't.
- Search by code, filters by day, status, priority.
- Phone layout of the Queue at 390 × 844 (no sideways scroll, 44 px targets).
- No "Batch 1" alone on Batches, the notices or the cards.
- `batches.spec.ts` updated for the tabs and the code.

## 6. Decisions and assumptions

**New decision (proposed, logged at build): D-129.** Batches get a stored row and a code; an
Inspection queue across days with priority, Start inspection and Void; supersedes "the QI sees
today only" (Dylan 2026-10-24) and D-084's midnight close for queued batches; Late after 30 min is
kept. Also: lifecycle stored, clock states worked out (§3.1, pending Q2); every old batch gets
a code, the never-inspected ones as Void "from before the queue" (§3.1, Dylan 2026-11-19).

**Assumptions (reserved in the defense plan as A-57 to A-61; CPoint hasn't confirmed any):**

- ASSUMPTION A-57: the code is `B-YYMMDD-N`. CPoint hasn't named a format (open in the vault:
  "a batch code format they would recognise"). Note: rolls from before Phase 26 keep `B-` codes
  (D-095, `B-YYYY-NNNN`-style). The formats differ, but see Q1.
- ASSUMPTION A-58: priority is Normal or Urgent only, set by the Floor Manager; the default order
  is oldest waiting first.
- ASSUMPTION A-59: a waiting batch never expires; the FM can Void it with a reason (no pairs made,
  line stopped).
- ASSUMPTION A-60: Start inspection is optional; an inspector may go straight to Inspect.
- ASSUMPTION A-61: batches already past on the day this ships get a code but aren't queued: the
  inspected ones read Inspected, the rest Void "Not inspected, from before the queue".

**New assumptions this plan adds (numbers taken at build, after Phase 32's A-80):**

- ASSUMPTION A-81: a batch inspected on a later day still counts on **its own day** (pairs, quota,
  Operations report), not the inspection day.
- ASSUMPTION A-82: who may inspect follows **today's** attendance (D-088): the FM covers only
  when today shows no QI present, whatever the batch's day.
- ASSUMPTION A-83: a batch's rolls are the rolls whose scan finished at Capture inside its
  start and end; a roll scanned across two batches counts in the one where it finished.
- ASSUMPTION A-85: an old roll with no supplier is renamed `LR-OLD-NNN`; its former code stays
  searchable.
- ASSUMPTION A-84: the Floor Manager can also see the Queue and Start inspection only when
  covering (D-088), but can always mark Urgent and Void.

## 7. Open questions for Dylan (answer before the build)

1. **Code prefix.** Keep `B-261116-2` (the defense plan), or use another prefix so it can't be
   mistaken for an old `B-` roll code (e.g. `BT-261116-2`)? Recommendation: keep `B-`; the old
   roll codes are history only and have a 4-digit year and 4-digit number.
2. **Stored lifecycle vs stored "Waiting"** (§3.1): OK to store only Open / Inspecting /
   Inspected / Void and work the rest out from the clock? Recommendation: yes (demo clock).
3. **No VOID rows for old slots** (§3.1): OK? Recommendation: yes.
4. **Correcting a late-inspected batch:** correct it on the day it was inspected (proposed), or
   keep "same day as the batch" until Phase 35? Recommendation: the inspection day.
5. A-81 to A-84 above: OK as assumptions to tell CPoint?

**Answers (Dylan, 2026-11-19):** Q3: old data is updated to match, so every old batch gets a code
(§3.1); the never-inspected ones are closed as "from before the queue" instead of filling the
queue (confirmed 2026-11-19). Q4: yes. Q5: yes. Q2: yes (store the lifecycle only). Q1: keep
`B-` for batches and **update the old roll codes to match** (Dylan, 2026-11-19), so no roll
starts with `B-` any more:

- The migration's follow-up step renames every roll whose code isn't `LR-…` (the old `B-YYYY-NNNN`
  and `R-YYYY-NNNN` rolls) to the current format `LR-<supplier code>-NNN`, numbered after that
  supplier's highest roll. A roll with no supplier gets `LR-OLD-NNN` (ASSUMPTION A-85).
- New field `Roll.formerCode String? @unique` keeps the old code; Find roll and the roll page
  accept it ("Formerly B-2026-0003"). The audit log records each rename (`roll.recode`).
- Checked 2026-11-19: the laptop's database has 430 rolls, all `LR-`, and the demo seed makes
  only `LR-` rolls, so this is a no-op there; it matters only for an older database (the PC or a
  groupmate's copy).
- Files added to §4: `prisma/schema.prisma` (Roll.formerCode), `src/lib/roll-rules.ts`,
  `roll.model.ts`, `roll.service.ts` (Find by former code), the roll page, a unit test for the
  renaming, the schema comment on `Roll.code`.

## 8. Overlap with uncommitted Phase 32 and how the Phase 33 `git add` keeps it out

**2026-11-19: Phase 32 is merged (#54).** The laptop is on `feature/roll-locations` with only
STATUS, SESSION_LOG, ROADMAP (wrap-up edits), `docs/DEMO_SCRIPT.md` and this plan uncommitted.
The Phase 33 build starts on a new branch from the latest `main` (`git switch main`,
`git pull`), so the overlap below no longer risks mixing Phase 32 code in. The list stays as a
check for the shared docs.

Phase 32 was uncommitted in the same folder (`git status` on 2026-11-18). Files both phases touch:

- `prisma/schema.prisma` (Phase 32: StorageLocation, RollMove, Roll location fields)
- `prisma/migrations/`: Phase 32's `20261117090000_roll_locations/` is untracked; Phase 33 adds
  its own `<later timestamp>_inspection_queue/`. Its timestamp must be after Phase 32's.
- `src/server/services/demo-seed.service.ts`, `src/server/models/demo-reset.model.ts`,
  `scripts/demo-reset.ts`
- `src/server/policies/permissions.ts`, `tests/unit/permissions.test.ts`,
  `tests/unit/demo-seed.test.ts`, `tests/unit/validator-messages.test.ts`
- `docs/STATUS.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/SESSION_LOG.md`, `docs/API.md`,
  `DESIGN.md`, `CLAUDE.md` (if touched)
- Also uncommitted and not Phase 32: `docs/DEMO_SCRIPT.md` (Dylan keeps it out),
  `docs/prompts/plans/defense-revisions-plan.md` (expected to go in with Phase 32's commit).

**How the split stays clean:** the build starts **only after Phase 32 is committed** (and ideally
merged), on a new branch from the latest `main`. Then every shared file above holds only Phase 33's
hunks as uncommitted changes, and the Phase 33 `git add --pathspec-from-file` list names only the
files in §4 plus this plan, the handoff, the Codex prompt and the reports. `git add .` / `-A` is
never used, so `docs/DEMO_SCRIPT.md` and any other leftover work stay out. Before writing the git
commands, `git status` and `git diff --stat` are checked so no Phase 32 hunk is left in a shared
file. If Phase 32 is somehow still uncommitted when Phase 33 must start, stop and ask Dylan rather
than sharing files.

## 9. Exact next step once Phase 32 is committed

1. Dylan answers §7 (Q1 to Q5) in the Phase 33 thread and gives the go.
2. Claude, in `C:\dev\CPoint-PMS` on the laptop: confirm `git status` shows no Phase 32 files and
   `main` is current; create the branch only when Dylan says so, else work on the folder as is.
3. Build in this order: rules + unit tests → schema + migration `inspection_queue` (`npm run
db:migrate -- --name inspection_queue`, `npm run db:generate`) → models, services, controllers,
   routes → pages and dialogs → demo seed and reset → CI checks → `npm run check`.
4. Write `qa/handoffs/<date>-inspection-queue.md` and `qa/CODEX_PROMPT_PHASE_33.md`; Dylan runs
   `npm run db:deploy` and pastes the prompt into Codex.
5. Wrap-up docs and the vault (Daily note, phase summary "Defense revisions (32 to 36)").
