# Prompt for Codex: Phase 28 QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 28, **each role sees
only its modules, and the demo sign-in tools** (D-100, D-101), and has not opened it in a browser.
Check that every role's sidebar and home match the table in the handoff exactly, that every other
page is refused, that the removed pages are gone, and that the demo tools appear and work only
with `DEMO_LOGIN_TOOLS=true`.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Leave `DEMO_LOGIN_TOOLS` off in `.env`. **Never press Reset demo data or call
  `/api/v1/demo/reset` against the dev database**; the demo-tool scenarios run in a throwaway
  Docker stack (step 6).
- Never `docker compose down -v` on the `cpoint-pms` project. Leave anything on port 3000 that
  isn't CPoint-PMS alone (`PORT=3001`).
- Browser checks stay headless (no visible Chrome windows).

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and
   `qa/handoffs/2026-10-25-phase-28-roles-and-demo-tools.md`.
2. Set up and save each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-25-phase-28/`:

   ```bash
   npm run db:up
   npx prisma migrate status
   npm run build
   ```

   No migration is pending (Phase 28 has none).

3. Run the full e2e suite once (`npm run test:e2e`, flag off) and save it as `e2e.log`. The two
   "with the flag on" demo tests skip here. If a test fails, re-run that file alone with
   `--workers=1` and save it as `e2e-rerun.log`.
4. **On the dev database** (`npm run start`): run S1 to S14 and A1 to A5 in the handoff's order.
   S1 and S2 also at 390 × 844. Take a screenshot of each role's sidebar and home, and run axe
   (WCAG 2.1 A/AA) on `/login`, the FM home and the Admin home.
5. Save the HTTP status of every URL in A1 to A5 and S11 to S14 in `access.txt` (role, URL,
   status).
6. **The demo tools in a throwaway stack**, never the dev database: D1 to D6.

   ```powershell
   # PowerShell, in C:\dev\CPoint-PMS
   $env:DB_PORT="5434"; $env:APP_PORT="3002"; $env:SEED_DEMO_USERS="true"; $env:SEED_DEMO_WEEK="true"; $env:DEMO_LOGIN_TOOLS="true"
   docker compose -p cpoint-qa up --build -d
   ```

   Wait about a minute for the demo week, then use `http://localhost:3002` for D1 to D5. Also run
   the e2e demo tests against it with the flag on:

   ```powershell
   $env:E2E_BASE_URL="http://localhost:3002"
   npx playwright test tests/e2e/auth.spec.ts -g "demo tools"
   ```

   (The stack's `DEMO_USER_PASSWORD` is the one from `.env`.) Save it as `e2e-demo.log`. For D6,
   set `$env:SEED_DEMO_USERS="false"` and run `docker compose -p cpoint-qa up -d` again. Then
   remove the stack and the variables:

   ```powershell
   docker compose -p cpoint-qa down -v
   Remove-Item Env:DB_PORT, Env:APP_PORT, Env:SEED_DEMO_USERS, Env:SEED_DEMO_WEEK, Env:DEMO_LOGIN_TOOLS, Env:E2E_BASE_URL
   ```

7. Put back anything you changed on the dev database (nothing should be needed: the dev scenarios
   only read).

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you saw.
- **For any FAIL:** the steps, the exact message, a screenshot, whether the app or the test is
  wrong, and the file and line you suspect. Don't fix it; Claude does.
- The e2e passed, failed and skipped counts (`e2e.log`, `e2e-demo.log`), and for each failing test
  its title, the failing line and the error.
- Every axe result, and `access.txt`.

## Write the report

Save it as `qa/reports/2026-10-25-phase-28-roles-and-demo-tools.md`, using
`qa/templates/report.md`. The verdict is **PASS** only if the build passes, the e2e suites have no
failure (one that passes in `e2e-rerun.log` counts as a test-isolation note), axe finds no serious
or critical violation, and every High scenario passed. List BLOCKED scenarios under **"Needs
Dylan"**.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-25.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_28]]` and the report.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the report
path.
