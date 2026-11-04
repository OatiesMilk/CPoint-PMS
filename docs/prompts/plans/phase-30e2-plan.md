# Plan: Phase 30E-2, the planning calendar

> Written 2026-11-04 by Claude from `docs/prompts/plans/phase-30e-plan.md` ("30E-2, the planning
> calendar" and "Decided for 30E-2"). Waiting for Dylan's go. Builds on `main` at a94fbe0 (#35).

## What the Floor Manager sees

**Batches → Plan** (`/batches/plan`, renamed "Plan days") becomes a **month calendar**, Monday to
Sunday, with Previous month / Next month.

- Each weekday cell shows its state:
  - **Planned:** "5 rolls · 128 pairs · every 4 h" (or "once a day").
  - **Non-working / Holiday:** the mark only, no name.
  - **Not planned:** muted; today's cell in the warning tone when it isn't planned.
  - Past days also show "3 of 5 rolls scanned" (planned against scanned).
- **Saturdays and Sundays** are greyed and can't be clicked. **Past days** can't be changed (they
  open read-only to show what was planned). The working-days ticks are gone.
- Clicking a weekday, today or later, opens a dialog:
  - **Rolls to be used** (whole number, an estimate; constructors may start more).
  - **Quota** (pairs that pass inspection, whole line) with the suggestion and **Use suggestion**,
    as today (D-099).
  - **Check-in interval:** Every 4 hours, or Once at the end of the day (D-115).
  - **Shift start / end**, prefilled 08:00 and 17:00, inside the factory window (D-105). _(Q1)_
  - A live preview: "Batch 1 08:00–13:00, lunch 11:00–12:00; Batch 2 13:00–17:00", with that
    day's lunch (still the Admin's, from tomorrow).
  - **Save plan**, and **Mark Non-working / Holiday**. A marked day shows **Undo, make it a working
    day** (back to Not planned). "Last changed by Rodel Pascual, 4 Nov 09:12" as a log-book fact.
- Below 640 px the grid becomes a list of the month's weekdays (no sideways scroll, D-034).
- Today's plan can change until its first batch is finished; then it's read-only with "Batch 1 is
  finished, so today's plan can't change." (A-36). The same holds for marking it Non-working.
- The old Batches form, Daily quota form, Schedule history and Quota history go; the calendar shows
  each day's plan and the audit log keeps every change.

**The start-of-day notice (A-37):** on a weekday with no plan and no Non-working mark, from 00:00,
the FM gets a banner on every page ("Today has no plan yet, so there are no batches. Plan today."
with a button), an item in the bell, and a **Plan today** card first on the FM home. The QI's
Batches page reads "No batches yet today. The Floor Manager plans them first." No banner for the QI.

**Batches page:** today's card shows the plan ("Plan: 5 rolls, 128 pairs, every 4 hours") and, for
the FM, "Rolls scanned today: 3 of 5 planned". Recent days gets Rolls planned and Rolls scanned
columns. A Non-working day reads "Today is marked Non-working / Holiday, so there are no batches."

**Reports → Operations:** the per-day table and `production.csv` add **Rolls planned** and **Rolls
scanned** _(Q2)_. Non-working and unplanned days aren't working days there (no batches, as now).

## Rules

- A day's batches come only from its plan. No plan, no batches (nothing is copied, Dylan 4 Nov).
- Rolls scanned on a day = rolls whose Finish roll was that Manila day (status Scanned), whatever
  the leather. Put-back and cancelled rolls don't count.
- The quota suggestion is unchanged: average passed pairs per full working day, last 10 such days.
- Lunch stays the System Admin's, from tomorrow. A lunch outside a day's shorter shift is ignored
  for that day and the dialog says so (as today).
- A plan can be saved up to the end of the third month ahead (ASSUMPTION A-40).
- A Non-working / Holiday day has no batches, no plan notice, and no stock-update reminder; the
  next reminder day is unchanged (ASSUMPTION A-41).
- Concurrent edits: a plan changed since the dialog opened is `409 STALE`, naming who and when.

## Data

- New table `day_plans`: `day` (date, unique), `kind` (`PLANNED` | `NON_WORKING`), `rollsPlanned`,
  `quota`, `intervalMinutes` (240 or null), `shiftStart`, `shiftEnd` (null when Non-working),
  `createdById`, `updatedById`, timestamps. Undo of a mark deletes the row. Every save, mark and
  undo runs in `runInTransaction` with `recordAudit` (`production.plan.set`,
  `production.plan.nonWorking`, `production.plan.cleared`), before and after.
- **History stays exact.** `production_schedules` and `daily_quotas` are kept, read-only, for days
  before the change, so past batches keep matching their finished check-ins. One date,
  `plansFrom`, splits them: before it the old schedule and quota; from it, only day plans.
  The migration sets it to tomorrow (Manila) on a database with finished batches, so **today keeps
  its batches**, and to the beginning on an empty one. _(Q3)_
- Because of that, nothing old is rewritten: A-39 ("1, 2 and 3 h plans become 4 h") isn't needed
  any more. Old days keep the times they were counted at.
- `plansFrom` lives in a one-row `production_settings` table (no new container).
- Migration `day_plans` (schema + that one date).

## API

- `GET /api/v1/production/plans?month=2026-11`: the month's days with plan, mark, batches and
  rolls scanned.
- `PUT /api/v1/production/plans/{day}`: `{ rollsPlanned, quota, suggestedQuota?, intervalMinutes,
shiftStart, shiftEnd, updatedAt? }`.
- `PUT /api/v1/production/plans/{day}/non-working` and `DELETE` the same (undo).
- `POST /api/v1/production/schedule` and `/quotas` answer `405` (gone).
- All behind `production:plan` (FM), with `requireApiPermission`.

## Files (main ones)

- `prisma/schema.prisma`, migration `day_plans`, `npm run db:generate`.
- `src/lib/production-rules.ts`: `INTERVAL_MINUTES = [240]`, day-plan rules, `planNotice`,
  month grid helper.
- `src/server/models/production.model.ts` (day plans, `plansFrom`), `roll.model.ts` (rolls scanned
  per day).
- `src/server/services/production.service.ts`: `batchesOn` reads the day plan from `plansFrom`;
  `productionToday`, `productionDays` add plan and rolls; `planMonth`, `saveDayPlan`,
  `markNonWorking`, `clearNonWorking`; `saveSchedule` / `saveQuota` removed.
- `src/server/validators/production.validator.ts`, `production.controller.ts`, routes above.
- `src/app/(app)/batches/plan/*` (calendar, day dialog), `batches/page.tsx`, `batches/actions.ts`.
- `batch-notices.tsx` + `(app)/layout.tsx` (plan notice for the FM), `floor-manager/page.tsx`
  (Plan today card), `stock-update.service.ts` (skip Non-working days).
- `ops-report.service.ts` + Operations view + `production.csv`.
- `demo-seed.service.ts`, `demo-reset.model.ts`: a plan for every demo working day (every 4 h,
  128 pairs, rolls planned close to the rolls scanned, one day under and one over), one weekday
  next week marked Non-working; reset clears day plans and sets `plansFrom` to the beginning.
- `.github/workflows/ci.yml`: the Docker job's batch checks count `day_plans` instead of
  schedules and quotas.
- Tests: unit tests for the rules, services, validators and demo seed; e2e `batches.spec.ts`
  (plans today first), `reports`, `smoke`, `auth` updated for Codex.
- Docs: `docs/API.md`, README's Batches part, STATUS, SESSION_LOG, ROADMAP, DECISIONS; QA handoff
  and `qa/CODEX_PROMPT_PHASE_30E2.md`; vault Daily note and the 30E phase summary.

## Decisions

- **D-114:** the planning calendar and day plans; every working day needs a plan, nothing copied;
  Non-working / Holiday mark; the start-of-day notice; `plansFrom` keeps history. Replaces "from
  tomorrow" for the schedule and quota (D-083, D-085, D-099) and D-105's working-day ticks (the
  factory window stays).
- **D-115:** the check-in interval is every 4 hours or once at the end of the day (replaces
  D-097's 1 to 4 hours).

## Questions for Dylan

1. **Shift hours.** Recommend: shift start and end in each day's plan, prefilled 08:00–17:00
   (keeps today's shorter-shift option, per day). Or: always 08:00–17:00, no shift fields.
2. **Planned against scanned.** Recommend: the calendar's past days, the Batches page (today and
   Recent days), and Reports → Operations with `production.csv`. Or fewer of those.
3. **The switch-over.** Recommend: today keeps its current batches; plans are needed from the day
   after the migration runs (so Thursday 5 Nov if run today). Or: plans needed from today.

## Assumptions to log in STATUS

A-36 (today's plan changes until its first batch is finished), A-37 (the notice is the FM's),
A-40 (plans up to three months ahead), A-41 (a Non-working day skips the stock reminder). A-39 is
withdrawn (no conversion needed).

## Done when

- The FM plans, changes and marks days on the calendar as above; weekends and past days can't be
  clicked; today locks after its first batch is finished.
- A day without a plan has no batches and the FM sees the notice; the QI sees the plain line.
- Past days' batches and reports are unchanged after the migration.
- Planned and scanned rolls show where agreed.
- `npm run check` passes; Codex runs the handoff (browser and e2e).
