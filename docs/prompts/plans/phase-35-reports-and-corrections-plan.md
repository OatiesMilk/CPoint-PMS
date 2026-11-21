# Plan: Phase 35, reports by period you can sort, filter, print and correct (the panel's revision 3)

**Status:** APPROVED (Dylan, 2026-11-21 06:45 UTC: "go ahead", all three recommendations): two sessions,
**35A first** (periods, sort, filters, print), then **35B** (corrections); a week is a week of the month
(D-109); repair inspections are correctable (A-105). Build 35A from this plan; no migration.
**Written:** 2026-11-21 on the laptop (`main` at the Overview clean-up merge, D-131).
**Inputs read:** the vault (CLAUDE.md, CPoint commands and where to look, Daily 2026-11-21, Overview
clean-up, Phases), STATUS, `docs/prompts/plans/defense-revisions-plan.md` → Phase 35, newest Codex report
`qa/reports/2026-11-21-overview-cleanup-run2.md` (PASS WITH ISSUES, its one issue fixed; nothing open),
`src/lib/report-rules.ts`, `src/lib/month-weeks.ts`, `src/app/(app)/reports/page.tsx` and
`rolls/page.tsx`, `report.validator.ts`, `report.controller.ts`, `production.service.ts` →
`correctCheckIn`, `repair.service.ts`, `batch-queue.service.ts`, `roll.validator.ts`, the `Roll`,
`ProductionCheckIn` and `RepairJob` models.

**Numbers:** decision **D-132** (D-131 went to the Overview clean-up). Assumptions **A-67 to A-70** were
reserved for this phase in the defense plan and are still unused; new ones start at **A-100**.

## What exists today

- **Range:** Operations and Quality take `preset=today|7d|14d|30d` or `from`/`to`, max 92 days
  (`parseRange`). Rolls has its own Added filter (7, 30, 90 days). Materials has Year, Month, Week of the
  month (`month-weeks.ts`, D-109: Week 1 is days 1 to 7, the last week may be short).
- **Tables:** about 14 on the four report pages, all shadcn `Table` in server components. None sorts.
  Only Rolls is paged (server side).
- **Filters:** Rolls (Find, Supplier, Status, Added); Materials (Find). Operations and Quality: none.
- **Print:** only the claim sheet (`reports/claims/[rollId]`, its own `print-button.tsx`); the app layout
  already hides the sidebar in print.
- **Corrections:** a finished batch, on the day it was inspected only, by whoever may inspect
  (`correctCheckIn`, "until Phase 35"); its lines lock once a repair is Back (A-93). A repair's
  inspection can't be corrected (A-94, "until Phase 35"). A roll's details can't be edited (only Move,
  Remove, return decision). Stock already has Correction rows; attendance is editable 7 days back.

## Choices for Dylan (recommendation first)

1. **Split into two sessions.** **35A** periods, sort, filter and print (read only, no writes);
   **35B** corrections (writes, audit, locks). Each gets its own Codex QA. Phase 34 in one go took four
   runs; this keeps each QA small. _Or_ one session, as the defense plan had it.
2. **What a "week" is.** **Weeks of the month, as Materials already does (D-109):** Week 1 is the 1st to
   the 7th, so a month's weekly prints add up to its monthly print and both pages read the same. _Or_
   calendar weeks Monday to Friday, which cross into the next month.
3. **Repair inspections are correctable (35B).** **Yes**, with the same lock idea as A-93: while any pairs
   it sent back are still At stage. _Or_ leave repairs out and keep A-94.

## 35A: periods, sort, filter, print

### Period picker (Operations, Quality, Rolls)

- One shared `PeriodPicker` (`src/components/features/reports/period-picker.tsx`): **Day** (a date),
  **Week** (year, month, week of the month, reusing `weeksOfMonth`/`resolveWeek` and their labels),
  **Month** (year + month), **Custom** (from/to). Everything in the URL, so a link, a CSV and a print
  show the same period.
- `parseRange` gains `period=day&day=…`, `period=week&year=&month=&week=`, `period=month&year=&month=`.
  The old `preset=` and `from`/`to` links keep working (bookmarks, e2e specs); the four presets stay as
  quick links beside the picker. A future day or month clamps to today, as now. `MAX_RANGE_DAYS` goes from
  92 to **366** (A-68). `previousRange` for a month compares with the month before (not the same number
  of days).
- The range line under the picker names the period: "Week 3 · Nov 15–21, 2026 · 7 days · as of …",
  "November 2026", "Sat, 21 Nov".
- **Rolls:** its Added filter becomes the same picker, on the day a roll was added (the `days=` param
  keeps working). **Materials** keeps its own week picker (it is a weekly report by design, D-109); it
  only gets Print.
- `reportQuerySchema` and `rollListQuerySchema` take the new params with `.catch(undefined)` like the
  rest; the CSV routes go through `rangeFrom`, so they follow the period with no route change.

### Sort

- A pure `sortRows(rows, key, dir, columns)` in `src/lib/table-sort.ts` (numbers, text with
  `localeCompare`, days; nulls last whatever the direction; stable) and a `SortableHeader`
  (`src/components/features/reports/sortable-header.tsx`): a `TableHead` whose label is a `Link` that sets
  `?sort=<table>.<column>&dir=asc|desc` and keeps every other param; `aria-sort` on the header; one sort
  per page.
- Each table lists its sortable columns (a whitelist; an unknown `sort` is ignored). The aggregated tables
  sort in memory on the server, in the page. **Rolls** sorts in the database query (it is paged), on code,
  supplier, added, scanned, defect %, scanning time and status. Default order unchanged when no `sort`.
- CSVs follow the period and filters, not the sort (A-100).

### Filters (only where they mean something)

- **Rolls:** + **Leather item** and + **Location** (Phase 32), beside Supplier and Status.
- **Operations → Final defects, Where defects come from, Repairs:** **Defect type**, **Fixable / Not
  fixable**, **Stage** (Phase 34), set once above those cards and saying so ("Filters the three defect
  cards below"); the KPI tiles stay whole-line (A-101).
- **Operations → Supplier quality:** **Supplier**.
- **Quality:** **Defect type** on the defects table.
- Filters are URL params, server side, and the matching CSV takes the same params. Each filtered card
  says "Filtered: …" with Clear, and has its own "No … match these filters" state.

### Print

- A **Print** button on Operations, Quality, Rolls and Materials (move the claim sheet's
  `print-button.tsx` to `src/components/features/reports/` and reuse it there).
- A `PrintHeader` (hidden on screen, `print:block`): CPoint Shoe Store Corporation, the report's name and
  tab, the period line, "Printed <Manila date and time>", **Prepared by <name>, <role>** (the signed-in
  user), and the active filters and sort in words.
- A **Remarks** box (a textarea on screen; its text prints; empty prints three ruled lines) and
  **Prepared by / Checked by** signature lines at the end. Nothing is saved (A-69).
- Print CSS in `src/app/globals.css`: `@page { size: A4 portrait; margin: 12mm }`, `thead` repeats on each
  page, rows don't split, buttons, pickers, filters, the demo band and the bell are `print:hidden`, charts
  print as they are (SVG), the token colours stay readable on white.
- **Rolls prints every matching row**, not one page: `?print=1` lifts the pager up to 500 rows and the
  header says "500 of N, narrow the filters" past that (A-102). The Print button opens that URL and
  calls print once it loads.

## 35B: corrections, always with a reason and an audit row

- **A past batch (any day), by the Floor Manager only (A-70).** `correctCheckIn` keeps every rule it
  has (stale check, A-93's line lock, the reason, the audit with before and after) and drops the
  same-day limit for the Floor Manager; the Quality Inspector still corrects only on the inspection day.
  Where: Batches → Queue → **Inspected and void** gets a **Day** date picker that reaches any past day
  (default still the last 7 days), and each Operations production-by-day row links to it ("See batches").
  The batch keeps showing "Corrected by …, when, why" as now; the production-by-day row shows a small
  "Corrected" mark when any of its batches was corrected after its day (A-103).
- **A roll's details, by the Floor Manager:** tag number, received date, return note (after the
  decision), and the **area only before Finish roll** (after it, the defect share and the 10% mark were
  worked out from it, so the area is fixed; A-104). Supplier and leather item don't change (stock is
  counted per item). Location stays with Move (Phase 32). Where: an **Edit details** dialog on the roll
  page (`reports/rolls/[id]`). Route: `PATCH /api/v1/rolls/{id}` (the route file already has `GET`),
  `expectedUpdatedAt` for the stale check, the changed fields only in the audit's before/after.
- **A repair's inspection (if choice 3 is yes), by the Floor Manager:** change how its pairs split
  between passed, scrapped and sent back again, same total, with a reason, while the job it sent back
  (if any) is still At stage; the child job's pairs follow, created or removed as needed. Locked once
  that child is Back or Done (A-105). Route: `PATCH /api/v1/production/repairs/{id}/inspect` beside the
  existing `POST`. Passed pairs move on the day of the original inspection (A-64 unchanged).
- Every write: `runInTransaction` + `recordAudit` with the same `tx`; `requireApiPermission` on each
  route plus the Floor Manager check that Void and Urgent already use (A-84); inline messages that name the
  field and the fix ("Give a reason for the correction.", "The area can't change after Finish roll: the
  defect share was worked out from it.").
- `docs/API.md`: the new params and the two new `PATCH` rows.

## Files (expected)

- 35A: `src/lib/report-rules.ts`, new `src/lib/table-sort.ts`, `src/server/validators/{report,roll}.validator.ts`,
  `src/components/features/reports/{period-picker,sortable-header,print-header,print-button,remarks-box}.tsx`,
  `src/app/(app)/reports/**` (pages, `_components/*`, `rolls/roll-filters.tsx`), `roll.service.ts`
  (`listRollsForReport` sort, item and location filters, print limit), `ops-report.service.ts`,
  `report.service.ts`, `repair.service.ts` (`repairReport` filters), `src/app/globals.css`.
- 35B: `production.service.ts` (`correctCheckIn`), `batch-queue.service.ts` (any past day),
  `src/app/(app)/batches/**` (the Day picker), `roll.service.ts` + `roll.validator.ts` + `roll.controller.ts`
  - `src/app/api/v1/rolls/[id]/route.ts`, `repair.service.ts` + the repair inspect route and controller,
    `src/app/(app)/reports/rolls/[id]/**` (Edit details).
- Both: unit tests beside each lib and service; e2e `reports-period.spec.ts`, `reports-print.spec.ts`
  (35A) and `corrections.spec.ts` (35B); `docs/API.md`; DESIGN.md → Reports (picker, sort header, print).
- **No migration**: corrections use the columns and the audit log that exist.

## Assumptions to log

- A-67 (changed if choice 2 is yes): a week is a week of the month, as Materials (D-109); otherwise
  Monday to Friday.
- A-68: a custom range may be up to 366 days.
- A-69: Remarks and signatures print only; the paper is the record.
- A-70: only the Floor Manager corrects past records; the Quality Inspector corrects only on the
  inspection day, as now.
- A-100: CSVs follow the period and filters, not the sort.
- A-101: the defect filters change the three defect cards, not the KPI tiles.
- A-102: a printed Rolls report holds up to 500 rows.
- A-103: a corrected batch shows "Corrected" on its day in Operations; who and why stay on the batch
  and in the audit.
- A-104: a roll's area can change only before Finish roll.
- A-105: a repair's inspection can be corrected while the pairs it sent back are still At stage.

## Kept rules

No per-person figures (the print's "Prepared by" is the person printing, not a figure); MVC layering;
guards on every page and route; tokens only; desktop layout (the reports stay desktop, D-096); defect
types stay data.

## QA (Codex)

- Unit (Claude): period math (each mode, month and year ends, a leap February, a short last week, future
  clamps, 366-day cap, old `preset` links), `sortRows` (each type, nulls, stable, unknown column),
  filters combining, the correction rules (FM any day, QI same day, A-93 lock, area after Finish roll,
  repair lock).
- e2e and browser (Codex): each report in Day, Week, Month and Custom with the CSV matching the screen;
  sort a column both ways on each table; each filter and Clear; print emulation and a PDF per report
  (`page.emulateMedia({ media: 'print' })`, `page.pdf`): header, period, prepared by, remarks, signatures,
  repeated table header, nothing cut off on A4; Rolls prints past one page. 35B: correct a batch from last
  week as the FM (the QI can't), the lock after a repair is Back, edit a roll's details (area refused after
  Finish roll), correct a repair inspection and its lock, an audit row for each with before and after.

## Next

Dylan's go (and the three choices). Then the Sonnet coding thread builds 35A (or the whole phase) from
this plan, runs `npm run check`, and writes the handoff and Codex prompt.
