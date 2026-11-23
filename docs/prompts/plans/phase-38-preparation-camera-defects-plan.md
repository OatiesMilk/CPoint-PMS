# Phase 38 plan: Preparation shows the camera's defects, repairs never go back to Preparation (planning thread, 2026-11-23)

Requests (Dylan, 2026-11-23), on top of Phase 37 (work in progress demo data):

1. "For Preparation the defects to be seen there are the ones detected by the camera capture module.
   It is different from the defects seen after Preparation: at Preparation it is the raw leather roll
   inspected by the camera vision, at the other stages it is already a shoe."
2. "Add it, but in the workflow there should be no repairs to be sent back, since it is already
   pre-filtered by the CV and it is raw leather being inspected, not a shoe that needs repair."

Run after Phase 37 is built (it touches the same board card). One session, Sonnet (high). Not demo
data: this changes a rule and the UI, so it has its own D-entry and QA.

## What it does

### A. The Preparation card lists the camera's defects (Batches → Work in progress)

- On the Preparation card, replace "No repairs here." with the leather defects the camera found on the
  rolls finished today, one count per roll per defect type, as Reports → Rolls and `defectBreakdown()`
  count them (D-117: whole rolls, never sections): for example "Found by the camera on rolls scanned
  today: Scratch 9, Crease 7, Cut 4, Hole 3". With none: "The camera found no defects on today's rolls."
  If `rollOutcomesByDay()` already gives the rolls returned today, add "Returned to supplier: N rolls."
  Otherwise leave it out (no new query for it).
- Data: `defectBreakdown()` in `report.model.ts` for today's Manila range with the `foundAtOrAbove`
  setting (the helper in `report.service.ts` reads it). Add `leatherDefects` to `wipBoard()`'s
  `preparation` object in `stage.service.ts` and render it in `wip-board.tsx`. Defect labels come from
  Settings → Defect types (never hardcoded, project rule). The Overview's Work in progress card is
  unchanged.
- The final shoe defects (Lifted sole, Glue marks, Loose stitching, Scuffs, Other) and the camera's
  leather defects stay two separate lists (A-62, A-66); the card says which is which in its heading.
- Rolls being scanned right now don't count until their Finish roll (as the reports).

### B. No repair is ever sent back to Preparation

- A repair goes only to Construction, Sole-ing or Finishing. Add `REPAIR_STAGES` (those three) to
  `src/lib/repair-rules.ts`; keep `STAGES` (four) for who works where, the counts and the board.
- Use `REPAIR_STAGES` in: the finding form's "Goes back to" (`findings-editor.tsx`), the repair's
  Change → move (`repair-actions.tsx`), "Sent back again" on Inspect repair
  (`repair-inspect-dialog.tsx`), the validators (`repair.validator.ts`, the finding and resend lines in
  `repair-rules.ts`, so the API refuses Preparation too, with a message naming the field), the stage
  filter and columns in Reports → Operations (Where defects come from, Repairs; `repair-sections.tsx`,
  `operations-view.tsx`, `report.validator.ts`, `repair.service.ts`). The Preparation card's repair
  block and `wipBoard()`'s Preparation `repairs` go (always empty).
- The database enum `ProductionStage` keeps PREPARATION (assignments and counts use it): no migration.
  Legacy rows: Phase 34 never ran outside the demo, but the coding thread checks the dev database with
  SQL for findings or repair jobs with stage PREPARATION; if any exist, reports still show them (a
  Preparation column only when the period has pairs there) rather than hiding pairs. Report it in the
  handoff.
- Docs say it: D-130's A-75 ("the stage is where a fixable pair goes back to") is amended to the three
  stages after Preparation (new D-entry, not an edit of the old one), API.md (the stage values of
  findings and repair endpoints), the manual's findings and repairs text, the master spec's rules and the
  DEMO_SCRIPT Act 5 and 6 lines about "Goes back to".

## Tests

- Unit: `repair-rules` (the finding line with Preparation is refused with the field's message; the
  three other stages pass; suggestion and totals unchanged), `stage.service` (the board's Preparation
  card has `leatherDefects` from the breakdown and no repairs), the validators.
- Existing e2e that picks a stage for a finding or a repair (final-defects, batches, corrections specs)
  must not rely on a Preparation option; the handoff lists what to rerun. Claude runs no browser tests.
- `npm run check`.

## Decisions and assumptions to log

- D-136 (Dylan, 2026-11-23): at Preparation the defects are the camera's, on the raw roll; no repair
  goes back to Preparation (the CV has already filtered the leather); repairs go to Construction,
  Sole-ing or Finishing only. Tell CPoint.
- A-113 (D-136): the Preparation card counts rolls per defect type finished today, the same count as
  Reports → Rolls; CPoint hasn't asked for a different measure.
- A-114 (D-136): constructors without Capture access may still be assigned to Preparation (A-96
  unchanged); only repairs are barred from it.

## Files left out on purpose

`prisma/schema.prisma` (no migration), the CI docker SQL block (protected file; its repair checks
still hold; one more check "no repair job or finding at PREPARATION" can be offered as a patch).

## Open points for Dylan

1. The card shows rolls per defect type (as Reports → Rolls). If you would rather show the number of
   detections, say so.
2. Should the Capture page's My stage card for a Preparation constructor show the same defect list?
   Left out for now (that card is a phone page and the Capture page already shows each shot's defects).

## Answers (Dylan, 2026-11-23)

Both open points: the defaults stand. The card counts rolls per defect type (as Reports → Rolls), and
the Capture page's My stage card does not show the list.
