# Prompt for Codex: Phase 30A QA, run 9 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS` on `feature/phase-30a-rolls-from-inventory`, with Docker
Desktop running, **after 01:00 Manila time**. No reset is needed. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 8 (`qa/reports/2026-10-27-phase-30a-run8.md`) passed, but
its build (20:30 Manila) came before one more change at 20:44, after Dylan's phone screenshot:
on Finish batch → **Rolls fully used**, each roll now shows only its **code** (which names the
supplier, e.g. `LR-MLT-001`) with its **area** at the right, and the **item** under it, cut short
with an ellipsis if long. The supplier's name is gone. A roll already ticked in the batch being
corrected shows "Ticked in this batch" under its code. Files: `src/app/(app)/batches/page.tsx`,
`src/app/(app)/batches/finish-batch-dialog.tsx`. `npm run check` passed (607).

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them. Never run `demo:reset` or
  `docker compose down -v`. Browser checks stay headless. Close the dialogs without saving.

## Steps

1. Check the Manila time; run only after 01:00 Manila.
2. Save each output as UTF-8 text in `qa/reports/artifacts/2026-10-27-phase-30a-run9/`:
   `npm run build` (it must be newer than the two files above), and the ledger query from
   `ledger-query.sql` in run 6's artifacts as `ledger.txt` (pipe it through stdin).
3. With no server of your own and `E2E_BASE_URL` unset, run `batches` with `--workers=1` once
   (`e2e-batches.log`).
4. Start the app (`npm run start`, `PORT=3001`), the QI. If no batch can be finished or corrected
   today, write NOT POSSIBLE with the reason. Screenshot each.
   - **R1 Desktop** (1440 × 900): open Finish batch (or Correct). Each roll row shows the code and
     the area on one line, the area right-aligned, and the item below; no row contains a
     supplier's name (compare with Settings → Suppliers). Dialog and list
     `scrollWidth <= clientWidth`.
   - **R2 Phone** (390 × 844): open the bottom bar's Finish batch (or Correct). The sheet's left edge
     is at x = 0 and right edge at 390; each roll row as in R1, a long item name ends in an
     ellipsis on one line; `scrollWidth <= clientWidth` on the sheet and the list, also after
     tabbing through every field to Not now.
   - **R3 Correct** (if a batch with a ticked roll exists today): its ticked roll shows "Ticked in
     this batch" under the code. Otherwise NOT POSSIBLE.
   - **A1** axe (WCAG 2.1 A/AA) on `/batches` with the sheet open at 390 × 844: 0 violations.
     Stop the server.
5. Save the ledger check again as `ledger-after.txt`.

## Write the report

Save it as `qa/reports/2026-10-27-phase-30a-run9.md` (or the Manila date you run it), using
`qa/templates/report.md`, with the Manila time each run started. The verdict is **PASS** only if
the build passes, the `batches` run has **no failure**, R1, R2 and A1 passed, R3 passed or was NOT
POSSIBLE with a reason, and `off_ledger` is 0 before and after. For any FAIL: the exact message or
measurement, app or test, and the file and line. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today, linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30A_RUN9]]` and the report.

Finish by replying with the verdict, the e2e counts and the report path.
