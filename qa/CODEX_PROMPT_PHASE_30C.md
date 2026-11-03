# Prompt for Codex: Phase 30C, cuts from 3 inches and the return to the supplier (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at 6966fcd), Docker
Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Phase 30C adds the 3-inch line for cuts, a phone calibration
on Capture, each finished roll's defect share against the supplier limit (10%), and the Floor
Manager's Returned to supplier or Keep decision. The handoff is
`qa/handoffs/2026-11-03-phase-30c-cuts-and-returns.md`. Read it first: S1 to S12, A1 and A2.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/`.
- Don't run `npm run demo:reset` and don't change Settings values for good: S2 and S3 only try
  refused values; leave the supplier limit at 10 and Cut at 3 in and 1%.
- Do the browser scenarios in **your in-app browser** so Dylan can watch them live, at the
  `npm run dev` URL (http://localhost:3000, or the port it printed). Playwright's own Chromium stays
  headless; don't open visible Chrome windows.

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-03-phase-30c/`.
2. The Docker demo app is stopped on purpose: don't start it. Keep only the database container up
   (`npm run db:up`), then `npm run db:deploy` (expect "No pending migrations") and
   `npm run db:generate`. If `npm run dev` isn't running, start it and note its URL.
3. In PowerShell set `$env:E2E_BASE_URL="http://localhost:3000"` (the dev port), then run
   `npx playwright test tests/e2e/returns.spec.ts` **first**: it leaves one Kept, one Returned and
   one waiting marked roll for the manual checks. Note their codes.
4. Walk S1 to S12, A1 and A2 in your in-app browser (axe with every rule and impact). S4 and S11
   may be NOT POSSIBLE (no camera; no batch to finish at that hour): say why.
5. Then `npx playwright test tests/e2e/rolls.spec.ts tests/e2e/inventory.spec.ts tests/e2e/capture.spec.ts tests/e2e/admin.spec.ts tests/e2e/supplier-quality.spec.ts`,
   then the full suite `npm run test:e2e`. Put back any schedule, lunch or quota rows the tests
   change. The dev server compiles each page on first visit and closes idle connections after 5 s:
   if a test fails on a first-compile timeout or `ECONNRESET`, rerun that spec alone once and report
   both results.

## Write the report

Save it as `qa/reports/2026-11-03-phase-30c-run1.md` (or the date you run it), using
`qa/templates/report.md`. **PASS** only if every scenario passed (NOT POSSIBLE with a reason is
fine for S4 and S11) and e2e has 0 failures (skips with a reason are fine). For any FAIL: steps, what
you saw against what was expected, a screenshot, file and line if you can tell. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30C]]` and the
report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
