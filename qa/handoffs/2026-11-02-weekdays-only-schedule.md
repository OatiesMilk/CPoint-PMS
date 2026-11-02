# QA handoff: production works Monday to Friday, 08:00 to 17:00

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| Date            | 2026-11-02                                                                          |
| Feature         | weekdays-only-schedule                                                              |
| Branch          | uncommitted on Dylan's PC, on `main` at e8fae83 (Phase 30B merged)                  |
| Spec / prompt   | `docs/DECISIONS.md` D-105; `docs/ROADMAP.md` Phases 24 to 31, the follow-up         |
| Written by      | Claude                                                                              |
| Previous report | none for this change (newest app report: `qa/reports/2026-10-27-phase-30a-run9.md`) |

## 1. What changed

- **Floor Manager, Batches → Plan batches and quota:** the schedule form says "The factory works
  Monday to Friday, 08:00 to 17:00." and has five day ticks (Monday to Friday; no Saturday or
  Sunday). The time boxes are limited to 08:00 to 17:00. Saving a shift start before 08:00 shows
  "Shift start must be 08:00 or later." under Shift start; a shift end after 17:00 shows "Shift end
  must be 17:00 or earlier." under Shift end. A shorter shift inside the window (08:00 to 16:00)
  saves. "Shift end must be after shift start." still applies.
- **API:** `PUT /api/v1/production/schedule` with a weekend day answers `422` "Working days are
  Monday to Friday."; `PUT /api/v1/inventory/settings` with day 6 or 7 answers `422` "Reminder days
  are Monday to Friday."
- **Floor Manager, Inventory → Update stock → Reminder days:** ticks for Monday to Friday only.
- **System Admin, Settings → Lunch break:** the hint now reads "The same on every working day."
  (no "Saturday too").
- **Demo week** (`demo:reset`): no rolls, batches or attendance on Saturday or Sunday.
- **Migration `20261102090000_weekdays_only`:** past schedule rows stay as they were; the schedule
  in force tomorrow gets a Monday-to-Friday copy starting tomorrow (Manila) when it had a weekend
  day or hours outside 08:00 to 17:00. Reminder days lose Saturday and Sunday. On Dylan's PC it was
  applied on 2026-11-02: the default 08:00–17:00 Mon–Sat row now has a Mon–Fri row from
  2026-11-03.

## 2. Files touched

| File                                                                                           | Change                                                                                 |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `src/lib/production-rules.ts`                                                                  | `WEEKDAYS` Mon–Fri; `FACTORY_OPENS`, `FACTORY_CLOSES`, `FACTORY_DAYS`; default Mon–Fri |
| `src/lib/stock-rules.ts`                                                                       | `REMINDER_DAY_CHOICES` (Mon–Fri)                                                       |
| `src/server/validators/production.validator.ts`                                                | schedule: days 1–5, start ≥ 08:00, end ≤ 17:00                                         |
| `src/server/validators/inventory.validator.ts`                                                 | reminder days 1–5                                                                      |
| `src/app/(app)/batches/plan/plan-forms.tsx`                                                    | hint, five ticks, `min`/`max` on the times, old weekend days dropped                   |
| `src/app/(app)/inventory/update/update-sheet.tsx`                                              | reminder ticks Mon–Fri                                                                 |
| `src/app/(app)/admin/settings/lunch-break-form.tsx`                                            | "The same on every working day."                                                       |
| `src/server/services/production.service.ts`                                                    | comments                                                                               |
| `src/server/services/demo-seed.service.ts`                                                     | demo week skips Saturday and Sunday                                                    |
| `prisma/schema.prisma`                                                                         | comments only                                                                          |
| `prisma/migrations/20261102090000_weekdays_only/migration.sql`                                 | data migration                                                                         |
| `tests/unit/validator-messages.test.ts`, `tests/unit/production.service.test.ts`               | new and updated unit tests                                                             |
| `tests/e2e/batches.spec.ts`, `tests/e2e/inventory.spec.ts`                                     | new checks (not run by Claude)                                                         |
| `docs/API.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, `docs/SESSION_LOG.md`, `docs/ROADMAP.md` | docs                                                                                   |

Database migration in this change: **yes** (name: `20261102090000_weekdays_only`, data only)

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # apply migrations (weekdays_only is already applied on the PC)
npm run build && npm run start   # or npm run dev; app on http://localhost:3000
```

Health check: `http://localhost:3000/api/health` returns OK. On the PC another project may hold
port 3000; then start with `PORT=3001`.

Extra steps for this change:

- S8 needs a fresh demo week: `npm run demo:reset -- --yes` (in PowerShell:
  `npm run demo:reset '--' --yes`).

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts
```

Then the full suite (`npm run test:e2e`). `batches.spec.ts` inserts its own 00:00–23:59 every-day
schedule straight into the database for the test, so it still runs on any day and hour.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page         |
| ----------------- | -------------------------- | ----------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`  |
| Quality Inspector | `inspector@cpoint.local`   | `/batches`        |
| System Admin      | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture` |

Data this test needs: the demo users; for S8 a fresh demo week.

## 5. Test scenarios

| ID   | Role      | Steps                                                                                                                                                                                                                 | Expected result                                                                                                                                                                                                                                | Priority |
| ---- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1   | FM        | Batches → **Plan batches and quota**. Look at the schedule form.                                                                                                                                                      | "The factory works Monday to Friday, 08:00 to 17:00." shows above the times; Working days has Monday to Friday ticks only (no Saturday, no Sunday).                                                                                            | High     |
| S2   | FM        | In the schedule form type Shift start 07:00 and Shift end 18:00, press **Save schedule**.                                                                                                                             | "Shift start must be 08:00 or later." under Shift start and "Shift end must be 17:00 or earlier." under Shift end; focus on Shift start; nothing saved (no toast).                                                                             | High     |
| S3   | FM        | Shift start 08:00, Shift end 16:00, Every 4 hours, Monday to Friday ticked; **Save schedule**.                                                                                                                        | Toast "Schedule saved. It applies from …" (tomorrow); the preview lists batches ending by 16:00; the history shows "08:00 to 16:00, every 4 hours, Mon to Fri". Put it back to 08:00–17:00 afterwards.                                         | High     |
| S4   | FM        | Shift start 17:00, Shift end 08:00, Save.                                                                                                                                                                             | "Shift end must be after shift start." under Shift end (unchanged rule).                                                                                                                                                                       | Medium   |
| S5   | FM (API)  | Signed in as the FM, `PUT /api/v1/production/schedule` with `{ "shiftStart": "08:00", "shiftEnd": "17:00", "intervalMinutes": 240, "workingDays": [6] }`. Repeat with `"shiftStart": "07:00"` and `workingDays: [1]`. | Both `422`; the bodies contain "Working days are Monday to Friday." and "Shift start must be 08:00 or later."                                                                                                                                  | High     |
| S6   | FM        | Inventory → **Update stock** → Reminder days.                                                                                                                                                                         | Ticks for Monday to Friday only; Wednesday and Friday ticked (or what was saved). Save another weekday and put it back.                                                                                                                        | Medium   |
| S7   | FM (API)  | `PUT /api/v1/inventory/settings` with `{ "reminderDays": [6] }`, then `[3, 7]`.                                                                                                                                       | Both `422` with "Reminder days are Monday to Friday."; saved days unchanged.                                                                                                                                                                   | High     |
| S8   | FM        | After `demo:reset` (section 3): Batches → Recent days, and Attendance on last Saturday (2026-10-31) and Sunday. Also run the read-only query below.                                                                   | No batch or check-in on Saturday or Sunday, and Recent days lists no Saturday (no "missed"); the three queries return 0, 0 and 0 (`demo:reset` puts back one Mon–Fri default schedule).                                                        | High     |
| S9   | Admin     | Settings → **Lunch break**.                                                                                                                                                                                           | The hint reads "The same on every working day." with no "Saturday".                                                                                                                                                                            | Low      |
| S10  | —         | Read-only: `SELECT "shiftStart","shiftEnd","workingDays","effectiveFrom" FROM production_schedules ORDER BY "effectiveFrom";` and `SELECT "reminderDays" FROM inventory_settings;` (before any `demo:reset`).         | The newest row (from 2026-11-03, or after your S3 save) has `{1,2,3,4,5}` and times inside 08:00–17:00; the 2000-01-01 row is still `{1,2,3,4,5,6}` (history kept); reminder days hold no 6 or 7. `npx prisma migrate status` says up to date. | High     |
| S11  | FM        | Batches as the FM on a weekday: today's batches still list (08:00–13:00 with lunch, 13:00–17:00 with the default).                                                                                                    | Unchanged from before.                                                                                                                                                                                                                         | Medium   |
| A11y | FM, Admin | axe on `/batches/plan`, `/inventory/update`, `/admin/settings` (Lunch break tab).                                                                                                                                     | 0 violations.                                                                                                                                                                                                                                  | Medium   |

S8 query (read-only):

```sql
SELECT count(*) FROM production_check_ins WHERE EXTRACT(ISODOW FROM day) IN (6, 7);
SELECT count(*) FROM batches WHERE "startedAt" IS NOT NULL
  AND EXTRACT(ISODOW FROM (("startedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')) IN (6, 7);
-- startedAt is stored as UTC without a time zone, so it is read as UTC before turning it into
-- Manila time (run 1's query skipped that step and counted two Monday-morning rolls as Sunday).
SELECT count(*) FROM production_schedules WHERE "workingDays" && '{6,7}';
```

### Access checks

| ID  | Role that must NOT have access | URL or action                                      | Expected        |
| --- | ------------------------------ | -------------------------------------------------- | --------------- |
| A1  | Quality Inspector              | `/batches/plan`; `PUT /api/v1/production/schedule` | 403 page; `403` |
| A2  | System Admin                   | `PUT /api/v1/inventory/settings`                   | `403`           |

## 6. Out of scope / known issues

- Phase 30B (`cv/`, `npm run cv:roll-photos`) is merged and passed its own QA; not part of this run.
- Attendance can still be taken on any day, and reports keep Monday-to-Sunday weeks (D-105).
- The plan form's preview shows tomorrow's batch times even when tomorrow is a weekend (a sample of
  the shift; no batches happen that day).
- `batches.spec.ts` fails between 00:00 and 01:00 Manila (known, STATUS).
