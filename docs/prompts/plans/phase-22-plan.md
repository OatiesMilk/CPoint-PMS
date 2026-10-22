# Phase 22 plan — Attendance

> **Status: approved by Dylan on 2026-10-21 (1A every active user, 2A 7 days back, 3A no absence
> reasons) and built.** Two changes while building: a locked or future day is `409 CONFLICT` (not
> 422), and a mark's user link cascades on a hard delete so test clean-ups aren't blocked. Brief:
> `docs/prompts/production-progression.md` → `<phase_22>`. Branch: none (work stays uncommitted on
> the `main` checkout in `C:\dev\CPoint-PMS`, as for Phases 20 and 21).

## 0. Starting point

- Newest QA report: `qa/reports/2026-10-20-phase-21-repair-station-floor-view.md`, **PASS** (29 of
  31, 2 blocked on Dylan's station checks; e2e 87 passed, 0 failed, 1 skipped). **No failures to
  fix first.** R4 and F3 stay with Dylan.
- Phases 20 and 21 are still uncommitted on `main`. Phase 22 adds to the same working tree.
- Last migration: `20261020110133_user_can_capture`. Last decision: D-076, so this phase starts at
  **D-077**.

## 1. What I reuse (by file)

| Need                                  | Reused from                                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Checkbox list with Find box and pager | `src/app/(app)/camera/operators-panel.tsx`, `src/lib/use-paged-rows.ts`, `components/features/table-pager.tsx` (`MATCHING`) |
| Manila "today" and day maths          | `manilaToday` (`src/lib/format.ts`), `addDays`, `manilaDayStart` (`src/lib/report-rules.ts`)                                |
| Role names                            | `ROLE_LABELS` (`src/lib/domain.ts`)                                                                                         |
| `409 STALE`                           | `Errors.stale` (`src/server/lib/errors.ts`), same pattern as the batch stage move                                           |
| Transactions and audit                | `runInTransaction` + `recordAudit(tx, …)` (`src/server/services/audit.service.ts`)                                          |
| Server action results and form errors | `src/server/lib/action-result.ts` (`toActionError`), `components/ui/{field-error,form-error-summary}.tsx`                   |
| Guards                                | `requirePermission` / `requireApiPermission` (`src/server/policies/guard.ts`)                                               |
| Home card look                        | the existing FM home cards (`low-stock-card.tsx`, `open-reworks-card.tsx`)                                                  |
| Demo users and reset                  | `DEMO_USERS` and `ensureDemoUsers` (`bootstrap.service.ts`), `demo-reset.{service,model}.ts`, `demo-seed.service.ts`        |

## 2. Schema (migration `attendance`)

```prisma
/// One day's attendance, a log book (D-008, D-077). Exists only once the Floor Manager saved it.
model AttendanceDay {
  id         String           @id @default(uuid(7)) @db.Uuid
  day        DateTime         @unique @db.Date // the Manila calendar date
  takenById  String           @db.Uuid
  takenAt    DateTime         @default(now())
  updatedAt  DateTime         @updatedAt
  takenBy    User             @relation("AttendanceTakenBy", fields: [takenById], references: [id])
  marks      AttendanceMark[]
  @@index([takenById])
  @@map("attendance_days")
}

model AttendanceMark {
  id              String        @id @default(uuid(7)) @db.Uuid
  attendanceDayId String        @db.Uuid
  userId          String        @db.Uuid
  present         Boolean
  attendanceDay   AttendanceDay @relation(fields: [attendanceDayId], references: [id])
  user            User          @relation(fields: [userId], references: [id])
  @@unique([attendanceDayId, userId])
  @@index([userId])
  @@map("attendance_marks")
}
```

- `User` gains `attendanceTaken AttendanceDay[] @relation("AttendanceTakenBy")` and
  `attendanceMarks AttendanceMark[]`.
- Existing rows: nothing to convert. Every past day simply reads "Not taken".
- `takenById` / `takenAt` record the **last** save (who and when); the audit log keeps every save.
- No hard deletes in the app. Re-saving a day replaces its marks inside the transaction (delete
  and re-create the day's marks), which is the brief's "replace its marks"; the audit row keeps the
  before and after.

## 3. Rules (`src/lib/attendance-rules.ts`, pure)

- `rosterFor(users, day, marks)`: active users created on or before the end of that Manila day,
  plus anyone with a mark that day (so deactivating someone later doesn't remove them from past
  days). Sorted Shoe Constructors first, then Floor Manager, Quality Inspector, System Admin, then
  by name.
- `editableDay(day, today)`: `{ ok: true }` for today and the 7 days before, otherwise
  `{ ok: false, reason }` with "Attendance can't be taken for a future day." or "Days more than 7
  days ago are locked." The 7 is one constant.
- `workforceFor(marks | null)`: `{ taken, constructorsPresent, constructorsOnRoster,
othersPresent }`. `taken: false` (and counts null) when the day wasn't saved. **The only worker
  count in the system** (Phase 23 reads it).
- `attendanceSummary(workforce, dayLabel)`: the summary sentence, so the page and the FM card
  say the same thing ("14 of 16 Shoe Constructors present · 3 others present" / "Attendance for
  Tue, 21 Oct hasn't been taken yet.").
- `changedNames(before, after)`: who changed between saves, for the audit row.

## 4. Access

- `permissions.ts`: `attendance:manage` → FLOOR_MANAGER; `attendance:read` → FLOOR_MANAGER,
  SYSTEM_ADMIN.
- `navigation.ts`: a new `attendance` nav icon (lucide `ClipboardCheck`) and Production →
  **Attendance** (`/attendance`, `attendance:read`, no `phase`), placed **first** in Production,
  before Batches, to match the Phase 23 order (Production, Attendance, Batches…).
- The master spec's `<roles_and_modules>` table, `tests/unit/permissions.test.ts`, and the nav
  lists in `tests/e2e/auth.spec.ts` (FM and Admin now see Attendance).
- The QI and constructors get 403 on the page and the API.

## 5. Files by layer

**New**

- `prisma/migrations/<ts>_attendance/migration.sql` (via `npm run db:migrate -- --name attendance`)
- `src/lib/attendance-rules.ts`
- `src/server/models/attendance.model.ts`: find a day with marks, list roster candidates (users
  created by the day's end, active or marked), conditional upsert, replace marks. The only Prisma
  access.
- `src/server/validators/attendance.validator.ts`: `dayParamSchema` ("Pick a real date, like
  2026-10-21."), `saveAttendanceSchema` (`expectedUpdatedAt` ISO or null for a first save;
  `marks: [{ userId: uuid, present: boolean }]`, at least one, no duplicate userId: "Ana Cruz is in
  the list twice. Refresh the page and save again." from the names the page sends; the API version
  says "This person appears twice in marks: <id>").
- `src/server/services/attendance.service.ts`: `getAttendanceDay(day)` (roster, marks, workforce,
  editable, updatedAt), `saveAttendanceDay(day, input, actor)`, `todayWorkforce()` (for the home
  card and Phase 23).
  - Save: check `editableDay`; load the roster; every `userId` must be on it ("Ana Cruz isn't on
    the roster for 21 Oct. Refresh the list." or, for an unknown id, "Someone in this list isn't on
    the roster for 21 Oct. Refresh the list."); roster people missing from `marks` are saved as
    absent so a day is always whole; inside `runInTransaction`: compare `updatedAt` with
    `expectedUpdatedAt` (or "already exists" on a first save) → `409 STALE` "Someone else saved
    this day's attendance. Refresh to see it."; upsert the day; replace marks; `recordAudit(tx,
{ action: "attendance.save", entity: "AttendanceDay", before: { present, absent }, after: {
present, absent, nowPresent: [names], nowAbsent: [names] } })`.
- `src/server/controllers/attendance.controller.ts`: `show` and `save`.
- `src/app/api/v1/attendance/route.ts` (GET, `?day=`) and `src/app/api/v1/attendance/[day]/route.ts`
  (PUT), one-liners.
- `src/app/(app)/attendance/page.tsx` (server, intent brief, `requirePermission("attendance:read")`,
  reads `?day=`), `attendance-roster.tsx` (client), `actions.ts` (`saveAttendanceAction`,
  `requirePermission("attendance:manage")`).
- `src/components/features/attendance/attendance-card.tsx` (FM home).
- `tests/unit/attendance-rules.test.ts`, `tests/unit/attendance.service.test.ts`
- `tests/e2e/attendance.spec.ts` (written, **not run**; Codex runs it)

**Changed**

- `prisma/schema.prisma` (above)
- `permissions.ts`, `navigation.ts`, the nav icon map in the sidebar component
- `src/app/(app)/floor-manager/page.tsx`: the Attendance card added (Batches by stage stays until
  Phase 23)
- `bootstrap.service.ts`: `DEMO_CONSTRUCTORS` (12 names, `@cpoint.local` emails, random
  passwords never shown), created by `ensureDemoUsers` when `SEED_DEMO_USERS=true`
- `demo-seed.service.ts`: a week of attendance (the last 6 working days, Mon–Sat, 1 to 4
  constructors absent on a few days, today left "Not taken" so the demo starts with the card's
  call to action)
- `demo-reset.service.ts` / `.model.ts`: keep the demo constructors' emails; delete
  `AttendanceMark` then `AttendanceDay` with the other test data (before users)
- `tests/unit/{permissions,validator-messages,demo-reset,demo-seed,bootstrap.service}.test.ts`
- `tests/e2e/auth.spec.ts` (nav lists)
- Docs: `docs/API.md`, `docs/prompts/system-rebuild.md` roles table, README demo script,
  `docs/ROADMAP.md` (Phase 22 section), `docs/STATUS.md`, `docs/DECISIONS.md` (D-077 onward),
  `docs/SESSION_LOG.md`, `qa/handoffs/2026-10-21-phase-22-attendance.md`

## 6. The page `/attendance`

- Intent brief: the FM, at the office desk at the start of the shift, ticks who came in; worst
  case: a person singled out, or a day's count silently wrong.
- Header with the day: a date field (defaults to today in Manila) with **Previous day** / **Next
  day** (Next is disabled on today). The URL carries `?day=` so a day can be linked.
- Summary sentence (from `attendanceSummary`), and "Saved by Ivy Reyes at 08:12" when taken.
- Roster table: Name · Role badge (with an icon, text label) · **Present** checkbox with a visible
  "Present" label per row. Find box (name or email), role filter (All / Shoe Constructors /
  Others), 15-row pager, all copied from the operators panel.
- **Mark everyone present** (ticks the whole roster, not just the page shown), then **Save
  attendance**, which reads "Save attendance (3 changes)" while there are unsaved changes and is
  disabled with none. After saving: a toast "Attendance for Tue, 21 Oct saved: 14 of 16 Shoe
  Constructors present."
- Unsaved changes: the page keeps them while you page, filter or search. Closing or reloading the
  tab asks first (`beforeunload`); clicking a link in the app asks "Leave without saving
  attendance?" (a capture-phase click guard on internal links, since the App Router has no route
  block). Changing the day with unsaved changes asks the same.
- A locked day (future, or more than 7 days ago) or the Admin: read-only, checkboxes shown as
  "Present" / "Absent" text, and one sentence why ("Days more than 7 days ago are locked." /
  "Only the Floor Manager takes attendance.").
- Errors sit in one alert above the table and name the person and fix (e.g. the stale message).
- **Never** on this page or anywhere: a per-person history, absence count, percentage or streak.
  The page only ever shows one day.

**FM home card "Attendance"**: "Not taken yet today" with **Take attendance**, or "14 of 16 Shoe
Constructors present · 3 others" with **Edit**. Links to `/attendance`.

## 7. API (documented in `docs/API.md`)

- `GET /api/v1/attendance?day=YYYY-MM-DD` (`attendance:read`; default today): `{ day, taken,
updatedAt, takenBy, editable, lockedReason, workforce, roster: [{ userId, name, role, present
}] }`. No per-person totals.
- `PUT /api/v1/attendance/{day}` (`attendance:manage`): `{ expectedUpdatedAt, marks: [{ userId,
present }] }` → 200 with the same shape; 400 validation, 403, 409 `STALE`, 422 locked day.

## 8. Tests

- **Unit** (Vitest, I run them):
  - `attendance-rules`: roster on the user's creation day (in and out at the Manila day's edge),
    after deactivation (kept on a marked day, gone from a later day), sort order; `editableDay`
    for today, 7 days ago, 8 days ago, tomorrow; `workforceFor` with no day, all present, only
    non-constructors present; the summary sentences.
  - `attendance.service`: stale save → 409, first save when someone else already saved → 409,
    unknown user → message with the date, missing roster people saved absent, audit written with
    the same `tx`, locked day refused.
  - `validator-messages.test.ts`: the date and duplicate messages.
  - `permissions.test.ts`: the two new permissions and the nav for each role.
  - demo-seed / demo-reset: constructors kept, attendance removed and re-seeded.
- **E2E** (written, **not run** by me): `tests/e2e/attendance.spec.ts`: FM takes today's
  attendance (Mark everyone present, untick two, save, summary updates); FM edits yesterday; 8 days
  ago is read-only; Admin read-only; QI and constructor get 403 on page and API; axe on the page.
  The test creates its own constructor accounts (as the other specs do).

## 9. Checks I run

`npm run check` (lint, typecheck, unit tests, build). No Playwright, axe or e2e (Codex runs those).
Then the ui-craft Definition of Done on `/attendance` and the FM home.

## 10. Decisions to log (from D-077)

- D-077 Attendance is a one-day log book within D-008 (no per-person history, counts or streaks).
- D-078 The roster rule (every active user by creation date, plus anyone marked that day).
- D-079 The edit window (today and 7 days back, FM only, Admin views) and the stale-save rule.
- D-080 `workforceFor` is the one worker count; only Shoe Constructors count as workers.
- D-081 Demo constructors (12, random passwords, kept by `demo:reset`).

## 11. Where the brief and the code differ (smallest change proposed)

- The brief's validator rule "every userId is on that day's roster" needs the database, so it is a
  **service** check, not Zod; Zod only checks shape, dates and duplicates.
- A message naming the person ("Ana Cruz isn't on the roster…") is only possible for a known user;
  an unknown id gets the general version.
- Demo users today share `DEMO_USER_PASSWORD`; the 12 demo constructors get random passwords
  instead, as the brief says, so they can't be signed in to.

## 12. Questions (one batch)

1. Roster: **every active user** (recommended) or only Shoe Constructors and System Admins?
2. Edit window: **7 days back** (recommended) or today only?
3. Absence reasons (Leave, Sick, Other): **leave out** (recommended) or add?
