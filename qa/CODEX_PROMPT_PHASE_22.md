# Prompt for Codex: Phase 22 QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 22, **Attendance**, and
has not opened it in a browser. Phase 22 adds:

- **Production → Attendance** (`/attendance`) for the Floor Manager: one day at a time, a Present
  tick per person with a role badge, Find, a role filter, the pager, **Mark everyone present** and
  **Save attendance (N changes)**; today and the past 7 days editable, older days locked;
- the same page read-only for the System Admin; refused for the Quality Inspector and constructors;
- an **Attendance** card on the Floor Manager's home;
- 12 demo Shoe Constructors and a week of attendance in the demo data.

## Rules

- **Do not modify** application code, tests, config, migrations, `package.json` or `.env`. You may
  only create files under `qa/reports/`.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Leave `SEED_DEMO_USERS` and `SEED_DEMO_WEEK` in `.env` as they are (both `false`). Scenarios
  D1 and D2 use a throwaway Docker stack instead (step 6).
- **Never run `npm run demo:reset` against the dev database** and never `docker compose down -v`
  on the `cpoint-pms` project. Use `docker compose stop` for it.
- Leave anything on port 3000 that isn't CPoint-PMS alone (start this app with `PORT=3001` if
  needed).
- Put back any data you change on the dev database. For attendance: before you start, save the
  output of `SELECT day FROM attendance_days ORDER BY day;` (run it with `docker exec
cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "…"`). At the end, delete only the days that
  weren't in that list, marks first:
  `DELETE FROM attendance_marks WHERE "attendanceDayId" IN (SELECT id FROM attendance_days WHERE day NOT IN (…));`
  then the same for `attendance_days`. Say in the report which days you removed.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and `qa/handoffs/2026-10-21-phase-22-attendance.md`.
2. Set up, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-21-phase-22-attendance/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

   `db:deploy` should report nothing pending (the `attendance` migration is already applied).

3. Save the attendance days list (see Rules).
4. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. It includes the new
   `attendance.spec.ts` and the updated nav lists in `auth.spec.ts`.
5. Start the app (`npm run dev`) and run scenarios S1 to S11 and the access checks A1 to A4 from
   the handoff's section 5, in order. Take a screenshot for each High scenario, the locked day
   (S5), the leave prompt (S6) and the stale-save message (S7).
6. **D1 and D2 in a throwaway stack**, never the dev database:

   ```bash
   # PowerShell, in C:\dev\CPoint-PMS
   $env:DB_PORT="5434"; $env:APP_PORT="3002"; $env:SEED_DEMO_USERS="true"; $env:SEED_DEMO_WEEK="true"
   docker compose -p cpoint-qa up --build -d
   ```

   Wait about a minute for the demo week, then run D1 at `http://localhost:3002`.
   For D2, point the reset at the throwaway database **and a scratch uploads folder** (so it never
   clears the dev uploads), and run the dry run first:

   ```bash
   $env:DATABASE_URL="postgresql://cpoint:<POSTGRES_PASSWORD from .env, or cpoint_dev_password>@localhost:5434/cpoint_pms?schema=public"
   $env:UPLOADS_DIR="$env:TEMP\cpoint-qa-uploads"
   npm run demo:reset
   ```

   Only if the dry run's counts match the throwaway stack (about 14 batches, not the dev
   database's), run `npm run demo:reset -- --yes`. If you can't be sure, mark D2 **BLOCKED** and
   say why. Then remove the stack and clear the variables:

   ```bash
   docker compose -p cpoint-qa down -v
   Remove-Item Env:DB_PORT, Env:APP_PORT, Env:SEED_DEMO_USERS, Env:SEED_DEMO_WEEK, Env:DATABASE_URL, Env:UPLOADS_DIR
   ```

7. Put the dev database's attendance back (see Rules).

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you actually saw.
- **For any FAIL:** the steps, the exact message or error, a screenshot, whether the app or the
  test is wrong, and the smallest fix naming the file and line.
- The e2e passed and failed counts, and for each failing test its title, the failing line and the
  error.
- Anywhere a user can see a per-person attendance figure (a history, count, percentage or
  streak), with its page and a screenshot. There should be none.

## Write the report

Save it as `qa/reports/2026-10-21-phase-22-attendance.md`, using `qa/templates/report.md`. The
verdict is **PASS** only if `db:deploy` and the build pass, the e2e suite has no failure, and every
High scenario passed. BLOCKED scenarios don't fail the run, but list them in a closing section
headed **"Needs Dylan"**.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the
report path.
