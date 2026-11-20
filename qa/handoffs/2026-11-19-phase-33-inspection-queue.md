# QA handoff: Phase 33 Inspection queue with batch codes

| Field           | Value                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Date            | 2026-11-19                                                                                                                             |
| Feature         | inspection-queue                                                                                                                       |
| Branch          | `main` at `42a2c1e` (#54) plus uncommitted Phase 33 work                                                                               |
| Spec / prompt   | `docs/prompts/plans/phase-33-inspection-queue-plan.md` (brief: the Phase 33 section of `docs/prompts/plans/defense-revisions-plan.md`) |
| Written by      | Claude                                                                                                                                 |
| Previous report | `qa/reports/2026-11-19-phase-32-run3.md` (PASS)                                                                                        |

## 1. What changed

The defense panel's revision 2: "a clear queue of pending batches … Don't just put Batch 1 /
Batch 2." (D-129)

- **Every batch has a code**, `B-YYMMDD-N`: `B-261116-2` is the second batch of 16 Nov 2026
  (A-57). It replaces "Batch 1 / Batch 2" on Batches, the Finish dialog, the notices (banner and
  bell), the Floor Manager's home card, the plan calendar's preview and every message.
- **Batches has two tabs: Queue and Today.** Queue is the Quality Inspector's home; the Floor
  Manager opens on Today. A notice's Finish link opens Today.
- **The Queue** lists every batch whose end has come and that isn't inspected or void, **across
  days**: Urgent first, then the one that has waited longest (A-58). Each card: the code, the day
  and times, the rolls finished at Capture inside it by leather ("6 rolls (Full-grain black ×4,
  Suede brown ×2)", A-83), "Waiting 3 hours 10 minutes", badges Waiting / Late / Urgent / Being
  inspected. Filters: Batch code, Day, Status, Priority. Below: **Inspected and void**, the last
  7 days.
- **Quality Inspector:** Start inspection (optional, A-60) marks it "Being inspected"; Inspect opens
  the Finish dialog ("Finish B-…", with the batch's day when it isn't today). A batch no longer
  closes at midnight: yesterday's batch can still be inspected today.
- **Floor Manager:** Mark Urgent (with a reason) / Set to Normal, and Void (with a reason, A-59).
  The QI has neither.
- A finished batch can be **corrected on the day it was inspected** (was: the batch's own day).
- Who may inspect follows **today's** attendance (A-82): the FM covers only when today shows no QI.
- A batch inspected on a later day still counts on **its own day** in the reports (A-81).
- **Old data is updated to match (Dylan, 2026-11-19):** every old batch gets a code; old finished
  ones are Inspected, old never-inspected ones are Void "Not inspected, from before the queue"
  (A-61). Old roll codes starting `B-` or `R-` are renamed `LR-<supplier>-NNN` (`LR-OLD-NNN` with no
  supplier, A-85); Find roll still finds them by the old code ("Formerly B-2026-0003").
- A day's plan can't change a batch someone acted on (being inspected, inspected, void or Urgent):
  "B-… is being inspected, so <day>'s batches can't change."

## 2. Files touched

| File                                                                                                                                             | Change                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261119090000_inspection_queue/`                                                                     | `ProductionBatch`, `BatchStatus`, `BatchPriority`, `InspectionQueueStart`, `ProductionCheckIn.batchId`, `Roll.formerCode`; the old roll-code rename |
| `src/lib/production-rules.ts`                                                                                                                    | `batchCode`, queue state and order, wait, rolls line, `syncBatches`; no midnight close; codes in labels and notices                                 |
| `src/server/models/production.model.ts`, `roll.model.ts`                                                                                         | batch rows, queue reads, sync, links; rolls finished with their item; find by former code                                                           |
| `src/server/services/production.service.ts`                                                                                                      | rows made on plan, lunch and read; finish by `batchId`; correction on the inspection day; today's attendance                                        |
| `src/server/services/batch-queue.service.ts` (new)                                                                                               | the queue, Start inspection, Urgent, Void                                                                                                           |
| `src/server/controllers/production.controller.ts`, `src/app/api/v1/production/batches/**` (new)                                                  | 4 routes                                                                                                                                            |
| `src/server/validators/production.validator.ts`, `src/server/policies/permissions.ts`                                                            | `batchId`, reasons, filters; `production:prioritise` (FM)                                                                                           |
| `src/app/(app)/batches/page.tsx`, `queue-list.tsx`, `queue-actions.tsx` (new), `finish-batch-dialog.tsx`, `actions.ts`, `plan/plan-calendar.tsx` | tabs, queue, dialogs, codes                                                                                                                         |
| `src/components/features/batches/batch-notices.tsx`, `production/production-cards.tsx`                                                           | codes                                                                                                                                               |
| `src/app/(app)/find/find-roll-client.tsx`, `src/server/services/roll.service.ts`                                                                 | "Formerly …"                                                                                                                                        |
| `src/server/services/demo-seed.service.ts`, `src/server/models/demo-reset.model.ts`, `scripts/demo-reset.ts`                                     | the missed demo batch waits, Urgent; reset clears batches                                                                                           |
| `.github/workflows/ci.yml`                                                                                                                       | docker SQL checks for the queue                                                                                                                     |
| `tests/unit/*`                                                                                                                                   | `inspection-queue-rules`, `batch-queue.service` (new); production, validator, permissions, demo-seed updated                                        |
| `tests/e2e/batches.spec.ts`, `tests/e2e/inspection-queue.spec.ts` (new)                                                                          | codes and tabs; the queue                                                                                                                           |

Database migration in this change: **yes** (`20261119090000_inspection_queue`). `npm run check`
passed (822 unit tests, build OK). The e2e specs were written, not run (Codex runs them).

## 3. How to run the app locally

```powershell
npm run db:up
npm run db:deploy        # applies 20261119090000_inspection_queue
npm run dev              # http://localhost:3000, DEMO_LOGIN_TOOLS=true
```

Extra steps for this change:

- **Before the reset (Q1 only):** back up the database, then check the migration's rename and the
  old-data codes on the laptop's own data (below), then `npm run demo:reset '--' --yes`.
- Run on a **weekday after 01:00 Manila** (as `batches.spec.ts` needs).
- For Q6 (two different inspectors) the System Admin adds a second Quality Inspector account under
  Users (e.g. "QA Inspector 2", `inspector2@cpoint.local`); remove it after the run.

E2E to run:

```powershell
$env:E2E_BASE_URL="http://localhost:3000"
npx playwright test tests/e2e/inspection-queue.spec.ts tests/e2e/batches.spec.ts --workers=2
npx playwright test --workers=2      # the full suite
```

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD`. Floor Manager `manager@cpoint.local` (home
`/floor-manager`), Quality Inspector `inspector@cpoint.local` (home `/batches`, Queue tab), System
Admin `admin@cpoint.local`, Shoe Constructor `constructor@cpoint.local`.

Data: after `demo:reset`, the demo's missed batch (the last batch of the shortest-handed day) waits
in the queue, marked Urgent: "Count it first: the customer picks these up today."

## 5. Test scenarios

| ID  | Role      | Steps                                                                                                                                                                                                                                                                                                                                                                    | Expected result                                                                                                                                                                                                                                                                                                                         | Priority |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q1  | — (DB)    | Before the reset: `npm run db:deploy`, then in psql `select count(*) from batches where code like 'B-%' or code like 'R-%'` and `select count(*) from batches where "formerCode" is not null`; open `/batches` once as the QI, then `select status, count(*) from production_batches group by 1` and `select count(*) from production_check_ins where "batchId" is null` | No roll code starts with `B-` or `R-`; renamed rolls (if any) have a formerCode and a `roll.recode` audit row; after the page load past batches exist, old unfinished ones are VOID with "Not inspected, from before the queue", and every finish in the last month is linked (0 null). Record the counts                               | High     |
| Q2  | QI        | `demo:reset`, sign in as the QI                                                                                                                                                                                                                                                                                                                                          | Lands on Batches with the **Queue** tab selected; "N batches waiting, 1 urgent…"; the Urgent card is first, with its reason; every card shows a code `B-YYMMDD-N`, day, times, a rolls line and "Waiting …"                                                                                                                             | High     |
| Q3  | QI        | Queue: type part of a code in Batch code → Filter; then Day, Status (Late), Priority (Urgent); Clear                                                                                                                                                                                                                                                                     | Only matching cards; Clear brings all back; with none matching, "No waiting batch matches these filters."                                                                                                                                                                                                                               | Medium   |
| Q4  | QI        | Inspect the Urgent batch from an earlier day: Start inspection, then Inspect; Finish with 20 / 1                                                                                                                                                                                                                                                                         | Toast "You're inspecting B-…." then "B-… finished."; the dialog title "Finish B-…" and its description name the day; the card leaves the queue and shows under Inspected and void with "20 pairs, 1 failed"; Reports → Operations counts it on **its own day** (A-81)                                                                   | High     |
| Q5  | QI        | Today tab: the cards, the notice banner and the bell when a batch is due                                                                                                                                                                                                                                                                                                 | Codes everywhere ("B-… is due. Finish it now.", "Finish B-…"); no text "Batch 1" alone                                                                                                                                                                                                                                                  | High     |
| Q6  | QI + QI 2 | QI 1 clicks Start inspection on a batch; QI 2 (another account, see §3) opens the Queue                                                                                                                                                                                                                                                                                  | QI 2 sees "Being inspected by <QI 1> since hh:mm" and no Start inspection / Inspect on it; QI 2 calling `POST /api/v1/production/batches/{id}/start` gets 409 "<QI 1> is already inspecting B-… (since hh:mm). Pick another batch."                                                                                                     | High     |
| Q7  | FM        | Queue: Mark Urgent on a waiting batch with an empty reason, then "Customer pick-up at 3 pm"; then Set to Normal                                                                                                                                                                                                                                                          | Empty: "Say why this batch is urgent, at least 5 characters, like "Customer pick-up at 3 pm"." under the field; saved: "B-… is Urgent." and it jumps to the top; Normal: "B-… is back to Normal." and it returns to its place                                                                                                           | High     |
| Q8  | FM        | Void a waiting batch, empty reason first, then "Line stopped, no pairs made"                                                                                                                                                                                                                                                                                             | Empty: "Say why this batch won't be inspected, at least 5 characters, like "Line stopped, no pairs made"."; saved: "B-… is void."; it leaves the queue, shows under Inspected and void with the reason; `POST /api/v1/production/check-ins {batchId}` for it → 409 "B-… was voided: Line stopped, no pairs made. It can't be finished." | High     |
| Q9  | QI        | Correct a batch inspected today that belongs to yesterday; then (demo clock to tomorrow) try to correct it                                                                                                                                                                                                                                                               | Today: the correction saves; tomorrow: "A batch can only be corrected on the day it was inspected. This one was inspected on <day>."                                                                                                                                                                                                    | Medium   |
| Q10 | FM        | With a batch Being inspected today, change today's plan (Plan days → today → once a day)                                                                                                                                                                                                                                                                                 | Refused: "B-… is being inspected, so <day>'s batches can't change." (or today's lock if a batch is already finished)                                                                                                                                                                                                                    | Medium   |
| Q11 | QI        | Demo clock: move to the next day 09:00                                                                                                                                                                                                                                                                                                                                   | Yesterday's unfinished batches stay in the queue as Late, "Waiting … hours"; nothing reads "closed at midnight"                                                                                                                                                                                                                         | High     |
| Q12 | FM        | Find roll: type the former code of a renamed roll (only if Q1 found one)                                                                                                                                                                                                                                                                                                 | The roll is found, "Formerly B-…" shown                                                                                                                                                                                                                                                                                                 | Low      |
| Q13 | QI        | Queue at 390 × 844                                                                                                                                                                                                                                                                                                                                                       | No sideways scroll; Start inspection / Inspect at least 44 px tall; the Finish dialog is a bottom sheet                                                                                                                                                                                                                                 | Medium   |
| Q14 | —         | The two e2e specs, then the full suite (`--workers=2`)                                                                                                                                                                                                                                                                                                                   | All pass; report counts                                                                                                                                                                                                                                                                                                                 | High     |

### Access checks

| ID  | Role that must NOT have access         | URL or action                                                                                  | Expected                                                                |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A1  | Quality Inspector                      | `PUT /api/v1/production/batches/{id}/priority`, `POST …/{id}/void`; Mark Urgent / Void buttons | 403 "Your role doesn't have access to this. …"; no buttons              |
| A2  | System Admin                           | `/batches`, `GET /api/v1/production/batches`                                                   | `/forbidden`; 403                                                       |
| A3  | Shoe Constructor                       | `/batches`, `GET /api/v1/production/batches`, `POST …/{id}/start`                              | `/forbidden`; 403                                                       |
| A4  | Floor Manager on a day a QI is present | `POST /api/v1/production/batches/{id}/start`                                                   | 403 "A Quality Inspector is present today, so they finish the batches." |

## 6. Out of scope / known issues

- The batch code format, Normal/Urgent only and the rest of A-57 to A-61, A-81 to A-85 are
  assumptions to confirm with CPoint; report wording problems, not the rules.
- Reports' sort, filter, print and corrections by period are Phase 35.
- Final-product defects and repairs on a queue item are Phase 34.
- `batches.spec.ts` still needs a batch due today: it fails between 00:00 and 01:00 Manila.
