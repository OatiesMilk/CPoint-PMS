# Prompt for Codex: Phase 30A QA, run 8 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS` on `feature/phase-30a-rolls-from-inventory`, with Docker
Desktop running, **after 01:00 Manila time**. No reset is needed. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 7 (`qa/reports/2026-10-27-phase-30a-run7.md`) passed.
Dylan then reviewed the Batches page as the QI and asked for three layout fixes. Claude changed:

- **Finish batch buttons:** every card's action column is one width on desktop, so **Finish batch
  1**, **Finish batch 2** and **Correct** are the same size (`md`) and line up. Correct is now a
  secondary button. On a phone the batch to finish stays the full-width `h-11` bottom bar.
- **Alignment:** the "Today, …" heading now sits above both columns, so the quota card's top lines
  up with the first batch card (at 1280 px and wider).
- **Finish batch window:** dialogs have two widths (`md` 448 px, `lg` 672 px). Finish batch and Add
  rolls are `lg`. In Finish batch the two counts sit side by side, the rolls are a bordered list
  below. Each roll now shows only what the QI needs (Dylan, after a phone screenshot): its code
  (which names the supplier) with the area at the right, and the item under it, cut short if long;
  the supplier's name is gone. Nothing scrolls sideways. On a phone it stays a bottom sheet with
  the counts stacked.

`npm run check` passed (607). DESIGN.md records the rules.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them. Never run `demo:reset` or
  `docker compose down -v`. Browser checks stay headless. Close the dialogs without saving.

## Steps

1. Check the Manila time; run only after 01:00 Manila.
2. Save each output as UTF-8 text in `qa/reports/artifacts/2026-10-27-phase-30a-run8/`:
   `npm run db:up`, `npx prisma migrate status` (up to date), `npm run build`, and the ledger query
   from `ledger-query.sql` in run 6's artifacts as `ledger.txt` (pipe it through stdin).
3. With no server of your own and `E2E_BASE_URL` unset, run `npm run test:e2e` once (`e2e.log`).
   Then run `batches` alone with `--workers=1` once (`e2e-batches.log`).
4. Start the app (`npm run start`, `PORT=3001`) for the checks below. Screenshot each into the
   artifacts folder. If today has no batch that can be finished and none finished, write NOT
   POSSIBLE for the checks that need one, with the reason.
   - **U3 Buttons** (the QI, 1440 × 900 and 1280 × 800): every Finish batch and Correct button on
     the batch cards has the same height and width (measure their bounding boxes) and the same
     right edge.
   - **U4 Alignment** (same sizes): the top of "Today against the quota" is within 2 px of the top
     of the Batch 1 card. At 1024 × 768 the quota card goes below the batches; no sideways page
     scroll.
   - **U5 Finish batch window** (1440 × 900, then 1280 × 800): open Finish batch (or Correct).
     The dialog is about 672 px wide, the two count fields are side by side, and the dialog and
     the rolls list have `scrollWidth <= clientWidth` (no sideways scroll), with a roll line that
     wraps if one is long. Keyboard: Tab goes Pairs finished → failed → the roll ticks → notes →
     Not now → Finish; Esc closes it.
   - **U6 Phone** (390 × 844, the QI): the bottom bar's Finish batch is full width and 44 px high;
     the sheet opens at the bottom, the two fields stacked, its left edge at x = 0 and its right
     edge at 390, `scrollWidth <= clientWidth` on the sheet and the rolls list (also after tabbing
     through every field), and each roll shows code, area and item with no supplier name.
   - **U7 Add rolls** (the FM, an active leather item, 1440 × 900): the dialog is about 672 px
     wide with no sideways scroll. Close it without saving.
   - **A1** axe (WCAG 2.1 A/AA) on `/batches` as the QI with the Finish batch window open, and on
     the item page with Add rolls open: 0 violations.
     Stop the server.
5. Save the ledger check again as `ledger-after.txt`.

## Write the report

Save it as `qa/reports/2026-10-27-phase-30a-run8.md`, using `qa/templates/report.md`, with the
Manila time each run started. The verdict is **PASS** only if the migration is up to date, the
build passes, the full suite and the `batches` run have **no failure**, U3 to U7 and A1 passed (or
were NOT POSSIBLE with a reason), and `off_ledger` is 0 before and after. For any FAIL: the exact
message or measurement, app or test, and the file and line. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today, linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30A_RUN8]]` and the report.

Finish by replying with the verdict, the e2e counts and the report path.
