# Prompt for Codex: `batches.spec.ts` at any hour (fix), run 1 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only,
`npm install` done. Any day works; B4 and B5 only run if the session is in that Manila hour.

---

You are the QA tester for CPoint-PMS: a test-only fix to `tests/e2e/batches.spec.ts` (the fixture
plan in `beforeAll`), so the spec passes between 00:00 and 01:00 Manila too. Handoff:
`qa/handoffs/2026-11-24-batches-spec-midnight.md`. Plan:
`docs/prompts/plans/fix-batches-spec-midnight-plan.md`.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` and your line in the vault's Daily
  note. Don't change the demo clock or the code to force B4 or B5; mark them **not run (outside the
  window)** instead.
- Use the in-app browser at http://localhost:3000 where a scenario needs one; Playwright stays headless.
  Don't open or leave visible Chrome windows.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"` before Playwright. A first-compile timeout or
  `ECONNRESET`: rerun that spec alone once and report both results; never change a timeout.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note).
2. Setup in a PowerShell terminal at `C:\dev\CPoint-PMS`: stop any other server on port 3000 and any
   older `npm run dev`; `npm run db:up`, `npm run db:deploy`, `npm run dev`; check
   `http://localhost:3000/api/health`. Demo clock on Real time. Note the Manila time at the start of
   each run.
3. Run B1 to B7 from the handoff. B3: read today's `day_plans` row while the spec runs (it is removed
   in `afterAll`). B7: the full suite `npm run test:e2e` once.
4. Write `qa/reports/2026-11-24-fix-batches-midnight-run1.md` from `qa/templates/report.md`, even on a
   full pass: PASS, PASS WITH ISSUES or FAIL, a table of every scenario (B4 and B5 marked as run or not
   run with the Manila time), the e2e counts, and each failure with steps, expected, actual and a log.
   Anything that fails goes in the report for Claude to fix.
5. Add one line under "Agent sessions" in the vault's `Daily/2026-11-24.md` linking this prompt and the
   report as `[[CPoint-PMS/qa/…]]`.
