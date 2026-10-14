# Prompt for Codex: Phase 13 QA, run 4 (paste everything below the line)

Run Codex locally in the CPoint-PMS project folder, with Docker Desktop running. Copy from the
line down.

---

You are the QA tester for CPoint-PMS. Your run 3 report
(`qa/reports/2026-10-14-phase-13-material-requests-run3.md`) had one failure: a serious axe
`color-contrast` finding in the Record delivery dialog. The builder (Claude) did not change the
app. Claude suspects the test measured the dialog while it was still fading in, but cannot prove
it, so the test helper now waits for the animation to end and prints the colours axe measured.
**Your job is to settle which it is, with evidence.** There are no manual scenarios.

## Rules

- **Do not modify** application code, tests, migrations, `package.json` or `.env`. You may only
  create files under `qa/reports/`. Do not fix a failing test; report it.
- Read passwords from `.env`. Never print them.
- Do not soften the result. If the contrast finding is still there, it is a FAIL, and the numbers
  go in the report.

## Steps

1. Read `qa/handoffs/2026-10-14-phase-13-material-requests-run4.md` and
   `qa/templates/report.md`.
2. Make sure no CPoint-PMS dev server is running. Leave the other project's server on port 3000
   alone.
3. Run these, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-14-phase-13-material-requests-run4/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

   Then the single test, **three separate times** (`single-1.log`, `single-2.log`,
   `single-3.log`):

   ```bash
   npx playwright test tests/e2e/procurement.spec.ts --grep "order, a short delivery with proof"
   ```

   Then the full runs (`e2e.log`, `e2e-serial.log`):

   ```bash
   npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run4/e2e-results
   npx playwright test tests/e2e/procurement.spec.ts --workers=1 --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run4/e2e-results-serial
   ```

## What to report

**If the short-delivery test passes all three times:** say that the run 3 contrast finding did not
recur once the test waited for the dialog to finish opening, so it was a measuring problem in the
test and not an app fault.

**If it fails with `color-contrast`:** copy the whole failing line from each of the three runs
exactly as printed. Each element now ends with
`[text colour on background colour, ratio:1, needs N:1, font size]`. Then state:

- the text colour and background colour for each element;
- whether the background is pure white (`#ffffff`) or darker;
- whether the ratios are identical across the three runs or differ;
- your judgement: **app wrong** (the same low ratio on white every time) or **test wrong** (ratios
  that change, or a background that is not the dialog's white), with the numbers as evidence.

**For any other failing test:** the title, the failing line, the exact error, what the page
showed, app wrong or test wrong, and the smallest fix naming the line.

## Write the report

Save it as `qa/reports/2026-10-14-phase-13-material-requests-run4.md`, using
`qa/templates/report.md`:

- The verdict: **PASS** only if T1 to T4 in the handoff all meet their expected result.
- One line on run 3's F1: did not recur, or still failing, with the measured values.
- Each command with its passed and failed counts.
- The count of "destination stream closed early" lines, nothing more about them.

Finish by replying with the verdict, the counts and the report path.
