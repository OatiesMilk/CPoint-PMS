# Prompt for Codex: Phase 25 QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running, **after Dylan has backed up
the dev database and applied `pass_or_reject`** (`npm run db:deploy`). Copy from the line down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 25, **Pass or Reject**
(D-093, D-094), and has not opened it in a browser. Check that:

- every section is Pass or Reject, decided by the camera at once and final, everywhere a verdict
  shows (badges, filters, a section's page, Capture, Floor view, homes, reports, CSVs);
- each defect type's "When found" is Usable or Not accepted (a required choice); Thresholds has only
  "A defect counts as found at" and the early-model notice;
- an unknown class rejects its section and shows under Settings → Unknown classes and on the Admin
  home;
- the Review queue, the Repair Station and Salvage are gone: no nav item, and their pages and APIs
  answer 404;
- the migration converted the dev database (no Fixable or Needs review left), and the demo week
  and `demo:reset` follow the new rule.

## Rules

- **Test and report only (D-092).** Do not modify application code, tests, config, migrations,
  `package.json` or `.env`. You may only create files under `qa/reports/`, and add your line to
  the vault's Daily note.
- Read passwords and tokens from `.env`. Never print them or put them in a report or log.
- **Never run `npm run db:migrate` or `npm run db:deploy` with something pending on the dev
  database**: if `pass_or_reject` is still pending in step 2, stop and report BLOCKED ("Dylan backs
  up and applies the migration first").
- Leave `SEED_DEMO_USERS` and `SEED_DEMO_WEEK` in `.env` as they are. The demo-data scenarios use a
  throwaway Docker stack (step 7).
- **Never run `npm run demo:reset` against the dev database** and never `docker compose down -v`
  on the `cpoint-pms` project. Use `docker compose stop` for it.
- Leave anything on port 3000 that isn't CPoint-PMS alone (start this app with `PORT=3001` if
  needed).
- **Put back what you change on the dev database:** found-at back to 50 (S8); the defect type you
  add in S6 and S7 turned off (types can't be deleted); the roll you start in S4 finished. Say in
  the report what you put back.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and
   `qa/handoffs/2026-10-24-phase-25-pass-or-reject.md`.
2. Set up, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-24-phase-25-pass-or-reject/`:

   ```bash
   npm run db:up
   npx prisma migrate status
   ```

   It must say the database schema is up to date. If `pass_or_reject` is pending, stop (Rules).
   Otherwise:

   ```bash
   npm run db:generate
   npm run build
   ```

   Also save the output of:

   ```bash
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "SELECT \"aiVerdict\"::text, \"finalVerdict\"::text, count(*) FROM scans GROUP BY 1, 2 ORDER BY 1, 2"
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "SELECT key, outcome::text, \"isActive\" FROM defect_types ORDER BY \"sortOrder\""
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "\dt (rework|salvage)*"
   ```

   Only PASS and REJECT, every type has an outcome, and no rework or salvage table.

3. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. If a test fails,
   re-run that file alone with `--workers=1` and save that as `e2e-rerun.log`.
4. **On the dev database** (`npm run start`): run S1 to S17 and the access checks A1 to A5. Take a
   screenshot for each High scenario and for A1. For S4 use the simulator (handoff §3).
5. Search the running app for leftovers: on every page each role can open, look for "Fixable",
   "Needs review", "Review queue", "Repair Station", "Rework", "Salvage" (as a page or a status;
   "for salvage" next to Reject is expected), "Override" and an orange or blue verdict. Report each
   with the page and a screenshot.
6. Check both CSV sets (S14) and attach them to the artifacts folder.
7. **The demo-data scenarios in a throwaway stack**, never the dev database: U1 and U2.

   ```powershell
   # PowerShell, in C:\dev\CPoint-PMS
   $env:DB_PORT="5434"; $env:APP_PORT="3002"; $env:SEED_DEMO_USERS="true"; $env:SEED_DEMO_WEEK="true"
   docker compose -p cpoint-qa up --build -d
   ```

   Wait about a minute for the demo week, then use `http://localhost:3002` for U1. For U2 the app
   container refuses `demo:reset` (`NODE_ENV=production`), so run it **from the host against the
   throwaway stack only**: in the same PowerShell window set `$env:DATABASE_URL` to the
   `DATABASE_URL` from `.env` with the port changed from 5432 to **5434** (don't print it), and
   `$env:UPLOADS_DIR` to a new empty folder, `"$env:TEMP\cpoint-qa-uploads"`. Check before you run
   anything: `$env:DATABASE_URL -match ":5434/"` must print `True`. Then:

   ```powershell
   npm run demo:reset
   npm run demo:reset -- --yes
   ```

   Afterwards remove the stack, the folder and the variables:

   ```powershell
   docker compose -p cpoint-qa down -v
   Remove-Item -Recurse -Force "$env:TEMP\cpoint-qa-uploads"
   Remove-Item Env:DB_PORT, Env:APP_PORT, Env:SEED_DEMO_USERS, Env:SEED_DEMO_WEEK, Env:DATABASE_URL, Env:UPLOADS_DIR
   ```

8. Put the dev database back (see Rules).

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you actually saw.
- **For any FAIL:** the steps, the exact message or error, a screenshot, whether the app or the
  test is wrong, and the file and line you suspect. Don't fix it; Claude does.
- The e2e passed and failed counts, and for each failing test its title, the failing line and the
  error.
- The three database queries from step 2 and every leftover from step 5.

## Write the report

Save it as `qa/reports/2026-10-24-phase-25-pass-or-reject.md`, using `qa/templates/report.md`. The
verdict is **PASS** only if the migration status and the build pass, the queries in step 2 show
only Pass and Reject and no removed table, the e2e suite has no failure (a failure that passes in
`e2e-rerun.log` counts as a test-isolation note, not a failure), every High scenario passed and
step 5 found nothing. BLOCKED scenarios don't fail the run, but list them in a closing section
headed **"Needs Dylan"**.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-24.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_25]]` and the report.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the
report path.
