# Prompt for Codex: Reports clean-up and reports by roll, run 3 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on c8c68dc), Docker Desktop
running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 2 (`qa/reports/2026-11-04-reports-cleanup-run2.md`)
passed R1 and R2 but failed two tests, now fixed in the tests:

- **F1:** `tests/e2e/batches.spec.ts` ran axe while the plan notice was still closing (the page
  behind it was still `aria-hidden`); it now waits for the notice to close first.
- **F2:** the Floor Manager smoke journey scans several pages with axe and ran past 30 s beside
  other specs (10 s alone); it now has 60 s, like the other long smoke journeys.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. In PowerShell pass test paths as plain arguments (no splatting).

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-04-reports-cleanup-run3/`. Start the database
   container and `npm run dev`; `$env:E2E_BASE_URL="http://localhost:3000"`.
2. **R1 (F1):** `npx playwright test tests/e2e/batches.spec.ts` passes (on a weekday; the
   no-plan test skips on a weekend).
3. **R2 (F2):** `npx playwright test tests/e2e/smoke.spec.ts` passes.
4. Targeted:
   `npx playwright test tests/e2e/rolls.spec.ts tests/e2e/reports.spec.ts tests/e2e/supplier-quality.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts tests/e2e/admin.spec.ts tests/e2e/batches.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun that
   spec alone once and report both results.
5. Ledger check (should be 0):
   `select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`

## Write the report

Save `qa/reports/2026-11-04-reports-cleanup-run3.md` from `qa/templates/report.md`. **PASS** if
R1 and R2 pass, every other e2e failure is a timeout that passed alone, and the ledger is 0. Add
one line under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`) linking
`[[CPoint-PMS/qa/CODEX_PROMPT_REPORTS_CLEANUP_RUN3]]` and the report. Reply with the verdict, the
e2e counts (passed, failed, skipped) and the report path.
