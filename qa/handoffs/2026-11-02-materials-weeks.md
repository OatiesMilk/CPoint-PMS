# QA handoff: Materials by week of the month, with Year, Month and Find (D-109)

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| Date            | 2026-11-02                                                                 |
| Feature         | materials-weeks (D-109)                                                    |
| Branch          | `main` at 2e63908, uncommitted in `C:\dev\CPoint-PMS` with D-107 and D-108 |
| Spec / prompt   | Dylan in the project chat, 2026-11-02; D-109                               |
| Written by      | Claude                                                                     |
| Previous report | `qa/reports/2026-11-02-no-unknown-classes-run1.md`                         |

## 1. What changed

Reports → Materials, "Used per material":

- **Weeks of the month:** Week 1 is days 1 to 7, Week 2 days 8 to 14, and so on from the 1st; the
  last week ends on the month's last day and can be shorter (Nov has Week 5 · Nov 29–30; a leap
  February has Week 5 · Feb 29). Labels: "Week 1 · Nov 1–7".
- **Year, Month, Week** dropdowns and a **Find material** box (name or item code, any case,
  trimmed; a clear button; an empty state "No material matches …" with Clear the search). All in
  the URL: `?year=2026&month=11&week=1&q=tacks`. Default: the week today falls in.
- Changing the month or year keeps the week number if that month has it, otherwise its last week
  that has started. Months and weeks that haven't started are disabled. A bad URL value (week 9,
  month 13, a future week, text) shows today's week.
- A line under the filters: "Week 1: Nov 1–7, 2026 (so far, up to today) · compared with Week 5 of
  Oct 29–31, 2026 (3 days against 7)."
- Columns **Selected week** and **Previous week**; the 8-week trend ("8 weeks to selected") and the
  Leather rolls table end at the selected week.
- **Per 100 pairs** and **Days left** still use the last 28 days up to today, whatever week is
  picked. "May run out before the next update" still covers every material, not only the search's.
- `materials-used.csv` follows the selection and the search: header
  `Week,From,To,Item code,Item,Category,Supplier,Unit,Used,Pairs finished,Used per 100 pairs`.

## 2. Files touched

`src/lib/month-weeks.ts` (new), `src/lib/stock-rules.ts`, `src/server/models/materials.model.ts`,
`src/server/services/materials.service.ts`, `src/server/controllers/report.controller.ts`,
`src/app/(app)/reports/materials/{page,material-filters}.tsx`, `docs/API.md`. Tests:
`tests/unit/{month-weeks,materials.service,stock-rules}.test.ts`, `tests/e2e/inventory.spec.ts`.
Database migration: **no**.

## 3. How to run

`npm run db:up`, then `npm run dev` (`PORT=3001` if 3000 is taken; the Docker demo app stays stopped), sign in as the FM. Use
the demo week (`npm run demo:reset '--' --yes` in PowerShell) only if the database has no stock
updates; note it first.

## 4. Scenarios

| ID  | Role | Steps                                                                                                   | Expected                                                                                                                                                                                | Priority |
| --- | ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | FM   | Open Reports → Materials.                                                                               | Year 2026, Month November, Week "Week 1 · Nov 1–7" selected; the line reads "Week 1: Nov 1–7, 2026 (so far, up to today) · compared with Week 5 of Oct 29–31, 2026 (3 days against 7)." | High     |
| S2  | FM   | Open the Week list in November.                                                                         | Week 1 · Nov 1–7 … Week 5 · Nov 29–30; weeks not started are disabled. Months after November are disabled.                                                                              | High     |
| S3  | FM   | October, then Week 5 · Oct 29–31; then Month September.                                                 | Week 5 · Sep 29–30 is kept. Then February 2026 → Week 4 · Feb 22–28 (Feb 2026 has 4 weeks).                                                                                             | High     |
| S4  | FM   | Open `/reports/materials?year=2024&month=2&week=5`.                                                     | If 2024 is in the Year list: "Week 5 · Feb 29" (one day). Otherwise check S4 in the unit tests only and say so.                                                                         | Low      |
| S5  | FM   | Open `?year=2026&month=11&week=9`, `?month=13`, `?year=2030&month=1&week=1`, `?week=abc`.               | Week 9 → the last started week of November; the rest → today's week. No error page.                                                                                                     | High     |
| S6  | FM   | Pick an October week that has Used entries.                                                             | Selected week and Previous week change; the trend's last bar is that week; Leather rolls' top row is that week. Per 100 pairs and Days left do not change from S1.                      | High     |
| S7  | FM   | Find: type ` CEMENT` (or another item's name in capitals with spaces), then an item code in lower case. | Only matching rows; the URL has `q=`; the week stays.                                                                                                                                   | High     |
| S8  | FM   | Find: `no-such-material-xyz`.                                                                           | "No material matches …" with Clear the search; the clear button (X) in the box also empties it and brings the rows back.                                                                | Medium   |
| S9  | FM   | Download Materials CSV with a week and a search set.                                                    | Header as in §1; 8 weeks per matching item, ending with the selected week; only matching items.                                                                                         | Medium   |
| S10 | FM   | Keyboard only: Tab through Year, Month, Week, Find, the clear button, the table.                        | Every control has a visible focus ring and its label is read; arrow keys change the dropdowns.                                                                                          | Medium   |
| S11 | FM   | 1280 px and 1024 px wide.                                                                               | Filters wrap; no sideways page scroll.                                                                                                                                                  | Low      |
| A1  | FM   | axe (WCAG 2.1 A/AA, every rule) on S1, S7 and S8.                                                       | 0 violations.                                                                                                                                                                           | High     |

## 5. Note on the previous report

Run 1's only failure, S3 (`GET /api/v1/defect-types/unknown` answered 405, not 404), was a wrong
expectation in that handoff: the path now matches `/api/v1/defect-types/[id]`, which only has
PATCH, so Next.js answers 405 Method Not Allowed, the same as other removed reads (for example
`GET /api/v1/scans`). No app fault; nothing to rerun.

## 6. Automated

`npm run check` passed in the cloud copy (lint, typecheck, 635 unit tests, build). E2E not run by
Claude: `tests/e2e/inventory.spec.ts` ("Materials report" test: the Week select, Find in lower case
with spaces, the new CSV header, the empty state and Clear).

## 7. Run 2 (after run 1)

Run 1 (`qa/reports/2026-11-02-materials-weeks-run1.md`): 11 of 12, e2e 78 passed, 4 failed, 2
skipped, 6 not run, all against `next dev`.

- **F1 (S11):** a wrong expectation here. The filters wrap when they don't fit; at 1280 px they fit
  in one row, with no sideways scroll. S11 now says so. No change.
- **F3 (`batches.spec.ts:177`):** a test race. It counted the history rows right after the first
  save's toast, before the table refreshed (8, then 9 from that first save); the second save did
  say "Nothing changed". The test now reloads, counts, enters tomorrow's schedule again and saves.
- **F2, F4, F5:** a first-compile timeout (passed alone), a closed browser session and a link not
  yet stable, under the full parallel suite on `next dev`. No app change; run 2 reruns them.

| ID  | Steps                                                                                             | Expected |
| --- | ------------------------------------------------------------------------------------------------- | -------- |
| R1  | `npx playwright test tests/e2e/batches.spec.ts` (dev server)                                      | 0 failed |
| R2  | `npx playwright test tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts tests/e2e/admin.spec.ts` | 0 failed |
| R3  | Full suite with two workers: `npm run test:e2e -- --workers=2` (`npm.cmd` in PowerShell)          | 0 failed |

## 8. Run 3 (after run 2)

Run 2 (`qa/reports/2026-11-02-materials-weeks-run2.md`): R2 24/0, R3 88 passed, 0 failed, 2
skipped; R1 failed at `batches.spec.ts:183`. The page snapshot shows why: after the reload the
form still read Shift start 00:00 (the test's own all-day schedule for today), so the save was
refused by the form ("must be 08:00 or later") and no toast came. The fill was made before the
page hydrated under `next dev` and was lost. The app saved nothing (8 schedules before and after).
The test now repeats the fill until the form's preview shows "Tomorrow: Batch 1 08:00–17:00".

| ID  | Steps                                                                         | Expected                       |
| --- | ----------------------------------------------------------------------------- | ------------------------------ |
| R4  | `npx playwright test tests/e2e/batches.spec.ts` against the dev server, twice | 6 passed, 0 failed, both times |
