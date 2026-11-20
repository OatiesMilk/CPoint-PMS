# Plan: Phase 34, final-product defects, repairs and work in progress (the panel's revision 1)

**Status:** PLAN ONLY, waiting for Dylan's go. No code, no migration, no git.
**Written:** 2026-11-20, laptop `C:\dev\CPoint-PMS`, `main` at e22ebb9 (Phase 33 merged, #55).
**Parent plan:** [defense-revisions-plan.md](defense-revisions-plan.md) → "Phase 34" (this file
refines it against the code as it is now; where they differ, this file wins).
**Inputs read:** vault (CLAUDE, Rules, Home, commands note, Defense revisions note, today's Daily),
repo CLAUDE.md, STATUS, DECISIONS (D-129), ROADMAP, the parent plan (Phase 34, A-62 to A-76), the
Phase 33 run 6 report, and the code: `prisma/schema.prisma`, `production.service.ts`,
`batch-queue.service.ts`, `production-rules.ts`, `permissions.ts`, `navigation.ts`, `guard.ts`,
Batches (`finish-batch-dialog`, `queue-list`, `page`), the Capture page, the Plan dialog, Settings,
Reports → Operations, the demo seed and reset, `ci.yml`.

**Triage of the newest Codex report** (`qa/reports/2026-11-20-phase-33-run6.md`): PASS WITH ISSUES;
the only note is a 3 s title refresh after the demo clock returns to real time. Nothing unresolved,
nothing to fix before Phase 34. Highest numbers in use: **D-129**, **A-85**; the parent plan's
**A-62 to A-66 and A-72 to A-76 are still free** and are used here.

## 1. Goal

1. The QI says, for every failed pair, **what was wrong**, whether it is **Fixable or Not fixable**,
   and for a fixable one **which stage it goes back to**. A fixable pair goes back to that stage as
   a repair job and returns to the QI's queue to be inspected again.
2. A **Work in progress (WIP) board**: pairs at each stage now, from counts the constructors the
   Floor Manager (FM) assigned to that stage enter, plus pairs in repair there and what waits for
   inspection.
3. The return stage is **learned from the QI's findings**: after 5 findings of a defect type in the
   last 4 weeks the form suggests the usual answer (never forces it).
4. **"Upper making" becomes "Construction"** (Dylan, 2026-11-17).
5. Still **no per-person rankings, scores or figures anywhere** (D-008).

## 2. Scope and non-goals

In: final defect types (data, Admin), findings on Finish batch and its correction, repair jobs and
their life (At stage → Back for inspection → Done), repairs in the Inspection queue, stage
assignments in the Plan dialog, stage counts and "My stage", the WIP board, Operations report
sections, quota counting repaired pairs, rename, demo seed and reset, CI checks, docs.

Out (and why):

- Leather defects and the camera checkpoint: unchanged (A-66). Final defects are a **separate list**
  from the CV `DefectType`s (Dylan, 2026-11-17).
- Reports by period, sort, filter, print, and corrections to past days: Phase 35 (D-131). Phase 34
  only adds report sections that Phase 35 will then cover.
- Correcting a **repair's** inspection result: Phase 35 (A-94).
- Stage tracking per batch or per component, due times for repairs, notifications, per-person
  anything.
- No new containers, no new packages.

## 3. Design choices (the short version)

| Question                        | Choice                                                                                                                                                                                  | Why                                                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does the WIP board live?  | A third tab **Work in progress** on Batches (`/batches?tab=wip`), next to Queue and Today. The FM's home gets a small card linking to it.                                               | No new route, no nav change (the QI's nav is Batches only, D-100), and the page already has tabs from Phase 33. The parent plan's `/production/wip` would need a new nav item for the QI. (Question Q1.) |
| When is a repair "sent"?        | The moment the QI saves a **Fixable** finding: its repair job is created **At stage** with its code.                                                                                    | One step for the QI. The FM can still move it or mark it not fixable until the stage marks it Back (A-87, amends A-63).                                                                                  |
| How does a repair return?       | The stage's assigned constructor (or the FM) taps **Back for inspection**; it joins the **Queue** as its own row (`RP-261120-2-1`); the QI enters passed, scrapped, or sent back again. | Same queue as batches (Phase 33), nothing new for the QI to learn.                                                                                                                                       |
| Who counts a stage?             | An assigned constructor, on their phone, from **My stage** on the Capture page; the FM for any stage. One shared number per stage, latest wins.                                         | Dylan's decision, 2026-11-17 (A-72, A-73).                                                                                                                                                               |
| Suggestion                      | A hint under the line ("Usually fixable at Sole-ing, 14 of 17") with a **Use this** button; never pre-filled.                                                                           | The QI decides (A-63, A-76).                                                                                                                                                                             |
| Findings for a Not fixable pair | Defect type and note only, **no stage**. The "Where defects come from" table has a fifth column, "Scrapped (not fixable)".                                                              | A stage is "where it goes back to" (A-75); inventing a stage for scrapped pairs would be a guess.                                                                                                        |
| Quota                           | `passed = finished − failed + repaired pairs that passed that day` (A-64). `finished` is unchanged, so a repaired pair is never counted twice as finished.                              | C-41 stays "pairs that pass inspection".                                                                                                                                                                 |

## 4. Data model and migration

Migration `20261120120000_final_defects_and_repairs` (via `npm run db:migrate -- --name
final_defects_and_repairs`, then `db:generate`). **Additive only**: no column of an existing table
changes, no data is rewritten, nothing needs a backfill. Old failed pairs simply have no findings
(A-89).

Enums: `ProductionStage { PREPARATION CONSTRUCTION SOLE_ING FINISHING }`,
`Remedy { FIXABLE NOT_FIXABLE }`, `RepairStatus { AT_STAGE BACK_FOR_INSPECTION DONE CANCELLED }`.

| Table                 | Columns (all `@@map`ped snake_case tables)                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `final_defect_types`  | `id`, `key @unique`, `label`, `description?`, `isActive`, `sortOrder`, timestamps. Placeholders seeded (marked "to confirm with CPoint"): Lifted sole, Glue marks, Loose stitching, Scuffs, and **Other** (key `OTHER`, cannot be removed or switched off; its finding needs a note).                                                                                                                                                                             |
| `inspection_findings` | `id`, `checkInId`, `finalDefectTypeId`, `pairs`, `remedy`, `returnStage?` (required for FIXABLE, null for NOT_FIXABLE), `note?`, timestamps. Index on `checkInId`, `finalDefectTypeId`, `createdAt`.                                                                                                                                                                                                                                                              |
| `repair_jobs`         | `id`, `code @unique` (`RP-<yymmdd>-<batch no>-<seq>`, e.g. `RP-261120-2-1`; seq counts the batch's jobs, a re-sent job takes the next number), `findingId`, `parentId?` (the job it was sent back again from), `pairs`, `stage`, `status`, `sentAt`, `backAt?`, `backById?`, `inspectedAt?`, `inspectedById?`, `passedPairs?`, `scrappedPairs?`, `resentPairs?`, `changeReason?`, timestamps. Index on `status, stage`, `findingId`, `backById`, `inspectedById`. |
| `stage_assignments`   | `id`, `day @db.Date`, `stage`, `userId`, `assignedById`, `createdAt`. **`@@unique([day, userId])`**: a constructor is at one stage a day (A-86); moving them is reassigning.                                                                                                                                                                                                                                                                                      |
| `stage_counts`        | `id`, `day`, `stage`, `pairs`, `enteredById`, `enteredAt`, `batchId?` (the batch whose interval holds `enteredAt`, null outside the shift). **Append-only**; the latest row per day and stage is the current count (A-72).                                                                                                                                                                                                                                        |

User gets the inverse relations (back, inspected-by, assigned, assigned-by, counted-by).
Foreign keys follow the project's pattern (indexed, no cascade deletes of history). Demo reset adds
the four new transactional tables before `production_check_ins`; `final_defect_types` is reference
data and is kept, like the CV defect types.

## 5. Files to change, by layer

**Pure rules, `src/lib/repair-rules.ts` (new; unit-tested):** `STAGES` and `STAGE_LABEL`
(Preparation, **Construction**, Sole-ing, Finishing), `parseFindings(failedPairs, raw, types)`
(see §7 for the messages), `suggestFor(findings, now)` (≥5 findings of the type in the last 4 weeks;
most common remedy over all of them, most common stage over the fixable ones; a tie goes to the
earlier stage in line order), `repairCode`, `nextRepairState` (the allowed moves), `parseRepairResult`
(passed + scrapped + sent back again = the job's pairs), `repairedPassedByDay`, `prefillAssignments`,
`mayCountStage`, `countReminderDue`, `wipTotals`. `production-rules.ts`: `passed` takes
`repairedPassed`; queue ordering (`compareQueue`) takes repair rows (see §6).

**Model (`src/server/models`, the only Prisma imports):** new `repair.model.ts` (findings, jobs,
transitions with a `where status` guard like `updateBatch`, the 4-week suggestion query, report
aggregates), new `stage.model.ts` (assignments, counts, latest counts), `reference-data.model.ts`
(`ensureFinalDefectType`, list/create/update/delete), `production.model.ts` (insert/replace findings
with the check-in; `repairedPassed` per day), `demo-reset.model.ts` (counts and deletes).

**Service (`src/server/services`):** new `repair.service.ts` (back, change, inspect, board data,
repair rows for the queue), new `stage.service.ts` (assignments, counts, `myStage`, the WIP board),
`production.service.ts` (`saveCheckIn` and `correctCheckIn` take and write findings; `productionDays`
adds `repairedPassed`), `batch-queue.service.ts` (merges repair rows), `ops-report.service.ts`
(new sections), `settings.service.ts` (final defect types), `bootstrap.service.ts` (reference data),
`demo-seed.service.ts` and `demo-reset.service.ts` (§12).

**Controller and routes:** new `repair.controller.ts` and `stage.controller.ts`;
`production.controller.ts` passes findings through. Route handlers stay one-liners (§8).

**Validators:** new `repair.validator.ts` (finding lines, repair result, change) and
`stage.validator.ts` (assignment, count); `production.validator.ts` adds `findings` to the finish
and correction bodies; `settings.validator.ts` adds the final defect type.

**Pages and components:**

- `batches/finish-batch-dialog.tsx` (and its correction mode): the **What was wrong** section (§7).
  New `batches/findings-editor.tsx` holds it so both modes share it.
- `batches/page.tsx`: third tab **Work in progress** (read-only for the QI); `batches/queue-list.tsx`
  renders repair rows; new `batches/repair-inspect-dialog.tsx`, `batches/wip-board.tsx`,
  `batches/repair-actions.tsx` (Back, Move, Not fixable after all).
- `batches/plan/plan-calendar.tsx`: a **Who works where** section in the Plan dialog; the form is a
  new `batches/plan/stage-assignments.tsx` with its own Save.
- `camera/capture/page.tsx` and new `camera/capture/my-stage.tsx` (the card).
- `floor-manager/page.tsx`: a small WIP card (pairs per stage, repairs open, waiting for inspection).
- `admin/settings/page.tsx`: a **Final defect types** section using the existing
  `reference-manager.tsx`, beside "Defect types" (label them clearly: "Defect types (leather,
  checked by the camera)" and "Final defect types (finished shoes, found by the QI)").
- `reports/_components/operations-view.tsx` and `ops-sections.tsx` (§9).

**Navigation / guards:** `navigation.ts` unchanged (no new item, Q1). Every new page section calls
the existing `requirePermission`; the new permissions are in §8.

## 6. The repair life and the queue

States: `AT_STAGE` → (stage taps Back) → `BACK_FOR_INSPECTION` → (QI inspects) → `DONE`;
`AT_STAGE` → `CANCELLED` (FM: Not fixable after all, or a correction rebuilds the lines).

- **Back for inspection:** the constructor assigned to that stage today, or the FM. Sets `backAt`.
  Idempotent under a race (the `where status = AT_STAGE` guard; the loser gets "Already marked back
  by someone else").
- **FM change** (A-87): move an At-stage job to another stage, or mark it **Not fixable after all**
  (pairs become Scrapped, the finding's remedy becomes NOT_FIXABLE, job CANCELLED). A reason is
  required and goes in the audit. Not available once it is Back.
- **In the Queue:** a Back job is a row with its code, the batch it came from, defect, pairs, the
  stage it came back from and how long it has waited (`backAt`, A-65: no due time, so never Late).
  Ordering: Urgent batches first, then everything by the time it started waiting (a batch's end, a
  repair's `backAt`). Day, status and code filters apply (the day filter uses `backAt`'s day);
  repairs are not voidable and not markable Urgent. They are **not** in the tab title's due count
  (A-90).
- **Inspect repair** (QI, or FM when covering, via the same `assertMayEnter` as batches, A-82): the
  QI enters **passed**, **scrapped** and **sent back again** (stage per line); the three add up to
  the job's pairs. Sent back again creates a child job (new code, `parentId`, same defect, At
  stage, no limit, A-88). Passed pairs count on the day of inspection (A-64). Scrapped is final.

## 7. UI

Desktop first (D-034). The only phone surface touched is the Capture page's new card (Capture is
already a phone page, D-096, so **no new phone page**). Follow `DESIGN.md` and ui-craft: tokens only,
plain copy (memory: short and plain, queue copy changes until Codex finishes), inline messages that
name the field and the fix. Stage chips use one neutral style; no red or green ranking between
stages, no medals, no ordering by performance (stages always in line order).

**Finish batch, "What was wrong"** (shown when failed pairs > 0; one line per defect):
`[Defect ▾] [Pairs] ( Fixable | Not fixable ) [Goes back to ▾] [Note]` and **Add another defect**.
Live helper under the list: "3 of 5 failed pairs still need a reason." / "You listed 6 for 5 failed
pairs. Remove 1." Hint under a line when a suggestion exists, with **Use this**. Errors, all inline:

- "Choose the defect on line 2."
- "Enter how many pairs on line 2 (1 or more)."
- "Say whether line 2 can be fixed."
- "Choose the stage line 2 goes back to." (Fixable only)
- "Describe the defect on line 2." (Other only)
- "Lifted sole is listed twice. Combine them into one line." (one line per defect type and remedy)
- "The lines add up to 6 pairs, but 5 failed. Change the lines or the failed count."

The same editor is in **Correct** (reason required as now). Per A-93 a correction may change the
failed pairs or lines only on the inspection day and only while none of the batch's repairs has been
marked Back; the dialog says so when locked ("A repair from this batch is already back for
inspection, so its failed pairs can't change. You can still correct the other counts."). Allowed
corrections cancel the batch's At-stage jobs and remake them from the new lines (before and after
in the audit).

**Plan dialog, "Who works where":** four rows (Preparation, Construction, Sole-ing, Finishing), each a
checkbox list of the active constructors; a constructor ticked in one row is removed from the
other (shown as "At Sole-ing"); absent ones from that day's Attendance are flagged "Absent". Empty
day with a previous working day that has assignments: ticked from that day with the banner "Same as
Thu 19 Nov. Save to confirm." (a suggestion, nothing stored until saved, A-74). Editable for today
and future planned days, **even after the plan locks**; past days are read-only. Only on a Planned
day ("Plan the day first." otherwise). Own **Save stages** button.

**My stage (Capture page, top):** "Sole-ing · pairs here now" with a number field (`inputmode=numeric`,
large), **Save count**, "Last counted 14:05 for all of Sole-ing", repairs at this stage ("2 pairs
back for repair · Lifted sole · RP-261120-2-1 [Back for inspection]"), and a reminder when a batch has
ended since the last count ("B-261120-2 just ended. Update the count."). A constructor assigned
today but without camera access sees My stage in place of "Ask the System Admin for camera access".
Not assigned: "You aren't assigned to a stage today. Ask the Floor Manager." (Q2.)

**WIP board:** a card per stage in line order: pairs now and "as of 14:05" (earlier day: "Not counted
today"), "In repair here: 3 pairs" with the defect names, an **Update count** button for the FM, and a
quiet line "Assigned today: Ana, Ben" **below** the figures (names are never beside a number).
Preparation also shows rolls open and being scanned (existing counts). A strip links to the Queue:
"2 batches and 1 repair waiting for inspection". QI: same board, no buttons except none (read only).

**Operations report** (also §9). **Settings:** Final defect types (label, description, active,
order; Other locked).

## 8. Routes and permissions (`/api/v1`, one-liner handlers → controllers)

New permissions in `permissions.ts` (the matrix test in `tests/unit` is updated):

| Permission                      | Roles                            | Used for                                                                                           |
| ------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `stage:assign`                  | FLOOR_MANAGER                    | PUT assignments                                                                                    |
| `stage:count`                   | FLOOR_MANAGER, SHOE_CONSTRUCTOR  | save a count (service checks the constructor is assigned to that stage **today**: `mayCountStage`) |
| `stage:read`                    | FLOOR_MANAGER, QUALITY_INSPECTOR | the board                                                                                          |
| `repair:update`                 | FLOOR_MANAGER, SHOE_CONSTRUCTOR  | Back for inspection (constructor: assigned to the job's stage today)                               |
| `repair:manage`                 | FLOOR_MANAGER                    | Move, Not fixable after all                                                                        |
| `production:checkin` (existing) | QI, FM covering                  | findings on finish and correct, inspect repair                                                     |
| `settings:manage` (existing)    | SYSTEM_ADMIN                     | final defect types                                                                                 |

| Route                               | Method                   | Purpose                                                                                              |
| ----------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `/production/check-ins` and `/[id]` | POST, PATCH              | body gains `findings`                                                                                |
| `/production/defect-suggestions`    | GET                      | the suggestion per final defect type (QI, FM)                                                        |
| `/production/repairs/[id]`          | PATCH                    | discriminated body `{action: back}`, `{action: move, stage, reason}`, `{action: notFixable, reason}` |
| `/production/repairs/[id]/inspect`  | POST                     | `{passedPairs, scrappedPairs, resend: [{stage, pairs}]}`                                             |
| `/production/stages/[day]`          | GET, PUT                 | assignments for a day (with the prefill suggestion)                                                  |
| `/production/stage-counts`          | POST                     | `{stage, pairs}` for today                                                                           |
| `/production/wip`                   | GET                      | the board                                                                                            |
| `/final-defect-types` and `/[id]`   | GET, POST, PATCH, DELETE | Settings (same shape as the existing defect-type routes)                                             |

Pages: Batches (existing `production:read`), Capture (existing `requireRole("SHOE_CONSTRUCTOR")`,
My stage reads only the viewer's own stage), Settings (existing). `docs/API.md` gets every row.

## 9. Audit, transactions, reports

Every mutation runs in `runInTransaction` and calls `recordAudit` with the same `tx`:
`production.checkin` and `production.checkin.correct` gain the lines (and Before for corrections);
`repair.create` (one per job, in the check-in's transaction), `repair.back`, `repair.move`,
`repair.notFixable`, `repair.inspect` (passed, scrapped, resent, child codes), `stage.assign` (the
day's before and after, user ids), `stage.count` (who entered it: **audit only**),
`settings.finalDefectType.create/update/delete`. Stale and race handling follow Phase 33 (`where
status`/`updatedAt` guards, `Errors.stale` with a sentence naming who and when).

**Reports → Operations gets four sections** (Quality stays the leather/camera view; the parent plan
put these under Quality, but its source is the CV; deviation, Q-free):

1. **Final defects:** per type, pairs found, fixable share, scrapped; old failed pairs without reasons
   appear as "Reason not recorded" so the totals reconcile (A-89).
2. **Where defects come from:** type × stage (fixable findings by the stage they went back to) plus
   the "Scrapped (not fixable)" column, counts and shares.
3. **Repairs:** sent, back, passed, scrapped, sent again, average time from sent to inspected.
4. **Work in progress:** per stage the days counted, average, highest and latest pairs, a bar list
   of the average (the bottleneck view), and per day the last count at each stage. Stage totals only.

The per-day table's **Passed** includes repaired pairs (a note says how many); the operations CSV
gets a `repairedPassed` column. Phase 35 adds periods, sort, filter and print to all of it.

## 10. Rename impact ("Upper making" → "Construction")

- **Code:** none today (`rg` finds no "Upper making" in `src`); the enum label is the only place,
  `STAGE_LABEL`.
- **Live docs changed in Phase 34:** `README.md:4`, `CLAUDE.md:4`, `docs/USER_MANUAL.md:27`,
  `docs/prompts/system-rebuild.md:20` and `:179`. D-130 states the rename.
- **History kept as written:** `docs/DECISIONS.md` (old entries), `docs/client-survey.md` (the
  client's own words), `docs/prompts/production-progression.md`, the Phase 23 handoff and
  `qa/CODEX_PROMPT_PHASE_26.md`. Phase 36's sweep lists "Upper making" as allowed in these.
- Paper figures: Phase 36.

## 11. Decisions and assumptions to log

**D-130 (new, with Phase 34):** final defects and repairs (partly reverses D-094's "no repair" for
finished shoes only); stage assignments and counts; the WIP board; the rename; quota counts repaired
pairs on the day they pass. Supersedes the parent plan's `/production/wip` page and "Reports →
Quality" placement.

Assumptions (log in STATUS → Open questions as `ASSUMPTION (A-nn, D-130)`):

- **A-62, A-64, A-65, A-66, A-72 to A-76:** as in the parent plan.
- **A-63 (amended):** the QI decides Fixable and the stage; the FM may move a job or mark it not
  fixable until the stage marks it Back (replaces "until the repair is sent").
- **A-86:** a constructor is at one stage a day. Amended by Addendum 1 (capture constructors are fixed at Preparation).
- **A-87:** a Fixable finding creates its repair job immediately.
- **A-88:** a repair that fails again is scrapped or sent back again, with no limit.
- **A-89:** failed pairs from before Phase 34 have no reasons; shown as "Reason not recorded", not
  backfilled.
- **A-90:** repairs waiting count in the Queue, not in the tab title's due count.
- **A-91:** a stage count from an earlier day shows "Not counted today"; a stage with nobody
  assigned is counted by the FM only.
- **A-93:** failed pairs and lines can be corrected on the inspection day, until a repair of that
  batch is Back for inspection.
- **A-94:** a repair's inspection can't be corrected until Phase 35.

## 12. Demo seed, reset and CI

- **Reference data:** the five final defect types (`bootstrap.service.ts`).
- **Seed** (`demo-seed.service.ts`, today's `saveCheckIn` call at about line 837): each failed batch
  gets findings by a fixed rotation, not chance, so the runs are reproducible: ≥5 Lifted sole (mostly
  Fixable → Sole-ing) and ≥5 Glue marks (Fixable → Finishing) inside 4 weeks so the **suggestion
  shows**, plus Scuffs (Not fixable) and one Loose stitching (Fixable → Construction). Then repairs
  at every state: two At stage (Sole-ing, Construction), one Back for inspection (in the Queue), two
  Done on earlier days (passed, one scrapped, one sent back again), so the reports have data.
  Stage assignments for the last working days and today (the demo constructors spread over the four
  stages, none twice a day) and a few stage counts per day, so the board and the prefill show.
- **Reset:** the four new tables are removed in the right order; `demo:reset` stays 2 to 3 minutes.
- **CI `docker` job** (`.github/workflows/ci.yml`; Claude tries to write it, otherwise the exact edit
  goes to Dylan): five or more final defect types incl. `OTHER`; every check-in with failed pairs
  has findings summing to exactly `failedPairs`; every FIXABLE finding has a `returnStage` and root
  repair jobs summing to its pairs; NOT_FIXABLE findings have none; at least one job each in At
  stage, Back for inspection and Done; a Done job's passed + scrapped + resent equals its pairs; every
  assignee is an active Shoe Constructor and no one is assigned twice a day; the `ProductionStage`
  enum has `CONSTRUCTION`.

## 13. Tests

**Unit (Claude runs `npm run check`):** `repair-rules` (findings: sum and gap messages per field,
Other needs a note, Fixable needs a stage, Not fixable has none, duplicate lines; suggestion: 4
findings none, 5 shows, the 4-week edge, tie, remedy vs stage; codes and resend numbering; repair
transitions; result sums; passed by day with a repair passing on a later day; prefill skipping
Non-working and holidays and dropping inactive users; `mayCountStage` for assigned, other
constructor, FM, QI; reminder due; WIP totals), the validators, the permission matrix, navigation
unchanged, and a type-level check that the board's view model has no per-person figure.

**E2E (written by Claude, run by Codex only):**

- `tests/e2e/final-defects.spec.ts`: QI finishes a batch with failed pairs split into two lines (one
  Fixable, one Not fixable); the gap message, the Other note; the repair appears At stage on the
  board; the FM moves it and marks one not fixable; the stage marks Back; it shows in the Queue under
  its code; the QI inspects it (passed, scrapped, sent back again); Today's passed count moves; the
  suggestion appears after the 5th finding and can be ignored; Settings → Final defect types; no
  names beside any figure; axe on the new dialogs.
- `tests/e2e/stage-wip.spec.ts`: FM assigns stages in Plan (prefill banner, save, past day
  read-only); an assigned constructor enters a count at a phone viewport; an unassigned one can't (UI
  message and a 403 from the API); a constructor without camera access still gets My stage; the FM
  covers an empty stage; the board and Operations' WIP section agree; QI sees the board read-only.
- Both specs serial, clean up **only their own rows** (marker notes, their own codes and a fixed
  day), never other specs' check-ins (the Phase 33 run 4 clash), and use `--workers=2`.

## 14. Docs and QA files to write

`docs/API.md` (routes above, changed check-in and correction bodies), `README.md` (features, the
demo script by role, rename), `docs/USER_MANUAL.md` (QI: reasons and repairs; FM: stages, board,
Settings; constructor: My stage), `CLAUDE.md` (rename; Capture's My stage in the phone list),
`docs/prompts/system-rebuild.md` (data model, domain rules, rename), `DESIGN.md` only if a new
pattern is added (the Fixable/Not fixable segmented control). Wrap-up: `docs/STATUS.md`,
`docs/SESSION_LOG.md`, `docs/DECISIONS.md` (D-130), `docs/ROADMAP.md`, and the vault (Daily, the
Defense revisions summary, an Inbox note for the CPoint questions below).

**QA handoff:** `qa/handoffs/2026-11-20-phase-34-defects-and-repairs.md` (from the template; scenarios
for each role, the migration, the demo reset). **Codex prompt:** `qa/CODEX_PROMPT_PHASE_34.md`. It
must say: stop the Docker app first with **`docker compose stop app`** (it holds port 3000), then
`npm run db:deploy`, `npm run dev`, back up before `demo:reset -- --yes`, run the e2e suite with
`--workers=2`, write the report in `qa/reports` even on a full pass, and **change no code**.

## 15. Build order (one session, Sonnet coding thread)

1. Schema, migration, `repair-rules.ts` with its unit tests.
2. Models, services, validators, controllers, routes; permissions and tests.
3. Finish batch findings and correction; passed counting; suggestions.
4. Repairs: board actions, queue rows, Inspect repair.
5. Stage assignments (Plan dialog), counts, My stage, the WIP board, FM card.
6. Reports sections and CSV column; Settings section.
7. Seed, reset, CI SQL, e2e specs, docs, rename, handoff and prompt.
8. `npm run check`, then wrap-up docs and vault.

## 16. Git (after a full Codex pass, Dylan runs it)

New branch from the latest `main` (e.g. `feature/defects-and-repairs`), `git add` only this phase's
files from a list file (`qa/phase-34-files.txt`, `--pathspec-from-file`). **Must include the
uncommitted Phase 33 merge notes** already in `docs/STATUS.md`, `docs/ROADMAP.md` and
`docs/SESSION_LOG.md` (about 10 lines; those three files are in the commit anyway). **Leave out on
purpose:** `docs/DEMO_SCRIPT.md` (Dylan's, stays uncommitted). If `ci.yml` could not be written, the
exact edit goes in the same message. No branch, commit or push before Dylan's go.

## 17. Questions for Dylan (each has a recommendation; the build waits for your answers and go)

1. **Where does the WIP board live?** Recommended: a third tab on Batches (no new nav item).
   Alternative: its own `/production/wip` page with a nav item for the FM and QI.
2. **A constructor assigned to a stage but without camera access:** recommended: they still get
   **My stage** on their Capture page. Alternative: only constructors the Admin allows to capture.
3. **One stage per constructor per day (A-86):** recommended yes (moving someone = reassigning).
   Alternative: allow a constructor in several stages, each with the shared count.
4. **A repair that fails again (A-88):** recommended: the QI may scrap it or send it back again,
   no limit. Alternative: send back once, then scrap.

Not blocking: CPoint's real list of final defects (the five are placeholders), and their rule for
repairs that keep failing. Both go in an Inbox note as `#question`.

---

## Addendum 1: capture constructors are stationed at Preparation

Dylan's rule (2026-11-20): shoe constructors the Admin has given Capture access are stationed at
**Preparation**, because capture happens only there. They are assumed to be at Preparation every
working day and cannot be selected for any other stage.

1. **"Has Capture access"** = `User.canCapture` (`prisma/schema.prisma`, set by the Admin through
   `camera.service.ts`). Nothing new is stored.
2. **Behaviour.** In the Plan dialog's **Who works where** (`batches/plan/stage-assignments.tsx`):
   - Capture-access constructors appear automatically under Preparation, locked, with the note
     "Has Capture access". They are not offered in the Construction, Sole-ing or Finishing pickers.
   - Constructors without the flag stay selectable for any stage, Preparation included.
   - Derived at read time from the flag, **not** stored as `stage_assignments` rows. A flag change
     applies at once, and `prefillAssignments` (previous-day prefill) skips them.
   - **Assigned today** line and WIP board: the derived people are added to Preparation's names
     and count of people. **My stage** (`camera/capture/my-stage.tsx`): they see Preparation, and
     count entry follows the plan's rule for Preparation (`mayCountStage`).
   - Q2 of §17 is unchanged for constructors without camera access (a stage assignment still gives
     them My stage); for capture constructors My stage is always Preparation.
3. **Server.** `stage.service.ts` rejects a capture-access constructor assigned to any stage but
   Preparation (model lookup in `stage.model.ts`; validator in `stage.validator.ts`). Inline
   message, for example: "Sam is a shoe constructor with Capture access, so Sam works at
   Preparation. Choose Preparation, or ask the Admin to remove Capture access first." A user can
   enter stage counts only for their own stage.
4. **Plan impact.** Amends A-86 (one stage per day stays; a capture constructor's stage is fixed)
   and §17 question 2 as above. §4 data model is unchanged (no migration).
5. **Files by layer.**
   - Model: `stage.model.ts` (`listCaptureConstructors`).
   - Rules: `repair-rules.ts` (`prefillAssignments` skip; a helper that merges derived people).
   - Service: `stage.service.ts` (derived lookup, rejection, `myStage`, WIP board, Assigned today).
   - Controller and validator: `stage.controller.ts`, `stage.validator.ts` (error text).
   - UI: `stage-assignments.tsx` (locked rows, pickers filtered), `my-stage.tsx`, `wip-board.tsx`.
   - Unit tests: service rule (rejects non-Preparation, accepts Preparation), derived lookup (flag
     on/off applies at once), prefill skip. E2E spec additions in `tests/e2e/stage-wip.spec.ts`
     (written, not run): locked row shown, not offered elsewhere, My stage shows Preparation.
   - Docs: `USER_MANUAL.md` (Plan dialog and Capture sections), `README.md` demo script.
   - Demo seed (`demo-seed.service.ts`, `tests/unit/demo-seed.test.ts`): the demo constructor with
     capture access must land at Preparation; add a check.
6. **Assumptions to log** (A-92 stays unused):
   - **A-95:** capture-access constructors are always at Preparation. The FM cannot move one on a
     short-staffed day; to move one, the Admin first removes their Capture access.
   - **A-96:** constructors without Capture access may still be assigned to any stage, Preparation
     included.
   - **Open point for CPoint:** no confirmation yet of the one-station-per-person rule (Inbox
     `#question`).
7. **Guardrail.** Phase 34 adds no per-person ranking or score. Names appear only in the
   **Assigned today** line.

---

## Fix list after Codex run 1

Source: `qa/reports/2026-11-20-phase-34-run1.md` (PASS WITH ISSUES; 41 of 47 passed, 2 failed, 4
blocked). Codex ran code from before Addendum 1; each finding is checked below against the working
tree of 2026-11-20 19:35 (+08), where the coding thread had already changed the tests and one
component. Nothing here edits code; the coding thread applies it.

### Verdict per finding

| Finding                                              | Verdict                                                              | Evidence (current code)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1.1 batches.spec finish dialog stayed open          | **Fixed** (test fault: failed pairs with no reason, Phase 34's rule) | The dialog keeps itself open on `validate()` errors, `finish-batch-dialog.tsx:144-148`. The spec now fills line 1 (Scuffs, Not fixable): `tests/e2e/batches.spec.ts:423-430`.                                                                                                                                                                                                                                                                                                                |
| E1.3 inspection-queue.spec finish dialog stayed open | **Fixed** (same cause)                                               | `tests/e2e/inspection-queue.spec.ts:229-236`. No other e2e posts failed pairs without a line (rg over `tests/e2e`).                                                                                                                                                                                                                                                                                                                                                                          |
| E1.2 Fixable radio click blocked                     | **Fixed** in the app, unverified                                     | Run 1's DOM had `class="sr-only"` on the input (e1-targeted.log:35); the input now is `absolute inset-0 size-full opacity-0` over its label: `findings-editor.tsx:200`. Manual F4 passed because a real click lands on the label.                                                                                                                                                                                                                                                            |
| E1.4 production CSV header                           | **Fixed** (test fault + column rename)                               | Header is `Passed after repair`, `production.service.ts:1324`; `reports.spec.ts:208` expects the same contiguous run. Run 1 saw `Of these, passed after repair`, which the source no longer has.                                                                                                                                                                                                                                                                                             |
| E1.5 QI board matched the global Change time         | **Fixed** (test fault)                                               | Assertion scoped to `wip-board`, `stage-wip.spec.ts:267-270`.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| C6 demo clock didn't move                            | **No fault found** (unproven)                                        | `demo-clock-control.tsx`, `clock.ts`, `demo-clock.service.ts`, `demo.controller.ts:64-71` are unchanged by Phase 34 (not in `git status`), and D-125 run 2 plus Phase 33 run 6 moved the clock with the same form. Codex's log shows the form closing without error and the header ticking on from real time, which is what a submit of the form's own prefilled time (`startChange`, line 80-86) does when typing into the date and time fields didn't update React state. Retry per below. |
| R7 after-midnight part                               | **Blocked by C6**, no fault                                          | Quota 170 → 171 and the "repaired first" line passed. Rerun after C6.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| C3 assigned, camera off                              | **Environment**, covered by e2e                                      | A Users-created account needs a first-login password change; the 12 roster constructors never sign in (`bootstrap.service.ts:124-126`). Covered and passing: `stage-wip.spec.ts:171-204`.                                                                                                                                                                                                                                                                                                    |
| C4 unassigned, camera off                            | **Environment**, covered by e2e                                      | Camera-on branch passed by hand; camera-off is `stage-wip.spec.ts:206-220` (passed in run 1).                                                                                                                                                                                                                                                                                                                                                                                                |
| A3 wrong-stage count as a Sole-ing constructor       | **Environment + Addendum 1**, covered by e2e                         | Noel can no longer be put at Sole-ing (A-95; 422 as seen); Analyn is a roster constructor with no usable password, so her sign-in failure is expected. The Finishing 403 for a Sole-ing constructor is `stage-wip.spec.ts:199-203` (passed).                                                                                                                                                                                                                                                 |

All five e2e failures are therefore closed in the tree, but "6 did not run" in the targeted run and
"10 did not run" in the full run never executed (the two Phase 34 specs are serial). Those tests are
unverified until run 2.

### Still applies

**F1. Error summary links to the wrong id (found in triage, not in the report).**
`finish-batch-dialog.tsx:193` reads `/^findings.(d+).(w+)$/`: the backslashes are missing, so
`findings.0.finalDefectTypeId` never matches and the summary link (shown from 3 errors up) goes to
`#findings.0.finalDefectTypeId`, which isn't an id. Low severity: the messages under the fields are
right and focus still reaches the first `aria-invalid` field.

- **Rules (`src/lib/repair-rules.ts`):** add a pure `summaryFieldId(key)`: `findings.<i>.<field>` →
  `finding-<i>-<field>` (same shape as `findingFieldId`, `findings-editor.tsx:58`); `findings` →
  `findings-error`; anything else → `null`.
- **UI (`finish-batch-dialog.tsx`):** the `summary` map calls it, then falls back to `FIELD_IDS[key] ??
key`. No `.exec` regex left in the component.
- **Unit test (`tests/unit/repair-rules.test.ts`):** the three cases above plus `pairs`, `reason`
  (`null`, so the dialog's own map applies).
- **E2E (write, don't run):** in `final-defects.spec.ts`'s first test, after the first Finish click
  with three or more errors, assert `getByTestId("form-error-summary").getByRole("link", { name:
"Describe the defect on line 3." })` has `href="#finding-2-note"`.

**F2. Fix the run 2 prompt's manual A3 line.** `qa/CODEX_PROMPT_PHASE_34_RUN2.md` step 3 says to use
"a demo constructor without Capture access from the Plan dialog's list" and the demo password. Those
twelve never sign in, which is what blocked run 1. Replace it with: report A3's wrong-stage 403 from
`stage-wip.spec.ts:171-204`; no manual A3. Same note in the handoff's A3, C3 and C4 rows
(`qa/handoffs/2026-11-20-phase-34-defects-and-repairs.md:160,161,175`). No code.

**F3. C6 retry needs a fallback so the clock is tested even if typing in the date and time fields
doesn't register.** In the run 2 prompt's C6 note add: before pressing Set clock, read the two fields
back (screenshot) and confirm they show 17:05; if they don't take typed values, send the same request
from the page (`fetch("/api/v1/demo/clock", { method: "POST", headers: {"Content-Type":
"application/json"}, body: JSON.stringify({ date: "2026-11-20", time: "17:05" }) })`), reload, read
the band, and say the form route was not verified. The server route is the same either way. If the
band still doesn't move after the API call, that is a real fault: attach the response and
`GET`-side evidence and send it back. No code change now.

### New assumptions

None. Next free number is A-97. (The CSV column rename to `Passed after repair` is wording, not a
rule.)

### Scenarios Codex run 2 should run

- **From the handoff:** P1 to P8 (P6 to P8 are Addendum 1: locked Preparation row with "Has Capture
  access", not offered at other stages, 422 with the exact message), C1 to C7 (C7 is Addendum 1's My
  stage = Preparation), A1, A2, A4 to A7, **R7 including after midnight**, **C6**.
- **Reported from e2e, not by hand:** C3, C4 camera-off, A3 (`stage-wip.spec.ts:171-220`).
- **E2E:** the five touched specs (`final-defects`, `stage-wip`, `batches`, `inspection-queue`,
  `reports`) with `--workers=2`, then the full suite with `--workers=2`. Report which tests of the
  serial specs did not run, if any. `stage-wip.spec.ts:287` (Addendum 1) and the new F1 assertion are
  new; the radio fix is only proved by `final-defects.spec.ts:172` and by the `.check()` calls in
  `batches.spec.ts` and `inspection-queue.spec.ts`.
- **Not rerun:** M1 to M3, F1 to F10, R1 to R6, R8, W1 to W5, S1, D1, A5 (all passed in run 1 on
  unchanged code; D1 only if the seed changed for Addendum 1: it did, so rerun D1 after the last
  `demo:reset`).

### Questions for Dylan

None blocking. Still open for CPoint: is a capture constructor really at Preparation all day, one
station per person (A-96)?

---

## Fix list after Codex run 2

Source: `qa/reports/2026-11-20-phase-34-run2.md` (FAIL; 20 of 24 scenarios passed, 2 failed, 2
blocked; targeted E1 20 passed, 4 failed, 3 did not run; full E1 107 passed, 4 failed, 2 skipped, 6
did not run). Every finding is checked against the working tree of 2026-11-20 20:30 (+08). Nothing
here edits code; the coding thread applies it. The four E1 failures are test faults; C2 is a small
real gap; C6 is not a Phase 34 fault.

### Verdict per finding

| Finding                                            | Verdict                                 | Evidence (current code)                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1.1 Lifted sole row shows 18, not 2               | **Test fault**                          | The report asks `from=MAIN&to=${manilaDay()}` (`final-defects.spec.ts:446`, also `:535`). `MAIN` is a Saturday (`:36`) but the range runs to today, and the seed writes findings on every working day (`demo-seed.service.ts:962-995`, weekdays only). `toContainText("2")` is also loose (it matches "12", "20").                                  |
| E1.2 `batches.spec` clean-up FK error              | **Test fault**                          | `afterAll` deletes this run's check-ins of today (`batches.spec.ts:124-127`) but the finish dialog now saves a finding line (`:423-430`), and `inspection_findings.checkInId` and `repair_jobs.findingId` are `ON DELETE RESTRICT` (`migration.sql:133`, `:139`). Codex's "line 615" is only the last test; the error is the `afterAll` hook.       |
| E1.3 `inspection-queue.spec` clean-up FK error     | **Test fault**                          | `cleanUp` deletes check-ins of the two weekend days with no children (`inspection-queue.spec.ts:52-56`); the test finishing Sunday saves a finding (`:229-236`). `cleanUp` is also the `beforeAll` (`:91`), so one failed run poisons the next: that is the full run's "queue-list setup" failure and the three serial tests that did not run.      |
| E1.4 `.nth(1)` is a disabled checkbox              | **Test fault**                          | The Preparation group lists every active Capture constructor first, locked (`stage-assignments.tsx:155-171`), and the e2e suites never delete the Capture constructors they create (`cv-helpers.ts:275-289`), so the second `E2E Constructor` match (`stage-wip.spec.ts:308`) is another locked one. Manual P6/P8 confirm the app is right.         |
| A3 gap (constructor on repair PATCH and WIP GET)   | **Confirmed gap**                       | No spec calls `PATCH /production/repairs/{id}` or `GET /production/wip` as a constructor (rg over `tests/e2e`). Code: `stage:read` has no constructor (`permissions.ts:56`); `repair:manage` is Floor Manager only (`:58`); the controller checks `repair:update`, then the id, then the body, then `repair:manage` (`repair.controller.ts:30-37`). |
| C2 `x` shows no message                            | **Real gap, small** (see C2 below)      | `stage-count-form.tsx:36-47`: the only check is the server action, so the message needs a round trip and a click; `parseCount` also accepts `1e3` and `0x10` (`Number(text)`, `stage.service.ts:173-175`). The same message passed in `stage-wip.spec.ts:182-186` (C3, both runs).                                                                  |
| C6 demo clock form didn't move the band            | **Not a Phase 34 fault** (see C6 below) | `demo-clock-control.tsx` is unchanged by Phase 34 (not in `git status`); the API path moved the clock and the reminder appeared.                                                                                                                                                                                                                    |
| R7, P1 to P8, C1, C3 to C5, C7, A1, A4, A6, A7, D1 | **Pass**, no action                     | Report table.                                                                                                                                                                                                                                                                                                                                       |

### Fixes, by file

**F1. Delete the children first in the clean-ups (E1.2, E1.3).** Decision: **fix the test helper and
keep the schema's `RESTRICT`.** The app never deletes a check-in: a correction removes that
check-in's repairs and findings first (`repair.model.ts:105-113`), a void only sets the batch's
status, and `demo:reset` deletes repairs, findings, then check-ins (`demo-reset.model.ts:118-123`).
`CASCADE` would let one delete silently drop repair history. Audit rows hold no foreign key to
either table, so none need deleting.

- New `tests/e2e/db-cleanup.ts`: `removeCheckIns(db: { query }, where: string, params: unknown[])`
  runs three statements, each using `SELECT id FROM production_check_ins WHERE ${where}`:
  `DELETE FROM repair_jobs WHERE "findingId" IN (SELECT id FROM inspection_findings WHERE
"checkInId" IN (…))`, then `DELETE FROM inspection_findings WHERE "checkInId" IN (…)`, then
  `DELETE FROM production_check_ins WHERE ${where}`. (`repair_jobs.parentId` is `SET NULL`, so
  one statement is enough.)
- `batches.spec.ts:124-127`: `removeCheckIns(db, '"enteredAt" >= $1 AND day = $2::date', [STARTED, today])`.
  Keep this scope. (Corrects the coordinator note: it already deletes only this run's check-ins of
  today since Phase 33 run 4, not every check-in of today.)
- `inspection-queue.spec.ts:53`: `removeCheckIns(db, 'day = ANY($1::date[])', [DAYS])`.
- `final-defects.spec.ts:57-68` already deletes in the right order; leave it.
- Unit test: none (test-only helper). E2E: the two specs themselves, plus the check below.
- **Run 3 evidence:** after the targeted run (before the full suite), Codex reports the result of
  `SELECT count(*) FROM production_check_ins WHERE day = ANY(ARRAY[<the two weekend days of
inspection-queue.spec, the three days of final-defects.spec>]::date[])`, expected 0 (the specs
  remove their own rows), and of `SELECT count(*) FROM inspection_findings WHERE "checkInId" NOT IN
(SELECT id FROM production_check_ins)`, which is 0 by the foreign key and shows the clean-up ran.

**F2. A seed-free report range (E1.1).** `final-defects.spec.ts:446` → `from=${MAIN}&to=${MAIN}`.
The seed never writes a weekend, and `SEEDED` (the Sunday) falls outside `to=MAIN`, so the range holds
only the spec's own check-in. Do the same at `:535` (the JSON range). Tighten the assertions:
`defects.getByRole("row", { name: "Lifted sole" }).getByRole("cell").nth(1)` `toHaveText("2")`; Glue
marks `"2"`; Loose stitching (after the correction test it is 1 pair at Construction) `"1"`; the origins
row for Loose stitching has the Construction cell `toContainText("1")`. Also assert `Reason not
recorded` is absent. No before/after deltas needed.

**F3. Name the constructor, not a position (E1.4).** `stage-wip.spec.ts:308`: read the name of
`loose` the way `:290-294` reads `capName` (`SELECT name FROM users WHERE id = $1`), then
`const looseBox = preparation.getByLabel(looseName)`; `await expect(looseBox).toBeEnabled()` and
`await expect(looseBox).not.toBeChecked()` (test 1 saved `loose` at Sole-ing on `NEXT`). The name
(`E2E Constructor <8 hex>`) is unique, so a substring match is safe.

**F4. A3 gap: a route matrix for constructors (new e2e test, written, not run).** Add one test to
`final-defects.spec.ts` right after the Floor Manager's repair test (it needs the open jobs; `-3`,
Loose stitching at Construction, is still At stage then) and before the A-93 test. Extend `cleanUp`
for the people it creates (same pattern as `stage-wip.spec.ts:70-84`: delete today's assignments of
their ids, then delete the users, else set `isActive = false`; guard when the ids don't exist yet).
Setup: `makeConstructor({ canCapture: false })` twice (`cv-helpers.ts:275`), A assigned to Sole-ing
today and B to Construction today, with `INSERT INTO stage_assignments` as `stage-wip.spec.ts:102-106`.
Send **valid bodies**: the controller parses the body before it checks `repair:manage`, so an invalid
body gives 422 before 403. Expected statuses:

| Actor                  | Call                                                                              | Status                                                         |
| ---------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| A (Sole-ing)           | `GET /production/wip`                                                             | 403                                                            |
| A                      | `PATCH /production/repairs/{-3}` `{action:"back"}`                                | 403, message names Construction (`repair.service.ts:253-255`)  |
| A                      | `PATCH` `{action:"move", stage:"FINISHING", reason:"Needs gluing first"}`         | 403                                                            |
| A                      | `PATCH` `{action:"notFixable", reason:"Cannot be saved"}`                         | 403                                                            |
| A                      | `POST /production/repairs/{-3}/inspect` (any body; the permission check is first) | 403                                                            |
| A                      | `GET /production/defect-suggestions`, `PUT /production/stages/{NEXT-day}`         | 403, 403                                                       |
| B (Construction)       | `PATCH` `{action:"move", …}`                                                      | 403 (`repair:manage`)                                          |
| Quality Inspector      | `GET /production/wip` / `PATCH {action:"back"}`                                   | 200 / 403                                                      |
| System Admin           | `GET /production/wip`                                                             | 403                                                            |
| Floor Manager          | `GET /production/wip`                                                             | 200                                                            |
| B (Construction), last | `PATCH {action:"back"}`                                                           | 200; a second `back` gives 409 ("already back for inspection") |

B's `back` goes last: it moves `-3` to the Queue, which later tests don't depend on (they use `-1`;
the reports test still sees a repair "Sent"). With this test A3 is verified by a spec, not only by
reading the permission matrix.

**F5. C2: check the count before the round trip, and accept digits only.**
Decision: **a fault per DESIGN.md/ui-craft** (inline message naming the field and the fix, shown
where the error is made), though a small one. The input is already a text field with
`inputmode="numeric"` (`stage-count-form.tsx:65`), so "x" is not dropped; the message appears only
after a click and a server round trip, and Save is disabled while that round trip is pending
(`:79`). A slow or stalled dev-server call looks exactly like Codex's "Save disabled, no message".
The run 2 e2e passed because Playwright clicks Save and waits.

- **Rules (`src/lib/repair-rules.ts`, next to `STAGE_COUNT_MAX` at `:524`):** add pure
  `parseStageCount(raw: unknown)` → `{ ok: true, pairs } | { ok: false, message }`, moved from
  `parseCount` (`stage.service.ts:170-185`). A string must match `/^\d+$/` after `trim()` (so `1e3`,
  `0x10`, `1.5`, `-1` and empty are refused); a number must be a whole number ≥ 0. Messages unchanged:
  "Enter the pairs here now as a whole number, like 12. Enter 0 if none." and "That is more than
  50,000 pairs. Check the number."
- **Service (`stage.service.ts`):** `parseCount` becomes a one-line re-export of `parseStageCount`, so
  `tests/unit/stage.service.test.ts:86-95` keeps passing.
- **UI (`stage-count-form.tsx`):** `submit()` runs `parseStageCount(value)` first; on failure it sets
  the error, moves focus to the input and does not call the action. `onBlur` runs it too when the
  field is not empty (a non-empty invalid entry shows the message as the person leaves the field; an
  empty untouched field says nothing until Save). Save stays enabled except while saving. The server
  action keeps validating (same text).
- **Unit tests (`tests/unit/repair-rules.test.ts`):** accepted `"12"`, `" 12 "`, `"0"`, `12`;
  refused `"x"`, `""`, `"  "`, `"-1"`, `"1.5"`, `"1e3"`, `"0x10"`, `1.5`, `-1`, `null`; over the max
  `"50001"`; message text exact.
- **E2E (written, not run), `stage-wip.spec.ts:182-186`:** after `input.fill("x")` and
  `input.blur()` the message is visible **before** Save is clicked and `Save count` is enabled; then
  clicking Save keeps the message and shows no "counted" toast; `fill("")` then Save shows the same
  message; `fill("1e3")` shows it too; `fill("14")` clears it and saves as before.

**F6. Docs and prompt.** Write `qa/CODEX_PROMPT_PHASE_34_RUN3.md` (below), add a line to the
handoff's A3 row that A3 is now verified by `final-defects.spec.ts` (F4), update STATUS, SESSION_LOG
and the vault (Daily line done by this thread; the phase summary note by the coding thread).

### C6: decision

**Out of scope for Phase 34. Not fixed now; a separate note, and a decisive check in run 3.**

- Code read (`demo-clock-control.tsx`, `git log` last touched in #48): the form's `date` and `time`
  are their own state (`:62-63`); a successful submit sets the view from the server's reply
  (`:110-113`), closes the form and refreshes. `router.refresh()` can't overwrite the form: the only
  state it touches is `view`/`now` (`:67-73`), and the form is already closed. So the "refresh
  overwrites the form" idea doesn't match the code.
- Codex's symptom (the form showed 17:05, the band didn't move, no error) fits **the typed value never
  reaching React's state**: the fields show the DOM value, `submit()` reads `date`/`time` state, which
  still hold the prefill from `startChange` (`:80-86`), so the clock is set to "now" and nothing visibly
  changes. A browser tool that sets `.value` without a real input event does exactly that; Phase 33
  run 6 moved the clock through the same form. No e2e covers the form, and one can't join the full
  suite (it moves a global clock under the other worker).
- A latent weakness, unrelated to the symptom: `setClockOffsetMs(initial.offsetMs)` runs on every
  render (`:56`), so after a successful change the next re-render resets the module's offset to the
  old prop until `router.refresh()` lands (`:115`); a slow refresh could let the 15 s tick (`:76`)
  slide the band back. Optional hardening later (call it in an effect keyed on `initial.offsetMs`);
  not part of this fix list.
- **Run 3 check (decisive):** before pressing Set clock, install `window.__b = []; const f =
window.fetch; window.fetch = (u, o) => { __b.push([String(u), o && o.body]); return f(u, o); }`,
  then press Set clock and read `window.__b`. If the body is `{"date":…,"time":"17:05"}` and the band
  doesn't move, that is a **real fault**: send it back with the body, the response and the band text.
  If the body holds the prefill, typing didn't reach the form's state (a tooling limit): retype with
  the keyboard (click the field, type `1705`), and say which method worked.

### New assumptions

None. The digits-only count is input validation, not a business rule. Next free number is A-97.

### Scenarios and specs for Codex run 3

**Setup (the prompt keeps this order):** `docker compose stop app` first; `npm run db:up`; `npm run
db:deploy`; a fresh `npm run dev` (stop the old one); **then `npm run demo:reset '--' --yes`** (run
2's failed clean-ups left findings and queue rows in the demo database); check the Real time clock.

**Manual:**

- **C2** at 390 × 844 as the Sole-ing/Preparation constructor: type `x`, tab away: the message shows
  with Save enabled; press Save: still shown, no count saved; clear the field and press Save: same
  message; type `1e3`: same message; type `14`: saves. Note if Save ever shows disabled, whether a
  toast appeared.
- **C6** with the fetch check above (Floor Manager, 17:05; then Back to real time).
- **A3** is reported from the new e2e test, not by hand.
- Not rerun (passed in run 2 on code that doesn't change): P1 to P8, C1, C3 to C5, C7, A1, A4, A6,
  A7, R7, D1 (the seed is unchanged). The batch-end reminder (C6's second half) only if the form route
  works; the API fallback already verified it.

**E1, in this order, with `--workers=2` each:**

1. Targeted: `npx playwright test tests/e2e/final-defects.spec.ts tests/e2e/stage-wip.spec.ts
tests/e2e/batches.spec.ts tests/e2e/inspection-queue.spec.ts tests/e2e/reports.spec.ts --workers=2`.
   Expect 28 tests (27 plus the A3 test), all passing. Report any that did not run and why.
2. Run the F1 evidence query; it must be 0.
3. The full suite: `npx playwright test --workers=2` (expect about 120, 2 skipped).
4. `npm run demo:reset '--' --yes` at the end, and Real time restored.

**Report:** `qa/reports/2026-11-20-phase-34-run3.md` (or the day's date and next run number), PASS /
PASS WITH ISSUES / FAIL, every scenario, the counts, each failure with steps, expected, actual and
evidence. Codex changes no code; a failure comes back to the planning thread.

### Questions for Dylan

None blocking. For information: C6 is treated as tooling until run 3's fetch check says otherwise; if
it turns out real, it becomes its own small fix outside Phase 34.

---

## Fix list after Codex run 3

Source: `qa/reports/2026-11-20-phase-34-run3.md` (FAIL; 5 of 8 scenarios passed, 2 failed, 1 blocked;
targeted E1 25 passed, 1 failed, 2 did not run; full E1 111 passed, 1 failed, 2 skipped, 6 did not
run). Every finding is checked against the working tree of 2026-11-20 21:50 (+08). Nothing here edits
code; the coding thread applies it. All three findings are **test or tooling faults**; no application
code needs to change. Run 3 passed C2, both clean-up queries (0 and 0) and the final reset, so the
run 2 fixes (F1 helper, F2 range, F3 name, F4 A3 matrix, F5 count check) are proved except where the
two failures below stopped the serial specs.

### Verdict per finding

| Finding                                                                 | Verdict                                                                                                               | Evidence (current code)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F2 `progress.passed` was 340, expected 352                              | **Test fault** (a whole-line total read while another worker writes it). The product rule is right.                   | The total is `max(0, finished − failed) + repairedPassed` over **all** of today's check-ins (`production.service.ts:646-651`, `production-rules.ts:584`). Run 3: before 351, after 340 = 351 − 12 + 1. The 12 match `batches.spec.ts`'s own pairs (9 passed from "11 pairs, 2 failed", `:488`, plus 3 at `:562`) deleted by its `afterAll` (`:126`) in the other worker between the two reads (an inference from the arithmetic; the report has no row-level evidence). `repairedPassed` rose by exactly 1 (assertion `:395` passed). Only `final-defects.spec.ts` ever inspects a repair (rg `repairs/` over `tests/e2e`), so `repairedPassed` is not shared. |
| F1 attendance save 409 (`batches.spec.ts:520`, from `:547`)             | **Test fault** (a roster read earlier and replayed after another spec removed people from it). Not an attendance bug. | See "F1 decision" below. `attendance.service.ts:155-160` and `:161-162,:192`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| B1 / C6 request capture blocked; `fill()` showed 17:05, band kept 09:13 | **Tooling artefact, no app fault. C6 closed as passed.**                                                              | See "B1 decision" below. `demo-clock-control.tsx:62-63,131,173,186`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| C2                                                                      | **Pass**, no action                                                                                                   | Report table.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| "6 did not run" after F2                                                | Follows from F2 (serial block); the six are A3, A-93, reports, suggestion, final defect types, no-names.              | `test.describe.configure({ mode: "serial" })`, `final-defects.spec.ts:19`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### F2 decision: what proves the quota rule

Rule (plan, A-64): _a repaired pair that passes counts on the day it passes_, once:
`passed = finished − failed + repairedPassed(day)`.

Assert only the repaired-pairs change? **Alone, not enough:** `repairedPassed + 1` proves the repair is
counted that day but not that it reaches `passed` (a regression that forgot to add it would still
pass). So split the proof into three parts, none of which reads a total another worker moves:

1. **E2E, `final-defects.spec.ts:394-396`.** Keep `repairedPassed` = before + 1 (line 395). Replace line
   396 with an identity inside the one `after` response, which no other worker can skew
   (`passed`, `finished`, `failed` and `repairedPassed` come from one function call):
   `const p = after.data.progress; expect(p.passed).toBe(Math.max(0, p.finished - p.failed) + p.repairedPassed);`.
   Add a comment saying why there is no `before.passed + 1`: other specs finish and delete batches today.
2. **Unit test, `tests/unit/production-rules.test.ts`** (inside "quotaProgress and the pace on passed
   pairs", `:282`; the 5-argument form is untested today): `quotaProgress(90, 6, 120, 1, 5)` gives
   `passed 89`, `repairedPassed 5`, `finished 90`, `failed 6`, `share ≈ 89/120`, pace "31 pairs more over
   1 batch to reach the quota."; and `quotaProgress(0, 0, 120, 1, 2)` gives `passed 2` (a repaired pair
   passing on a day with no batch finished still counts). `repairedPassedByDay` already has its day
   test (`repair-rules.test.ts:260-275`).
3. Day-boundary and "counts on the day it passes" are already unit-tested
   (`repair-rules.test.ts:260-275`, 01:00 Manila on the 20th). Nothing else needed. A private day or
   a delta in the same transaction window is not worth it: the identity above is exact.

**A3 stays where it is** (`final-defects.spec.ts:400`, after the Floor Manager test, before A-93). It
reads rows that test 1 makes (`-3` At stage at Construction), and its last step marks `-3` Back, which
removes `-3` from the Construction card that the Floor Manager test reads (`:306`), so it can neither
run before that test nor outside this file's serial block. With F2 fixed, nothing before it should
fail. If one does, Codex's report already names every test that did not run (as run 3 did).

### F1 decision: the attendance 409

What the 409 guards: `saveAttendanceDay` refuses a save in two ways. **CONFLICT** if the roster the
page sent names someone who isn't on the roster now (`attendance.service.ts:155-160`: "Someone in this
list isn't on the roster … Refresh the list."), and **STALE** if the day's `updatedAt` isn't the one
the caller read (`:161-162`, `:192`). Both are correct and meaningful: a Floor Manager's page that is
out of date must be told to refresh.

What the test sends: `batches.spec.ts:511-515` reads the roster and `updatedAt` once, at the start,
and replays that `before.roster` in every save (`:527`, `:548`) and in the restore (`:580`). The roster
holds the E2E constructors other specs make (`makeConstructor`, `cv-helpers.ts:275`; `stage-wip.spec.ts`;
the A3 test) and **those specs delete them**: `final-defects.spec.ts:81` (`afterAll` at `:182`) and
`stage-wip.spec.ts:80` (`afterAll` at `:116`). Deleting a user cascades its attendance marks
(`schema.prisma:664`), so a person who was in the roster at `:511` can be gone by the second save.
Run 3's log fits: the first PUT answered 200 in 1.9 s, the second 409 in 84 ms
(`dev-server.log:252,267`) while two other workers were finishing. The status is all the report
kept, so CONFLICT versus STALE is unproven; the cause and the fix are the same. (In the full suite
`attendance.spec.ts` also saves today's attendance, a second possible STALE source.)

Options: (a) refetch the roster before each save and ignore people who disappeared; (b) separate the
specs. **Pick (a).** (b) can't be done: Playwright serial mode only orders tests inside one file, and
cross-file separation would mean one worker for the whole suite. (a) keeps the server's guard
meaningful (the test then behaves like a real page that refreshed) and costs a few lines.

**Fix (`tests/e2e/batches.spec.ts`, D-088 test, `:500-593`):**

- Add `read()` = `GET /api/v1/attendance` returning `data` (`taken`, `updatedAt`, `roster`).
- `save(present: (r) => boolean)` becomes: `read()`, `PUT` with `marks = roster.map(r => ({ userId: r.id,
present: present(r) }))` and `expectedUpdatedAt = fresh.updatedAt`; if the status is 409, read again
  and retry once (at most twice in all); then `expect(status).toBe(200)`. No fixed waits.
- The three calls: `save(() => true)`; `save((r) => r.role !== "QUALITY_INSPECTOR")`; and the restore in
  `finally`. For the restore, keep `const was = new Map(before.roster.map(r => [r.id, r.present]))`
  from the first read and call `save((r) => was.get(r.id) ?? false)` (someone who vanished is simply
  not sent; a new one is saved absent, as before).
- `before.taken === false` branch (delete marks and the day) stays.
- Not changed: the app, the other specs. E2E written, not run.

### B1 decision: how run 4 verifies C6 without a console

Read: `demo-clock-control.tsx`. The date and time fields are ordinary controlled inputs (`value` and
`onChange`, `:171-173`, `:184-186`) and `submit()` sends the **React state** (`:131`), which
`startChange` prefilled with the current time (`:80-86`). The band's text after Set clock comes from
the **server's reply** (`setView(data)`, `:110-112`), and a reload renders it from the server again.

Why this is a tooling artefact, not a fault: Codex's `fill()` made the field _display_ 17:05 but the
clock stayed at the 09:13 prefill, which is what happens when a tool writes `input.value` through the
element's own setter and then sends an `input` event: React's value tracker sees that the DOM value
already equals what it last saw, skips `onChange`, and the state keeps the prefill. A person's typing,
the browser's picker and autofill send real events and work (Playwright's own `fill()` also does; the
e2e suite fills React inputs everywhere). Proof in the same run: typing `1705` with the real keyboard
moved the band to 17:05. Nothing in the component, the controller or the service changed in Phase 34
(none is in `git status`), and D-125 run 2, Phase 33 run 6 and Phase 34 run 2 (API fallback) all moved
the clock. **No change to the component.** (Reading the fields from the DOM at submit would hide the
tool's quirk but change working code for a tool's sake.)

**Can C6 be closed as passed on run 3's evidence?** Yes, for what C6 is: the Floor Manager sets the
demo clock to 17:05 through the form and it moves, and Real time restores. The request body is the only
thing unseen, and the band reading 17:05 (a server reply) shows it was 17:05. The batch-end reminder at
17:05 was verified in Phase 33 run 6 and run 2 here. **Verdict: C6 PASS.** Run 4 adds a confirmation
that doesn't gate the pass.

**Run 4 check (no console; the route is POST only, there is no clock GET):** a headless Playwright
script, run from the repo root, saved as `qa/reports/artifacts/<run>/c6-clock.mjs` (a report artifact,
not a test; it changes nothing on the page). Sketch (untested; adapt the sign-in to the login page):

```js
import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ locale: "en-GB" })).newPage(); // 24-hour time field
await page.goto("http://localhost:3000/login");
await page.getByLabel("Email").fill("manager@cpoint.local");
await page.getByLabel("Password").fill(process.env.DEMO_USER_PASSWORD);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL((u) => u.pathname !== "/login");
await page.getByRole("button", { name: "Change time" }).click();
await page.getByLabel("Time").click();
await page.keyboard.type("1705");
const [res] = await Promise.all([
  page.waitForResponse((r) => r.url().endsWith("/api/v1/demo/clock")),
  page.getByRole("button", { name: "Set clock" }).click(),
]);
console.log(res.request().postData(), res.status(), await res.text());
await page.reload();
console.log(await page.getByTestId("demo-clock-time").innerText()); // expect "... · 17:05"
await page.getByRole("button", { name: "Back to real time" }).click();
console.log(await page.getByTestId("demo-clock").innerText()); // expect "Real time: ..."
await browser.close();
```

Pass when the body is `{"date":"<today Manila>","time":"17:05"}`, the status is 200 with `data.on` true, the
reloaded band reads 17:05, and Back to real time returns "Real time". Then one query as the second
witness (the audit log keeps who and when, `demo-clock.service.ts:84-91`): `SELECT "createdAt",
after FROM audit_logs WHERE action = 'demo_clock.set' ORDER BY "createdAt" DESC LIMIT 2;` The newest
row's `after.at` is `real time` and the one before it `<today>T09:05:00.000Z` (17:05 Manila). If the
script itself can't run, say so and still close C6 on the in-app keyboard result. Only a non-200 or a
band that doesn't move **with keyboard typing** is a product fault.

### New assumptions

None. Next free number is A-97. (Test-only fixes and a tooling note; the passed-pairs rule is A-64.)

### Fixes, by file (coding thread; E2E written, not run)

1. `tests/e2e/final-defects.spec.ts:394-396`: the `repairedPassed` delta plus the same-response identity
   above, with the comment.
2. `tests/unit/production-rules.test.ts` (near `:282`): the two `quotaProgress` cases with `repairedPassed`.
3. `tests/e2e/batches.spec.ts:500-593`: `read()`, `save(present)` with a fresh read and one retry on 409,
   and the restore from the first read's `present` map.
4. Docs and prompt: `qa/CODEX_PROMPT_PHASE_34_RUN4.md` (below), a line in the handoff's C6 row
   (C6 closed as passed in run 3; run 4 confirms with the script), STATUS, SESSION_LOG, the phase's vault summary.
   Run `npm run check` (the new unit tests count) and say so honestly; never run the e2e.

### Scope of Codex run 4

**Setup, in this order (the prompt keeps it):** `docker compose stop app` first (it holds port 3000);
`npm run db:up`; `npm run db:deploy`; stop any old dev server, then a **fresh `npm run dev`**; then
**`npm run demo:reset '--' --yes`**; check the clock reads Real time.

**Manual:** only the C6 confirmation above (script, then the audit query). C2 and everything else passed
or is covered by e2e: not rerun.

**E1, with `--workers=2` each:**

1. Targeted: `npx playwright test tests/e2e/final-defects.spec.ts tests/e2e/stage-wip.spec.ts
tests/e2e/batches.spec.ts tests/e2e/inspection-queue.spec.ts tests/e2e/reports.spec.ts --workers=2`.
   Expect 28 tests, all passing; this is the first run in which the serial tail of `final-defects`
   (A3, A-93, reports, suggestion, final defect types, no-names) can run. Report any that did not run, and why.
2. The same two clean-up queries as run 3 (days of `final-defects` and `inspection-queue`, and orphan
   findings); both must be 0.
3. The full suite: `npx playwright test --workers=2` (expect about 120, 2 skipped).
   If a test fails on a first-compile time-out or `ECONNRESET`, rerun that spec alone once and report both.
4. **`npm run demo:reset '--' --yes` at the end**, and the demo clock back on **Real time**.

**Report:** `qa/reports/2026-11-20-phase-34-run4.md` (or the day's date and next run number), PASS / PASS
WITH ISSUES / FAIL, every scenario, the counts, each failure with steps, expected, actual and evidence.
A full pass (targeted 28 of 28 and the full suite with no failure or "did not run") closes Phase 34 QA.
Codex changes no code; a failure comes back to the planning thread.

### Questions for Dylan

None blocking. For information: C6 is closed as passed (a tooling artefact, not an app fault). Still open
for CPoint: is a capture constructor really at Preparation all day, one station per person (A-96)?
