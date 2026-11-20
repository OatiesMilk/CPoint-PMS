# Prompt for Codex: Phase 33 Inspection queue, run 2 (paste everything below the line)

Before pasting, **Dylan** (PowerShell, laptop, in `C:\dev\CPoint-PMS`):

1. Stop the old Docker app that holds port 3000 (built before Phases 32 and 33): `docker compose stop app`.
   The database container keeps running.
2. Stop the other project's Vite server on port 3000 (`Supply-Chain`), and the CPoint dev server
   started this morning on port 3001 (close its terminal, or `taskkill /PID 26888 /F`).
3. Start a fresh `npm run dev` with `DEMO_LOGIN_TOOLS=true`. It must print
   `Local: http://localhost:3000`.

Run on a weekday after 01:00 Manila.

---

You are the QA tester for CPoint-PMS: Phase 33, the Inspection queue with batch codes (D-129),
**run 2**. Handoff: `qa/handoffs/2026-11-19-phase-33-inspection-queue.md`. Run 1:
`qa/reports/2026-11-19-phase-33-run1.md`.

## Why run 2

Run 1 tested the wrong app. Port 3000 was served by the old Docker container `cpoint-pms-app-1`
(built 45 hours earlier, before Phases 32 and 33) and another project's Vite server. The CPoint
dev server on 3001 had been started before the Phase 33 schema was generated, so its in-memory
database client had no `productionBatch` ("Cannot read properties of undefined (reading
'findMany')"). Claude found no code fault in Q2 to Q14 or A1 to A4. One real issue was fixed:
`demo:reset` after the e2e suite failed on the 5 s transaction limit inside Add rolls, which now
has 30 s. `npm run check` passed (822 unit tests).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` (the report and its artifacts)
  and your line in the vault's Daily note.
- **You may create the second Quality Inspector account for Q6** in the app (System Admin → Users
  → Add user, role Quality Inspector, e.g. "QA Inspector 2", `inspector2@cpoint.local`), and you
  deactivate it after Q6. This is test data, not a config change.
- In-app browser at http://localhost:3000 for the manual scenarios; headless Playwright only for
  the e2e runs and API calls. Don't open visible Chrome windows.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"`, `--workers=2`. A first-compile timeout or
  `ECONNRESET`: rerun that spec alone once and report both; never change a timeout.
- Ignore the dev overlay's "Encountered a script tag while rendering React component" at
  `src/app/layout.tsx`. It has been there since Phase 0 (the theme script) and doesn't stop pages.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`,
   `Notes/Phases/Defense revisions (32 to 36).md`).
2. **Pre-flight (stop and report BLOCKED if any fails):**
   - `Get-NetTCPConnection -State Listen -LocalPort 3000` → the owning process's command line is
     `C:\dev\CPoint-PMS\node_modules\next\...` (not Docker, not Vite).
   - Sign in as the QI at http://localhost:3000. `/batches` shows the **Queue** and **Today** tabs.
     `GET /api/v1/production/batches` returns 200.
3. **Q1 on the pre-reset data from run 1:**
   1. Back up the current database to `storage\backups\before-phase-33-run2.dump` (as in run 1).
   2. Restore run 1's backup: `docker cp storage\backups\before-phase-33-run1.dump cpoint-pms-db-1:/tmp/run1.dump`,
      then `docker exec cpoint-pms-db-1 pg_restore -U cpoint -d cpoint_pms --clean --if-exists /tmp/run1.dump`.
   3. `npm run db:deploy` (expect no pending migrations).
   4. Run Q1 from the handoff: the counts before, open `/batches` once as the QI, then the counts
      after. Also record `select count(*) from production_batches where status='VOID' and "voidReason"='Not inspected, from before the queue'`.
4. `npm run demo:reset '--' --yes`, then run **Q2 to Q11, Q13, Q14 and A1 to A4** from the
   handoff. Q12 is not applicable unless Q1 finds a roll with a `formerCode`.
5. After the e2e suite, run `npm run demo:reset '--' --yes` once more and record whether it
   finishes (run 1's two attempts hit the 5 s limit).
6. Write `qa/reports/2026-11-19-phase-33-run2.md` (or today's date) from `qa/templates/report.md`,
   with PASS, PASS WITH ISSUES or FAIL, a table of every scenario, the pre-flight result, the e2e
   counts, and each failure with steps, expected, actual and evidence.
7. Add one line under "Agent sessions" in today's vault `Daily/` note linking this prompt, the
   handoff and the report as `[[CPoint-PMS/qa/…]]`.
