# Prompt for Codex: Phase 24 QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 24, **remove Material
Requests and Procurement** (D-091), and has not opened it in a browser. Nothing new was added.
Check that the module is gone everywhere and that what was around it still works:

- no Procurement or Material requests in any role's sidebar; `/procurement` and
  `/api/v1/procurement/**` answer 404;
- the Floor Manager home without the Pending requests card; Inventory without the Requested badge
  or Request link; Reports → Operations without a Purchasing section or request attention items;
  `stock.csv` without "Open request";
- a new Shoe Constructor home: the Capture card when allowed to capture, otherwise "Ask the System
  Admin for camera access.";
- Admin → Users without the leather-roll switch;
- migration `drop_procurement`, and the demo week and `demo:reset` without requests.

## Rules

- **Test and report only (D-092).** Do not modify application code, tests, config, migrations,
  `package.json` or `.env`. You may only create files under `qa/reports/`, and add your line to
  the vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Leave `SEED_DEMO_USERS` and `SEED_DEMO_WEEK` in `.env` as they are. The demo-data scenarios use
  a throwaway Docker stack instead (step 6).
- **Never run `npm run demo:reset` against the dev database** and never `docker compose down -v`
  on the `cpoint-pms` project. Use `docker compose stop` for it.
- Leave anything on port 3000 that isn't CPoint-PMS alone (start this app with `PORT=3001` if
  needed).
- **Put back what you change on the dev database:** the demo constructor's camera switch (S5, S6)
  and any user name you edit (S10). Say in the report what you put back.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and
   `qa/handoffs/2026-10-23-phase-24-remove-procurement.md`.
2. Set up, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-23-phase-24-remove-procurement/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run db:generate
   npm run build
   ```

   `db:deploy` should report nothing pending (`drop_procurement` was applied after a backup).
   Also save the output of:

   ```bash
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "\dt purchase*"
   ```

   It should find no relations.

3. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. If a test fails,
   re-run that file alone with `--workers=1` and save that as `e2e-rerun.log`.
4. **On the dev database** (`npm run start`): run S1 to S11 and the access checks A1 to A4. Take a
   screenshot for each High scenario and for A1.
5. Search the running app for leftovers: on every page each role can open, look for the words
   "Procurement", "Material request", "Purchase", "Requested" (as a stock badge) and "leather roll"
   (as a request permission). Report any you find with the page and a screenshot.
6. **The demo-data scenarios in a throwaway stack**, never the dev database: U1 to U3.

   ```powershell
   # PowerShell, in C:\dev\CPoint-PMS
   $env:DB_PORT="5434"; $env:APP_PORT="3002"; $env:SEED_DEMO_USERS="true"; $env:SEED_DEMO_WEEK="true"
   docker compose -p cpoint-qa up --build -d
   ```

   Wait about a minute for the demo week, then use `http://localhost:3002` for U1. For U2, the app
   container refuses `demo:reset` (`NODE_ENV=production`), so run it **from the host against the
   throwaway stack only**: in the same PowerShell window set `$env:DATABASE_URL` to the
   `DATABASE_URL` from `.env` with the port changed from 5432 to **5434** (don't print it), and
   `$env:UPLOADS_DIR` to a new empty folder, `"$env:TEMP\cpoint-qa-uploads"`. Check both before
   you run anything: `$env:DATABASE_URL -match ":5434/"` must print `True`. Then:

   ```powershell
   npm run demo:reset
   npm run demo:reset -- --yes
   ```

   Then U3 at `http://localhost:3002`. Afterwards remove the stack, the folder and the variables:

   ```powershell
   docker compose -p cpoint-qa down -v
   Remove-Item -Recurse -Force "$env:TEMP\cpoint-qa-uploads"
   Remove-Item Env:DB_PORT, Env:APP_PORT, Env:SEED_DEMO_USERS, Env:SEED_DEMO_WEEK, Env:DATABASE_URL, Env:UPLOADS_DIR
   ```

7. Put the dev database back (see Rules).

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you actually saw.
- **For any FAIL:** the steps, the exact message or error, a screenshot, whether the app or the
  test is wrong, and the file and line you suspect. Don't fix it; Claude does.
- The e2e passed and failed counts, and for each failing test its title, the failing line and the
  error.
- Every leftover from step 5.

## Write the report

Save it as `qa/reports/2026-10-23-phase-24-remove-procurement.md`, using `qa/templates/report.md`.
The verdict is **PASS** only if `db:deploy` and the build pass, no purchase table is left, the e2e
suite has no failure (a failure that passes in `e2e-rerun.log` counts as a test-isolation note,
not a failure), every High scenario passed and step 5 found nothing. BLOCKED scenarios don't fail
the run, but list them in a closing section headed **"Needs Dylan"**.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-23.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_24]]` and the report.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the
report path.
