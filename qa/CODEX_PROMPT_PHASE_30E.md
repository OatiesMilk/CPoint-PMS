# Prompt for Codex: Phase 30E-1, the leather then the roll; a roll leaves stock at Capture (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at 9bfd10e), Docker
Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. In Phase 30E-1 the Shoe Constructor picks the leather,
then the roll on the table, at Capture; Finish roll takes the roll off stock; the Quality
Inspector's Finish batch asks only for pairs; and the Floor Manager no longer sends rolls back or
keeps them (Too many defects is information only). The handoff is
`qa/handoffs/2026-11-04-phase-30e-rolls-by-color.md`. Read it first: S1 to S11, A1 to A3.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/` (and the backup in step 2).
- Leave Settings as you found them (the limit at 10, Cut at 3 in and 1%).
- Do the browser scenarios in **your in-app browser** so Dylan can watch them live, at the
  `npm run dev` URL (http://localhost:3000, or the port it printed). Playwright's own Chromium stays
  headless; don't open visible Chrome windows.

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-04-phase-30e/`.
2. The Docker demo app is stopped on purpose: don't start it. Keep only the database container up
   (`npm run db:up`), then `npm run db:deploy` (expect "No pending migrations"; Dylan has restored and migrated the database) and
   `npm run db:generate`. Back up the database, then reset the demo data (PowerShell drops a bare
   `--`):
   `docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/before-30e-qa.dump`,
   `docker cp cpoint-pms-db-1:/tmp/before-30e-qa.dump storage/backups/before-30e-qa-run1.dump`,
   `npm run demo:reset '--' --yes`. If `npm run dev` isn't running, start it and note its URL.
3. Walk S1 to S11 and A1 to A3 in your in-app browser (axe with every rule and impact). S4 and S5
   may be NOT POSSIBLE (no camera; no batch due at that hour): say why.
4. In PowerShell set `$env:E2E_BASE_URL="http://localhost:3000"` (the dev port), then run
   `npx playwright test tests/e2e/capture.spec.ts tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts tests/e2e/returns.spec.ts tests/e2e/rolls.spec.ts`,
   then the full suite `npm run test:e2e`. Put back any schedule, lunch or quota rows the tests
   change. The dev server compiles each page on first visit and closes idle connections after 5 s:
   if a test fails on a first-compile timeout or `ECONNRESET`, rerun that spec alone once and report
   both results.
5. Check the ledger at the end: every item's on-hand equals the sum of its movements
   (`select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`
   should be 0).

## Write the report

Save it as `qa/reports/2026-11-04-phase-30e-run1.md` (or the date you run it), using
`qa/templates/report.md`. **PASS** only if every scenario passed (NOT POSSIBLE with a reason is
fine for S4 and S5), e2e has 0 failures (skips with a reason are fine) and the ledger is 0. For any
FAIL: steps, what you saw against what was expected, a screenshot, file and line if you can tell.
Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30E]]` and the
report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
