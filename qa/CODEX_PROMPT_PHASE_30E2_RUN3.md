# Prompt for Codex: Phase 30E-2 run 3, after the run 2 fixes (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at a94fbe0), Docker
Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 2 (`qa/reports/2026-11-04-phase-30e2-run2.md`) failed;
Claude fixed it. Read the handoff `qa/handoffs/2026-11-04-phase-30e2-planning-calendar.md` and the
run 2 report first.

## What changed since run 2

- F1: `batches.spec.ts` clicks the bell that is on screen (`filter({ visible: true })`); the bell
  is in both the desktop sidebar and the phone bar.
- F2: `src/components/ui/scroll-region.tsx` starts as a keyboard stop ("…, scrolls sideways") in
  the server's HTML and measures before paint, then drops the stop when the table fits. So a wide
  table is focusable from the first paint.
- F3 (the smoke journey timed out in the full suite only, passed alone): no code change.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/`.
- Don't run `demo:reset`. Put back any `day_plans` row you change, exactly, as in run 2.
- Browser checks in **your in-app browser** at the `npm run dev` URL; Playwright's Chromium stays
  headless.

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-04-phase-30e2-run3/`. Restart `npm run dev`.
2. **R1** axe (WCAG 2.1 A/AA, every impact) on Reports → Operations and Batches as the FM at 1355
   px, scanned as soon as the production table is visible, and again settled: 0 violations both
   times. Check the table wrapper has `tabindex="0"` on first load at 1355 px, and that at a width
   where the table fits (for example 1920 px) it has no `tabindex`.
3. Set `$env:E2E_BASE_URL="http://localhost:3000"`. Run
   `npx playwright test tests/e2e/batches.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts`,
   then `npm run test:e2e`. If a test fails on a first-compile timeout, a test deadline or
   `ECONNRESET`, rerun that spec alone once (`--workers=1`) and report both results. Check
   `day_plans` and `lunch_breaks` match the snapshot from before the tests.
4. Ledger check (should be 0):
   `select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`.

## Write the report

Save it as `qa/reports/2026-11-04-phase-30e2-run3.md` from `qa/templates/report.md`. **PASS** only
if R1 passes, e2e has 0 failures (skips with a reason are fine; a timeout that passes alone is
noted, not a failure) and the ledger is 0. Don't fix anything.

Then add one line under "Agent sessions" in today's vault Daily note, linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30E2_RUN3]]` and the report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
