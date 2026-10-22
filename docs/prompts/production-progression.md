# Prompt: Phases 22–24 — Attendance, production progression in place of stage monitoring, and materials used from output

> **How to use this file.** It holds **three phases**, one per Claude Code session (CLAUDE.md: one
> phase per session). Open Claude Code (Opus) at `C:\dev\CPoint-PMS`, switch to **plan mode**, and
> say:
> _"Read `docs/prompts/production-progression.md` and run Phase 22. Stop for my approval before
> writing code."_
> Next session, say the same with Phase 23, then Phase 24. Attendance comes first because
> production progression reads its worker count; materials come last because they are deducted
> from the check-in counts.

---

<role>
You are the senior full-stack engineer who built Phases 0–21. You know the conventions and keep to
them. CPoint asked to stop tracking batches stage by stage and to track **output against a daily
quota** instead, with **attendance** so the Floor Manager can see why a day fell short. An
industry panel reviews the result. Where CPoint hasn't decided something, surface it. Never invent
a business rule quietly.
</role>

<read_first>
Read these **before you plan**. The plan must cite what it reuses.

1. `CLAUDE.md` (auto-loaded), `AGENTS.md`, `docs/STATUS.md`
2. The newest report in `qa/reports/` (today `2026-10-20-phase-21-repair-station-floor-view.md`).
   If it lists failures, fix them first and say so in the plan.
3. `docs/prompts/system-rebuild.md`: master spec. Its `<architecture>`, `<roles_and_modules>`,
   `<ui>`, `<quality_gates>`, `<documentation_protocol>` and `<final_report_format>` still apply,
   except where `<project_rules>` below overrides them.
4. `docs/prompts/material-requests.md`: the shape this brief follows, and its form-message rules.
5. `docs/DECISIONS.md`, especially:
   - **D-008** (no per-person workforce metrics: the client had jealousy problems after awards);
   - D-017 (bootstrap), D-018 (schema conventions), D-019 (batch lifecycle and `409 STALE`);
   - D-020 and D-066 (the camera feeds the batch at Preparation), D-025 and D-033 (reports);
   - D-026 and D-056 (demo week, `demo:reset`), D-032 (branches), D-034 (layout), D-038 (form
     messages), D-047 (pagination), D-072 (supplier quality uses batches), D-075 (per-person flag
     pattern: `canCapture`).
   - The last entry is **D-076**. New ones start at **D-077**.
6. `docs/client-survey.md` Q8–Q11 (bottleneck, "summarize per day", quota "but not strict") and
   Q16–Q20 (the FM checks the floor morning, lunch and afternoon; jealousy; "batch quota").
7. `docs/ROADMAP.md`, `docs/API.md`, `DESIGN.md`, `.claude/skills/ui-craft/SKILL.md`
8. Code:
   - Batches and stages (what Phase 23 replaces):
     - `prisma/schema.prisma`: `Batch`, `BatchStageLog`, `BatchStatus`, `Stage`, `ShoeType`,
       `Batch.targetQuotaPairs`
     - `src/lib/stage-machine.ts`, `src/lib/domain.ts` (`STAGE_ORDER`, `STAGE_LABELS`)
     - `src/server/{models,services,controllers,validators}/batch.*`, `stage-log.model.ts`
     - `src/app/(app)/batches/**`, `src/app/api/v1/batches/**`
     - `src/components/features/batches/*` (`batches-by-stage-card.tsx`, `stage-progress.tsx`)
     - `src/server/services/batch.service.ts` → `batchesByStageSummary`
   - Who depends on batches (must keep working): `src/server/services/camera.service.ts` (the
     batch `IN_PROGRESS` at `PREPARATION`), `capture.service.ts` (`409 BATCH_MOVED`),
     `scan-ingest.service.ts`, `salvage.service.ts`, `ops-report.service.ts` (supplier quality,
     claim sheets `/reports/claims/[batchId]`)
   - Reports: `src/app/(app)/reports/page.tsx` and `_components/operations-view.tsx`,
     `ops-sections.tsx`; `src/lib/report-rules.ts` (`manilaDayStart`, `fillDays`,
     `pickBottleneck`), `src/lib/ops-rules.ts` (`findStuckBatches`, `stageShares`,
     `buildAttention`); `report.service.ts` (`stagesCsv`, `productionReport`)
   - Homes: `src/app/(app)/floor-manager/page.tsx`, `quality-inspector/page.tsx`,
     `admin/page.tsx`
   - Access: `src/server/policies/permissions.ts`, `navigation.ts`, `guard.ts`
   - Inventory (Phase 24): `InventoryItem`, `InventoryMovement`, `InventoryCategory` in the
     schema; `src/server/services/inventory.service.ts` (`postMovement`, usage can't go below
     zero), `src/lib/inventory-rules.ts`, `src/app/(app)/inventory/**`,
     `src/components/features/inventory/low-stock-card.tsx`; the roll taken on batch create in
     `batch.service.ts`
   - People: `User` in the schema, `src/server/services/user-admin.service.ts`,
     `src/app/(app)/admin/users/**`
   - A checkbox list with a Find box and a pager to copy: `src/app/(app)/camera/operators-panel.tsx`
     and `src/app/(app)/procurement/requesters-panel.tsx`, `src/lib/use-paged-rows.ts`,
     `src/components/features/table-pager.tsx`
   - Forms and errors: `src/server/lib/{errors,action-result}.ts`, `src/server/validators/shared.ts`,
     `src/components/ui/{field-error,form-error-summary}.tsx`, `src/lib/focus-first-invalid.ts`
   - Seeds and tests: `src/server/services/{bootstrap,demo-seed,demo-reset}.service.ts`,
     `tests/unit/**`, `tests/e2e/batches.spec.ts`, `tests/e2e/helpers.ts`
   - Next.js 16 docs in `node_modules/next/dist/docs/` for anything about Server Actions, forms or
     caching you're not sure of.
     </read_first>

<context>
**Today (Phases 2 and 7):** the Floor Manager registers a **batch** (one leather roll: roll code,
supplier, shoe type, optional `targetQuotaPairs`) and moves it through four stages, Preparation →
Upper Making → Sole-ing → Finishing, with `BatchStageLog` rows. The FM home shows "Batches by
stage", and Reports → Operations shows batches in production, time in each stage, the bottleneck,
stuck batches and `stages.csv`.

**What Dylan asked for (2026-10-21), in his words, cleaned up:**

_Production progression replaces batch and stage monitoring._

- The Floor Manager sets a **fixed check-in time**: how often the QA must enter the number of
  shoes counted (for example every 2 hours, or 4 hours).
- At each check-in the **QA enters the result**: how many shoes were completed in that interval,
  **per type (School Shoes and Topsider)**.
- The **number of workers**, taken from attendance, sits beside each result.
- **Goal: optimize workforce capacity.** From the average shoes per interval, the Floor Manager
  updates the **quota per day** her shoe workers must accomplish.

_Attendance tab, a production manager feature._

- The employees for each day, **based on the existing users** in the system.
- An identifier for the work they do (**admin or shoe constructor**).
- A **checkbox** for attendance.
- It correlates with output, e.g. "Since 5 shoe constructors are absent today, the total shoes
  produced is below the quota."

_Materials used, calculated automatically (Dylan, 2026-10-21, second message)._

- Conversions, for example: **1 leather roll = 10 leather pieces**; **1 shoe = 16 nails and 4
  leather pieces** (pieces already cut from the roll).
- When the QI reports, say, 22 shoes made, the system works out the materials those shoes used and
  takes them off inventory.
- And: **how does a batch end** once stages aren't tracked any more? (Answered in assumption 1.)

**How this maps onto the system:**

| Dylan's word                      | In the system                                         |
| --------------------------------- | ----------------------------------------------------- |
| QA                                | Quality Inspector (`QUALITY_INSPECTOR`)               |
| Floor Manager, production manager | Floor Manager (`FLOOR_MANAGER`); Ms Ivy in the survey |
| Admin                             | System Admin (`SYSTEM_ADMIN`)                         |
| Shoe workers                      | Shoe Constructors (`SHOE_CONSTRUCTOR`)                |
| School shoes, Topsider            | `ShoeType` rows (`SCH`, `TOP`). Data, never hardcoded |
| Shoes                             | **Pairs**, the unit `targetQuotaPairs` already uses   |

**The line this must not cross (D-008, survey Q17–Q19):** attendance is a log book, not a score.
The system records who was present each day, and every output number stays **per day, per
check-in or per shoe type for the whole line**. Never per person: no "absences per person", no
streaks, no "most absent" list, no output per named constructor, no ranking. "Pairs per
constructor present" is allowed only as a **line average for a day** (total pairs ÷ constructors
present), never attached to a name.
</context>

<assumptions>
Defaults this brief picks where the ask is open. Each becomes a STATUS open question and a
DECISIONS entry. **Confirm or change them in Step 1 of each phase**; Dylan can overrule any.

1. **A batch becomes one leather roll at Preparation, and it ends when the roll is finished.**
   The camera, the Capture page, salvage, supplier quality and claim sheets all hang off batches,
   so the batch stays, but it no longer travels through Upper Making, Sole-ing and Finishing:
   - **Planned** (roll registered) → **Start** puts it at Preparation, where the camera scans its
     sections → **Finish roll** → **Completed**. Cancel stays as it is (reason required).
   - **Finish roll** is done by the FM or the QI once the roll is used up. When the scans reach
     the roll's expected yield (10 pieces in Dylan's example, assumption 15), the batch page and
     the Capture page suggest it ("All 10 pieces scanned. Finish this roll?"); it is never
     automatic, because a roll can give more or fewer pieces.
   - Finishing a roll with open Repair Station sections is allowed, as completing with repairs
     open is today (D-022); those pieces count when their repair is done.
   - The next roll is then started, and the camera feeds it (the existing batch rule, D-020).
     `409 BATCH_MOVED` becomes "This roll was finished."
   - The stage moves (advance, move back) and stage monitoring go: the FM home "Batches by stage"
     card, the Operations stage sections (batches in production, time in each stage, bottleneck,
     stuck batches, the stage share in the attention list) and `stages.csv`. Production
     progression takes their place. This supersedes D-019's lifecycle.
2. **No data migration.** Existing batches and stage logs are kept as they are. Completed and
   cancelled batches keep their stage timeline as history. A batch still **in progress past
   Preparation** shows as "Started before rolls were tracked" with **Finish roll**; a planned or
   Preparation batch simply follows the new flow. Nothing is converted into check-ins (old
   batches never recorded pairs finished). The `Stage` enum and `currentStage` stay in the schema
   (new batches only ever use Preparation). `Batch.targetQuotaPairs` stays in the table but leaves
   the batch form and pages; the daily quota replaces it.
3. **"Completed" means a pair that left Finishing**, the end of the line, counted by the QI at the
   check-in. Pairs still in progress aren't counted. Each check-in counts **only the pairs finished
   since the previous check-in**, not a running total.
4. **The schedule:** a shift start and end plus an interval of 1, 2, 3 or 4 hours (**default 08:00
   to 17:00, every 2 hours**; the survey says the FM walks the floor morning, lunch and afternoon,
   so 4 hours is the other likely pick). Check-ins fall at each interval from the start, plus one at
   the shift end if it isn't on the grid: 10:00, 12:00, 14:00, 16:00, 17:00. Monday to Saturday are
   working days by default (the survey left Saturday open, D-037).
5. **A schedule or quota change applies from the next day**, never mid-day, so a day's check-ins
   and quota stay consistent. Both keep their history (`effectiveFrom`).
6. **Who enters a check-in:** the Quality Inspector, and the Floor Manager too, so a day without a
   QI on shift isn't lost (unlike D-028, where flagged scans wait). A check-in is open from its
   time until the end of the Manila day. After **30 minutes** it shows as **Late**; at the end of
   the day an empty one is **Missed**. A late entry is allowed the same day and keeps its real
   entry time. A saved check-in can be corrected the same day **with a reason** (both values in
   the audit). No in-app or push notifications, just the due check-in on the QI and FM homes.
7. **The quota is per shoe type, per day, for the whole line**, in pairs, set by the FM. The page
   **suggests** a quota from the last **10 working days** that have every check-in entered:
   average pairs per interval × check-ins per day, and next to it the line average per
   constructor present × constructors expected today. The FM accepts the suggestion or types
   another number. No per-person quota.
8. **Attendance is taken by the Floor Manager.** The System Admin can view it. The QI doesn't see
   the Attendance page but sees "Constructors present today: 14" on the check-in form.
9. **The roster is every active user** on that day, with their role as the "what they do" badge.
   Only **Shoe Constructors count as workers** for capacity; other roles are listed and ticked but
   don't change the worker count. A user created mid-week appears from the day they were created; a
   deactivated user stays in past days only.
10. **A day starts "Not taken".** The FM ticks who is present, or uses **Mark everyone present**
    and unticks the absent, then saves. Present or absent only: no half days, late arrivals,
    hours or absence reasons. The FM can edit today and the past **7 days**; never the future. A
    day with attendance not taken shows the worker count as "Not taken", never 0.
11. **The worker count on a check-in** is the number of constructors present that day, read when
    the check-in is saved and kept on the row, so a later attendance edit is visible
    ("Attendance changed after this check-in") instead of silently rewriting history.
12. **Factory workers without a login** are out of scope. Every person on the roster is a user, as
    Dylan said. If CPoint's constructors don't have accounts, the Admin creates them (they never
    need to sign in). Flag this as the main open question for CPoint.
13. **The demo** gets about 12 demo Shoe Constructors (when `SEED_DEMO_USERS=true`; random
    passwords, never used to sign in), a week of attendance with a few absences, the default
    schedule, a quota per type and a week of check-ins whose shortfalls line up with the absences.
    `demo:reset` keeps the demo constructors.
14. **Materials per shoe type are data** (a "materials per pair" list on each shoe type, set by
    the FM in Production → Plan): inventory item and quantity, e.g. School Shoes: Leather pieces 4,
    Nails 16. **Shoes or pairs:** the check-in counts **pairs** (assumption 3), so the list is per
    pair. If Dylan's "1 shoe = 16 nails, 4 pieces" means one single shoe, a pair is 32 nails and 8
    pieces; the screen says "per pair" so the FM enters the right number. Confirm with CPoint.
15. **Leather pieces become their own inventory item** (category `LEATHER_PIECE`, unit "piece"),
    and each leather-roll item gets a **pieces per roll** number (default 10). Pieces enter stock
    when a roll is finished (assumption 1): **the roll's usable sections** (passed, plus Fixable
    ones once done), because one scan is one section (STATUS assumption). The batch page shows
    "8 of 10 expected pieces usable", which also feeds supplier quality. If a roll was never
    scanned, the FM enters the pieces it gave.
16. **Usage is posted automatically** as OUT movements through the ledger (D-023), one per
    material, when a check-in is saved: "Used for 22 pairs of School Shoes, 12:00 check-in". A
    correction posts the difference; nothing is edited in place.
17. **A count is never refused for missing stock.** Today usage can't take stock below zero
    (`inventory.service.ts`). For automatic usage, take what is on hand down to zero, save the
    check-in, and record the shortfall ("Nails: 40 pieces used that weren't in stock"). The FM home
    and Inventory show **Stock count needed** until the FM records a count (an ADJUST). Stock
    still equals the ledger.
18. **Nails are stocked in boxes and used in nails.** Dylan: **1 box = 257 nails (13 × 1.88 mm)**.
    The nails item keeps "box" as its stock unit (deliveries and material requests stay in
    boxes) and gains **"Each box holds 257 nails"**. Materials per pair are entered in nails (16),
    and usage is converted to boxes: 22 pairs × 16 = 352 nails = 1.37 boxes. To stop rounding
    from drifting, usage is worked out from the **running total of nails used** for that item,
    so the boxes posted always add up to the nails used ÷ 257, rounded once. Stock reads "4.63
    boxes (about 1,190 nails)". The same "each unit holds" setting works for any item counted
    in smaller pieces (thread, adhesive); it is data, not a nails special case.
19. **Leather rolls leave stock when a batch starts**, as today when a roll is chosen (D-023);
the automatic usage only takes pieces, nails and the other listed materials, so a roll is
never counted twice.
</assumptions>

<phase_22>

## Phase 22 — Attendance

**Scope:** the Attendance tab, its data, and the worker count Phase 23 reads. No production
changes yet.

**1. Data (migration `attendance`)**

- `AttendanceDay`: `day` (`@db.Date`, Manila date, unique), `takenById`, `takenAt`, `updatedAt`.
  A row exists only once the FM saved that day.
- `AttendanceMark`: `attendanceDayId`, `userId`, `present` (Boolean), `@@unique([attendanceDayId,
userId])`. One row per person on the roster when the day was saved.
- UUIDv7 ids, `@@map` snake_case, every FK indexed, no hard deletes (D-018).
- Saving a day is **one transaction**: upsert the day, replace its marks, `recordAudit` with the
  before and after counts and the names that changed. The save sends the `updatedAt` the FM saw;
  a mismatch is `409 STALE` ("Someone else saved this day's attendance. Refresh to see it.").

**2. Rules (pure, unit-tested, in `src/lib/attendance-rules.ts`)**

- `rosterFor(users, day)`: active users created on or before the day, plus anyone with a mark that
  day (so a later deactivation doesn't rewrite history). Sorted by role (Shoe Constructors first),
  then name.
- `editableDay(day, today)`: today and the 7 days before; anything else says why ("Attendance
  can't be taken for a future day." / "Days more than 7 days ago are locked.").
- `workforceFor(marks)`: `{ constructorsPresent, constructorsOnRoster, othersPresent, taken }`.
  Phase 23 uses this; it is the **only** worker count in the system.

**3. Access**

- `attendance:manage` → Floor Manager. `attendance:read` → Floor Manager, System Admin.
- Update `permissions.ts`, `navigation.ts` (Production → **Attendance**, `/attendance`, no
  `phase`), the master spec's `<roles_and_modules>` table, and `tests/unit/permissions.test.ts`.
- Every page calls `requirePermission`, every route `requireApiPermission`.

**4. The page `/attendance`**

- An intent brief at the top of the file (ui-craft §1). Worst case: a person singled out.
- A day picker (defaults to today, Manila), with Previous / Next day.
- Summary line: "**14 of 16** Shoe Constructors present · 3 others present", or "Attendance for
  Tue, 21 Oct hasn't been taken yet."
- The roster: name, a **role badge** (Shoe Constructor, System Admin, Floor Manager, Quality
  Inspector), and a **Present** checkbox with a visible label (not colour alone). A Find box and
  the 15-row pager (D-047), copied from `operators-panel.tsx`. A role filter (All, Shoe
  Constructors, Others).
- **Mark everyone present**, then **Save attendance**. Unsaved changes are kept on the page and
  the button reads "Save attendance (3 changes)". Leaving with unsaved changes asks first.
- Locked days are read-only with the reason in one sentence.
- Admin sees the same page read-only.
- **Never** on this page or anywhere else: a per-person history, absence count, percentage or
  streak.
- FM home: an **Attendance** card ("Not taken yet today · Take attendance", or "14 of 16
  constructors present").

**5. API** (one-line routes → controller → service → model)

- `GET /api/v1/attendance?day=YYYY-MM-DD` and `PUT /api/v1/attendance/[day]` with
  `{ expectedUpdatedAt, marks: [{ userId, present }] }`. Document both in `docs/API.md`.
- Validators: the day is a real date in `YYYY-MM-DD`; every `userId` is on that day's roster
  ("Ana Cruz isn't on the roster for 21 Oct. Refresh the list."); no duplicates.

**6. Seeds**

- Demo constructors and a week of attendance as in assumption 13. Update `demo-reset` to keep the
  demo constructors and remove attendance with the rest of the test data.
- `stock equals the ledger` and the other CI invariants still hold.

**7. Tests**

- Unit: `attendance-rules` (roster on the creation day, after deactivation, sort order; editable
  days at the edges: today, 7 days ago, 8 days ago, tomorrow; `workforceFor` with no marks, all
  present, only non-constructors), the validator messages (added to
  `validator-messages.test.ts`), the service (stale save, audit written in the same `tx`),
  permissions.
- E2E (**written, not run**; Codex runs them): `tests/e2e/attendance.spec.ts`: FM takes today's
  attendance, edits yesterday, can't edit 8 days ago; Admin read-only; QI and constructor are
  refused; axe on the page.

**Done when:** the FM can take and edit attendance for today and the past 7 days, the Admin can
view it, the FM home shows today's count, `workforceFor` is tested, nothing shows a per-person
figure, and the project's gates pass.
</phase_22>

<phase_23>

## Phase 23 — Production progression in place of stage monitoring

**Scope:** the schedule, check-ins, the daily quota with its suggestion, the correlation with
attendance, and replacing the stage-monitoring views (assumption 1).

**1. Data (migration `production_progression`)**

- `ProductionSchedule`: `shiftStart` and `shiftEnd` (`"HH:mm"`, Manila), `intervalMinutes`
  (60, 120, 180 or 240), `workingDays` (ISO weekdays), `effectiveFrom` (`@db.Date`),
  `createdById`, `createdAt`. The row in force on a day is the latest `effectiveFrom` ≤ that day.
  The bootstrap creates the default (assumption 4).
- `DailyQuota`: `shoeTypeId`, `pairs` (Int), `effectiveFrom`, `suggestedPairs` (Int?, what the
  page suggested when it was set), `createdById`, `createdAt`. Same "latest in force" rule, per
  shoe type.
- `ProductionCheckIn`: `day` (`@db.Date`), `slotAt` (the scheduled time, a `DateTime`),
  `enteredAt`, `enteredById`, `constructorsPresent` (Int?, null = attendance not taken),
  `notes` (String?), `correctedAt`, `correctedById`, `correctionReason`.
  `@@unique([day, slotAt])`.
- `ProductionCount`: `checkInId`, `shoeTypeId`, `pairs` (Int ≥ 0). `@@unique([checkInId,
shoeTypeId])`. One row per **active** shoe type at the time of entry.
- Saving a check-in is one transaction with `recordAudit`. A second save of the same slot hits the
  unique key and returns `409 STALE` ("Lea Santos already entered the 12:00 check-in at 12:04.
  Refresh to see it.").

**2. Rules (pure, unit-tested, in `src/lib/production-rules.ts`)**

- `slotsFor(schedule, day)`: the check-in times for a day (none on a non-working day).
- `slotState(slot, checkIn, now)`: Upcoming, **Due**, **Late** (more than 30 minutes past),
  **Entered**, **Missed** (day over, nothing entered). Put the 30 minutes in one constant with an
  `ASSUMPTION` comment.
- `dayProgress(checkIns, quotas)`: per shoe type, pairs so far, quota, % of quota, and the pace
  needed for the rest of the day ("38 pairs more over 2 check-ins to reach the quota").
- `suggestQuota(history, schedule, expectedConstructors)`: assumption 7, returning the number and
  the sentence that explains it ("Average 22 pairs per 2-hour check-in over the last 10 working
  days × 5 check-ins = 110 pairs"). Returns null with a reason when there are fewer than 3 full
  days.
- `explainShortfall(day)`: for a day below quota, one sentence from the day's numbers only:
  "Below quota by 18 pairs. 5 of 16 Shoe Constructors were absent." / "Below quota by 6 pairs
  with everyone present." / "Below quota. Attendance wasn't taken that day." Never a name.
- Unit tests at the edges: a shift end off the grid, a 4-hour interval, the 30-minute boundary,
  a day with one check-in missed, a new shoe type mid-week, a quota change effective tomorrow,
  zero constructors present, attendance not taken.

**3. Access**

- `production:read` → Floor Manager, Quality Inspector, System Admin (view).
- `production:checkin` → Quality Inspector, Floor Manager (assumption 6).
- `production:plan` → Floor Manager (schedule and quota).
- Nav: Production → **Production** (`/production`) first, then Attendance, Batches, Inventory,
  Procurement. The master spec's roles table, `permissions.test.ts` and `auth.spec.ts` nav lists
  are updated.

**4. Pages**

- **`/production`** (all three roles; actions follow permissions). An intent brief at the top.
  - **Today:** each check-in as a row with its time, state badge (icon and label), pairs per shoe
    type, constructors present, and who entered it (an audit fact, like the requester's name on a
    request; never totalled per person). The due one has **Enter count**.
  - **Today against the quota:** per shoe type, a progress bar with "86 of 120 pairs (72%)" and the
    pace sentence. Below quota at the end of the day, the `explainShortfall` sentence.
  - **Recent days:** the last 14 working days, per day: pairs per type, quota, % of quota,
    constructors present / on roster, pairs per constructor present (line average), and the
    shortfall sentence. A chart of pairs per day against the quota, with the constructors present
    on a second series (`dataviz` skill; colours from tokens; the quota line labelled, not colour
    alone).
- **Enter count** (a dialog or `/production/check-in`): one whole-number field per active shoe
  type ("School Shoes finished since 10:00"), constructors present shown read-only from attendance
  (or "Attendance not taken yet. Ask the Floor Manager." without blocking the save), optional
  notes. **Correct** on a saved check-in the same day asks for a reason.
- **`/production/plan`** (FM): the schedule form (shift start, shift end, interval, working days,
  "Applies from tomorrow, 22 Oct") and a quota per shoe type with the suggestion beside it and
  **Use suggestion**. History of both, newest first.
- **Homes:**
  - QI home: a **Next check-in** card ("12:00 check-in is due" or "Late by 40 minutes", with
    **Enter count**).
  - FM home: **Today's production** (progress against the quota per type, the next check-in, and
    any late or missed ones) **replaces "Batches by stage"**.
- **Reports → Operations:** a **Production** section (pairs per day per type, quota, % of quota,
  constructors present, shortfall sentences) replaces the stage sections. `production.csv` (one
  row per day and shoe type) replaces `stages.csv` in the export list. The attention list loses
  its stage items and gains "3 of the last 5 working days were below quota".

**5. Batches end as finished rolls; what is removed or kept (assumptions 1 and 2)**

- `stage-machine.ts` becomes the roll lifecycle: `start` (Planned → Preparation), `finish`
  (Preparation, or an older batch past it → Completed), `cancel`. `advance` and `move_back` are
  removed from the UI, the API (`POST /api/v1/batches/[id]/stages` accepts `start` and `finish`
  only, documented in `docs/API.md`) and the rules, with unit tests for each move and refusal
  ("This roll is already finished.").
- `finishRoll` in `batch.service.ts`: a conditional update (`409 STALE`), a `BatchStageLog` end
  row so the history stays whole, `recordAudit`. Allowed for the FM and the QI (new permission
  `batch:finish`). The camera rule and `409 BATCH_MOVED` text follow (assumption 1).
- The "All N pieces scanned. Finish this roll?" hint on the batch page and the Capture page
  (`scans ≥ pieces per roll`). In Phase 23 the expected yield is a constant 10 with an
  `ASSUMPTION` comment; Phase 24 moves it onto the roll item.
- Removed from view: `BatchesByStageCard`, `stage-progress.tsx` for new batches, the Operations
  stage sections, `findStuckBatches` and `stageShares` callers, `stages.csv` route and its link,
  the batch form's Target quota field. Delete code that has no caller left.
- The batch list's stage filter becomes a status filter: Planned, At Preparation, Finished,
  Cancelled.
- Kept: batch create, edit, cancel, the batch detail (old batches keep their stage timeline as
  history), the camera, Capture, salvage, supplier quality, claim sheets.
- Update every place that names the removed views: the README demo script, `docs/API.md`, e2e
  specs that assert the stage card or `stages.csv` (`batches.spec.ts`, `reports.spec.ts`,
  `smoke.spec.ts`).

**6. API** (one-line routes; documented in `docs/API.md`)

- `GET /api/v1/production/today`, `GET /api/v1/production/days?from&to`
- `POST /api/v1/production/check-ins` `{ slotAt, counts: [{ shoeTypeId, pairs }], notes? }`
- `PATCH /api/v1/production/check-ins/[id]` `{ counts, reason }` (same Manila day only)
- `PUT /api/v1/production/schedule`, `PUT /api/v1/production/quotas`
- `GET /api/v1/reports/production.csv`

**7. Validation messages** (Zod, shared by forms and the API, D-038)

- "Enter the School Shoes finished since 10:00 as a whole number, like 24. Enter 0 if none."
- "School Shoes can't be more than 2,000 pairs in one check-in. Check the number."
- "The 14:00 check-in isn't open yet. You can enter it from 14:00."
- "The check-in for Mon, 20 Oct closed at midnight. Ask the Floor Manager to note it instead."
- "Shift end must be after shift start."
- "Pick an interval of 1, 2, 3 or 4 hours."
- "Enter the daily quota for Topsider as a whole number of pairs, at least 1."
- "Say why you're correcting this check-in, at least 5 characters."

**8. Seeds**

- The default schedule in the bootstrap. The demo week (D-026): quotas per type, check-ins for
  every working day with one late and one missed, and three days below quota that line up with
  the seeded absences. Keep the batches and scans the camera and supplier quality need.

**9. Tests**

- Unit: everything in §2; the services (unique slot → `409 STALE`, correction keeps both values
  in the audit, a change applies from tomorrow); validators; permissions; a payload test that no
  production or attendance response carries a per-person total (extend the existing D-008 report
  payload test).
- E2E (**written, not run**): `tests/e2e/production.spec.ts`: FM sets a schedule and a quota; QI
  enters a check-in; a second entry of the same slot is refused; a correction needs a reason; the
  FM home shows progress; a constructor is refused; axe on `/production` and `/production/plan`.
  Update the specs named in §5.

**Done when:** the FM sets the schedule and the quota (with the suggestion), the QI enters counts
per shoe type at each check-in, today's progress and the recent days show against the quota with
the constructors present and a one-sentence reason for each shortfall, the stage-monitoring views
are gone, a batch ends with **Finish roll** and still feeds the camera until then, nothing is per
person, and the project's gates pass.
</phase_23>

<phase_24>

## Phase 24 — Materials used, worked out from the check-ins

**Scope:** assumptions 14 to 19: materials per pair for each shoe type, leather pieces from
finished rolls, boxes of nails counted in nails, automatic usage from check-ins, and the
stock-count flag.

**1. Data (migration `materials_per_pair`)**

- `InventoryCategory` gains `LEATHER_PIECE`. The bootstrap creates one "Leather pieces" item
  (unit "piece") if none exists; the FM can add more (one per leather colour or thickness).
- `InventoryItem.piecesPerRoll` (Int?, leather rolls only, default 10) and
  `InventoryItem.pieceItemId` (which pieces item a roll turns into).
- `InventoryItem.countPerUnit` (Int?, e.g. 257) and `InventoryItem.countUnit` (String?, e.g.
  "nail"): how many small pieces one stock unit holds (assumption 18). The bootstrap and demo set
  the nails item to 257 nails per box.
- `MaterialUsageTotal`: `itemId` (unique), `countUsed` (Int, the running total in the count
  unit), `unitsPosted` (Decimal(12,2)). Each usage posts `round(countUsed ÷ countPerUnit, 2) −
unitsPosted`, so rounding never drifts.
- `ShoeTypeMaterial`: `shoeTypeId`, `itemId`, `quantityPerPair` (Decimal(12,2), in the item's
  count unit when it has one, e.g. 16 nails; otherwise its stock unit), `updatedById`,
  `updatedAt`. `@@unique([shoeTypeId, itemId])`. A change applies to check-ins saved after it;
  earlier usage isn't recalculated.
- `InventoryMovement` gains `checkInId` (String?, indexed), so every automatic movement links back
  to its check-in; `MaterialShortfall`: `itemId`, `checkInId`, `quantity`, `resolvedAt`,
  `resolvedByMovementId`.

**2. Rules (pure, unit-tested, in `src/lib/material-rules.ts`)**

- `materialsFor(counts, perPair)`: per item, pairs × quantity per pair, in hundredths as D-023
  does. Example for the test: 22 pairs of School Shoes at 4 pieces and 16 nails → 88 pieces, 352
  nails.
- `toStockUnits(countUsedBefore, countUsedNow, countPerUnit, unitsPostedBefore)`: the boxes to
  post. Tests: 352 nails at 257 per box → 1.37 boxes; then 257 more → total 609 nails = 2.37
  boxes, so 1.00 posted; a hundred small check-ins of 3 nails each add up to exactly
  round(300 ÷ 257, 2) = 1.17 boxes; a correction down gives the boxes back the same way.
- `usagePlan(needed, onHand)`: what to take and the shortfall per item (assumption 17).
- `correctionDelta(before, after)`: the difference to post when a check-in is corrected.
- `piecesFromRoll(scans, repairsDone)`: usable sections when a roll is finished
  (assumption 15).

**3. Where it runs**

- Saving or correcting a check-in (Phase 23's service) posts the usage **in the same transaction**
  through `postMovement`, writes shortfalls and one `recordAudit` for the whole save. A shoe type
  with no materials set posts nothing and the check-in says "No materials are set for Topsider,
  so nothing was taken from stock."
- **Finish roll** posts the usable pieces as IN to the roll's pieces item; a repair marked done
  later posts one more piece. A roll never scanned asks the FM for the pieces it gave.
- Recording a stock count (ADJUST) on an item resolves its open shortfalls.

**4. Screens**

- **Production → Plan → Materials per pair:** for each shoe type, rows of item and quantity
  ("Nails, 16 per pair"), add and remove, with a line under it: "22 pairs would use 88 leather
  pieces and 352 nails (1.37 boxes)."
- **Inventory:** every item form gets an optional **Each [box] holds [257] [nails]**; quantities
  of such items read "4.63 boxes (about 1,190 nails)" on Inventory, the low-stock card and the
  material request picker. The leather-roll item form gets **Pieces per roll** and **Turns into**; movement
  lists show "Used for 22 pairs of School Shoes, 12:00 check-in" with a link; items with an open
  shortfall show a **Stock count needed** badge and a filter.
- **The check-in result:** after saving, "Taken from stock: 88 leather pieces, 352 nails."
- **The batch page:** "8 of 10 expected pieces usable" once finished.
- **FM home:** "Stock count needed" joins the low-stock card. The low-stock rules now also cover
  leather pieces and nails used by check-ins.
- **Reports → Operations:** materials used per day and per item next to the pairs made (never per
  person); `materials-used.csv`.

**5. Validation messages**

- "Enter nails per pair as a number greater than 0, like 16."
- "Leather pieces is already in the School Shoes list. Change its quantity instead."
- "Pieces per roll must be a whole number from 1 to 500."
- "Choose the pieces item this roll turns into."
- "Enter how many nails one box holds as a whole number, like 257."
- "Name what the box holds, like nails."

**6. Seeds**

- The bootstrap's Leather pieces item. Demo materials per pair for both shoe types, pieces per
  roll on the demo rolls, and the demo week's check-ins and finished rolls posted through the same
  services, with one shortfall left open. The CI invariant "stock equals the ledger" must hold.

**7. Tests**

- Unit: everything in §2; the check-in service posting usage, a shortfall, a correction up and
  down, a shoe type with no materials; Finish roll posting pieces; a count resolving a shortfall;
  validators.
- E2E (**written, not run**): the FM sets materials per pair; the QI enters 22 pairs and the
  Inventory movements show the usage; a correction posts the difference; a short item shows Stock
  count needed until a count; axe on the new screens.

**Done when:** each shoe type has its materials per pair, a check-in takes its materials off stock
through the ledger in the same transaction, a finished roll adds its usable pieces, a shortage
never blocks a count and shows Stock count needed until a count, stock still equals the ledger,
and the project's gates pass.
</phase_24>

<project_rules>
Dylan's standing rules. They override the master spec where they differ.

- **Plan first.** Start in plan mode. Lay out the changes and stop for Dylan's approval before
  writing code. Save the approved plan as `docs/prompts/plans/phase-22-plan.md` (then
  `phase-23-plan.md`).
- **Resuming:** check which phase or step was last completed (this file, `docs/STATUS.md`,
  `git status`, recent changes) and continue from there. One phase per session.
- **No git without Dylan's word.** Don't create branches, commits, pushes or PRs unless he says
  so. Work in `C:\dev\CPoint-PMS` and leave the changes uncommitted.
- **UI craft:** readable font sizes, humanized copy, inline messages that name the exact field and
  the fix, and the existing design (tokens only, `DESIGN.md`, the ui-craft skill, D-034 layout).
- **Checks Claude runs:** `npm run lint`, `npm run typecheck`, `npm run test` (unit) and
  `npm run build` only, or `npm run check` for all four. Paste the real output summaries. **Claude
  never runs browser or e2e tests** (Playwright, axe), even though the master spec lists them as
  gates. Write or update the e2e specs; Codex runs them.
- **QA handoff:** after each phase, write `qa/handoffs/YYYY-MM-DD-phase-22-attendance.md` (then
  `…-phase-23-production-progression.md`) from `qa/templates/handoff.md`: what changed by role,
  files touched, the migration, the seeded data to use, clickable scenarios with at least one
  negative per feature, access checks for every role, and what's out of scope.
- **Migrations:** `npm run db:migrate -- --name <change>`, then `npm run db:generate`.
- Every mutation runs in `runInTransaction` and calls `recordAudit(tx, …)` with the same `tx`.
  </project_rules>

<workflow>
For **each** phase:

**Step 1: Plan (plan mode; stop for approval).**

- What you read and what you'll reuse, by file.
- The schema diff and migration name; how existing rows are treated (assumption 2).
- The permission and nav changes.
- The files you'll add, change or delete, by layer; the unit and e2e test list; the doc changes.
- For Phase 23, the exact list of stage-monitoring code that goes, with each caller.

Then ask, in **one batch with a recommended option each**, only the questions that change the
build:

- **Phase 22:**
  - Roster: every active user (recommended), or only Shoe Constructors and System Admins?
  - Edit window: 7 days back (recommended), or today only?
  - Absence reasons (Leave, Sick, Other): leave out (recommended) or add?
- **Phase 23:**
  - A batch ends with Finish roll at Preparation (recommended, assumption 1), or keep the four
    stage moves and Complete from Finishing?
  - Default interval: 2 hours (recommended, Dylan's example) or 4 hours (the survey's three walks)?
  - Can the FM enter check-ins too (recommended), or the QI only?
  - Quota suggestion window: 10 working days (recommended), 5 or 20?
- **Phase 24:**
  - Materials per pair (recommended) or per single shoe?
  - Pieces from a finished roll: its usable scanned sections (recommended), or always the pieces
    per roll number?
  - Missing stock: take it to zero and flag a stock count (recommended), or refuse the check-in?

**Step 2: Build** at green checkpoints (unit tests and typecheck passing).

**Step 3: Checks.** `npm run check`. Run the ui-craft Definition of Done on every touched screen.
If a check can't run, say so. Never claim it passed.

**Step 4: Docs** (`/wrap-up`, without the commit and push unless Dylan says so).

- `docs/ROADMAP.md`: a section for the phase with ticked acceptance criteria. Phase 23 also marks
  the Phase 2 and Phase 7 stage-monitoring items as replaced.
- `docs/STATUS.md`: progress (25 / 25 after Phase 24), test counts, next step, and the open
  questions from `<assumptions>`.
- `docs/DECISIONS.md` from **D-077**: attendance as a log book within D-008, the roster rule, the
  worker count, the schedule and its timing, who enters check-ins, the quota and its suggestion,
  what replaced stage monitoring and how a batch ends (mark it as superseding D-019's lifecycle
  and the stage parts of D-025), materials per pair, pieces from finished rolls, and automatic
  usage with the shortfall rule (mark it as extending D-023).
- `docs/API.md`, the README demo script, the master spec's roles table.
- Prepend to `docs/SESSION_LOG.md`.
- The QA handoff (see `<project_rules>`).

**Step 5: Report** in the master spec's `<final_report_format>`. The "Next session" prompt names
the next phase in this file, or the Codex run. Then stop.
</workflow>

<constraints>
- The CLAUDE.md non-negotiables all apply:
  - MVC layering, with Prisma in `models/` only; pages call services;
  - guards on every page and API route;
  - tokens only in the UI; desktop first with the D-034 layout; no new containers;
  - shoe types, the schedule and quotas are **data**, never hardcoded.
- **No per-person workforce metrics (D-008).** Attendance marks are a log; output is per day,
  check-in or shoe type for the whole line. Any figure divided by people is a line average for a
  day and never carries a name.
- All times are Manila for display and day boundaries, UTC in storage (`report-rules.ts`).
- Don't touch the decision engine, the CV ingestion contract or procurement. The Capture page's
  batch rule (the oldest batch at Preparation, D-020) stays; only its "batch moved" wording changes.
- Stock changes only through ledger movements (D-023), automatic usage included.
- If this brief conflicts with a settled decision or the code, say so in the plan and propose the
  smallest change. Don't silently pick one.
  </constraints>
