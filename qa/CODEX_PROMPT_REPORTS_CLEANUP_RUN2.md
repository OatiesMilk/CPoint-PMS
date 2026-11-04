# Prompt for Codex: Reports clean-up and reports by roll, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on c8c68dc), Docker Desktop
running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 (`qa/reports/2026-11-04-reports-cleanup-run1.md`)
failed on three points, now handled:

- **F1:** the handoff was wrong. Batches' Recent days leaves today out, so S15 now adds Today's
  finished pairs when the range ends today (`qa/handoffs/2026-11-04-reports-cleanup.md`, S15).
- **F2:** `tests/e2e/reports.spec.ts` now looks for the removed card's exact title, not any text
  that contains "Rejected sections" (the claim sheet's help text still does).
- **F3:** the smoke test's 30 s deadline in the full suite only (it passed in the targeted run).
  No change; rerun the spec alone if it happens again.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Browser checks in your in-app browser at the `npm run dev` URL.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-04-reports-cleanup-run2/`. Start the database
   container and `npm run dev` as in run 1; `$env:E2E_BASE_URL="http://localhost:3000"`.
2. **R1 (F1):** redo S15 with the corrected expectation: Pairs finished on Operations (last 14
   days) = the sum of Recent days on Batches + Today's finished pairs.
3. **R2 (F2):** `npx playwright test tests/e2e/reports.spec.ts` passes.
4. Run the targeted specs:
   `npx playwright test tests/e2e/rolls.spec.ts tests/e2e/reports.spec.ts tests/e2e/supplier-quality.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts tests/e2e/admin.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun that
   spec alone once and report both results.
5. Ledger check (should be 0):
   `select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`

## Write the report

Save `qa/reports/2026-11-04-reports-cleanup-run2.md` from `qa/templates/report.md`. **PASS** if
R1 and R2 pass, every e2e failure is a timeout that passed alone, and the ledger is 0. Add one line
under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`) linking
`[[CPoint-PMS/qa/CODEX_PROMPT_REPORTS_CLEANUP_RUN2]]` and the report. Reply with the verdict, the
e2e counts (passed, failed, skipped) and the report path.
