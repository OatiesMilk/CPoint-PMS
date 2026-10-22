# Phase 23 plan — Production progression in place of stage monitoring

> **Status: approved by Dylan on 2026-10-21 (1A Finish roll at Preparation, 2B every 4 hours,
> 3B only the QI enters check-ins, 4A 10 working days, 5A the first quota applies from today).** Brief:
> `docs/prompts/production-progression.md` → `<phase_23>`. Branch: none (work stays uncommitted on
> the `main` checkout in `C:\dev\CPoint-PMS`, with Phases 20 to 22).
>
> **Built on 2026-10-21.** Changes while building: (1) the closed-check-in message says "Write the
> count in the notes of today's next check-in instead." because, with 3B, the Floor Manager can't
> note it; (2) the day rows start at the first check-in ever entered, so days before the system
> was used don't read as missed; (3) shoe type names in report rows are `label`, so no report key
> is `name` (the D-008 payload test); (4) the demo week keeps its newest roll at Preparation for the
> camera and the finish hint; (5) every active shoe type needs a quota when saving the quota form.

## 0. Starting point

- Newest QA report: `qa/reports/2026-10-21-phase-22-attendance-run2.md`, **PASS** (R1 to R4; e2e
  94 passed, 0 failed, 1 skipped). **No failures to fix first.**
- Phases 20, 21 and 22 are uncommitted on `main`. Phase 23 adds to the same working tree.
- Last migration: `20261021031541_attendance`. Phase 22 used D-077 to D-081, so this phase starts
  at **D-082** (the brief says D-077; that was written before Phase 22).

## 1. What I reuse (by file)

| Need                                   | Reused from                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Worker count (the only one, D-080)     | `workforceFor`, `rosterFor` (`src/lib/attendance-rules.ts`), `loadDay` in `attendance.service.ts`      |
| Manila days and CSV                    | `manilaToday`, `addDays`, `manilaDayStart`, `fillDays`, `toCsv`, `parseRange` (`report-rules.ts`)      |
| `409 STALE`, transactions, audit       | `Errors.stale`, `runInTransaction`, `recordAudit(tx, …)`                                               |
| Form errors (D-038)                    | `action-result.ts`, `field-error.tsx`, `form-error-summary.tsx`, `focus-first-invalid.ts`              |
| Chart                                  | `recharts` (already used by `flow-chart.tsx`, `verdict-trend-chart.tsx`), tokens only, `dataviz` skill |
| Home card look                         | `attendance-card.tsx`, `low-stock-card.tsx`                                                            |
| Report sections                        | `KpiTile`, `AttentionList` (`ops-parts.tsx`), the Operations card/table pattern                        |
| Batch cancel, roll return, repair note | `cancelBatch`, `returnRolls`, `openRepairsNote` (kept as they are)                                     |
| Shoe types as data                     | `listActiveShoeTypes` (`reference-data.model.ts`)                                                      |

## 2. Schema (migration `production_progression`)

```prisma
/// When the QI counts finished pairs (D-083). The row in force on a day is the latest effectiveFrom ≤ day.
model ProductionSchedule {
  id              String   @id @default(uuid(7)) @db.Uuid
  shiftStart      String   // "HH:mm", Manila
  shiftEnd        String
  intervalMinutes Int      // 60, 120, 180 or 240
  workingDays     Int[]    // ISO weekdays, 1 = Monday
  effectiveFrom   DateTime @db.Date
  createdById     String?  @db.Uuid // null for the bootstrap default
  createdAt       DateTime @default(now())
  @@index([effectiveFrom])
  @@map("production_schedules")
}

/// Pairs per shoe type per day for the whole line (D-085). Never per person.
model DailyQuota {
  id             String   @id @default(uuid(7)) @db.Uuid
  shoeTypeId     String   @db.Uuid
  pairs          Int
  suggestedPairs Int?     // what the page suggested when it was set
  effectiveFrom  DateTime @db.Date
  createdById    String   @db.Uuid
  createdAt      DateTime @default(now())
  @@index([shoeTypeId, effectiveFrom])
  @@index([createdById])
  @@map("daily_quotas")
}

model ProductionCheckIn {
  id                   String    @id @default(uuid(7)) @db.Uuid
  day                  DateTime  @db.Date
  slotAt               DateTime  // the scheduled time
  enteredAt            DateTime  @default(now())
  enteredById          String    @db.Uuid
  constructorsPresent  Int?      // null = attendance not taken (D-080), read when saved
  constructorsOnRoster Int?      // so "5 of 16 were absent" stays true later
  notes                String?
  correctedAt          DateTime?
  correctedById        String?   @db.Uuid
  correctionReason     String?
  counts               ProductionCount[]
  @@unique([day, slotAt])
  @@index([enteredById])
  @@index([correctedById])
  @@map("production_check_ins")
}

model ProductionCount {
  id         String @id @default(uuid(7)) @db.Uuid
  checkInId  String @db.Uuid
  shoeTypeId String @db.Uuid
  pairs      Int
  @@unique([checkInId, shoeTypeId])
  @@index([shoeTypeId])
  @@map("production_counts")
}
```

- Relations on `User` (entered, corrected, quota and schedule author) and `ShoeType` (quotas,
  counts). UUIDv7, snake_case, every FK indexed, no hard deletes (D-018).
- One addition to the brief: `constructorsOnRoster` is kept on the check-in beside
  `constructorsPresent`, so the shortfall sentence ("5 of 16 were absent") never changes after the
  fact.
- **Existing rows (assumption 2):** nothing is converted. `Batch`, `BatchStageLog`, `Stage`,
  `currentStage` and `targetQuotaPairs` stay in the schema. Old batches keep their timeline.

## 3. Rules (pure, unit-tested)

**`src/lib/production-rules.ts`**

- `scheduleOn(schedules, day)`, `quotaOn(quotas, shoeTypeId, day)`: latest `effectiveFrom ≤ day`.
- `slotsFor(schedule, day)`: 08:00–17:00 every 2 h → 10:00, 12:00, 14:00, 16:00, 17:00; none on a
  non-working day.
- `slotState(slot, checkIn, now)`: Upcoming, Due, Late (`LATE_AFTER_MINUTES = 30`, one constant
  with an `ASSUMPTION` comment), Entered, Missed (the Manila day ended with nothing entered).
- `dayProgress(checkIns, quotas, slotsLeft)`: per shoe type, pairs so far, quota, % of quota, and
  "38 pairs more over 2 check-ins to reach the quota" (or "Quota reached.").
- `suggestQuota(history, schedule, expectedConstructors)`: average pairs per check-in over the last
  10 full working days × check-ins per day, plus the line average per constructor present ×
  constructors expected, each with its sentence. Null with a reason under 3 full days.
- `explainShortfall(day)`: "Below quota by 18 pairs. 5 of 16 Shoe Constructors were absent." /
  "Below quota by 6 pairs with everyone present." / "Below quota. Attendance wasn't taken that
  day." Numbers only, never a name.
- `checkInWindow(slot, now)`: the "isn't open yet" and "closed at midnight" refusals.

**`src/lib/stage-machine.ts` becomes the roll lifecycle** (file kept, contents replaced):
`start` (Planned → In progress at Preparation), `finish` (In progress at any stage → Completed,
so an older batch past Preparation can finish too), `cancel` (unchanged). `advance`, `move_back`,
`complete`, `nextStage`, `previousStage` and `stageDurations` go. Refusals: "This roll is already
finished.", "Start the roll first.", "This roll was cancelled." `EXPECTED_PIECES_PER_ROLL = 10`
with an `ASSUMPTION` comment (Phase 24 moves it onto the roll item), and
`finishHint(scanned)` → "All 10 pieces scanned. Finish this roll?".

## 4. Access and navigation

| Permission           | Roles                                   |
| -------------------- | --------------------------------------- |
| `production:read`    | Floor Manager, Quality Inspector, Admin |
| `production:checkin` | Quality Inspector only (3B)             |
| `production:plan`    | Floor Manager                           |
| `batch:finish` (new) | Floor Manager, Quality Inspector        |

- Nav, Production section: **Production** (`/production`), Attendance, Batches, Inventory,
  Procurement. The QI now sees the Production section (Production and Batches).
- Update `permissions.ts`, `navigation.ts` (new `production` icon), the master spec's roles table,
  `tests/unit/permissions.test.ts` (it covers the nav too) and the `auth.spec.ts` nav lists.

## 5. Stage monitoring: what goes, with each caller

| Removed                                                                                                | Callers changed                                                                                        |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `batchesByStageSummary`, `BatchesByStageCard`, `inProgressByStage`                                     | FM home → **Today's production** card                                                                  |
| `StageProgress` (`stage-progress.tsx`) and the batch detail durations                                  | Batch page: the timeline table stays, titled **History** (old batches keep their stage rows)           |
| `transitionBatchStage` advance / move back / complete                                                  | `batch-actions.tsx` (Start roll, **Finish roll…**, Edit, Cancel), `actions.ts`, controller, validator  |
| `productionReport` stage times, `pickBottleneck`, `stageDurations` and `openStageWaits` (report model) | `ops-report.service.ts`, `report.controller.ts` (`GET /reports/production` now returns pairs vs quota) |
| `findStuckBatches`, `stageShares`, `OpenBatch`, `StageStat`, `leadTimes`, `openBatches` lanes          | `ops-report.service.ts`, `buildAttention` (loses bottleneck and stuck items)                           |
| "On the floor now" (`FlowLanes`), "Time in each stage", the batch Flow chart                           | `operations-view.tsx` → a **Production** section                                                       |
| `stagesCsv` and `/api/v1/reports/stages.csv`                                                           | reports page export list → **Production CSV** (`/api/v1/reports/production.csv`)                       |
| Target quota field, list column and detail row                                                         | `batch-form.tsx`, `edit/page.tsx`, `batches/page.tsx`, `[id]/page.tsx`, `batch.validator.ts`           |
| Stage filter and "time in stage" column on the batch list                                              | `batch-filters.tsx`, `batch.model.ts` (`stage` filter), `batch.service.ts` (`timeInStageMs`)           |
| `STAGE_HOURS` / stage replay in the demo week                                                          | `demo-seed.service.ts`                                                                                 |

Code with no caller left is deleted, with its unit tests.

**Kept:** batch create, edit, cancel, the detail page, the camera rule (oldest batch at
Preparation, D-020), Capture, salvage, supplier quality and claim sheets.

**Batch wording:**

- Status filter: Planned, At Preparation, Finished, Cancelled. The status badge reads the same
  (In progress → "At Preparation", Completed → "Finished"). An old batch in progress past
  Preparation reads "Started before rolls were tracked" with **Finish roll**.
- `409 BATCH_MOVED` on Capture becomes "This roll was finished, so this section wasn't saved. The
  next scan goes to B-2026-0042. Press Capture again." `NO_BATCH_MESSAGE` says "No roll is at
  Preparation. Start one on the Batches page, then scan again."

**Finish roll** (`finishRoll` in `batch.service.ts`): FM or QI. A dialog shows the scan count and,
when open, the repair note (as completing does today, D-022) and any scans still waiting for
review. Conditional update (`409 STALE`), closes the open `BatchStageLog` row, `recordAudit`
`batch.finish`. The hint "All 10 pieces scanned. Finish this roll?" shows on the batch page and the
Capture page when scans ≥ 10. On Capture, an allowed constructor sees the hint without the button
("Ask the Floor Manager or the QI to finish it.").

## 6. Pages

- **`/production`** (all three roles; buttons follow permissions). Intent brief at the top. Worst
  case: a shortfall read as one person's fault.
  - **Today:** one row per check-in: time, state badge (icon + label), pairs per shoe type,
    constructors present, entered by (an audit fact, never totalled), and **Enter count** or
    **Correct**. "Attendance changed after this check-in" when today's count no longer matches.
  - **Today against the quota:** per shoe type a progress bar, "86 of 120 pairs (72%)", the pace
    sentence; after the last check-in, the shortfall sentence.
  - **Recent days:** the last 14 working days: pairs per type, quota, % of quota, constructors
    present / on roster, pairs per constructor present (line average), shortfall sentence. A chart
    of pairs per day against the quota line (labelled, not colour alone) with constructors present
    as a second series.
- **Enter count** (a dialog on `/production`; the QI home links to `/production?enter=<slot>`):
  one whole-number field per active shoe type ("School Shoes finished since 10:00"), constructors
  present read-only (or "Attendance not taken yet. Ask the Floor Manager." without blocking), notes.
  **Correct** asks for a reason, same Manila day only.
- **`/production/plan`** (FM): the schedule form (shift start, shift end, interval, working days,
  "Applies from tomorrow, Thu 22 Oct") and a quota per shoe type with the suggestion and **Use
  suggestion**. History of both, newest first, 15 per page.
- **Homes:** QI home gets **Next check-in** ("12:00 check-in is due" / "Late by 40 minutes", Enter
  count). FM home: **Today's production** (progress per type, the next check-in, late or missed
  ones) replaces Batches by stage. The Admin home is unchanged.
- **Reports → Operations:**
  - KPI tiles (the brief doesn't say): Batches completed, Batches started, Typical lead time and In
    production now become **Pairs made**, **Of quota**, **Rolls finished** and **Rolls at
    Preparation**. First-pass yield and To clean or cut around stay.
  - A **Production** section (pairs per day per type, quota, %, constructors present, shortfall
    sentences) replaces the On the floor now, Flow and Time in each stage sections.
  - The Daily summary's Started and Completed columns read Rolls started and Rolls finished
    (`operations.csv` headers follow).
  - Attention: the bottleneck and stuck-batch items go; "3 of the last 5 working days were below
    quota" comes in.

## 7. API (one-line routes; `docs/API.md`)

- `GET /api/v1/production/today`, `GET /api/v1/production/days?from&to` (`production:read`)
- `POST /api/v1/production/check-ins` `{ slotAt, counts: [{ shoeTypeId, pairs }], notes? }`
- `PATCH /api/v1/production/check-ins/[id]` `{ counts, reason }` (`production:checkin`)
- `PUT /api/v1/production/schedule`, `PUT /api/v1/production/quotas` (`production:plan`)
- `GET /api/v1/reports/production.csv` (one row per day and shoe type); `GET /reports/production`
  returns the same rows as JSON
- `POST /api/v1/batches/[id]/stages` accepts `start` (`batch:manage`) and `finish`
  (`batch:finish`) only; `advance`, `move_back` and `complete` get a 422 naming the two moves.

## 8. Validation messages (Zod, shared by forms and the API, D-038)

The eight in the brief, word for word, plus: "Pick at least one working day.", "Enter the shift
start as a time, like 08:00.", "A check-in can't have the same shoe type twice." and "This
check-in was already corrected by Lea Santos at 12:40. Refresh to see it." (stale correction). A
second entry of the same slot is `409 STALE` with the brief's sentence.

## 9. Seeds

- **Bootstrap:** the default schedule (08:00 to 17:00, every 4 hours (2B), so 12:00, 16:00 and
  17:00; Monday to Saturday),
  effective from 2000-01-01 so it is always in force. No quota (quotas are the FM's call).
- **Demo week:** each roll is started, scanned at Preparation and **finished** when its scans are
  done (no stage replay); the thread, adhesive and nails the replay used post at the finish
  instead, so the ledger still balances. Quotas per shoe type from the first demo day. Check-ins
  for every past working day through the real service, with one entered late and one missed; the
  three days with 5, 3 and 2 constructors absent (Phase 22's pattern) end below quota. Today's
  check-ins up to now. `demo:reset` removes check-ins, quotas and schedules other than the default.

## 10. Tests

- **Unit:** `production-rules` (shift end off the grid, 4-hour interval, the 30-minute boundary,
  one missed check-in, a new shoe type mid-week, a quota change effective tomorrow, zero
  constructors present, attendance not taken, the suggestion under 3 days); the roll lifecycle
  (each move and refusal); `production.service` (unique slot → `409 STALE`, a correction keeps both
  values in the audit, a change applies from tomorrow, the snapshot of constructors present);
  `finishRoll`; validators (`validator-messages.test.ts`); permissions and nav; the D-008 payload
  tests (`report.service.test.ts`, `ops-report.service.test.ts`) extended to the production and
  attendance responses. Rewritten or trimmed: `stage-machine`,
  `ops-rules`, `report-rules`, `report.service`, `ops-report.service`, `batch.service`,
  `batch.validator`, `capture.service`, `demo-seed`.
- **E2E (written, not run; Codex runs them):** new `tests/e2e/production.spec.ts` (FM sets a
  schedule and a quota; QI enters a check-in; a second entry of the slot is refused; a correction
  needs a reason; the FM home shows progress; a constructor is refused; axe on `/production` and
  `/production/plan`). Updated: `batches.spec.ts` (Start roll, Finish roll), `outcomes.spec.ts`
  (finish with a repair open), `reports.spec.ts` (Production section, `production.csv`, no
  `stages.csv`), `smoke.spec.ts`, `auth.spec.ts` (nav lists).

## 11. Docs

`docs/ROADMAP.md` (Phase 23 section; Phase 2 and Phase 7 stage items marked replaced),
`docs/STATUS.md`, `docs/DECISIONS.md` D-082 onward (the roll lifecycle, superseding D-019's
lifecycle and the stage parts of D-025; the schedule and its timing; who enters check-ins; the
quota and its suggestion; the shortfall sentence within D-008; the KPI and CSV changes),
`docs/API.md`, the README demo script, the master spec's roles table, `docs/SESSION_LOG.md`, and
the QA handoff `qa/handoffs/2026-10-21-phase-23-production-progression.md`.

## 12. Checks I run

`npm run check` (lint, typecheck, unit tests, build). No Playwright or browser tests; Codex runs
the e2e specs from the handoff.

## 13. Questions (recommended first)

1. **How a batch ends:** Finish roll at Preparation (recommended), or keep the four stage moves and
   Complete from Finishing?
2. **Default check-in interval:** every 2 hours (recommended, your example), or every 4 hours (the
   survey's morning, lunch and afternoon walks)?
3. **Who enters check-ins:** the QI and the Floor Manager (recommended, so a day without a QI isn't
   lost), or the QI only?
4. **Quota suggestion window:** the last 10 working days (recommended), 5 or 20?
5. **The first quota:** when a shoe type has no quota yet, the first one applies from today
   (recommended, so a fresh system isn't a day without a quota); every later change applies from
   tomorrow. Or always from tomorrow?
