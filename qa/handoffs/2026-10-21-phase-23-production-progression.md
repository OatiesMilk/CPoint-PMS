# QA handoff: Phase 23, production progression in place of stage monitoring

| Field           | Value                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Date            | 2026-10-21                                                                                          |
| Feature         | phase-23-production-progression                                                                     |
| Branch          | `main` checkout in `C:\dev\CPoint-PMS`, **uncommitted** (with Phases 20 to 22)                      |
| Spec / prompt   | `docs/prompts/production-progression.md` → `<phase_23>`; plan `docs/prompts/plans/phase-23-plan.md` |
| Written by      | Claude                                                                                              |
| Previous report | `qa/reports/2026-10-21-phase-22-attendance-run2.md` (PASS)                                          |

Dylan's answers: **1A** a batch ends with Finish roll at Preparation; **2B** check-ins every 4 hours
by default; **3B only the Quality Inspector enters check-ins** (the Floor Manager doesn't); **4A**
the quota suggestion averages 10 full working days; **5A** a shoe type's first quota applies from
today, later changes from tomorrow. Decisions D-082 to D-087.

**Follow-up 2026-10-22 (D-088, amends 3B):** the Floor Manager can also enter and correct
check-ins, **only on a day attendance is taken and no Quality Inspector is marked present**. See
scenarios C1 to C4; P2 and A2 changed.

## 1. What changed

- **Everyone (FM, QI, Admin):** a new **Production** page (Production → Production, `/production`):
  today's check-ins, today against the daily quota per shoe type, and the last 14 working days
  with a chart and one sentence for each day below quota ("Below quota by 18 pairs. 3 of 12 Shoe
  Constructors were absent."). Nothing names a person except who entered a check-in.
- **Quality Inspector:** enters the pairs finished at each check-in (**Enter count**), per shoe
  type, and can **Correct** one the same day with a reason. A **Next check-in** card on the home.
  Can now **Finish roll** on a batch (not start, edit or cancel).
- **Floor Manager:** **Schedule and quota** (`/production/plan`): the check-in schedule (applies
  from tomorrow) and a daily quota per shoe type with a **suggestion** and **Use suggestion**, plus
  the history of both. The home's **Batches by stage** card is replaced by **Today's production**.
  The FM can't enter check-ins (3B).
- **Batches are rolls:** **Start roll**, **Finish roll…**, Edit, **Cancel roll…**. No stage moves.
  Statuses read Planned, At Preparation, Finished, Cancelled. "All 10 pieces scanned. Finish this
  roll?" on the batch page and the Capture page. Old batches still past Preparation read "Started
  before rolls were tracked" and can be finished. The Target quota field is gone from the form,
  the list and the detail page. The list's Stage filter is gone (status filter only). The batch
  page's "Stage timeline" is now **History**; the progress stepper is gone.
- **Reports → Operations:** KPI tiles **Pairs made**, **Of quota**, **Rolls finished**, **Rolls at
  Preparation** (Batches completed/started, Typical lead time and In production now are gone).
  A **Production** section replaces On the floor now, Flow and Time in each stage. Attention:
  "N of the last 5 working days were below quota" replaces the bottleneck and stuck items.
  **Production CSV** replaces Stages CSV. The daily summary and `operations.csv` say Rolls
  started / Rolls finished.
- **Capture page:** "No roll is at Preparation…", and a finished roll's refusal reads "This roll
  was finished, so this section wasn't saved. The next scan goes to B-…. Press Capture again."

## 2. Files touched

| File                                                                                                     | Change                                                                                                                       |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261021133748_production_progression/`                       | New `ProductionSchedule`, `DailyQuota`, `ProductionCheckIn`, `ProductionCount`                                               |
| `src/lib/production-rules.ts`                                                                            | New: slots, states, window, progress, pace, suggestion, shortfall                                                            |
| `src/lib/stage-machine.ts`                                                                               | Now the roll lifecycle (start, finish, cancel, labels, finish hint)                                                          |
| `src/lib/domain.ts`                                                                                      | Status labels At Preparation / Finished                                                                                      |
| `src/lib/ops-rules.ts`, `src/lib/report-rules.ts`                                                        | Stage rules removed; below-quota attention item                                                                              |
| `src/server/models/production.model.ts`                                                                  | New                                                                                                                          |
| `src/server/models/{batch,report,ops-report,attendance,reference-data,demo-reset}.model.ts`              | Stage queries removed; roll counts; attendance range; all shoe types; reset clears production                                |
| `src/server/services/production.service.ts`                                                              | New: today, days, plan, check-ins, corrections, schedule, quotas, report, CSV, default schedule                              |
| `src/server/services/{batch,report,ops-report,attendance,bootstrap,camera,capture,demo-seed}.service.ts` | Finish roll; roll flow; Operations production; `workforceByDay`; default schedule; roll wording; demo week                   |
| `src/server/controllers/{production,batch,report,scan}.controller.ts`                                    | New production API; start/finish permissions; production CSV; `scanned` on current batch                                     |
| `src/server/validators/{production,batch}.validator.ts`                                                  | New production schemas; start/finish only, no target quota                                                                   |
| `src/server/policies/{permissions,navigation}.ts`                                                        | `batch:finish`, `production:read/checkin/plan`; Production nav item                                                          |
| `src/app/api/v1/production/**`, `src/app/api/v1/reports/production.csv/`                                 | New one-line routes; `reports/stages.csv` deleted                                                                            |
| `src/app/(app)/production/{page,actions,check-in-dialog}.tsx`, `production/plan/{page,plan-forms}.tsx`   | New pages                                                                                                                    |
| `src/app/(app)/batches/**`                                                                               | Roll actions, History, no target quota, no stage filter                                                                      |
| `src/app/(app)/camera/capture/{page,capture-client}.tsx`                                                 | Finish hint, roll wording                                                                                                    |
| `src/app/(app)/{floor-manager,quality-inspector}/page.tsx`                                               | Today's production / Next check-in cards                                                                                     |
| `src/app/(app)/reports/page.tsx`, `_components/{operations-view,ops-parts}.tsx`                          | Production section, KPIs, Production CSV; FlowLanes removed                                                                  |
| `src/components/features/production/*`, `charts/production-chart.tsx`                                    | New                                                                                                                          |
| `src/components/features/batches/{batches-by-stage-card,stage-progress}.tsx`, `charts/flow-chart.tsx`    | Deleted                                                                                                                      |
| `src/components/features/{batches/batch-status-badge,app-shell/sidebar}.tsx`                             | Roll labels; Production icon                                                                                                 |
| `scripts/demo-reset.ts`, `.github/workflows/ci.yml`                                                      | Reset labels; CI checks schedule, quotas, check-ins                                                                          |
| `tests/unit/**`                                                                                          | New `production-rules`, `production.service`; updated stage, batch, report, ops, permissions, validators, demo seed, capture |
| `tests/e2e/production.spec.ts`                                                                           | New                                                                                                                          |
| `tests/e2e/{batches,outcomes,reports,smoke,auth}.spec.ts`                                                | Updated for rolls, Production, nav                                                                                           |
| Docs                                                                                                     | `ROADMAP`, `STATUS`, `DECISIONS` (D-082 to D-087), `API`, `README`, `SESSION_LOG`, master spec roles table                   |

Formatting only (Prettier): `src/app/(app)/attendance/attendance-roster.tsx`,
`tests/unit/attendance.service.test.ts`, `tests/unit/bootstrap.service.test.ts`.

Database migration in this change: **yes** (`production_progression`, already applied to the dev
database). The bootstrap adds the default schedule the first time the app starts.

## 3. How to run the app locally

PowerShell, in `C:\dev\CPoint-PMS`, on the main PC:

```bash
npm run db:up
npm run db:deploy
npm run build
npm run start
```

(`npm run dev` also works.) Health: `http://localhost:3000/api/health`. If port 3000 is taken by
another project, start with `PORT=3001`.

**Check-ins open at their scheduled time** (12:00, 16:00 and 17:00 Manila by default), so most
check-in scenarios need either the right time of day or a test schedule. Use one of these:

- **Recommended: a throwaway stack with the demo week** (as in earlier runs, `cpoint-qa`), so the
  Recent days, the suggestion and the Operations report have data: `SEED_DEMO_USERS=true`,
  `SEED_DEMO_WEEK=true`.
- **A test schedule for today**, so a check-in is always due (after 01:00 Manila). Run in the
  stack's database, and delete it afterwards:

```sql
INSERT INTO production_schedules (id, "shiftStart", "shiftEnd", "intervalMinutes", "workingDays", "effectiveFrom", "createdAt")
VALUES (gen_random_uuid(), '00:00', '23:59', 60, '{1,2,3,4,5,6,7}', (now() AT TIME ZONE 'Asia/Manila')::date, now())
RETURNING id;
-- afterwards: DELETE FROM production_schedules WHERE id = '<that id>';
```

Existing automated tests that cover this area (Claude didn't run them, project rule):

```bash
npm run build && npx playwright test tests/e2e/production.spec.ts tests/e2e/batches.spec.ts tests/e2e/outcomes.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts
```

Then the full suite. `production.spec.ts` inserts and removes its own hourly schedule and deletes
the check-ins and quotas it made; it needs `DATABASE_URL` and must run **after 01:00 Manila**.

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data:

- **Dev database (as of 2026-10-21):** no quotas or check-ins yet; 7 old batches still in progress
  past Preparation (Batches → Status "At Preparation" shows them with "Started before rolls were
  tracked"); 55 at Preparation, 8 planned. Shoe types School Shoe and Topsider.
- **Demo week (throwaway stack):** quotas School Shoe 85 and Topsider 43 from the week's first day;
  the QI's check-ins at 12:00, 16:00, 17:00 on every working day, one 17:00 **missed** (Recent days
  "· 1 missed"), one entered **late**; three days below quota with 2, 3 and 5 constructors absent,
  each with its sentence; the newest roll still at Preparation with 20+ scans (finish hint).
  Which calendar days these land on depends on the weekday the stack is seeded.

## 5. Test scenarios

| ID  | Role                             | Steps                                                                                                                                                                                  | Expected result                                                                                                                                                                                                                                                                                  | Priority |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| P1  | FM                               | Sign in. Look at the home.                                                                                                                                                             | **Today's production** card with a bar per shoe type ("N of 85 pairs (x%)" or "N pairs, no quota") and the next check-in line. No "Batches by stage" card.                                                                                                                                       | High     |
| P2  | FM                               | Attendance not taken today. Production (sidebar, first item under Production).                                                                                                         | Today's check-ins table (12:00, 16:00, 17:00 with state badges), "Today against the quota", Recent days chart and table. **No Enter count button**; text "Take today's attendance first. You can enter check-ins only when it shows no Quality Inspector present."                               | High     |
| P3  | FM                               | Production → **Schedule and quota**. Set Shift start 17:00, Shift end 08:00, Save schedule.                                                                                            | "Shift end must be after shift start." under Shift end; focus there.                                                                                                                                                                                                                             | High     |
| P4  | FM                               | Same form: 08:00, 17:00, Check-in "Every 2 hours", Save schedule.                                                                                                                      | Preview "Check-ins at 10:00, 12:00, 14:00, 16:00, 17:00. Applies from tomorrow, …"; toast "Schedule saved. It applies from <tomorrow>."; Schedule history shows it first; Production today still shows 12:00, 16:00, 17:00.                                                                      | High     |
| P5  | FM                               | Untick every working day, Save schedule.                                                                                                                                               | "Pick at least one working day."                                                                                                                                                                                                                                                                 | Medium   |
| P6  | FM                               | Daily quota: enter 0 for School Shoe, Save quotas.                                                                                                                                     | "Enter the daily quota for School Shoe as a whole number of pairs, at least 1." under the field.                                                                                                                                                                                                 | High     |
| P7  | FM                               | Dev DB (no quota yet): enter 90 for School Shoe and 45 for Topsider, Save quotas. (Leaving one blank gives that type's "Enter the daily quota…" message: every active type needs one.) | Toast "2 quotas saved." Hint said "No quota yet. The first one applies from today, …". Production today now shows "… of 90 pairs". Quota history rows from **today**.                                                                                                                            | High     |
| P8  | FM                               | Change School Shoe to 95, Save.                                                                                                                                                        | Hint "Today: 90 pairs. A change applies from <tomorrow>."; history row from tomorrow; today still 90.                                                                                                                                                                                            | High     |
| P9  | FM                               | Demo stack: look at the suggestion box.                                                                                                                                                | "Suggested: N pairs" with "Average … pairs per check-in over the last 5 full working days × 3 check-ins a day = N pairs." and the per-constructor line. **Use suggestion** fills N. On the dev DB: "A suggestion needs at least 3 working days with every check-in entered. There are 0 so far." | Medium   |
| P10 | QI                               | Sign in (a check-in due: test schedule or the right time).                                                                                                                             | **Next check-in** card: "The HH:00 check-in is due." (or "Late by N minutes") with **Enter count**.                                                                                                                                                                                              | High     |
| P11 | QI                               | Click Enter count on the card.                                                                                                                                                         | `/production` opens with the dialog already open for that check-in.                                                                                                                                                                                                                              | Medium   |
| P12 | QI                               | In the dialog press **Save count** with empty fields.                                                                                                                                  | One message per shoe type: "Enter the School Shoe finished since HH:MM as a whole number, like 24. Enter 0 if none."; focus on the first.                                                                                                                                                        | High     |
| P13 | QI                               | Enter 2001 for one type. Save.                                                                                                                                                         | "School Shoe can't be more than 2,000 pairs in one check-in. Check the number."                                                                                                                                                                                                                  | Medium   |
| P14 | QI                               | Enter 22 and 10, a note, Save count.                                                                                                                                                   | Toast "HH:MM check-in saved."; the row shows **Entered**, 22 and 10, constructors present (or "Not taken"), "Inspector name at HH:MM", "Note: …". Today against the quota goes up.                                                                                                               | High     |
| P15 | QI                               | Same slot again through the API (`POST /api/v1/production/check-ins` with that `slotAt`).                                                                                              | `409`, code `STALE`, "<name> already entered the HH:00 check-in at HH:MM. Refresh to see it."                                                                                                                                                                                                    | High     |
| P16 | QI                               | `POST` for a later slot that hasn't come yet.                                                                                                                                          | `409`, "The HH:00 check-in isn't open yet. You can enter it from HH:00."                                                                                                                                                                                                                         | Medium   |
| P17 | QI                               | Correct on the saved row; change a number; Save correction without a reason.                                                                                                           | "Say why you're correcting this check-in, at least 5 characters."                                                                                                                                                                                                                                | High     |
| P18 | QI                               | Give a reason, Save correction.                                                                                                                                                        | Row shows "Corrected by … at HH:MM: <reason>". Admin → Audit log has `production.checkin.correct` with before and after counts.                                                                                                                                                                  | High     |
| P19 | QI + FM                          | With attendance **not taken** today, open Enter count. Then as FM take attendance. Reload Production.                                                                                  | Dialog: "Attendance not taken yet. Ask the Floor Manager." and it still saves (row "Not taken"). After attendance, the row shows "Attendance changed after this check-in".                                                                                                                       | Medium   |
| P20 | QI                               | Leave a due check-in more than 30 minutes.                                                                                                                                             | Badge **Late** and "Late by N minutes"; once entered, **Entered late**.                                                                                                                                                                                                                          | Medium   |
| P21 | FM                               | Demo stack: Production → Recent days.                                                                                                                                                  | Three days with a sentence like "Below quota by N pairs. 3 of 12 Shoe Constructors were absent."; one day "x of 3 · 1 missed"; days on quota show "—". No person named anywhere in the table or chart tooltip.                                                                                   | High     |
| C1  | FM                               | Attendance: mark everyone present (the QI included), Save. Production.                                                                                                                 | No Enter count; "A Quality Inspector is present today, so they enter the check-ins." `POST /api/v1/production/check-ins` → 403 with the same sentence.                                                                                                                                           | High     |
| C2  | FM                               | Attendance: untick the Quality Inspector, Save. Production (a check-in due).                                                                                                           | Note "No Quality Inspector is present today, so you can enter the check-ins…"; **Enter count** and **Correct** appear; a count saves under the FM's name. Admin → Audit log: `production.checkin` with `coveringForQualityInspector: true`.                                                      | High     |
| C3  | FM                               | After C2, with a check-in late or missed today, look at the FM home.                                                                                                                   | Today's production card: "… late. No Quality Inspector is present today, so enter them on Production."                                                                                                                                                                                           | Low      |
| C4  | QI                               | With the QI marked absent (C2), sign in as the QI and enter a check-in.                                                                                                                | Still allowed (the QI can always enter).                                                                                                                                                                                                                                                         | Medium   |
| R1  | FM                               | New batch → register → **Start roll**.                                                                                                                                                 | Badge "At Preparation". Buttons Finish roll…, Edit, Cancel roll…. No Move to / Move back. No Target quota field on the form.                                                                                                                                                                     | High     |
| R2  | FM                               | **Finish roll…**                                                                                                                                                                       | Dialog "Do this when the roll is used up. N sections were scanned (10 expected)…"; Finish roll → badge "Finished"; History has one Preparation row with an end time.                                                                                                                             | High     |
| R3  | FM                               | Finish a roll with a Fixable section still open (outcomes test data, or scan one Fixable first).                                                                                       | The dialog shows "1 section is still to be cleaned or cut around. The roll will be tagged Being handled…"; finishes; "Being handled · 1" tag stays.                                                                                                                                              | Medium   |
| R4  | FM                               | Batches → Status filter.                                                                                                                                                               | Options All statuses, Planned, At Preparation, Finished, Cancelled. No Stage filter. No Stage or Target columns.                                                                                                                                                                                 | Medium   |
| R5  | FM                               | Dev DB: open an old batch at Upper Making/Sole-ing/Finishing.                                                                                                                          | Badge "Started before rolls were tracked", a note naming its stage, History with its stage rows; Finish roll works.                                                                                                                                                                              | Medium   |
| R6  | FM                               | API: `POST /api/v1/batches/{id}/stages` `{ "action": "advance", "expectedStage": "PREPARATION" }`.                                                                                     | `422` "Choose start or finish. A roll no longer moves through stages."                                                                                                                                                                                                                           | Medium   |
| R7  | QI                               | Open a roll at Preparation.                                                                                                                                                            | Finish roll… only (no Start, Edit, Cancel); it finishes. API `start` as QI → 403.                                                                                                                                                                                                                | High     |
| R8  | QI/FM                            | Demo stack: Capture page with the newest roll.                                                                                                                                         | Under "Next scan goes to …": "N pieces scanned, 10 expected. Finish this roll?" with "Open B-… to finish it".                                                                                                                                                                                    | Medium   |
| R9  | Constructor (allowed to capture) | Capture page with a roll of ≥ 10 scans.                                                                                                                                                | The hint ends "Ask the Floor Manager or the Quality Inspector to finish it." (no link).                                                                                                                                                                                                          | Low      |
| O1  | FM                               | Reports (Operations), 7 days.                                                                                                                                                          | KPI tiles Pairs made, Of quota, Rolls finished, Rolls at Preparation, First-pass yield, To clean or cut around. A **Production** section (chart + table). No "On the floor now", "Flow" or "Time in each stage".                                                                                 | High     |
| O2  | FM                               | Demo stack: What needs attention.                                                                                                                                                      | "3 of the last 5 working days were below quota" linking to /production. No bottleneck or "waiting longer than usual" items.                                                                                                                                                                      | Medium   |
| O3  | FM                               | Download **Production CSV**.                                                                                                                                                           | Header `Date (Manila),Shoe type,Pairs finished,Daily quota,% of quota,Check-ins entered,Check-ins scheduled,Shoe Constructors present,Shoe Constructors on the roster,Pairs per constructor present (line average),Day below quota`; one row per day and shoe type; no names.                    | High     |
| O4  | FM                               | Operations CSV; `/api/v1/reports/stages.csv`.                                                                                                                                          | Operations CSV header has "Rolls started,Rolls finished"; stages.csv is 404.                                                                                                                                                                                                                     | Medium   |
| U1  | All                              | ui-craft check on `/production`, `/production/plan`, the batch page, the homes: axe, a narrow window (no sideways page scroll), keyboard through Enter count and the forms.            | No serious axe issues; tables scroll inside their card only.                                                                                                                                                                                                                                     | Medium   |

### Access checks

| ID  | Role that must NOT have access                                    | URL or action                                                                                                                                       | Expected                                   |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| A1  | Shoe Constructor                                                  | `/production`, `/production/plan`, `GET /api/v1/production/today`, `/days`                                                                          | `/forbidden`; 403                          |
| A2  | Floor Manager, on a day a QI is present or attendance isn't taken | Enter count; `POST /api/v1/production/check-ins`; `PATCH …/check-ins/{id}`                                                                          | No button; 403 with the reason             |
| A3  | System Admin                                                      | `/production/plan`; `PUT /api/v1/production/schedule`, `/quotas`; check-ins                                                                         | `/forbidden`; 403 (can view `/production`) |
| A4  | Quality Inspector                                                 | `/production/plan`; `PUT …/schedule`, `…/quotas`; batch `start`, Edit, Cancel                                                                       | `/forbidden`; 403; no buttons              |
| A5  | Quality Inspector, Admin                                          | `/api/v1/reports/production`, `/production.csv`                                                                                                     | 403 (Floor Manager only)                   |
| A6  | Admin                                                             | Finish roll on a batch page                                                                                                                         | No button; API `finish` → 403              |
| A7  | Sidebar                                                           | FM: Overview, Production, Attendance, Batches, …; QI: Overview, Production, Batches, Camera, …; Admin: Overview, Production, Attendance, Batches, … | As listed (`auth.spec.ts`)                 |

## 6. Out of scope / known issues

- **Phase 24** (materials used from check-ins, leather pieces, nails in boxes) isn't built; nothing
  is taken from stock by a check-in yet.
- The FM can cover only once today's attendance is taken with no QI present (D-088); with
  attendance not taken, a day without a QI stays Missed until it is. Not a fault.
- `production.spec.ts`'s Floor Manager test changes today's attendance (QI present, then absent)
  and puts it back; run it apart from `attendance.spec.ts`.
- A check-in can't be entered after midnight or before its time; a correction only the same day.
- The demo week's day-by-day numbers depend on the weekday it was seeded; check the shape (three
  short days lining up with 2, 3 and 5 absent, one missed, one late), not exact numbers.
- `Batch.targetQuotaPairs`, `Stage` and `currentStage` stay in the database on purpose (no data
  migration, assumption 2); old batches keep their stage History.
- Device checks from earlier phases (station laptop, real leather for Fixable/Reject) still need
  Dylan.
- Claude ran lint, typecheck, 714 unit tests and the build (all pass) and a read-only check of the
  services against the dev database, plus a demo week on a throwaway database (since dropped):
  stock equals the ledger, 17 check-ins, the three short days on the 2, 3 and 5 absent days. No
  browser or e2e test was run.
