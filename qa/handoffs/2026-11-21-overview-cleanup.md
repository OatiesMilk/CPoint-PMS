# QA handoff: Overview clean-up (the Floor Manager's home)

| Field           | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| Date            | 2026-11-21                                                                                         |
| Feature         | overview-cleanup                                                                                   |
| Branch          | uncommitted on `main` at 68f3c21 (Phase 34 merged, #56 and #57)                                    |
| Spec / prompt   | `docs/prompts/plans/floor-manager-overview-cleanup-plan.md`, decision D-131, `docs/ROADMAP.md`     |
| Written by      | Claude                                                                                             |
| Previous report | none (the last report on this folder is `qa/reports/2026-11-20-phase-34-run4.md`, PASS, unrelated) |

## 1. What changed

Only the Floor Manager's **Overview** (`/floor-manager`) and one banner. No data, rule, route or
permission changed, so no migration and no API change.

- The page has **three zones** with 32 px between them and 16 px between cards:
  1. **Needs attention**, only when something is due: slim rows for **Plan today** and **Stock update
     today**. With nothing due the zone isn't on the page (no empty box, no gap). When both are due
     **Plan today** is the filled button and **Update stock** the outlined one (one primary per view).
  2. **On the line now**: **Today's batches** (wide) beside **Work in progress**, the same height.
  3. **Today so far**: **Attendance**, **Rolls today**, **Low-stock alerts**, **Daily summary**, two by
     two (four in one row from 1536 px), one height per row.
- The **plan banner** ("Today has no plan yet, so there are no batches. Plan today.") no longer shows on
  the Overview, since the Plan today row says the same thing. It still shows on every other page, the
  bell still lists it, and the batch banner ("B-… is due. Finish it now.") is unchanged everywhere.
- **Work in progress**: a stage not counted today shows "–" (read aloud as "not counted today"); with no
  stage counted one muted line says "No stage has been counted today."; the repairs and waiting line is a
  muted line at the bottom ("No repairs open. Nothing is waiting for inspection." when quiet; the old line
  ended in two full stops).
- **Today's batches** on an unplanned day says "Nothing to count until today is planned." (it no longer
  repeats the plan sentence); the quota block stays.
- **Take attendance** is an outlined button now (a card-level action, not the page's primary).
- Every other role's pages are unchanged.

## 2. Files touched

| File                                                      | Change                                                                                                      |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/floor-manager/page.tsx`                    | three zones; Needs attention is a labelled `section` shown only when due; `primary` passed to the stock row |
| `src/app/(app)/floor-manager/wip-card.tsx`                | same height, auto-fit stage figures, "–" and quiet states, muted footer line                                |
| `src/components/features/overview/action-card.tsx`        | **new**: the slim alert row (icon, title, one line, one button)                                             |
| `src/components/features/production/production-cards.tsx` | Plan today on the action row; Today's batches `h-full` and the new no-plan line                             |
| `src/components/features/inventory/stock-update-card.tsx` | on the action row; `primary` prop                                                                           |
| `src/components/features/attendance/attendance-card.tsx`  | `h-full`; Take attendance outlined                                                                          |
| `src/components/features/reports/home-cards.tsx`          | Rolls today `h-full`; Daily summary `h-full`, links at the card's bottom                                    |
| `src/components/features/inventory/low-stock-card.tsx`    | `h-full`                                                                                                    |
| `src/components/features/batches/batch-notices.tsx`       | the plan banner returns nothing on `/floor-manager`                                                         |
| `src/app/(app)/layout.tsx`                                | the plan banner's wrapper is `empty:hidden` (no 32 px gap when it is hidden)                                |
| `tests/e2e/batches.spec.ts`                               | the no-plan test: on the Overview no `plan-notice`, on `/batches` the banner still shows                    |
| `tests/e2e/overview-layout.spec.ts`                       | **new**, read-only: order, one primary, equal heights, 2 × 2 and 1 × 4, no sideways scroll, axe             |
| `DESIGN.md`, `docs/USER_MANUAL.md`, wrap-up docs          | the Overview section and the banner rule                                                                    |

Database migration in this change: **no**.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, `npm install` done, `.env` filled in (`AUTH_SECRET`,
`BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
docker compose stop app   # the old Docker app holds port 3000; stop it first
npm run db:up
npm run db:deploy
npm run dev               # http://localhost:3000 (a fresh dev server, started after the code change)
```

Health check: `http://localhost:3000/api/health` returns OK.

**Getting the due rows.** The demo week plans today and the days before it, so on a real weekday no row is
due and Needs attention isn't shown (that is scenario O2). To see the rows, use the Demo mode band →
**Change time** (D-125) and move the clock to a future weekday, **09:00** (the demo plans nothing ahead):
that day has no plan (the Plan today row), no stage count, no attendance and no rolls. If that weekday is
also a **Wednesday or Friday** (the default reminder days) with no stock update saved on it, the Stock
update row shows too, so one clock setting covers O1, O3 and O5. **Back to real time** when done.

Existing automated tests that cover this area (run these too):

```bash
$env:E2E_BASE_URL="http://localhost:3000"
npx playwright test tests/e2e/overview-layout.spec.ts tests/e2e/batches.spec.ts tests/e2e/stage-wip.spec.ts tests/e2e/reports.spec.ts tests/e2e/inventory.spec.ts tests/e2e/attendance.spec.ts --workers=2
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page         |
| ----------------- | -------------------------- | ----------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`  |
| Quality Inspector | `inspector@cpoint.local`   | `/batches`        |
| System Admin      | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture` |

Data: the demo week after `npm run demo:reset '--' --yes` (2 to 3 minutes); the demo clock for the due rows.

## 5. Test scenarios

Browser checks in the in-app browser at 1280 px unless a width is given (resize with the browser's
viewport menu). Screenshots of O1, O2 and O4 go in `qa/reports/artifacts/` for Dylan to compare with his
"messy" screenshot.

| ID  | Role                            | Steps                                                                                                                                                                                                                                                                    | Expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Priority |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| O1  | Floor Manager                   | Clock to a future weekday 09:00 (unplanned). Open `/floor-manager`. Then open `/batches`, `/attendance` and `/reports`. Open the bell.                                                                                                                                   | On the Overview the **first thing under "Good day, …" is the Plan today row**: no banner above the title, and "Plan today" appears as a title once (the row), with one **Plan today** button. Today's batches reads "Nothing to count until today is planned." with no button. The banner "Today has no plan yet, so there are no batches. Plan today." shows on `/batches`, `/attendance` and `/reports`. The bell still lists "Today has no plan yet. Plan today."                                                                                                                                                                                         | High     |
| O2  | Floor Manager                   | Real time, a weekday with today planned and no stock update due (or any day with both rows saved). Open `/floor-manager` at 1280 and 1536 px.                                                                                                                            | No Needs attention zone and no gap under the header (the first card follows the header). Today's batches and Work in progress sit side by side at 1280 px and have the same top and height; the same at 1536 px.                                                                                                                                                                                                                                                                                                                                                                                                                                             | High     |
| O3  | Floor Manager                   | Clock to a future Wednesday or Friday 09:00. Open the Overview.                                                                                                                                                                                                          | The Needs attention zone has two rows, Plan today first, then Stock update today. **Plan today is the filled button, Update stock the outlined one.** If you save a stock update (or move the clock to a day with a plan), the remaining row's button is filled.                                                                                                                                                                                                                                                                                                                                                                                             | High     |
| O4  | Floor Manager                   | Real time. Look at the four lower cards (Attendance, Rolls today, Low-stock alerts, Daily summary) at 1280, 1536 and 700 px.                                                                                                                                             | 1280: two by two, the tops of each pair equal, each pair one height. 1536: one row of four, tops equal. 700 (below 768): one column. 768 and up: two columns. Daily summary's **Reports** and **Download 14-day CSV** sit at the card's bottom edge. No card floats mid-row.                                                                                                                                                                                                                                                                                                                                                                                 | High     |
| O5  | Floor Manager                   | Clock to a future weekday (no stage counts, no attendance, nothing finished that day). Repairs, work waiting for inspection and rolls still open are line-wide, not per day, so the seeded ones stay on any day. Look at each card; with low stock cleared, or as it is. | Work in progress: every stage "–" and one muted line "No stage has been counted today.", then the muted last line with one full stop each (with the seeded repairs: "17 pairs in repair. 1 batch and 1 repair waiting for inspection."; "No repairs open. Nothing is waiting for inspection." only when none are open, which a unit test covers). Attendance: "Not taken yet today." with an **outlined** Take attendance button. Rolls today: "No roll finished at Capture yet today." and 0 scanned and 0 returned (Rolls still open stays the line-wide count). Low-stock: "Nothing to reorder right now." when none. No card collapses or leaves a hole. | Medium   |
| O6  | Floor Manager covering          | Clock to 17:05 on a planned weekday; in Attendance mark the Quality Inspector absent (put it back after). Open the Overview.                                                                                                                                             | The batch banner "B-… is due. Finish it now." with **Finish B-…** shows above the title and is the only banner. No plan banner. If no batch is due after the reset, say blocked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Medium   |
| O7  | Quality Inspector, System Admin | Sign in as each on an unplanned weekday (clock); the QI opens Batches → Today, the Admin only the home (the Admin has no Batches page).                                                                                                                                  | No visible change for either role. The QI reads "No batches yet today. The Floor Manager plans them first." on Today; neither sees the plan banner or the Needs attention zone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Medium   |
| O8  | Floor Manager                   | Dark theme (the sidebar's theme switch); resize to 768 px; Tab through the Overview; run an accessibility scan if available.                                                                                                                                             | Both themes: the rows read as alerts (info blue), text readable. At 768 px nothing scrolls sideways. Tab order follows the page: Needs attention row buttons, Today's batches' Open, Work in progress' Open, Attendance, Rolls, Low-stock, Daily summary links. No serious axe findings. Needs attention has a hidden heading read by a screen reader; the cards' titles are the visible headings.                                                                                                                                                                                                                                                           | Medium   |
| O9  | n/a                             | Run the e2e files in section 3 with `--workers=2`, then the full suite with `--workers=2` on a fresh dev server.                                                                                                                                                         | `overview-layout.spec.ts` passes (a test may skip when nothing is due, which it says); the edited `batches.spec.ts` no-plan test passes; no other spec reads the changed text.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | High     |

### Access checks

| ID  | Role that must NOT have access                    | URL or action    | Expected                                           |
| --- | ------------------------------------------------- | ---------------- | -------------------------------------------------- |
| A1  | Quality Inspector, Shoe Constructor, System Admin | `/floor-manager` | Redirect to their own home or Forbidden, as before |

## 6. Out of scope / known issues

- The screenshots in `docs/screenshots/manual/` were not retaken; `06-overview.png` still shows the old
  layout. Dylan or Codex may retake it (O1 and O2 are the pictures).
- `batches.spec.ts` needs a batch due today, so it fails between 00:00 and 01:00 Manila (known, see STATUS).
- A full run with six workers on one `next dev` stalls sign-ins (Phase 32 notes): use `--workers=2`.
- At exactly 768 px the lower cards are already two columns (`md`); one column is below 768.
- Claude ran `npm run check` only (lint, typecheck, 944 unit tests, build). Nothing was looked at in a
  browser or e2e by Claude.
