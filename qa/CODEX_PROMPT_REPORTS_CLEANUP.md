# Prompt for Codex: Reports clean-up, run 1 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on c8c68dc, Phase 30E-2),
Docker Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. The Floor Manager's reports were simplified (D-116): a roll
over the defect limit is Returned to supplier, Reports → Rolls filters by Not yet scanned /
Scanning passed / Returned to supplier, "for salvage" is gone, and Materials lost the 8-week trend
and Per 100 pairs and gained Returned to supplier per week. Then (D-117) the reports count whole
rolls, Scanning passed or Returned to supplier, instead of sections, and the Rejected sections,
Rolls open and Rolls finished cards are gone. The handoff is
`qa/handoffs/2026-11-04-reports-cleanup.md`. Read it first: S1 to S21, A1 and A2.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/`.
- Don't run `demo:reset`: this is Dylan's own data. There is no migration in this change.
- Do the browser scenarios in **your in-app browser** at the `npm run dev` URL
  (http://localhost:3000, or the port it printed). Playwright's own Chromium stays headless; don't
  open visible Chrome windows.

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-04-reports-cleanup/`.
2. Keep only the database container up (`npm run db:up`), `npm run db:deploy` (for 30E-2's
   migration if not yet applied), `npm run db:generate`, then `npm run dev`; note its URL.
3. In PowerShell set `$env:E2E_BASE_URL="http://localhost:3000"` (the dev port), then run
   `npx playwright test tests/e2e/returns.spec.ts` first (it makes a roll over the limit for S3).
4. Walk S1 to S21 and A1, A2 in your in-app browser (axe with every rule and impact). If a
   scenario can't be done, mark it NOT POSSIBLE and say why.
5. Run `npx playwright test tests/e2e/rolls.spec.ts tests/e2e/reports.spec.ts tests/e2e/supplier-quality.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts tests/e2e/admin.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a first-compile timeout or
   `ECONNRESET`, rerun that spec alone once and report both results.
6. Check the ledger at the end:
   `select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`
   should be 0.

## Write the report

Save it as `qa/reports/2026-11-04-reports-cleanup-run1.md` (or the date you run it), using
`qa/templates/report.md`. **PASS** only if every scenario passed (NOT POSSIBLE with a reason is
fine), e2e has 0 failures (skips with a reason are fine) and the ledger is 0. For any FAIL: steps,
what you saw against what was expected, a screenshot, file and line if you can tell. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_REPORTS_CLEANUP]]` and
the report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
