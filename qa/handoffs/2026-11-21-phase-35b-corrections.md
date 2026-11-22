# QA handoff: Phase 35B, corrections to past records

| Field           | Value                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| Date            | 2026-11-21                                                                                                          |
| Feature         | phase-35b-corrections                                                                                               |
| Branch          | uncommitted on `main` (1c196bb, Phase 35A merged as #59)                                                            |
| Spec / prompt   | `docs/prompts/plans/phase-35-reports-and-corrections-plan.md` → 35B; D-133; A-70, A-103 to A-110; `docs/ROADMAP.md` |
| Written by      | Claude                                                                                                              |
| Previous report | `qa/reports/2026-11-21-phase-35a-run3.md` (PASS; nothing open for 35B)                                              |

## 1. What changed

Only the **Floor Manager** can correct what is past, and every correction asks **Why are you correcting
it?** (5 characters or more), keeps the old and the new value in the audit log, and says so in its toast.

- **A batch from any past day.** Batches → **Queue** → **Inspected and void** has a **Batch date**
  picker (**Show this date**; **Last 7 days** goes back) that reaches any day, not only the last 7. Each
  inspected batch has the same **Correct** dialog as today's. Every rule of a same-day correction still
  holds: the stale check, the reason, both counts in the audit, and the failed pairs and the "What was wrong"
  lines **lock once a repair from the batch is Back for inspection or Done** (A-93). The Floor Manager no
  longer needs a "no Quality Inspector present today" cover for a past day (A-109). The Quality Inspector
  still corrects only on the day they inspected it, and for an older batch is told "Ask the Floor Manager
  to correct it." A corrected batch shows one line under its findings: "Corrected by <name>, Tue, 17 Nov
  10:05: <reason>". **Reports → Operations → Production by day** marks a day **Corrected** when a batch of it
  was corrected on a later day (A-103), with a muted **See batches** link to that day's list (also on
  Batches → Recent days).
- **A roll's details.** On the roll page (Reports → Rolls → a roll) **Edit details** corrects the **tag
  number**, the **received day** (not after today), the **return note** (only a roll from before the Phase
  30E rule that has a return decision; none in the demo) and the **area, only before Finish roll** (In stock or
  Being scanned): after it, the defect share and the return mark were worked out from it (A-104). After Finish
  roll the area is shown but disabled, with the reason, and the API says "The area can't change after Finish
  roll: …". The supplier and the leather item never change; the place stays with Move. A removed roll can't be
  edited (A-106). Only the changed fields go in the audit.
- **A repair's inspection.** In Queue → Inspected and void, an inspected repair has **Correct** (Floor
  Manager only): change how its pairs split between **Passed**, **Scrapped** and **Sent back again**, the same
  total, with a reason, **while every job it sent back is still At stage** (A-105). The jobs it sent back follow
  (a line keeps its job and code, extra jobs go, extra lines add a job). Once one of them is Back for
  inspection, inspected or marked Not fixable, the row says which and why instead of offering Correct. The
  original inspection time and inspector stay; passed pairs still count on the day it was first inspected
  (A-108).

Writes are new, but **no migration**: the audit log holds both values.

## 2. Files touched

| File                                                                                                                  | Change                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/services/production.service.ts`, `batch-queue.service.ts`                                                 | `correctCheckIn` for any past day (Floor Manager); the queue's `doneDay`, `correctable` per viewer, `correction`, repair `correctRepairInspection`; `DayRow.correctedLater` |
| `src/server/models/{production,repair,roll}.model.ts`                                                                 | done batches of one day; corrected fields on the queue's check-in; repair children and the correction writes; `updateRollDetails`                                           |
| `src/lib/{repair-rules,roll-rules}.ts`                                                                                | `inspectionLockedReason`, `planChildChanges`; `planRollEdit`, `areaEditable`, the edit messages                                                                             |
| `src/server/validators/{production,repair,roll}.validator.ts`                                                         | `doneDay`; `repairCorrectionSchema`; `updateRollSchema`                                                                                                                     |
| `src/server/services/roll.service.ts`, `controllers/{repair,roll}.controller.ts`                                      | `updateRoll`; the two `PATCH` handlers                                                                                                                                      |
| `src/app/api/v1/rolls/[id]/route.ts`, `src/app/api/v1/production/repairs/[id]/inspect/route.ts`                       | `PATCH` added                                                                                                                                                               |
| `src/app/(app)/batches/{actions.ts,queue-list.tsx,repair-inspect-dialog.tsx,page.tsx}`                                | the Batch date picker, Correct on past batches and repairs, the correction line, See batches                                                                                |
| `src/app/(app)/reports/rolls/{actions.ts,[id]/page.tsx}`, `src/components/features/rolls/edit-roll-details.tsx` (new) | Edit details                                                                                                                                                                |
| `src/components/features/production/production-parts.tsx`, `src/app/(app)/reports/_components/operations-view.tsx`    | the Corrected badge and See batches                                                                                                                                         |
| `tests/unit/*` (7 files), `tests/e2e/corrections.spec.ts` (new)                                                       | unit tests (1001 pass); e2e written, not run                                                                                                                                |
| `docs/API.md`, `DESIGN.md`, `docs/USER_MANUAL.md`, `docs/prompts/system-rebuild.md`, `README.md`                      | the new params and `PATCH` rows; Corrections to past records; the manual; the spec                                                                                          |

Database migration in this change: **no**.

## 3. How to run the app locally

`docker compose stop app` first (the Docker app is older than these phases), then:

```bash
npm run db:up
npm run db:deploy      # nothing new to apply
npm run dev            # http://localhost:3000 (or the port it prints)
npm run demo:reset '--' --yes   # 2 to 3 minutes; the demo week is the last 14 days
```

Existing specs that cover the touched pages (run them too): `inspection-queue.spec.ts`,
`final-defects.spec.ts`, `batches.spec.ts`, `rolls.spec.ts`, `reports.spec.ts`, `stage-wip.spec.ts`,
plus the new `corrections.spec.ts`.

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD`. Floor Manager `manager@cpoint.local`, Quality Inspector
`inspector@cpoint.local`, System Admin `admin@cpoint.local`, Shoe Constructor `constructor@cpoint.local`.

The reset gives the last 14 days; weekdays have batches, already inspected for the past ones. Pick a
**weekday 8 to 13 days ago** that shows batches in Reports → Operations → Production by day: it is out of
the Queue's default 7 days, so the Batch date picker is needed. For the repair scenarios (C6 to C8) there is
nothing to correct until a repair is inspected: make one (C6 step 1). `corrections.spec.ts` builds its own
rows (a Saturday and a Sunday 22 to 28 days back) and removes them afterwards.

## 5. Test scenarios

| ID  | Role    | Steps                                                                                                                                                                                                                                                                                                                                                       | Expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Priority |
| --- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| C1  | FM      | Batches → Queue. Under **Inspected and void** note the description. Choose a **Batch date** 8 to 13 days ago (a weekday with batches), **Show this date**. Tap **Correct** on a batch, change **Pairs finished** by 2, leave the reason empty, **Save correction**; then write a reason, **Save correction**.                                               | The last 7 days don't list that batch; after Show this date the URL has `doneDay=` and the description reads "Batches of <day> that have left the queue." plus the sentence about corrections. No reason: "Say why you're correcting this batch, at least 5 characters." under the field. With a reason the dialog closes, a toast says "…corrected. Both counts are kept in the audit log.", the row shows the new pairs and "Corrected by <name>, <day time>: <reason>". | High     |
| C2  | FM      | Reports → Operations with a Custom range of that day. Read the Production by day row, then tap **See batches**. Download the Production CSV for the range.                                                                                                                                                                                                  | The day shows a **Corrected** badge and a **See batches** link; the link lands on Batches → Queue with that day's list and the batch visible. The CSV and the row show the corrected pairs (the same numbers). The link is not in a print PDF.                                                                                                                                                                                                                             | High     |
| C3  | QI      | Open `/batches?tab=queue&doneDay=<that day>`. Look at the batch. Then (headless/API) `PATCH /api/v1/production/check-ins/<id>` with any change and a reason.                                                                                                                                                                                                | The batch is listed with its "Corrected by …" line but **no Correct button**. The API answers `409` "A batch can only be corrected on the day it was inspected. This one was inspected on <day>. Ask the Floor Manager to correct it." Today's batches still have Correct for the QI (as before).                                                                                                                                                                          | High     |
| C4  | FM      | Same batch day, a batch with failed pairs and a repair (from a batch you finish and inspect today with the demo clock, or from `corrections.spec.ts`'s second test): mark one of its repairs **Back for inspection**, then try to change the **failed pairs** of that batch from the picker.                                                                | The Correct dialog shows the lines locked ("A repair from this batch is already back for inspection, so its failed pairs can't change. You can still correct the other counts."); changing the pairs finished alone saves; the API with a new failed count answers `409` with that sentence.                                                                                                                                                                               | High     |
| C5  | FM      | Reports → Rolls → a roll **In stock** → **Edit details**. Press Save with nothing changed; clear the reason and change the **Tag number** and **Area**; then give a reason and save. Then a **Received on** date after today.                                                                                                                               | "Nothing changed. Change a field, or close this window." Then "Say why you are correcting this roll, at least 5 characters." under the reason. After saving the page shows the new tag and area. A future date: "The day the rolls arrived can't be after today." The audit log (Admin → Audit log, action `roll.update`) has the roll with only the changed fields before and after, and the reason.                                                                      | High     |
| C6  | FM + QI | Make a repair to correct: a Floor Manager marks a repair **Back for inspection** (Batches → Work in progress); the QI inspects it from the Queue (**Inspect repair**: some Passed, some **Send some back again**, total = its pairs). Then, as FM, Queue → **Inspected and void** → that repair → **Correct**: change the split (same total), reason, save. | The repair's row has **Correct** for the FM only (the QI's row has none). The dialog opens with the saved numbers. A total that differs says "Passed, scrapped and sent back again add up to N, but this repair has M pairs. Change the numbers."; no change says "Nothing changed. …"; saved, the row shows the new split. The job it sent back keeps its code and shows the new pairs (Work in progress); a line removed removes its job.                                | High     |
| C7  | FM      | Continue C6: mark the job it sent back **Back for inspection**, then reload the Queue.                                                                                                                                                                                                                                                                      | The inspected repair's row has no Correct and says "<code>, sent back from <parent>, is already back for inspection, so this inspection can't change."; `PATCH …/repairs/<id>/inspect` answers `409` with that sentence.                                                                                                                                                                                                                                                   | High     |
| C8  | Admin   | Admin → Audit log: filter `production.checkin.correct`, `repair.inspect.correct`, `roll.update`.                                                                                                                                                                                                                                                            | One row per correction you made, each with before and after, the reason, and (batch) `correctedOnLaterDay: true` with the day it was inspected; the repair's keeps the old and new sent-back lines.                                                                                                                                                                                                                                                                        | Medium   |
| C9  | FM      | Roll after Finish roll: open a **finished** roll (Reports → Rolls, status Scanning passed) → **Edit details**.                                                                                                                                                                                                                                              | **Area (sq ft)** is shown but disabled with "Fixed after Finish roll: the defect share and the return mark were worked out from it."; the tag still changes. `PATCH /api/v1/rolls/<id>` with `areaSqFt` answers `422` "The area can't change after Finish roll: …"; a tag-only change answers `200`. A removed roll has no **Edit details**; the API answers `409` "<code> was removed, so its details can't change."                                                      | High     |
| C10 | FM      | Two windows as the Floor Manager on the same roll: open **Edit details** in both; save a tag in the first, then another tag in the second.                                                                                                                                                                                                                  | The second says "Someone else changed this roll just now. Refresh to see where it is." with Refresh; nothing is overwritten. The same for a batch correction opened twice: "This batch was changed by someone else. Refresh to see it.", or, when the first save was itself a correction, "This batch was already corrected by <name> at <time>. Refresh to see it."                                                                                                       | Medium   |
| C11 | FM      | Axe (serious and critical) on Batches → Queue with a past day shown, with the Correct dialog open, and on a roll page with Edit details open; light and dark.                                                                                                                                                                                               | No serious or critical violation; each field has its label and its error is tied to it; Escape closes the dialogs; focus returns to the button.                                                                                                                                                                                                                                                                                                                            | Medium   |
| C12 | FM      | Run `corrections.spec.ts` and the existing specs listed in §3, then the full suite with `--workers=2`.                                                                                                                                                                                                                                                      | All pass; a first-compile time-out or `ECONNRESET` is rerun alone once and both results reported. The spec leaves no rows behind (its Saturday and Sunday, 22 to 28 days back).                                                                                                                                                                                                                                                                                            | High     |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                                                                                                                  | Expected                                                                                          |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| A1  | QI, Admin, Shoe Constructor    | `PATCH /api/v1/rolls/<id>` with a tag and a reason; `PATCH /api/v1/production/repairs/<id>/inspect`; the QI's page `/reports/rolls/<id>`                                       | `403` for both PATCH calls, `/forbidden` for the page; nothing changes                            |
| A2  | Admin, Shoe Constructor        | `PATCH /api/v1/production/check-ins/<id>`; `GET /api/v1/production/batches?doneDay=…`                                                                                          | `403`                                                                                             |
| A3  | (as the Floor Manager)         | `/batches?tab=queue&doneDay=2999-01-01`, `…&doneDay=2026-02-30`, `…&doneDay=nonsense`; `PATCH /api/v1/rolls/not-a-uuid`; `PATCH /api/v1/production/repairs/not-a-uuid/inspect` | The pages load (200) with the last 7 days; the PATCH calls answer `404`; nothing echoed unescaped |

## 6. Out of scope / known issues

- **No migration.** A repair's correction is not marked on its row (no column): the audit log is the
  record (A-108). A corrected batch is marked on its card and, by day, in Operations.
- The return note can only be edited on an old roll that has a return decision; the demo has none, so it
  is covered by unit tests (`planRollEdit`, `updateRoll`), not by a scenario.
- The Queue lists at most 200 done batches for a range; one day never reaches it.
- Claude did not open any of this in a browser; the dialogs, the Batch date picker and the Corrected badge
  are unverified until your run.
