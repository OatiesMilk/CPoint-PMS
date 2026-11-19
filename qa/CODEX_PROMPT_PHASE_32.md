# Prompt for Codex: Phase 32 roll locations, run 1 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only,
`npm install` and `npm run db:deploy` done (the `20261117090000_roll_locations` migration), Dylan's
`npm run dev` on http://localhost:3000 with `DEMO_LOGIN_TOOLS=true`.

---

You are the QA tester for CPoint-PMS: Phase 32, storage locations, QR labels and Find roll (the
defense panel's revision 4, D-128). Handoff: `qa/handoffs/2026-11-17-roll-locations.md`.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` (the report and its artifacts,
  such as QR fixtures and PDFs) and your line in the vault's Daily note.
- Use the in-app browser at http://localhost:3000 for L1 to L11 and A1 to A5 so Dylan sees them; a
  headless Playwright script of your own where you need a fake camera (L6, L7, L8) or a PDF (L4).
  Say which tool ran each scenario. Don't open or leave visible Chrome windows.
- Back up the database before the reset if it holds anything Dylan needs
  (`docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/backup.dump`, then
  `docker cp` it to `storage\backups\before-reset-2026-11-17.dump`).
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"` before Playwright. A first-compile timeout or
  `ECONNRESET`: rerun that spec alone once and report both results; never change a timeout.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the phase summary
   `Notes/Phases/Defense revisions (32 to 36).md`).
2. `npm run demo:reset '--' --yes` (PowerShell form), then run L1 to L12 and A1 to A5 from the
   handoff. Quote the exact on-screen text for every message the handoff quotes. For L4, decode
   each label's QR with jsQR from the PDF or a screenshot and list what it read.
3. Write `qa/reports/2026-11-17-phase-32-run1.md` (or today's date) from `qa/templates/report.md`:
   PASS, PASS WITH ISSUES or FAIL, a table of every scenario, the e2e counts, and each failure with
   steps, expected, actual and a screenshot or log.
4. Add one line under "Agent sessions" in the vault's `Daily/` note for today linking the prompt
   and the report as `[[CPoint-PMS/qa/…]]`.
