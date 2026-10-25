# Prompt for Codex: Phase 27 QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running, **after Dylan has backed up
the dev database, applied `batches_are_intervals` (`npm.cmd run db:deploy`, `npm.cmd run
db:generate`) and reset the demo week (`npm.cmd run demo:reset -- --yes`)**, and after 01:00
Manila time. Copy from the line down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 27, **batches are the
check-in intervals** (D-097 to D-099), and has not opened it in a browser. Check that:

- the working day is split into batches with lunch left out (08:00–13:00 with lunch 11:00–12:00,
  and 13:00–17:00 by default), and the Floor Manager can choose every 1 to 4 hours or once at the
  end of the day, with one daily quota on passed pairs;
- the System Admin sets the lunch break under Settings → Lunch break, from tomorrow;
- the Quality Inspector, on a phone (390 × 844), gets the on-screen notices and finishes each batch
  with the pairs finished and the pairs that failed inspection, from 10 minutes before its end;
  one finish per batch, and a correction needs a reason;
- the Floor Manager finishes batches only on a day no QI is present (D-088);
- shoe types are gone everywhere, `/production` is 404, and the reports use passed pairs;
- the migration converted the dev database, and the demo week and `demo:reset` produce batches.

## Rules

- **Test and report only (D-092).** Do not modify application code, tests, config, migrations,
  `package.json` or `.env`. You may only create files under `qa/reports/`, and add your line to
  the vault's Daily note.
- Read passwords and tokens from `.env`. Never print them or put them in a report or log.
- **Never run `npm run db:migrate` or `npm run db:deploy` with something pending on the dev
  database**: if `batches_are_intervals` is still pending in step 2, stop and report BLOCKED
  ("Dylan backs up and applies the migration first").
- Leave `SEED_DEMO_USERS` and `SEED_DEMO_WEEK` in `.env` as they are. The demo-data scenarios use a
  throwaway Docker stack (step 7).
- **Never run `npm run demo:reset` against the dev database** and never `docker compose down -v`
  on the `cpoint-pms` project. Use `docker compose stop` for it.
- Leave anything on port 3000 that isn't CPoint-PMS alone (start this app with `PORT=3001` if
  needed).
- **Put back what you change on the dev database** (step 8): the test schedule and "no lunch" rows
  you added, the batches you finished, today's attendance, and the schedule, quota and lunch you
  changed in S3, S5, S6 and S7.
- Don't run the e2e suite while you run the manual scenarios: `batches.spec.ts` adds its own test
  schedule and changes today's attendance.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and
   `qa/handoffs/2026-10-24-phase-27-batches.md`.
2. Set up, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-24-phase-27-batches/`:

   ```bash
   npm run db:up
   npx prisma migrate status
   ```

   It must say the database schema is up to date. If `batches_are_intervals` is pending, stop
   (Rules). Otherwise:

   ```bash
   npm run db:generate
   npm run build
   ```

   Also save the output of:

   ```bash
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "SELECT \"startTime\", \"endTime\", \"effectiveFrom\", \"createdById\" IS NULL AS is_default FROM lunch_breaks ORDER BY \"effectiveFrom\""
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "SELECT pairs, \"suggestedPairs\", \"effectiveFrom\" FROM daily_quotas ORDER BY \"effectiveFrom\""
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "SELECT day, count(*) AS batches, sum(pairs) AS finished, sum(\"failedPairs\") AS failed FROM production_check_ins GROUP BY day ORDER BY day"
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "SELECT \"shiftStart\", \"shiftEnd\", \"intervalMinutes\", \"effectiveFrom\" FROM production_schedules ORDER BY \"effectiveFrom\""
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "SELECT table_name FROM information_schema.tables WHERE table_name IN ('shoe_types','production_counts')"
   ```

   Expected: one lunch row, 11:00 to 12:00, the default; one quota of 128; at most 2 finished
   batches a past day, each day with failed pairs; the default schedule 08:00 to 17:00 every 240
   minutes; no `shoe_types` or `production_counts` table (an empty result).

3. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. If a test fails,
   re-run that file alone with `--workers=1` and save that as `e2e-rerun.log`. Then check that
   `batches.spec.ts` removed its rows: the schedule query of step 2 again shows only the default.
4. **On the dev database** (`npm run start`): run S1 to S19 and the access checks A1 to A6, in the
   handoff's order. S2 and S9 need **no** test schedule; add it (handoff §3) before S8 and remove
   it after S15. Use Playwright with `viewport: { width: 390, height: 844 }` for S8 to S12, and
   Playwright's clock for S9 (handoff §3). Run axe on Batches at 390 × 844 and at 1440 × 900, on
   Plan batches and quota, and on Settings → Lunch break. Take a screenshot for each High
   scenario, plus a phone screenshot of the banner, the bell open, and the Finish batch sheet.
5. Search the running app for leftovers (S19): on every page each role can open, look for "Shoe
   type", "School Shoe" or "Topsider" as a field or column, "Enter count", "check-in" as a button
   or heading, a "Production" page title, and the Settings tab "Shoe types". Report each with the
   page and a screenshot.
6. Download the Production and Operations CSVs (S17) and attach them to the artifacts folder.
7. **The demo-data scenarios in a throwaway stack**, never the dev database: U1 and U2.

   ```powershell
   # PowerShell, in C:\dev\CPoint-PMS
   $env:DB_PORT="5434"; $env:APP_PORT="3002"; $env:SEED_DEMO_USERS="true"; $env:SEED_DEMO_WEEK="true"
   docker compose -p cpoint-qa up --build -d
   ```

   Wait about a minute for the demo week, run step 2's queries against it
   (`docker exec cpoint-qa-db-1 psql …`), then use `http://localhost:3002` for U1. For U2 the app
   container refuses `demo:reset` (`NODE_ENV=production`), so run it **from the host against the
   throwaway stack only**: in the same PowerShell window set `$env:DATABASE_URL` to the
   `DATABASE_URL` from `.env` with the port changed from 5432 to **5434** (don't print it), and
   `$env:UPLOADS_DIR` to a new empty folder, `"$env:TEMP\cpoint-qa-uploads-phase27"`. Check before
   you run anything: `$env:DATABASE_URL -match ":5434/"` must print `True`. Then:

   ```powershell
   npm run demo:reset
   npm.cmd run demo:reset -- --yes
   ```

   Afterwards remove the stack, the folder and the variables:

   ```powershell
   docker compose -p cpoint-qa down -v
   Remove-Item -Recurse -Force "$env:TEMP\cpoint-qa-uploads-phase27"
   Remove-Item Env:DB_PORT, Env:APP_PORT, Env:SEED_DEMO_USERS, Env:SEED_DEMO_WEEK, Env:DATABASE_URL, Env:UPLOADS_DIR
   ```

8. Put the dev database back (Rules): delete the test schedule and "no lunch" rows by their ids,
   the check-ins you saved (`DELETE FROM production_check_ins WHERE "enteredAt" >= '<your start
time>'`), and the schedule, quota and lunch rows you saved
   (`… WHERE "createdAt" >= '<your start time>' AND "createdById" IS NOT NULL` on
   `production_schedules`, `daily_quotas` and `lunch_breaks`); put today's attendance back as you
   found it. Then run step 2's queries once more and save them as `after.txt`.

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you actually saw.
- **For any FAIL:** the steps, the exact message or error, a screenshot, whether the app or the
  test is wrong, and the file and line you suspect. Don't fix it; Claude does.
- The e2e passed and failed counts, and for each failing test its title, the failing line and the
  error.
- The database queries from step 2 (before and after), every axe result from step 4, and every
  leftover from step 5.

## Write the report

Save it as `qa/reports/2026-10-24-phase-27-batches.md`, using `qa/templates/report.md`. The
verdict is **PASS** only if the migration status and the build pass, the queries in step 2 show
what step 2 expects, the e2e suite has no failure (a failure that passes in `e2e-rerun.log` counts
as a test-isolation note, not a failure), axe finds no serious or critical violation, every High
scenario passed and step 5 found nothing. BLOCKED scenarios don't fail the run, but list them in a
closing section headed **"Needs Dylan"**.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-24.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_27]]` and the report.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the
report path.
