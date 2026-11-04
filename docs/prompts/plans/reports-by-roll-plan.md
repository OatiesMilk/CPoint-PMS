# Plan: Reports count leather rolls, not sections

Status: **built 4 Nov 2026 (D-117), uncommitted; Codex next.** Was: plan only, waiting for Dylan's go (asked 4 Nov 2026; other threads are building, so no
code yet). Follows the Reports clean-up (D-116, built and uncommitted, Codex run 1 not run yet).
New decision: **D-117**.

## The ask, as I read it

Reports judge whole leather rolls, not sections (shots). A roll is **Scanning passed**, or
**Returned to supplier** when its defects cover more than the limit (10%) of its area (D-116). The
**Rejected sections** card goes. "Scans per day" counts the rolls scanned each day.

## Rules (proposed)

- A roll counts on the **Manila day it was finished at Capture** (Finish roll). A roll still being
  scanned isn't counted until it is finished; a removed roll never counts.
- Passed or Returned is the D-116 status (`rollReportStatus`): a roll that couldn't be measured
  counts as passed (A-42).
- The camera still decides each shot Pass or Reject at Capture and on a scan's page; that is
  unchanged. Only the Reports pages, the FM home and the CSVs stop counting sections.

## What changes on each page

**Operations (FM)**

- Remove the **Rejected sections** card.
- KPI tiles: **Reject rate** → **Returned to supplier** (share of rolls scanned in the range,
  "3 of 20 rolls"); **First-pass yield** → **Rolls passed** (share of rolls). Pairs, quota and
  Rolls finished/open stay.
- **Checkpoint before cutting** card: Rolls scanned, Scanning passed, Returned to supplier; Top
  defects counted by the rolls each defect was found on.
- **Daily summary** table: Rolls started, Rolls scanned, Passed, Returned to supplier (the
  Scanned/Pass/Reject section columns go).
- **Supplier quality**: Rolls, Passed, Returned to supplier, Returned %, Top defect, Defect area.
  The Sections, Pass % and Reject % columns go. The **High** badge (and the "needs attention"
  item) moves to a supplier whose Returned % is well above the others' (same rule, on rolls).
- **Rolls with the most rejects** → **Rolls with the most defects**: the top 5 by Defect %, each
  with its status and claim sheet.

- **Rolls open** and **Rolls finished** KPI tiles removed (Dylan, 4 Nov); the rolls scanned in the
  range show on the Returned to supplier and Rolls passed tiles ("3 of 20 rolls"). **Pairs finished** stays; its note reads
  "all pairs the QI counted at Finish batch, failed ones included" so it explains itself.

**Quality tab (FM)**

- Tiles: **Rolls scanned**, **Scanning passed**, **Returned to supplier**.
- **Scans per day** chart → **Rolls scanned per day**, stacked Passed and Returned to supplier.
- **Defects by type**: per type, the rolls it was found on and how many of them were returned.
- **Daily summary**: Day, Rolls scanned, Passed, Returned to supplier.

**FM home**

- **Rolls today**: Rolls scanned today, Returned to supplier today, Rolls still open.
- **Daily summary** card: Rolls scanned, Passed, Returned.

**CSVs**

- `daily.csv`: Date, Rolls scanned, Passed, Returned to supplier.
- `defects.csv`: Defect, Rolls found on, Returned to supplier.
- `operations.csv`: Date, Rolls started, Rolls scanned, Passed, Returned to supplier.
- `suppliers.csv`: Supplier, Rolls, Passed, Returned to supplier, Returned %, Top defect, High,
  Defect area %, Rolls measured.
- `supplier-rolls.csv`: the 100 rolls with the highest Defect %: roll, tag, supplier, Defect %,
  status, main defects.

**Left as it is:** Reports → Rolls (one row per roll; its Shots, Passed and Rejected columns count
that roll's shots) and a roll's page with its shots; Capture; a scan's page; Materials.

## Files (expected)

`src/server/models/{report,ops-report}.model.ts` (count rolls by finish day, status and defects),
`src/server/services/{report,ops-report}.service.ts` (totals, KPIs, CSVs),
`src/lib/ops-rules.ts` (High on Returned %), `src/app/(app)/reports/_components/{quality-view,
operations-view,ops-sections,ops-parts}.tsx`, `src/components/features/charts/{verdict-trend-chart,
verdict-legend}.tsx`, `src/components/features/reports/home-cards.tsx`, the FM home's data call,
`docs/API.md`; unit tests for both services and ops-rules; e2e `reports`, `supplier-quality`,
`smoke`, `rolls`. No migration (rolls already carry status, finish time and the mark).

Overlap: the FM home page (`floor-manager/page.tsx`) is changed by 30E-2; I'd keep that edit to
the data the card reads.

## Order

Fold it into the Reports clean-up before its Codex run, so one QA run covers D-116 and D-117.

## Checks

`npm run check` only (in a cloud copy of the laptop folder, since its packages are Windows builds).
E2E and browser checks by Codex.
