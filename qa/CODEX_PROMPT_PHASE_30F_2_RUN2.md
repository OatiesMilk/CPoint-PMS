# Prompt for Codex: Phase 30F-2, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main da3d792), Docker Desktop
running for the database only, Dylan's `npm run dev` on http://localhost:3000. Best on a weekday
(Monday to Friday) after 01:00 Manila, so today has batches and the Finish batch screens exist.
Then copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 30F-2 (the desktop pages), run 2. Run 1
(`qa/reports/2026-11-07-phase-30f-2-run1.md`) failed. Handoff: `qa/handoffs/2026-11-07-phase-30f-2.md`.

What Claude changed since run 1:

- **F3, F6:** the Materials warning is a `<div>` now (it was a `<p>` holding the `<details>`), so
  Show all sits inside the orange box and the page hydrates without an error. F6 (Find material
  never adding `q=`) is expected to be the same fault: React rebuilt the page and dropped the typed
  text.
- **F7:** `KpiTile` carries `data-slot="card"` again, so the tests' tile locators find it.
- **F2, F4:** the three wide tables got narrower without dropping a column or a word:
  - Reports → Rolls: 8 px cell sides, the item line under the code truncated at 128 px (full name
    in its `title`), Supplier wraps at 128 px, the Status badge wraps onto two lines when long,
    the Defect % and Scanning time headers wrap.
  - Production by day (Reports → Operations, and Batches → Recent days for the FM): the Note
    column is gone as a column; a day's shortfall sentence is now a muted line under that day's
    row, across the table ("Below quota by 18 pairs. 3 of 12 Shoe Constructors were absent.").
    Each day's two lines share one hover.
  - The leather item's Rolls table: 8 px cell sides, Defects found wraps at 176 px, the Status
    badge wraps when long.
- **F5:** Reports → Rolls' **Download CSV** is in the header row, right of the title, like the
  other tabs. The average scanning time line stays above the table.
- **F1:** a capture-script and data issue, not an app fault (the first Inventory page lists no
  leather item after many e2e items, and the Rolls links were read right after the empty-filter
  capture). Capture the detail pages directly by URL, as you did in run 1's supplement.
- **S9:** a native `title` tooltip doesn't show in screenshots. It passes when the hovered item
  line's `title` equals the full name.

`npm run check` passed (708 unit tests, build OK). Claude ran no browser or e2e test.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Don't change any Windows setting. Undo anything you change in the app (as in
  run 1) and say so.
- Run against Dylan's `npm run dev` URL (AGENTS.md), with `$env:E2E_BASE_URL="http://localhost:3000"`.
  Playwright's Chromium stays headless; walk the manual checks in your in-app browser.
- If an API route that 30F-2 didn't touch answers 404, stop and ask Dylan to clear the dev cache
  (stop `npm run dev`, `Remove-Item -Recurse -Force .next\dev`, start it again), then rerun.

## Steps

Artifacts in `qa/reports/artifacts/2026-11-07-phase-30f-2-run2/`.

1. **R1 (F3, F6):** as the FM, open `/reports/materials` with a full page load and keep the
   console. Expected: no hydration or "cannot be a descendant" error; five names and "…" with
   **Show all N** inside the orange warning; Show all opens and closes with the pointer and with
   Tab then Enter. Then `npx playwright test tests/e2e/inventory.spec.ts --workers=1`.
2. **R2 (F7):** `npx playwright test tests/e2e/reports.spec.ts --workers=1`.
3. **R3 (F2, F4):** with a headless Playwright script of your own saved beside the artifacts, at
   1280 × 800 and 1440 × 900, light and dark, measure the page and each table's scroll region
   (`scrollWidth` against `clientWidth`) and whether the last column is fully visible, on:
   Reports → Rolls, Reports → Operations (Production by day), Batches as the FM (Recent days), and
   a leather item with rolls on hand (any item whose Rolls table has a **Remove** button). Expected:
   equal widths and the last column visible everywhere. Also check: a day with a shortfall shows
   its sentence on a line under the day's row, a day without one has no extra line, and each
   Rolls row's Status badge reads in full (two lines allowed).
4. **R4 (F5):** at 1280 px, Reports → Rolls: **Download CSV** right of the Reports title, at the
   same height as the other tabs' CSV buttons; it still downloads `rolls.csv` with the filters.
5. **R5 (S9):** hover the first Rolls row's item line: its `title` equals the full item name.
6. **R6 (screenshots):** at 1440 and 1280, light and dark, capture the after pictures of Reports
   → Rolls, Operations, Quality, Materials (warning closed), Batches (FM), a roll's page, a leather
   item's page and a scan's page (open the detail pages by URL). On a weekday, also the six QI
   Finish batch captures run 1 couldn't take (the dialog at 1440 and 1280, the sheet at 390, light
   and dark); on a weekend, mark them blocked. Compare with
   `qa/reports/artifacts/2026-11-06-phase-30f-baseline/`: same words and controls.
7. **A1:** axe (WCAG 2.1 A/AA, serious or critical) on Reports → Rolls, Operations, Materials and
   the leather item page, light and dark: 0 expected.
8. **Full suite:** `npm.cmd run test:e2e`. For each failing spec, rerun that spec alone once with
   `--workers=1` and report both results (AGENTS.md). Note any time-of-day skip.

## Write the report

Save `qa/reports/2026-11-07-phase-30f-2-run2.md` from `qa/templates/report.md` (use the actual
date in the name if it's another day). **PASS** if R1 to R5 and A1 pass, the screenshots keep the
baseline's words and controls, and every e2e failure passes when rerun alone. Add one line under
"Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`) linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_2_RUN2]]` and the report. Reply with the verdict, the R3
widths, the e2e counts (passed, failed, skipped) and the report path.
