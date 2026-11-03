# Prompt for Codex: Materials by week of the month (D-109) (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at 2e63908, with D-107
and D-108), Docker Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. D-109 changes Reports → Materials: weeks of the month (days
1–7, 8–14 … from the 1st), Year, Month and Week dropdowns, a Find material box, and a CSV that
follows them. The handoff is `qa/handoffs/2026-11-02-materials-weeks.md`. Read it first: S1 to
S11 and A1.

**Run 3:** do only §8 of the handoff (R4) and save the report as
`qa/reports/2026-11-02-materials-weeks-run3.md`. Put back any schedule, lunch or quota rows the
test adds, as in run 2.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/`.
- Do the browser scenarios in **your in-app browser** so Dylan can watch them live, at the
  `npm run dev` URL (http://localhost:3000, or the port it printed). Playwright's own Chromium stays
  headless; don't open visible Chrome windows.

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-02-materials-weeks/`.
2. The Docker demo app is stopped on purpose (Dylan, 2 Nov): don't start it. Keep only the
   database container up (`npm run db:up`). If `npm run dev` isn't already running, start it and
   note its URL. Walk S1 to S11 and A1 in your in-app browser at that URL (axe with every rule and
   impact).
3. E2E against the same dev server, in PowerShell:
   `$env:E2E_BASE_URL="http://localhost:3000"` (the dev port), then
   `npx playwright test tests/e2e/inventory.spec.ts`, then the full suite `npm run test:e2e`. Put
   back any schedule, lunch or quota the tests changed. The dev server compiles each page on first
   visit and closes idle connections after 5 s: if a test fails on a first-compile timeout or
   `ECONNRESET`, rerun that spec alone once and report both results.

## Write the report

Save it as `qa/reports/2026-11-02-materials-weeks-run1.md` (or the date you run it), using
`qa/templates/report.md`. **PASS** only if every scenario passed and e2e has 0 failures (skips with
a reason are fine). For any FAIL: steps, what you saw against what was expected, a screenshot, file
and line if you can tell. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_MATERIALS_WEEKS]]` and
the report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
