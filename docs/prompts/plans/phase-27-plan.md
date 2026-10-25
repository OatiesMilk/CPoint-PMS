# Phase 27 plan — Batches are the check-in intervals

> **Status: draft, waiting for Dylan's approval. No code changed yet.** Brief:
> `docs/prompts/factory-visit-changes.md` → `<phase_27>` (C-2 to C-8, C-18, C-25 to C-31, C-40,
> C-41; A-2 to A-9, A-24). Branch: none. The work stays uncommitted in `C:\dev\CPoint-PMS` until
> Dylan branches from the latest `main`.

## 0. Starting point

- Laptop `main` is at `33fe2b3` (#24, Phase 26 and its QA run 2 PASS), level with `origin/main`.
  The only local change is `docs/STATUS.md` (the Phase 26 "QA passed" update, not committed yet).
- Newest QA: `qa/reports/2026-10-24-phase-26-run2.md`, **PASS** (e2e 73 passed, 2 failed, 1
  skipped; both `rolls.spec.ts` failures passed alone, a test-isolation note). **Nothing to fix
  first.** One `rolls.spec.ts` test asserts `/batches` is 404; this phase brings `/batches` back,
  so that line changes (`/batches/new` and `/constructor` stay 404).
- Last migration: `20261025090000_rolls_at_capture`. Last decision: D-096, so this phase writes
  **D-097** (a batch is a check-in interval; lunch), **D-098** (worked-out statuses, Finish batch
  with failed pairs, on-screen notices) and **D-099** (no shoe types, one daily quota).
- The visit notes and the brief agree for this phase. Deferred to Phase 28 by Dylan: trimming the
  FM sidebar (Camera, Scans, the Quality heading). Role homes also stay for Phase 28 (question 3).

## 1. What I reuse

| Need                         | Reused from                                                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Schedule rows from tomorrow  | `ProductionSchedule`, `inForceOn`, `effectiveFromFor`, `saveSchedule` (D-083)                  |
| A batch's record             | `ProductionCheckIn` (one row per batch, `@@unique([day, slotAt])`, `409 STALE`, D-084)         |
| Who may finish               | `mayEnterCheckIns` / `checkInCoverReason` (D-088, C-29), unchanged                             |
| Same-day correction          | `correctCheckIn` with `expectedUpdatedAt` and a reason; both counts in the audit               |
| Worker counts                | `workforceByDay` (D-080), the shortfall sentence's absences                                    |
| Quota suggestion, pace       | `suggestQuota`, `paceSentence`, `explainShortfall`, `belowQuotaAttention`, now on passed pairs |
| Production page parts        | `/production` page, `check-in-dialog.tsx`, `plan-forms.tsx`, `production-parts.tsx`, cards     |
| Phone layout                 | `DESIGN.md` → Phone layout (D-096): the top bar, `h-11` controls, the bottom action            |
| Settings tab + history table | the Thresholds and early-model notice forms in `admin/settings`                                |
| Reports                      | `ops-report.service.ts` production section, `productionCsv`, the Operations view               |
| Demo week                    | `demo-seed.service.ts` → `seedProduction` (through the real services)                          |

## 2. Step A — remove shoe types (own green checkpoint, before new behaviour)

Delete: `src/app/api/v1/shoe-types/**`, Settings → Shoe types tab, `shoeTypeSchema` and the
`shoeType` reference kind (validator, service, controller, model maps), `ensureShoeType`,
`listActiveShoeTypes`, `listAllShoeTypes`, `findShoeType`, `REFERENCE_DATA.shoeTypes` in the
bootstrap, `shoeTypeCodes` in `demo-reset`, the per-type fields of the check-in dialog, quota form,
Production tables, Operations view and `production.csv`, and the shoe-type lines in `admin.spec.ts`.
The audit log keeps old `ShoeType` rows as history; their entity link goes (the tab no longer
exists). Then the code uses one `pairs` per check-in and one quota (Step B's schema).

## 3. Step B — schema and the migration `batches_are_intervals`

| Change                                                                                                                                                  | Existing rows (A-10)                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| new `LunchBreak` (`lunch_breaks`): `startTime?`, `endTime?` ("HH:mm"), `effectiveFrom`, `createdById?`, `createdAt`; both times null = "No lunch break" | none created by the migration; the bootstrap adds the default (below)                                                                                  |
| `ProductionSchedule.intervalMinutes` becomes optional: **null = once at the end of the day**                                                            | unchanged (60 to 240)                                                                                                                                  |
| `ProductionCheckIn.pairs Int`, `failedPairs Int @default(0)`                                                                                            | `pairs` = the sum of its `production_counts`; `failedPairs` 0                                                                                          |
| drop `production_counts`                                                                                                                                | summed first                                                                                                                                           |
| `DailyQuota` loses `shoeTypeId`                                                                                                                         | for each distinct `effectiveFrom`, one row with the sum of the per-type quotas in force that day (creator = that day's latest setter, suggestion null) |
| drop `shoe_types`                                                                                                                                       | gone (nothing else references it since Phase 26)                                                                                                       |

**The default lunch (A-4).** `ensureDefaultLunchBreak` in the bootstrap, beside
`ensureDefaultSchedule`: when no lunch row exists it adds 11:00–12:00, in force from **2000-01-01
on a database with no check-ins** (a new or reset one) and **from tomorrow otherwise**, so the dev
database's past days keep their old check-in times (12:00, 16:00, 17:00) and still match their
rows. I'll run the migration's SQL on a scratch copy in the cloud to check the sums.

Internal names stay (`ProductionCheckIn` is a finished batch, `production.*` the code); CLAUDE.md
gets the glossary line.

## 4. Rules (`src/lib/production-rules.ts`, pure, unit-tested)

- `batchesFor(schedule, breaks, day)` replaces `slotsFor`: number, `start`, `end` (= `slotAt`),
  the break inside, working minutes and the label "Batch 2 · 10:00–13:00, lunch 11:00–12:00".
  Working time leaves the breaks out; a batch whose working time runs out at a break's start ends
  when the break ends (C-26); the last batch ends at the shift end (A-2); end of day is one batch;
  a break outside the shift is ignored (and the plan page and Settings say so).
- `batchState(batch, record, now)`: UPCOMING, IN_PROGRESS (with `pausedForLunch`), DUE at its end,
  LATE 30 minutes after (D-084, ASSUMPTION comment), FINISHED (with a Corrected tag), MISSED at
  midnight. `FINISH_OPENS_MINUTES = 10` (C-28): finishable from end − 10 minutes to midnight.
- `noticesFor(batches, records, now)`: the next notice times (end − 10 minutes and the end, by the
  clock), shared by the browser and the tests.
- Pace, shortfall and suggestion on **passed** pairs (finished − failed, C-41), no shoe types.

Required tests (08:00–17:00, lunch 11:00–12:00): every 4 h → 08–13, 13–17; every 2 h → 08–10,
10–13, 13–15, 15–17; end of day → 08–17; every 3 h → 08–12, 12–15, 15–17; every hour → Batch 3
10–12; no lunch every 4 h → 12:00, 16:00, 17:00; two breaks; lunch outside the shift refused; a
lunch change from tomorrow; a day that isn't a working day.

## 5. Access (unchanged matrix, new uses)

The QI finishes and corrects; the FM only on a day with no QI present (`mayEnterCheckIns`); the FM
plans (`production:plan`); the Admin sets the lunch (`settings:manage`). `production:read` keeps the
Admin's read-only view until Phase 28 trims it. Sidebar: **Production → Batches** (`/batches`),
same position, for FM, QI and Admin. Constructors are refused as today.

## 6. Screens

- **`/batches`** (replaces `/production`; phone first for the QI): today's batches as cards with
  number, times and lunch, a status badge (icon + word), and when finished "40 pairs, 3 failed
  inspection · Finished 13:04 by Maricel Dizon". The due or late batch, and the next one from 10
  minutes before its end, has **Finish batch**. Today against the quota (one number, passed pairs,
  the pace). The FM also sees Recent days (14 working days, chart, shortfall sentences). At 390 px:
  one column, `h-11` controls, Finish batch fixed at the bottom (D-096).
- **Finish batch:** the existing Dialog, full-width at the bottom on a phone (no new component):
  "Pairs finished in Batch 2 (10:00–13:00)", "Of these, failed inspection" (starts at 0), both
  `inputMode="numeric"`, notes, **Finish batch 2**. **Correct** the same day with a reason.
- **`/batches/plan`** (FM, replaces `/production/plan`): shift start and end; **How often**: every
  1, 2, 3 or 4 hours, or once at the end of the day; working days; "Applies from tomorrow"; a
  preview ("Tomorrow: Batch 1 08:00–13:00, Batch 2 13:00–17:00", with tomorrow's lunch); one daily
  quota with its suggestion; history of both.
- **Settings → Lunch break** (Admin): start, end, "No lunch break", applies from tomorrow, history.
- **Notices (A-9)** for the QI, and the FM on a covering day, on every page: a banner at the top of
  the page at end − 10 ("Batch 2 ends at 13:00. Get ready to count the finished pairs.") and at the
  end ("Batch 2 is due. Finish it now." with **Finish batch**); a **bell** listing due and late
  batches; the tab title starts with "(1)". A client component in the app layout fetches
  `GET /api/v1/production/today` every 60 s and when the tab returns, and sets timers from
  `noticesFor`. No browser notification, push, sound or server scheduler (C-31).
  The desktop has no top bar, so the bell sits at the top of the sidebar beside the logo, and in
  the phone top bar (the smallest fit for "a bell in the top bar").
- **FM home:** Today's batches replaces Today's production. **QI home:** Next check-in becomes Next
  batch, linking to `/batches` (see question 3).
- **Reports → Operations:** Production per day with pairs finished, failed, failed share and
  passed against the quota; KPI tiles Pairs finished, Failed inspection, Of quota, Rolls finished.
  `production.csv`: one row a day (Date (Manila), Pairs finished, Failed inspection, Failed %,
  Passed, Daily quota, % of quota, Batches finished, Batches scheduled, Shoe Constructors present,
  On the roster, Pairs per constructor present (line average), Day below quota). Never per person.
- Removed: Settings → Shoe types, every shoe-type field, filter and column, and `/production`
  (404; it moves to `/batches`).

## 7. API (`docs/API.md` updated)

- `GET /api/v1/production/today`: batches with states, the lunch, the quota, `canFinish`.
- `GET /api/v1/production/days`: recent days, finished and failed each.
- `POST /api/v1/production/check-ins` `{ slotAt, pairs, failedPairs, notes? }` (`slotAt` = the
  batch's end); `PATCH /api/v1/production/check-ins/{id}` `{ pairs, failedPairs, reason,
expectedUpdatedAt }`.
- `PUT /api/v1/production/schedule` (`intervalMinutes: null` = end of day),
  `PUT /api/v1/production/quotas` `{ pairs, suggestedPairs? }`.
- New `PUT /api/v1/settings/lunch-break` `{ startTime, endTime } | { none: true }` (Admin).
  Removed: `/api/v1/shoe-types/**`.

Messages exactly as the brief's §6.

## 8. Files by layer (about 45 changed, 6 deleted, 6 added)

- **Schema / migration:** `prisma/schema.prisma`, `prisma/migrations/2026102609…_batches_are_intervals`.
- **Rules:** `src/lib/production-rules.ts`, `src/lib/ops-rules.ts` (attention link `/batches`),
  `src/lib/report-rules.ts` (comment).
- **Models:** `production.model.ts` (+ lunch breaks), `reference-data.model.ts` (shoe types out),
  `demo-reset.model.ts`.
- **Services:** `production.service.ts` (batches, finish, correct, plan, lunch, reports, CSV),
  `settings.service.ts`, `bootstrap.service.ts`, `ops-report.service.ts`, `demo-seed.service.ts`,
  `demo-reset.service.ts`, `audit-query.service.ts`.
- **Validators / controllers / routes:** `production.validator.ts`, `settings.validator.ts`,
  `production.controller.ts`, `settings.controller.ts`, `report.controller.ts`, new
  `api/v1/settings/lunch-break/route.ts`; delete `api/v1/shoe-types/**`.
- **Pages / components:** move `app/(app)/production/**` → `app/(app)/batches/**`; `admin/settings`
  (Lunch break tab, Shoe types out); `floor-manager/page.tsx`, `quality-inspector/page.tsx`;
  `components/features/production/*` (cards, parts); new `components/features/batches/
batch-notices.tsx` (banner, bell, tab title); `app/(app)/layout.tsx`, `sidebar.tsx` (the bell
  slot); `navigation.ts`; `reports/_components/operations-view.tsx`.
- **Scripts:** `scripts/demo-reset.ts` (labels).
- **Docs:** CLAUDE.md glossary line, `DESIGN.md` (Batches phone layout, the notice banner and
  bell), `docs/API.md`, README demo script, master spec roles table, wrap-up docs.

## 9. Tests

- **Unit:** `production-rules.test.ts` (§4's examples, states, notices, passed-pair pace and
  suggestion); `production.service.test.ts` (one finish per batch, a second is `409 STALE`; before
  the 10-minute mark refused with "Batch 3 can be finished from 14:50."; failed above finished
  refused; a correction keeps both counts in the audit; schedule, quota and lunch from tomorrow;
  the D-008 payload test); validators and `validator-messages.test.ts`; `settings.service.test.ts`
  (lunch inside the shift, end after start); `permissions.test.ts`; `ops-report`, `demo-seed`,
  `demo-reset` tests updated.
- **E2E (written, not run):** new `tests/e2e/batches.spec.ts` replacing `production.spec.ts`, with
  Playwright's clock: the QI at 390 × 844 sees the notice at end − 10 and at the end and finishes
  the due batch with failed pairs; a second finish refused; the FM sets end of day; the Admin sets
  the lunch; a constructor refused. `reports.spec.ts` (CSV header), `admin.spec.ts` (shoe types
  out), `rolls.spec.ts` (`/batches` no longer 404).

## 10. Seeds

Default schedule and lunch (batches end at 13:00 and 17:00). The demo week: the QI finishes every
batch a few minutes after its end with a few failed pairs a day, one late, one missed, the FM
covering on the day the QI is absent (D-088); one quota number, chosen so the same three short
days line up with the absences on passed pairs. `demo:reset` clears finished batches, quotas,
schedules and lunch breaks, then the bootstrap defaults come back.

## 11. Conflicts and the smallest fix

1. **"A bell in the top bar":** the desktop has a sidebar, not a top bar. The bell goes at the top
   of the sidebar on a desk and in the phone top bar.
2. **The suggestion (D-085)** was "average pairs per check-in × check-ins a day". With lunch and a
   shorter last batch, batches differ in length, and switching to end of day would change the
   number for the same output. Fix: average **passed pairs per full working day** over the last
   10 (question 4).
3. **Past check-ins vs the new lunch:** a lunch in force on past days would move their times and
   orphan their rows. Fix: the default lunch starts tomorrow on a database that has check-ins (§3).
4. **`rolls.spec.ts`** expects `/batches` to be 404; it changes to `/production` 404.

## 12. Questions (one batch, recommended first)

1. **Default lunch:** 11:00–12:00, the visit's example? (Recommended: yes.)
2. **What the QI sees on Batches:** today only, or the last 7 days too? (Recommended: today only.)
3. **The QI's home:** keep the QI Overview this phase with a Next batch card, and make Batches the
   home in Phase 28 with the rest of the role list? (Recommended: yes, Phase 28 owns the homes.)
4. **The quota suggestion:** the average passed pairs per full working day over the last 10 such
   days, instead of per check-in × check-ins? (Recommended: yes.)

## 13. Checks I'll run

`npm run check` (lint, typecheck, unit tests, build) at each checkpoint and at the end; the
migration on a scratch database; a shoe-type removal sweep (`rg -i "shoe.?type"` over `src`,
`tests`, `scripts`, `prisma/schema.prisma` returns only history). No `cv/` change, so no `cv/`
checks. No browser or e2e runs (Codex).

## 14. Dylan's answers (2026-10-24)

1. Default lunch 11:00–12:00, editable by the System Admin (Settings → Lunch break). Yes.
2. The QI sees today only. Yes.
3. The QI keeps the Overview home this phase; Phase 28 makes Batches the home. Yes.
4. The suggestion is the average passed pairs per full working day. Yes.
