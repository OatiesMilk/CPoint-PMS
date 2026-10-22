# Prompt for Codex: Phase 23 QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 23, **production
progression in place of stage monitoring**, plus a follow-up (D-088), and has not opened any of it
in a browser. Phase 23 adds:

- **Production → Production** (`/production`): today's check-ins (12:00, 16:00 and 17:00 by
  default), today against the daily quota per shoe type, and the last 14 working days with a
  chart and one sentence for each short day;
- **Enter count** and **Correct** for the Quality Inspector; the Floor Manager can do the same
  **only on a day attendance shows no Quality Inspector present** (D-088);
- **Schedule and quota** (`/production/plan`) for the Floor Manager, with a quota suggestion;
- batches as leather rolls: **Start roll**, **Finish roll** (FM and QI), no stage moves;
- the FM home's **Today's production** card (replaces Batches by stage), the QI home's **Next
  check-in** card;
- Reports → Operations: a Production section, new KPI tiles, `production.csv` in place of
  `stages.csv`.

## Rules

- **Do not modify** application code, tests, config, migrations, `package.json` or `.env`. You may
  only create files under `qa/reports/`.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Leave `SEED_DEMO_USERS` and `SEED_DEMO_WEEK` in `.env` as they are. The demo-data scenarios use
  a throwaway Docker stack instead (step 6).
- **Never run `npm run demo:reset` against the dev database** and never `docker compose down -v`
  on the `cpoint-pms` project. Use `docker compose stop` for it.
- Leave anything on port 3000 that isn't CPoint-PMS alone (start this app with `PORT=3001` if
  needed).
- **Put back any data you change on the dev database.** Before you start, save the ids in each of
  these tables (run each with `docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "…"`):
  `production_check_ins`, `daily_quotas`, `production_schedules`, and the days in
  `attendance_days`. At the end, delete only rows that weren't in those lists (for attendance,
  marks first: `attendance_marks` where `"attendanceDayId"` is a new day, then the day). Batches
  you create or finish can stay. Say in the report what you removed.
- Check-ins only open at their scheduled time. Where a scenario needs a check-in that is due, use
  the **test schedule** SQL in the handoff's section 3 (hourly, 00:00 to 23:59, today only) and
  delete it afterwards. Run after 01:00 Manila time.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and
   `qa/handoffs/2026-10-21-phase-23-production-progression.md` (including the 2026-10-22
   follow-up note and scenarios C1 to C4).
2. Set up, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-22-phase-23-production-progression/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

   `db:deploy` should report nothing pending (`production_progression` is already applied).
   Starting the app once creates the default schedule (bootstrap).

3. Save the id lists (see Rules).
4. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. It includes the new
   `production.spec.ts` and updated `batches`, `outcomes`, `reports`, `smoke` and `auth` specs.
   `production.spec.ts` and `attendance.spec.ts` both change today's attendance, so if either
   fails, re-run those two files alone with `--workers=1` and save that as `e2e-rerun.log`.
5. **On the dev database** (`npm run start`, or `npm run dev`): run P2, P3 to P8, P10 to P20,
   C1 to C4, R1 to R7 and the access checks A1 to A7, with the test schedule in place for the
   check-in ones. Take a screenshot for each High scenario, the late state (P20) and the covering
   note (C2).
6. **The demo-data scenarios in a throwaway stack**, never the dev database: P1, P9, P21, R8, R9,
   O1 to O4 and U1.

   ```bash
   # PowerShell, in C:\dev\CPoint-PMS
   $env:DB_PORT="5434"; $env:APP_PORT="3002"; $env:SEED_DEMO_USERS="true"; $env:SEED_DEMO_WEEK="true"
   docker compose -p cpoint-qa up --build -d
   ```

   Wait about a minute for the demo week, then use `http://localhost:3002`. Afterwards remove the
   stack and clear the variables:

   ```bash
   docker compose -p cpoint-qa down -v
   Remove-Item Env:DB_PORT, Env:APP_PORT, Env:SEED_DEMO_USERS, Env:SEED_DEMO_WEEK
   ```

7. Put the dev database back (see Rules) and delete the test schedule.

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you actually saw.
- **For any FAIL:** the steps, the exact message or error, a screenshot, whether the app or the
  test is wrong, and the smallest fix naming the file and line.
- The e2e passed and failed counts, and for each failing test its title, the failing line and the
  error.
- Anywhere a user can see a per-person production or attendance figure (pairs, absences or a
  ranking tied to a name), with its page and a screenshot. There should be none; only who entered
  or corrected a check-in is named.
- Anything left of stage monitoring (Batches by stage, Move to …, Time in each stage, Stages CSV).

## Write the report

Save it as `qa/reports/2026-10-22-phase-23-production-progression.md`, using
`qa/templates/report.md`. The verdict is **PASS** only if `db:deploy` and the build pass, the e2e
suite has no failure (a failure that passes in `e2e-rerun.log` counts as a test-isolation note,
not a failure), and every High scenario passed. BLOCKED scenarios don't fail the run, but list
them in a closing section headed **"Needs Dylan"**.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the
report path.
