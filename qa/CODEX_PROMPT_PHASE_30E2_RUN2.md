# Prompt for Codex: Phase 30E-2 run 2, after the run 1 fixes (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at a94fbe0), Docker
Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 (`qa/reports/2026-11-04-phase-30e2-run1.md`) failed;
Claude fixed it. Read the handoff `qa/handoffs/2026-11-04-phase-30e2-planning-calendar.md`
(updated: S11, S12 and section 6) and run 1's report first.

## What changed since run 1

- F1 (past days don't open): not a fault. Dylan decided weekends and past days can't be clicked;
  the handoff was wrong and now says so. The cell shows the plan and the rolls scanned.
- F2: Recent days and Reports → Operations have separate **Rolls planned** and **Rolls scanned**
  columns.
- F3: `batches.spec.ts` reads each field's own error (`#plan-rolls-error` and so on), not the
  summary link with the same text.
- S8: an unplanned today is no longer locked by batches finished before it had a plan, so the FM
  can plan today from the notice.
- F4 (smoke toast timeout in the full suite only) had no code change: rerun that spec alone.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/`.
- Don't run `demo:reset`: this is Dylan's own data. Put back any plan you add or change for a check
  (note its values first), and undo any Non-working mark you add.
- Browser checks in **your in-app browser** at the `npm run dev` URL. Playwright's Chromium stays
  headless; don't open visible Chrome windows.

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-04-phase-30e2-run2/`. Keep only the database
   container up; restart `npm run dev` so it picks up the changes (`npm run db:deploy` should say
   "No pending migrations").
2. Recheck in the browser: **R1** S11 (past days are static cells with the plan and rolls scanned;
   Next stops after the third month ahead). **R2** S12 (two roll columns in Recent days and
   Operations; both in `production.csv`). **R3** S8: as the FM, today (unplanned) shows the banner,
   bell item and home card; Plan today opens an editable dialog; save a plan (note it is a test
   plan), check the banner and bell item go, then delete that `day_plans` row so today is unplanned
   again as before. **R4** axe on Operations and Batches → Recent days.
3. Set `$env:E2E_BASE_URL="http://localhost:3000"` (the dev port). Run
   `npx playwright test tests/e2e/batches.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a first-compile timeout, a toast
   wait or `ECONNRESET`, rerun that spec alone once and report both results. Check afterwards that
   `day_plans` and `lunch_breaks` match the snapshot from before the tests.
4. Ledger check at the end (should be 0):
   `select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`.

## Write the report

Save it as `qa/reports/2026-11-04-phase-30e2-run2.md` (or the date you run it) from
`qa/templates/report.md`. **PASS** only if R1 to R4 pass, e2e has 0 failures (skips with a reason
are fine, and a timeout that passes alone is noted) and the ledger is 0. Don't fix anything.

Then add one line under "Agent sessions" in today's vault Daily note
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30E2_RUN2]]` and
the report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
