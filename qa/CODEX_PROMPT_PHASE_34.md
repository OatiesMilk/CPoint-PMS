# Prompt for Codex: Phase 34 final defects, repairs and work in progress, run 1 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`) on a **weekday after 01:00 Manila**, Docker Desktop
running for the database only, `npm install` done.

---

You are the QA tester for CPoint-PMS: Phase 34, final-product defects, repairs and the work in
progress board (the defense panel's revision 1, D-130). Handoff:
`qa/handoffs/2026-11-20-phase-34-defects-and-repairs.md`.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` (the report and its artifacts)
  and your line in the vault's Daily note. Creating and removing a test constructor (and switching
  its camera access) through the app's Users page for C3 is allowed.
- Use the in-app browser at http://localhost:3000 for the manual scenarios so Dylan sees them;
  headless Playwright only for the e2e runs and API calls. Say which tool ran each scenario.
  Don't open or leave visible Chrome windows.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"` before Playwright, `--workers=2`. A
  first-compile timeout or `ECONNRESET`: rerun that spec alone once and report both results;
  never change a timeout.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the phase summary
   `Notes/Phases/Defense revisions (32 to 36).md`).
2. Setup, in a PowerShell terminal at `C:\dev\CPoint-PMS`, in this order:
   1. **`docker compose stop app`**: the old Docker app container holds port 3000 and was built
      before Phase 34, so stop it first. Also stop any other project's server on port 3000 (for
      example a Vite server) and any older `npm run dev` of this project.
   2. `npm run db:up`
   3. Back up the database: `docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/backup.dump`,
      then `docker cp cpoint-pms-db-1:/tmp/backup.dump storage\backups\before-phase-34-run1.dump`.
   4. `npm run db:deploy`. `20261120120000_final_defects_and_repairs` may already be applied on the
      laptop; either way save the output.
   5. `npm run dev` (a dev server started before the schema change keeps the old database client in
      memory, so start it now) and check `http://localhost:3000/api/health`.
   6. Run **M2** now, on this database, before any reset.
   7. `npm run demo:reset '--' --yes` (the PowerShell form; 2 to 3 minutes).
3. Run M1, M3, F1 to F10, R1 to R8, P1 to P8, W1 to W5, C1 to C7, S1, D1 and A1 to A7 from the
   handoff, then E1: the two new specs (`tests/e2e/final-defects.spec.ts`,
   `tests/e2e/stage-wip.spec.ts`) and the full suite with `--workers=2`. Quote the exact on-screen
   text for every message the handoff quotes. A weekend or a day with no batch waiting: use the demo
   clock (Demo mode band → Change time) to a weekday at 17:05, or say what blocked the scenario.
4. Write `qa/reports/2026-11-20-phase-34-run1.md` (or today's date) from `qa/templates/report.md`,
   even on a full pass: PASS, PASS WITH ISSUES or FAIL, a table of every scenario, the e2e counts, and
   each failure with steps, expected, actual and a screenshot or log. Change no code: anything that
   fails goes in the report for Claude to fix.
5. Add one line under "Agent sessions" in the vault's `Daily/` note for today linking this prompt,
   the handoff and the report as `[[CPoint-PMS/qa/…]]`.
