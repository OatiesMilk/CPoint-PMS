# QA handoff: Phase 30E-2, the planning calendar

| Field           | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| Date            | 2026-11-04                                                                           |
| Feature         | phase-30e2-planning-calendar                                                         |
| Branch          | `main` at a94fbe0, uncommitted on the laptop                                         |
| Spec / prompt   | `docs/prompts/plans/phase-30e2-plan.md`, `docs/ROADMAP.md` Phase 30E-2, D-114, D-115 |
| Written by      | Claude                                                                               |
| Previous report | `qa/reports/2026-11-04-phase-30e-run3.md` (30E-1)                                    |

## 1. What changed

- **Floor Manager:** Batches → **Plan days** (`/batches/plan`) is a month calendar (Monday to
  Friday columns; Saturdays and Sundays aren't shown as clickable days). Clicking a weekday, today
  or later, opens **Plan for <day>**: **Rolls to be used** (0 to 200, an estimate), **Quota (pairs
  that pass)** with the suggestion and Use suggestion, **Check-in interval** (Every 4 hours, or Once
  at the end of the day), **Shift start** and **Shift end** (08:00 and 17:00 prefilled), and a live
  "Batches:" preview. **Save plan**, or **Mark Non-working / Holiday** (no name). A marked day's
  dialog has **Undo, make it a working day**. Past days can't be clicked (D-114); their cells show the plan and
  the rolls scanned. Months move with Previous / Next, up to three months ahead.
- **No plan, no batches.** Nothing is copied. On an unplanned weekday the FM sees a banner on every
  page ("Today has no plan yet, so there are no batches. Plan today."), a bell item and a **Plan
  today** card first on the home. Batches shows "Today has no plan yet …" with **Plan today**. The
  QI reads "No batches yet today. The Floor Manager plans them first." A Non-working day has no
  batches, no notice and no stock reminder.
- **Today locks** once one of its batches is finished: "A batch is already finished today, so
  today's plan can't change. Plan the coming days instead." (409 from the API).
- **Planned against scanned:** Batches shows "N of M rolls scanned today" (FM); Recent days, Reports
  → Operations and `production.csv` gain Rolls planned and Rolls scanned (a roll counts on the day
  its Finish roll was pressed).
- **Gone:** the Schedule and quota forms, the working-days ticks, every 1, 2 and 3 hours for new
  plans, `/api/v1/production/schedule` and `/api/v1/production/quotas` (404).
- **Migration:** `20261104120000_day_plans` turns the old schedule and quota into a plan for every
  past working day and today, so their batches and numbers stay the same; then drops the old
  tables. Days after today have no plan.
- **Demo week:** a plan for every working day (3, 1, then 2 rolls; quota 128; every 4 hours;
  08:00 to 17:00) and next week's Wednesday marked Non-working.

## 2. Files touched

| File                                                                                         | Change                                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261104120000_day_plans/`                        | `DayPlan`, `DayKind`; old tables converted and dropped        |
| `src/lib/production-rules.ts`                                                                | interval 240 only, month helpers, plan rules, rolls lines     |
| `src/server/models/production.model.ts`, `roll.model.ts`                                     | day plan reads and writes; roll finish times                  |
| `src/server/services/production.service.ts`, `roll.service.ts`                               | day plans drive batches; plan month; save, mark, undo; notice |
| `src/server/services/stock-update.service.ts`                                                | no reminder on a Non-working day                              |
| `src/server/validators/production.validator.ts`, `controllers/production.controller.ts`      | plan schemas and handlers                                     |
| `src/app/api/v1/production/plans/**`                                                         | new routes; `schedule` and `quotas` routes deleted            |
| `src/app/(app)/batches/plan/page.tsx`, `plan-calendar.tsx` (`plan-forms.tsx` deleted)        | the calendar and day dialog                                   |
| `src/app/(app)/batches/page.tsx`, `actions.ts`, `floor-manager/page.tsx`, `layout.tsx`       | plan lines, no-plan state, home card, notice                  |
| `src/components/features/batches/batch-notices.tsx`, `app-shell/sidebar.tsx`, `production/*` | banner, bell item, Rolls scanned column, Plan today card      |
| demo seed, demo reset, bootstrap, `scripts/demo-reset.ts`                                    | day plans instead of a schedule                               |
| `tests/unit/*` (6 files), `tests/e2e/batches.spec.ts`                                        | updated and rewritten                                         |
| `.github/workflows/ci.yml`, docs                                                             | CI checks `day_plans`; API, DESIGN, README, wrap-up docs      |

Database migration in this change: **yes** (name: `20261104120000_day_plans`)

## 3. How to run the app locally

Prerequisites: Docker Desktop running, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up
# back up first (the migration drops production_schedules and daily_quotas):
docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/before-30e2.dump
docker cp cpoint-pms-db-1:/tmp/before-30e2.dump storage/backups/before-phase30e2-2026-11-04.dump
npm run db:deploy      # applies 20261104120000_day_plans
npm run db:generate
npm run dev
```

Existing automated tests that cover this area:

```bash
npx playwright test tests/e2e/batches.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts
```

`batches.spec.ts` saves an hourly-style plan for today straight in the database for its own
checks, and puts today's plan back afterwards.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                    | Home page        |
| ----------------- | ------------------------ | ---------------- |
| Floor Manager     | `manager@cpoint.local`   | `/floor-manager` |
| Quality Inspector | `inspector@cpoint.local` | `/batches`       |
| System Admin      | `admin@cpoint.local`     | `/admin`         |

Data: Dylan's own database after the migration (no reset needed). Today has a plan converted from
the old schedule. For S7 to S9 a weekday with no plan is needed: use a future weekday, or, if a
check can only be seen today, delete today's row from `day_plans` and save it again at the end
(note the row's values first).

## 5. Test scenarios

| ID  | Role | Steps                                                                                                                                 | Expected result                                                                                                                                                                                                                                        | Priority |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| S1  | FM   | After `db:deploy`, open Batches.                                                                                                      | Today's batches and numbers are the same as before the migration (compare with a screenshot taken before); "Plan: …" line names the shift and interval.                                                                                                | High     |
| S2  | FM   | Batches → **Plan days**.                                                                                                              | A month calendar, Monday to Friday; today marked; past days show planned and scanned rolls; future days "Not planned yet"; no working-days ticks.                                                                                                      | High     |
| S3  | FM   | Click a future weekday. Enter Rolls 4, use the suggestion (or 120), Every 4 hours, keep 08:00–17:00. Watch "Batches:". **Save plan**. | Preview lists 08:00–13:00 and 13:00–17:00 (default lunch); toast; the day shows 4 rolls and the quota.                                                                                                                                                 | High     |
| S4  | FM   | Reopen that day, change Rolls to 5, Save. Then reopen and Save without changes.                                                       | First save updates the day; second reads "Nothing changed, so nothing was saved."                                                                                                                                                                      | Medium   |
| S5  | FM   | On a future day: Rolls `-1` or `2.5`, Quota empty, Shift end 18:00, Shift start after Shift end.                                      | Each field shows its own message (e.g. "Enter the rolls to be used as a whole number, like 5. Enter 0 if none."; "Shift end must be 17:00 or earlier."); focus on the first; nothing saved.                                                            | High     |
| S6  | FM   | Interval list.                                                                                                                        | Only "Every 4 hours" and "Once at the end of the day". Once a day previews one batch to the shift end.                                                                                                                                                 | Medium   |
| S7  | FM   | Click another future weekday → **Mark Non-working / Holiday**. Reopen it → **Undo, make it a working day**.                           | Marked: "Non-working / Holiday" on the calendar, dialog says no batches, no notice, no stock reminder. Undo: back to Not planned.                                                                                                                      | High     |
| S8  | FM   | A weekday with no plan for today (see Data). Open any page, the bell and the home.                                                    | Banner "Today has no plan yet, so there are no batches. Plan today."; a bell item; **Plan today** card first on the home; Batches shows the no-plan state with Plan today. Plan today opens today's dialog; after saving, the banner and bell item go. | High     |
| S9  | QI   | Same unplanned today, open Batches.                                                                                                   | "No batches yet today. The Floor Manager plans them first." No banner, no bell plan item.                                                                                                                                                              | High     |
| S10 | FM   | With a batch finished today, open today on the calendar.                                                                              | Read-only with "A batch is already finished today, so today's plan can't change. Plan the coming days instead."                                                                                                                                        | Medium   |
| S11 | FM   | Navigate months: Previous into the past, Next three times.                                                                            | Past days can't be clicked and show the plan and rolls scanned in the cell; after the third month ahead Next stops, with "Days can be planned up to three months ahead." Saturdays and Sundays never open.                                             | Medium   |
| S12 | FM   | Batches → Recent days; Reports → Operations; download `production.csv`.                                                               | Separate Rolls planned and Rolls scanned columns in Recent days and Operations; Rolls planned and Rolls scanned in Operations and the CSV.                                                                                                             | Medium   |
| S13 | FM   | Phone width (390 px): Plan days, open a day.                                                                                          | A list of weekdays instead of the grid; the dialog fits with no sideways scroll.                                                                                                                                                                       | Low      |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                         | Expected                       |
| --- | ------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------ |
| A1  | QI, Admin                      | `/batches/plan`; `GET /api/v1/production/plans`; `PUT /api/v1/production/plans/{day}` | 403 page / 403                 |
| A2  | anyone                         | `GET/PUT /api/v1/production/schedule`, `/api/v1/production/quotas`                    | 404                            |
| A3  | FM                             | `PUT /api/v1/production/plans/<a Saturday>` or a past day                             | 422 or 409 with a named reason |
| A4  | —                              | axe (WCAG 2.1 A/AA) on Plan days, the day dialog, Batches with the plan notice        | 0 violations                   |

## 6. Out of scope / known issues

- Run 1 fixes: past days were never meant to open (Dylan: weekends and past days can't be
  clicked); Operations and Recent days now have a separate Rolls planned column; an unplanned
  today stays plannable even when batches were finished before it had a plan.
- Lunch stays the Admin's (Settings → Lunch break), from tomorrow.
- `batches.spec.ts` needs a batch due today: it fails between 00:00 and 01:00 Manila.
- A day converted from an old 1, 2 or 3 hour schedule keeps that interval as history (D-115).
