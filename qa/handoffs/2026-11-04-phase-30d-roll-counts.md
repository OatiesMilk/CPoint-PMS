# QA handoff: Phase 30D, roll counts on Capture, the calendar and Materials

| Field           | Value                                                                |
| --------------- | -------------------------------------------------------------------- |
| Date            | 2026-11-04                                                           |
| Feature         | phase-30d-roll-counts                                                |
| Branch          | `main` at a97d949 plus uncommitted Phase 30D changes (laptop)        |
| Spec / prompt   | `docs/prompts/plans/phase-30d-plan.md`, D-118 in `docs/DECISIONS.md` |
| Written by      | Claude                                                               |
| Previous report | `qa/reports/2026-11-04-reports-cleanup-run3.md` (PASS)               |

## 1. What changed

- **Shoe Constructor, Capture:** a card above the roll shows "Today, Wed, 4 Nov" and **Leather
  rolls scanned 3/15** in large text with a bar (rolls finished today against the Floor Manager's
  plan; "Plan reached" once met). With no plan: "The Floor Manager hasn't planned today yet.";
  marked Non-working: "Today is marked Non-working / Holiday.". Below, **Next planned days**: up
  to 4 planned days (Non-working and unplanned days skipped), each "Leather rolls scanned 0/12".
  It recounts right after this phone finishes or puts back a roll, every 60 s and when the tab
  comes back.
- **Floor Manager, Batches → Plan days:** today and past days read "3 of 5 rolls scanned · 1
  returned" when rolls went over the defect limit; the day's dialog adds ": 2 used, 1 returned to
  the supplier (over the defect limit)."
- **Floor Manager, Reports → Materials → Leather rolls:** **Rolls used** is now rolls checked −
  returned (the rolls the camera passed), **Rolls checked by the camera** also counts rolls sent
  back in Phase 30C, a new **Removed (other)** column (rolls removed from stock, e.g. water
  damage), and each week shows its working days ("4 working days"). A leather item's row in Used
  per material reads "Rolls that left stock: used, returned or removed".

## 2. Files touched

| File                                                                                                                           | Change                                            |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `src/app/(app)/camera/capture/plan-counter.tsx`                                                                                | new: the counter card                             |
| `src/app/(app)/camera/capture/capture-client.tsx`, `page.tsx`                                                                  | show the counter; recount after Finish / Put back |
| `src/app/api/v1/rolls/plan/route.ts`, `src/server/controllers/roll.controller.ts`                                              | `GET /api/v1/rolls/plan`                          |
| `src/server/services/production.service.ts`                                                                                    | `capturePlan`; the calendar's returned rolls      |
| `src/server/services/roll.service.ts`, `src/server/models/roll.model.ts`                                                       | `rollOutcomesByDay`, `listRollFinishes`           |
| `src/lib/production-rules.ts`, `src/lib/month-weeks.ts`                                                                        | counter rules, working days                       |
| `src/server/models/materials.model.ts`, `src/server/services/materials.service.ts`, `src/app/(app)/reports/materials/page.tsx` | Leather rolls                                     |
| `src/app/(app)/batches/plan/plan-calendar.tsx`, `page.tsx`                                                                     | "· N returned"                                    |
| `tests/unit/*` (5 files), `tests/e2e/capture.spec.ts`, `tests/e2e/inventory.spec.ts`                                           | tests                                             |
| `docs/*`                                                                                                                       | API, D-118, plan, wrap-up                         |

Database migration in this change: **no**.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, `npm install` done, `.env` filled in (`AUTH_SECRET`,
`BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up
npm run dev
```

Existing automated tests that cover this area:

```bash
npx playwright test tests/e2e/capture.spec.ts tests/e2e/inventory.spec.ts tests/e2e/batches.spec.ts tests/e2e/smoke.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role             | Email                      | Home page         |
| ---------------- | -------------------------- | ----------------- |
| Floor Manager    | `manager@cpoint.local`     | `/floor-manager`  |
| Shoe Constructor | `constructor@cpoint.local` | `/camera/capture` |
| System Admin     | `admin@cpoint.local`       | `/admin`          |

Data: Dylan's database after his `demo:reset` on 4 Nov (no reset needed). The constructor needs
camera access (Admin → Users → More actions). Note today's plan before changing it and put it
back at the end. A leather item with rolls in stock is needed for S4 (Inventory → Add rolls if
none).

## 5. Test scenarios

| ID  | Role                 | Steps                                                                                                                                        | Expected result                                                                                                                                                                                    | Priority |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | FM, then constructor | FM: Batches → Plan days, plan today with Rolls to be used 15 (and, if possible, tomorrow 12 and the day after 10). Constructor: open Capture | "Today, <weekday>, <day> <Mon>" and "Leather rolls scanned N/15", N = rolls finished today; a bar; "Next planned days" lists tomorrow "Leather rolls scanned 0/12" and the next                    | High     |
| S2  | FM, constructor      | FM marks a future weekday Non-working. Constructor reloads Capture                                                                           | That day is not under Next planned days; the list holds at most 4 days, in date order                                                                                                              | High     |
| S3  | FM, constructor      | Note today's plan, then FM marks today Non-working (only if no batch is finished today; otherwise skip and say why). Constructor reloads     | "Today is marked Non-working / Holiday."; undo the mark and restore the plan after                                                                                                                 | Medium   |
| S4  | Constructor          | Capture: Start a roll, take a shot, Finish roll                                                                                              | Right after the finish message the count goes up by 1 ("N+1/15") without a reload                                                                                                                  | High     |
| S5  | Constructor          | Start a roll and Put roll back (no shot)                                                                                                     | The count doesn't change                                                                                                                                                                           | Medium   |
| S6  | Constructor          | At 390 × 844 (phone) open Capture                                                                                                            | The counter fits, no sideways scroll; the Capture button stays at the bottom                                                                                                                       | High     |
| S7  | FM                   | Batches → Plan days, look at today (after S4) and a past day with scans; click today                                                         | The cell reads "N of 15 rolls scanned" (plus "· M returned" when a roll went over the limit); the dialog says "…so far." or "…so far: X used, M returned to the supplier (over the defect limit)." | Medium   |
| S8  | FM                   | Reports → Materials, Leather rolls                                                                                                           | Columns Week, Rolls used, Rolls checked by the camera, Returned to supplier, Removed (other), Pairs finished; each week shows "N working days"; on every row Rolls used = checked − returned       | High     |
| S9  | FM                   | Materials: compare the selected week with Reports → Rolls (filter Returned to supplier, the same days)                                       | Returned to supplier matches; Rolls checked = Scanning passed + Returned for rolls finished that week                                                                                              | Medium   |
| S10 | FM                   | Inventory → a leather item → Remove a roll in stock (reason "QA water damage"), then Materials, this week                                    | Removed (other) goes up by 1; Rolls used doesn't change                                                                                                                                            | High     |
| S11 | FM                   | Materials: pick a month's Week 5 (e.g. Nov 29–30)                                                                                            | Its row reads "1 working day"                                                                                                                                                                      | Low      |
| S12 | FM                   | Materials, Used per material: a leather item's row                                                                                           | It reads "Rolls that left stock: used, returned or removed"; other items don't                                                                                                                     | Low      |
| S13 | Any                  | axe (WCAG 2.1 A/AA) on Capture (phone) and Materials                                                                                         | 0 violations                                                                                                                                                                                       | High     |

### Access checks

| ID  | Role that must NOT have access    | URL or action            | Expected                                                 |
| --- | --------------------------------- | ------------------------ | -------------------------------------------------------- |
| A1  | FM, QI, Admin                     | `GET /api/v1/rolls/plan` | 403                                                      |
| A2  | Signed out                        | `GET /api/v1/rolls/plan` | 401                                                      |
| A3  | Constructor without camera access | Capture                  | "Ask the System Admin for camera access." and no counter |

## 6. Out of scope / known issues

- The scale marker (in place of tap calibration) is a separate thread, not built.
- The counter counts every roll finished, passed or returned (A-44); that is intended.
- A roll removed counts on the day it was removed (A-45).
- Leather item rows in Used per material still count every roll that left stock (Days left needs
  it); only the Leather rolls table counts used as passed.
