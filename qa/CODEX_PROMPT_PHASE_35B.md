# Prompt for Codex: Phase 35B, corrections to past records, run 1 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only,
`npm install` done. Any day works.

---

You are the QA tester for CPoint-PMS: Phase 35B (D-133), the Floor Manager's corrections to past
records: a batch from any past day, a roll's details (the area only before Finish roll) and a
repair's inspection (while the pairs it sent back are still at their stage). No migration. Handoff:
`qa/handoffs/2026-11-21-phase-35b-corrections.md`.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` (the report and its artifacts) and
  your line in the vault's Daily note. These scenarios **write** data (corrections, a repair you
  make); the demo reset at the start and the end puts it back, and you say so in the report.
- Use the in-app browser at http://localhost:3000 (the `npm run dev` port) so Dylan sees the dialogs.
  **Where the in-app browser's fill or click doesn't reach the page** (the fault of the Overview
  clean-up runs 1 and 2: typing in a React form), run that step with a headless Playwright script or
  the e2e spec instead and say so. Don't open or leave visible Chrome windows.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"` before Playwright, `--workers=2`. A first-compile
  timeout or `ECONNRESET`: rerun that spec alone once and report both results; never change a timeout.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note, the
   phase summary `Notes/Phases/Phase 35 - Reports by period and corrections.md`).
2. Setup, in a PowerShell terminal at `C:\dev\CPoint-PMS`:
   1. `docker compose stop app`, and stop any other project's server on port 3000 and any older
      `npm run dev` of this project (the new pages must come from a fresh dev server).
   2. `npm run db:up`, `npm run db:deploy` (no new migration; save the output).
   3. `npm run dev`, then check `http://localhost:3000/api/health`.
   4. `npm run demo:reset '--' --yes` (2 to 3 minutes).
3. Run C1 to C12, A1 to A3 from the handoff. Save a screenshot of the Batch date picker with a past day
   shown, of the Correct dialog for a past batch, of a corrected batch's line, of the Corrected badge in
   Operations, of Edit details (area enabled, then disabled after Finish roll) and of a repair's
   Correct dialog and its locked row into `qa/reports/artifacts/<today>-phase-35b/`. Quote the exact
   on-screen text for every line the handoff quotes. For C6 and C7 say how you made the repair
   (which batch, which repair code, the pairs) so the run can be repeated.
4. Run the e2e (C12): `corrections.spec.ts`, then `inspection-queue`, `final-defects`, `batches`, `rolls`,
   `reports` and `stage-wip`, then the full suite, all with `--workers=2`. Save the counts.
5. Write `qa/reports/<today>-phase-35b-run1.md` from `qa/templates/report.md`, even on a full pass:
   PASS, PASS WITH ISSUES or FAIL, a table of every scenario, the e2e counts, and each failure with
   steps, expected, actual and a screenshot or log. Change no code: anything that fails goes in the
   report for Claude to fix. Say which tool ran each scenario.
6. Finish with `npm run demo:reset '--' --yes` and say so. Add one line under "Agent sessions" in the
   vault's `Daily/` note for today linking this prompt, the handoff and the report as `[[CPoint-PMS/qa/…]]`.
