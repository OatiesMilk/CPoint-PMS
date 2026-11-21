# QA handoff: Phase 35A, reports by period (sort, filter, print)

| Field           | Value                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Date            | 2026-11-21                                                                                                                      |
| Feature         | phase-35a-reports-by-period                                                                                                     |
| Branch          | uncommitted on `main` (9e3038a)                                                                                                 |
| Spec / prompt   | `docs/prompts/plans/phase-35-reports-and-corrections-plan.md` → 35A; D-132; A-67, A-68, A-69, A-100 to A-102; `docs/ROADMAP.md` |
| Written by      | Claude                                                                                                                          |
| Previous report | none for Phase 35 (newest: `qa/reports/2026-11-21-overview-cleanup-run2.md`, PASS WITH ISSUES, nothing open)                    |

## 1. What changed

The Floor Manager's Reports pages (Operations, Quality, Rolls, Materials) gain, for the same data and
the same numbers:

- **A period picker** on Operations, Quality and Rolls: **Day**, **Week** (a week of the month, as
  Materials: week 1 is days 1 to 7, the last week may be short), **Month**, **Custom** (up to
  **366 days**, was 92). The four quick links (Today, 7 days, 14 days, 30 days) stay on Operations
  and Quality. Rolls has **Any time** (its default) and the period filters on the day a roll was
  added. The choice is in the URL, so a link, a CSV and a print show one period. A future day, week
  or month ends at today; an invalid value falls back to today (no error page).
- **Sortable tables.** A click on a column header sorts (a second click reverses; `aria-sort`; one sort
  per page; `?sort=<table>.<column>&dir=asc|desc`). Tables: Operations → Production by day, Final
  defects, Where defects come from, Work in progress (stage and day tables), Materials at risk,
  Supplier quality (suppliers and worst rolls), Daily summary; Quality → Defects by type, Daily
  summary; Rolls → every column but the actions. CSVs ignore the sort (A-100).
- **Filters.** Operations: **Defect type**, **Fixable**, **Stage** above the three defect cards
  (Final defects, Where defects come from, Repairs; the key figures stay whole-line, A-101) and
  **Supplier** on Supplier quality (also its two CSVs). Quality: **Defect type** (also the Defects
  CSV). Rolls: **Leather item** and **Location** beside Find, Supplier, Status (also the Rolls CSV).
  A narrowed card says "Filtered: …" with Clear and has its own no-match sentence.
- **Print** button on all four reports. The printed page (A4 portrait, 12 mm margin) has a header
  (company, report, period, printed time, **Prepared by** the signed-in person and role, the filters and
  sort in words), a repeated table header, no split rows, no controls or navigation, and ends with a
  **Remarks** box (its text prints; empty it prints three ruled lines) and Prepared by / Checked by
  signature lines. Nothing is saved (A-69). Dark mode prints in the light colours. **Rolls prints every
  matching row** (up to 500, A-102): the Print button opens the page with `?print=1&autoprint=1`.
- "vs previous 7 days" now reads "vs previous month", "vs previous week" or "vs the day before" for a
  month, a week or a day, and compares with the month or week before (not the same number of days).

Read-only: no write, no route change beyond the new params, **no migration**.

## 2. Files touched

| File                                                                                                                                            | Change                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/report-rules.ts`, `src/lib/day-math.ts` (new), `src/lib/month-weeks.ts`                                                                | `parseRange` takes `period=day/week/month`; 366-day cap; labels; `previousRange`, `compareLabel`; `addDays` moved |
| `src/lib/table-sort.ts` (new), `src/lib/repair-rules.ts`                                                                                        | `parseSort`, `sortRows`, `sortFor`, `sortText`; `matchesFinding`, `matchesRepair`, `RepairFilters`                |
| `src/server/validators/{report,roll}.validator.ts`                                                                                              | period, filter, sort and print params                                                                             |
| `src/server/services/{ops-report,repair,report,roll}.service.ts`, `src/server/models/{ops-report,repair,roll}.model.ts`, `report.controller.ts` | filters, the period for Rolls, sorted and printed Rolls, option lists                                             |
| `src/components/features/reports/*` (new: period picker, sortable header, filters, print header, report footer; moved: print button)            | the shared parts                                                                                                  |
| `src/app/(app)/reports/page.tsx`, `rolls/page.tsx`, `rolls/roll-filters.tsx`, `materials/page.tsx`, `_components/*`                             | the pages, sorted headers, filters, print header and footer                                                       |
| `src/components/features/production/production-parts.tsx`                                                                                       | `ProductionDaysTable` sorts when given a sort (Batches' Recent days doesn't)                                      |
| `src/app/globals.css`, `src/styles/tokens.css`                                                                                                  | print rules; the dark token block is `@media not print`                                                           |
| `tests/unit/*`, `tests/e2e/reports-period.spec.ts`, `tests/e2e/reports-print.spec.ts` (new)                                                     | unit tests (970 pass); e2e written, not run                                                                       |
| `docs/API.md`, `DESIGN.md`                                                                                                                      | the new params; Reports: periods, sort, filters and print                                                         |

Database migration in this change: **no**.

## 3. How to run the app locally

As in the Overview clean-up handoff: `docker compose stop app` first (the new pages must come from a
fresh dev server, and the Docker app is older than Phases 34 and the clean-up), then:

```bash
npm run db:up
npm run db:deploy      # nothing new to apply
npm run dev            # http://localhost:3000 (or the port it prints)
npm run demo:reset '--' --yes   # 2 to 3 minutes; the demo week is the last 14 days
```

Existing specs that cover the touched pages (run them too): `reports.spec.ts`, `supplier-quality.spec.ts`,
`rolls.spec.ts`, `smoke.spec.ts`, `inventory.spec.ts`, plus the two new ones.

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD`. The Floor Manager (`manager@cpoint.local`) owns Reports.
The reset gives data for today (Sat 21 Nov 2026 when this was written) and the 13 days before: weekdays
only have batches, so a **Week** or **Month** of this month and the week before (Week 2, Nov 8 to 14)
show figures; earlier months are empty but still valid (a table of zero rows, 30 daily rows for
September). The **in-app browser's fill may not reach React state** (Overview clean-up runs 1 and 2):
open the pages by URL for the modes below, and where a scenario needs a control, use the headless
script or the e2e spec and say which ran it.

Deep links to use (adjust the year, month and week to today):

- Day `/reports?view=operations&period=day&day=2026-11-18`
- Week `/reports?view=operations&period=week&year=2026&month=11&week=2` (Nov 8 to 14)
- Month `/reports?view=quality&period=month&year=2026&month=11`
- Custom `/reports?view=operations&period=custom&from=2026-11-01&to=2026-11-21`

## 5. Test scenarios

| ID  | Role | Steps                                                                                                                                                                                                                                                                                                                                                          | Expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Priority |
| --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| P1  | FM   | Open Operations by each deep link above (Day, Week 2, Month, Custom).                                                                                                                                                                                                                                                                                          | The picker's tab for that mode is current (`aria-current`). The line `data-testid=report-range` reads: Day "… · 1 day"; Week "Week 2 · Nov 8–14, 2026 · 7 days"; Month "November 2026 · 21 days" (to today); Custom "Nov 1 – Nov 21 · 21 days". KPI tiles say "vs the day before", "vs previous week", "vs previous month", "vs previous 21 days".                                                                                                                                                        | High     |
| P2  | FM   | On Operations Week 2, read Pairs finished; open Week 1 (week=1) and Week 3 (week=3) and add up the three weeks plus Weeks 4 and 5 of the month's days that exist. Then read Month.                                                                                                                                                                             | The weekly Pairs finished add up to the month's (weeks of the month tile the month). Compare the Production table rows with the Production CSV (`/api/v1/reports/production.csv?period=week&year=2026&month=11&week=2`): same days, same numbers.                                                                                                                                                                                                                                                         | High     |
| P3  | FM   | Quality: Day, Week, Month and Custom as in P1. For Month 2026-09 count the Daily summary rows; fetch `/api/v1/reports/daily.csv?period=month&year=2026&month=9`.                                                                                                                                                                                               | 30 rows on screen; the CSV has a header and 30 rows; for any period the CSV totals equal the tiles. Months with no rolls show "No rolls scanned in this range".                                                                                                                                                                                                                                                                                                                                           | High     |
| P4  | FM   | Rolls: open `/reports/rolls` (no period), then `?period=day&day=<a day with rolls>`, `?period=month&year=2026&month=11`, `?period=custom&from=…&to=…`, and the old `?days=7`.                                                                                                                                                                                  | "Any time" is current by default and no range line shows. With a period, "Rolls added …" shows and only rolls added in it are listed (check the first roll's added day in its page). `?days=7` still filters. The Rolls CSV link keeps the period and filters.                                                                                                                                                                                                                                            | High     |
| P5  | FM   | Picker controls (e2e `reports-period.spec.ts` covers them; by hand or a headless script otherwise): on Operations click Week, change Month and Week; click Month, then Day and pick a date; click Custom, set From and To, Show; click "14 days".                                                                                                              | Each change updates the URL (`period=…`) and the page; the filters and sort already in the URL stay; the page number resets; "14 days" gives `/reports?view=operations&preset=14d`. A future month or week is disabled in the selects.                                                                                                                                                                                                                                                                    | High     |
| P6  | FM   | Open `?period=day&day=2999-01-01`, `?period=day&day=2026-02-30`, `?period=week&year=2999&month=1&week=1`, `?period=month&year=abc&month=99`, `?from=2026-02-30`.                                                                                                                                                                                               | Every page loads (200), no error. The four `period=` cases show today, today's week or today's month; the old `from=`/`to=` link with an impossible date is ignored and shows the default last 14 days (run 1 F3). `GET /api/v1/reports/quality?from=2020-01-01&to=2999-01-01` returns `range.days` 366.                                                                                                                                                                                                  | Medium   |
| P7  | FM   | On each sortable table (Operations: Production by day, Final defects, Where defects come from, Work in progress ×2, Materials at risk, Supplier quality ×2, Daily summary; Quality: Defects by type, Daily summary; Rolls: Roll, Supplier, Area, Scanned, Scanning time, Shots, Passed, Rejected, Defect %, Status) click a header twice, and a second column. | First click ascending (arrow up, `aria-sort="ascending"`), second descending; the rows follow the column (numbers as numbers, text A to Z with Roll 9 before Roll 10, empty values last either way); the second column replaces the first (one sort per page); the period and filters stay; the header link is reachable and operable by keyboard. A sort on another table's name in the URL, or an unknown column, is ignored. Rolls: Scanning time and Status sort the whole result, not just the page. | High     |
| P8  | FM   | Operations: pick **Fixable → Not fixable** (Apply). Then Defect type, Stage. Note the key figures. Click Clear on a card's "Filtered:" line.                                                                                                                                                                                                                   | The three defect cards each show "Filtered: Not fixable" with Clear; rows narrow; a card with no match says "No final defects match these filters." / "No defects match these filters." / "No repairs match these filters."; "Share of failed" stays a share of **all** failed pairs; "Reason not recorded" disappears while a filter is on; the KPI tiles and the other cards don't change; Clear removes the filters and keeps the period.                                                              | High     |
| P9  | FM   | Operations Supplier quality: pick a supplier (Apply); open Suppliers CSV and Rolls CSV. Quality: pick a defect type; open Defects CSV. Rolls: pick a Leather item, then a Location; open Download CSV.                                                                                                                                                         | Only that supplier's row and rolls show; the Suppliers CSV holds the same row; the Rolls CSV holds up to 100 of that supplier's worst rolls (the card shows the first five, as before, run 1 F7); the Quality and Rolls CSVs hold the same rows as the screen (the links carry `supplierId=`, `defect=`, `itemId=`, `locationId=`); the Rolls CSV has no `sort=` and its rows match the screen filter (not the sort). The Rolls list counts match the filtered total.                                     | High     |
| P10 | FM   | For each of Operations, Quality, Rolls and Materials emulate print (`page.emulateMedia({ media: 'print' })`) and save an A4 PDF (`page.pdf`) into the report's artifacts. Type a remark first on one of them.                                                                                                                                                  | The PDF has the header (CPoint Shoe Store Corporation, "Reports · <name>", Period, Printed, "Prepared by Floor Manager…" with the signed-in name), the filters and sort in words when set, no navigation, picker, filter bar, buttons, sidebar, demo band or bell; table headers repeat on a second page; no row splits; nothing is cut off at the right edge on A4; the remark prints as text; with no remark three ruled lines print; Prepared by / Checked by lines come last.                         | High     |
| P11 | FM   | Repeat P10's Operations print with the theme set to dark (`colorScheme: 'dark'`).                                                                                                                                                                                                                                                                              | The paper is white with dark text (no dark panels or pale text).                                                                                                                                                                                                                                                                                                                                                                                                                                          | Medium   |
| P12 | FM   | Rolls: open `/reports/rolls?print=1` (no `autoprint`), count the rows, emulate print and save the PDF.                                                                                                                                                                                                                                                         | Every matching roll is listed (more than the usual 15), no pager, header says "Reports · Rolls"; with more than 500 matches (not available in the demo; covered by a unit test) it would say "Showing the newest 500 of N rolls". The Print button opens the same URL with `print=1&autoprint=1` (check the href; `window.print` is not asserted).                                                                                                                                                        | Medium   |
| P13 | FM   | Other prints still work: a claim sheet (`/reports/claims/<roll>`, "Save as PDF") and the Phase 32 label sheets (`/inventory/labels`), light and dark.                                                                                                                                                                                                          | The claim sheet prints as before, on light colours; the label sheet is still one A4 page with 21 labels (Phase 32 L4: margin 0). The new `@page` rule is only on report pages.                                                                                                                                                                                                                                                                                                                            | Medium   |
| P14 | FM   | Old links: `/reports?preset=7d`, `/reports?view=quality&from=D&to=D`, `/reports?view=operations&preset=7d` then click "7 days".                                                                                                                                                                                                                                | They work as before; the click lands on `/reports?view=operations&preset=7d`. The CSV links on a page carry `from` and `to` of the period shown.                                                                                                                                                                                                                                                                                                                                                          | Medium   |
| P15 | FM   | Run the e2e: `reports-period.spec.ts`, `reports-print.spec.ts` and the existing specs listed in §3, then the full suite with `--workers=2`.                                                                                                                                                                                                                    | All pass; a first-compile time-out or `ECONNRESET` is rerun alone once and both results reported.                                                                                                                                                                                                                                                                                                                                                                                                         | High     |

### Access checks

| ID  | Role that must NOT have access                    | URL or action                                                                                                                                                                       | Expected                                                                      |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A1  | Quality Inspector, System Admin, Shoe Constructor | `/reports`, `/reports/rolls`, `/reports/materials`, and `GET /api/v1/reports/operations?period=month&defect=X&supplierId=…`, `…/suppliers.csv?supplierId=…`, `…/rolls.csv?itemId=…` | `/forbidden` for the pages, `403` for the API, with the new params as before  |
| A2  | Any role                                          | `?sort=rolls.roll;drop&dir=sideways`, `?remedy=MAYBE&stage=PACKING`, `?itemId=not-a-uuid`                                                                                           | The page loads (200); the bad values are dropped, nothing is echoed unescaped |

## 6. Out of scope / known issues

- **35B is not built:** corrections of past batches, a roll's details and a repair inspection come in the
  next session; the "correct" rules stay as in Phase 33 and 34.
- Materials only gets Print (its own week picker stays); no per-person figure was added, and "Prepared
  by" is the person printing.
- A sorted Rolls list sorts the newest 5,000 matches in memory (scanning time and status aren't database
  columns); narrow the filters past that. Not reachable with the demo data.
- Claude did not open any of this in a browser; the print layout in particular is unverified until your PDFs.
- `dark:` Tailwind variants (a handful) don't flip back in print; the tokens do. Report any pale text.
