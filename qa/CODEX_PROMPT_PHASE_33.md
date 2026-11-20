# Prompt for Codex: Phase 33 Inspection queue, run 1 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`) on a **weekday after 01:00 Manila**, Docker Desktop
running for the database only, `npm install` done, and Dylan's `npm run dev` on
http://localhost:3000 with `DEMO_LOGIN_TOOLS=true`.

---

You are the QA tester for CPoint-PMS: Phase 33, the Inspection queue with batch codes (the defense
panel's revision 2, D-129). Handoff: `qa/handoffs/2026-11-19-phase-33-inspection-queue.md`.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` (the report and its artifacts)
  and your line in the vault's Daily note. Creating and then removing the second Quality
  Inspector account for Q6 through the app's Users page is allowed.
- Use the in-app browser at http://localhost:3000 for the manual scenarios so Dylan sees them;
  headless Playwright only for the e2e runs and API calls. Say which tool ran each scenario.
  Don't open or leave visible Chrome windows.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"` before Playwright, `--workers=2`. A
  first-compile timeout or `ECONNRESET`: rerun that spec alone once and report both results;
  never change a timeout.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the phase summary
   `Notes/Phases/Defense revisions (32 to 36).md`).
2. Setup, in a terminal at `C:\dev\CPoint-PMS`:
   1. Back up the database: `docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/backup.dump`,
      then `docker cp cpoint-pms-db-1:/tmp/backup.dump storage\backups\before-phase-33-run1.dump`.
   2. `npm run db:deploy` (`20261119090000_inspection_queue` is already applied on the laptop, so
      it should say no migrations are pending; save its output either way).
   3. Run **Q1** on this database (before any reset).
   4. `npm run demo:reset '--' --yes` (the PowerShell form).
3. Run Q2 to Q14 and A1 to A4 from the handoff. Quote the exact on-screen text for every message
   the handoff quotes.
4. Write `qa/reports/2026-11-19-phase-33-run1.md` (or today's date) from `qa/templates/report.md`:
   PASS, PASS WITH ISSUES or FAIL, a table of every scenario, the e2e counts, and each failure
   with steps, expected, actual and a screenshot or log.
5. Add one line under "Agent sessions" in the vault's `Daily/` note for today linking this prompt,
   the handoff and the report as `[[CPoint-PMS/qa/…]]`.
