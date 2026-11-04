# QA handoff: Phase 30E-1, the leather then the roll; a roll leaves stock at Capture

| Field           | Value                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Date            | 2026-11-04                                                                                                   |
| Feature         | phase-30e-rolls-by-color                                                                                     |
| Branch          | `main` at 9bfd10e, **uncommitted** on the laptop (`C:\dev\CPoint-PMS`)                                       |
| Spec / prompt   | `docs/prompts/rolls-by-color-and-same-day-plan.md` items 1 to 3; plan `docs/prompts/plans/phase-30e-plan.md` |
| Written by      | Claude                                                                                                       |
| Previous report | `qa/reports/2026-11-03-phase-30c-run3.md` (pass, nothing open)                                               |

## 1. What changed

- **Capture → Start a roll (D-113).** The constructor picks the **Leather** ("Brown suede
  (topsiders) · Marikina Leather Trading · 3 rolls"), then the **Roll on the table** from that
  leather's rolls ("LR-MLT-012 · 24.5 sq ft · tag 88-14"), and presses **Start scanning**. Nothing
  to type. Each roll's area is the one the Floor Manager entered with **Add rolls** (unchanged
  from Phase 30A). With nothing chosen: "Choose the leather you’re scanning." / "Choose the roll on
  the table. Its code is on its label." **Start another roll** replaces Scan another roll; **Put roll
  back** stays for an empty roll.
- **Finish roll takes the roll off stock (D-112),** whatever its Defect %: "LR-MLT-012 is finished
  with 6 shots. It is taken off the Brown suede (topsiders) stock." Over the limit it adds "12.4% of
  it has defects, which is too many. The Floor Manager will see it." Nothing to set aside.
- **Finish batch (D-111):** only pairs finished, failed inspection and notes (or the correction's
  reason). No Rolls fully used list. Batches ticked before still show "Fully used: …".
- **Reports → Rolls:** **Too many defects** is information only. The "waiting for your decision"
  band, the "Waiting for your decision" status choice, **Send back to supplier…** and **Keep and
  use…** are gone. **Remove roll…** shows for a roll in stock or being scanned (it leaves stock),
  not for a scanned one ("Scanned and taken off stock."). The claim sheet stays.
- **Settings → Thresholds:** "A roll has too many defects when they cover more than __%".
  **Reports → Operations → Supplier quality:** the column is **Too many defects**; Returned is gone
  (and from `suppliers.csv`).
- **Inventory** is unchanged from Phase 30A (Add rolls with areas; the count follows the rolls).
- **Migration** `rolls_leave_stock_at_capture` (data only): scanned rolls not yet ticked Fully used
  leave stock (−1); rolls in stock stay pickable.
- **Demo week:** no Fully used ticks and no returns; every scanned roll took one off stock; one
  shelf roll removed for water damage.

## 2. Files touched

| File                                                                                                                                                 | Change                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `prisma/migrations/20261104090000_rolls_leave_stock_at_capture/`, `prisma/schema.prisma` (comment)                                                   | scanned rolls off stock                        |
| `src/lib/roll-rules.ts`, `src/server/{models/roll.model,services/roll.service,controllers/roll.controller,validators/roll.validator}.ts`             | finish −1, remove rules, no ticks or decisions |
| `src/server/services/production.service.ts`, `validators/production.validator.ts`, `src/app/(app)/batches/{finish-batch-dialog,page}.tsx`            | no roll list on Finish batch                   |
| `src/app/(app)/camera/capture/{start-roll-form,roll-bar,capture-client,page}.tsx`                                                                    | the leather, then the roll                     |
| `src/app/(app)/reports/rolls/**`, `reports/_components/ops-sections.tsx`, `components/features/rolls/remove-roll.tsx`; `return-decision.tsx` deleted | Too many defects as information                |
| `src/app/api/v1/rolls/[id]/return-decision/route.ts`                                                                                                 | deleted (404)                                  |
| `src/app/(app)/admin/settings/thresholds-form.tsx`, `src/lib/admin-rules.ts`, `src/server/services/{ops-report,demo-seed}.service.ts`                | wording; Supplier quality; demo week           |
| `.github/workflows/ci.yml`                                                                                                                           | the Docker job's demo roll checks              |
| `tests/unit/*`, `tests/e2e/{cv-helpers,capture,batches,returns,rolls}.ts`                                                                            | updated                                        |
| `docs/{API,STATION_SETUP,DECISIONS,STATUS,ROADMAP,SESSION_LOG}.md`                                                                                   | D-111 to D-113                                 |

Database migration in this change: **yes** (`rolls_leave_stock_at_capture`, data only).

## 3. How to run the app locally

Docker Desktop running for the **database only** (don't start the Docker `app`). Dylan restores the
laptop database from `storage/backups/before-phase30e-2026-11-04.dump` first (30E thread); then:

```bash
npm run db:up
npm run db:deploy      # applies rolls_leave_stock_at_capture
npm run db:generate
npm run dev            # http://localhost:3000, or the port it prints
```

Extra steps: back up, then reset the demo data (PowerShell drops a bare `--`):

```powershell
docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/before-30e-qa.dump
docker cp cpoint-pms-db-1:/tmp/before-30e-qa.dump storage/backups/before-30e-qa-run1.dump
npm run demo:reset '--' --yes
```

Existing automated tests that cover this area:

```powershell
$env:E2E_BASE_URL="http://localhost:3000"
npx playwright test tests/e2e/capture.spec.ts tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts tests/e2e/returns.spec.ts tests/e2e/rolls.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page         |
| ----------------- | -------------------------- | ----------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`  |
| Quality Inspector | `inspector@cpoint.local`   | `/batches`        |
| System Admin      | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture` |

Data: after `demo:reset`, the three demo leather items have rolls on the shelf, and the newest demo
roll is still being scanned. `constructor@cpoint.local` has camera access (if not, the System Admin
gives it under Users → More actions).

## 5. Test scenarios

| ID  | Role                               | Steps                                                                                                  | Expected result                                                                                                                                                                                                                                                                    | Priority |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Shoe Constructor                   | Capture → **Start another roll** (if a roll is open) → **Start scanning** with nothing chosen          | "Choose the leather you’re scanning." under Leather; Roll on the table is disabled ("Choose the leather first"); no text box on the form                                                                                                                                           | High     |
| S2  | Shoe Constructor                   | Choose **Brown suede (topsiders) · … · N rolls** → Start scanning; then choose a roll → Start scanning | First "Choose the roll on the table. Its code is on its label."; the roll list shows "LR-MLT-… · NN sq ft"; the roll starts. Line: "Roll LR-MLT-… · Brown suede (topsiders) · NN sq ft · 0 shots"                                                                                  | High     |
| S3  | Shoe Constructor                   | On that empty roll: **Put roll back** → confirm                                                        | "LR-… is back with the rolls waiting to be scanned."; it shows in the Roll on the table list again                                                                                                                                                                                 | High     |
| S4  | Shoe Constructor                   | Start a roll, capture at least one shot (phone or camera), **Finish roll**                             | "… is finished with N shots. It is taken off the <leather> stock." (and a Defect % line); Inventory → that leather's on hand is 1 lower; its Rolls table shows the roll Scanned. NOT POSSIBLE without a camera: say why                                                            | High     |
| S5  | Quality Inspector                  | Batches → Finish the due batch (or **Correct** a finished one)                                         | Only pairs finished, failed inspection, notes or reason: no Rolls fully used list, no checkboxes. Toast "Batch N finished." NOT POSSIBLE if no batch is due: say why                                                                                                               | High     |
| S6  | Floor Manager                      | Reports → Rolls; open a demo roll with **Too many defects**                                            | "Too many defects" on its row; no "waiting for your decision" band; the Status filter has no "Waiting for your decision". The roll's page: "This roll has too many defects (…, over 10%)." and "Scanned and taken off stock."; no Send back, Keep or Remove; **Claim sheet** opens | High     |
| S7  | Floor Manager                      | Inventory → a leather item → a roll Not scanned → **Remove** with a reason                             | It reads Removed; on hand 1 lower                                                                                                                                                                                                                                                  | Medium   |
| S8  | Floor Manager                      | Inventory → **Add rolls** on a leather item (2 rolls, areas 24.5 and 31.75)                            | +2 on hand; both listed Not scanned; then both show at Capture under that leather                                                                                                                                                                                                  | Medium   |
| S9  | System Admin                       | Settings → Thresholds                                                                                  | "A roll has too many defects when they cover more than"; 0 refused with "Enter a percentage from 1 to 100…". Leave it at 10                                                                                                                                                        | Medium   |
| S10 | Floor Manager                      | Reports → Operations → Supplier quality; the Suppliers CSV                                             | Column **Too many defects**; no Returned; the CSV has "Rolls with too many defects" and no "Rolls returned"                                                                                                                                                                        | Medium   |
| S11 | Shoe Constructor (phone width 390) | Capture → Start a roll                                                                                 | Both dropdowns and the button fit, no sideways scroll; Start scanning at least 44 px tall                                                                                                                                                                                          | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                   | Expected     |
| --- | ------------------------------ | --------------------------------------------------------------- | ------------ |
| A1  | Floor Manager, QI, Admin       | `GET /api/v1/rolls/ready`, `POST /api/v1/rolls/{id}/start`      | 403          |
| A2  | anyone                         | `POST /api/v1/rolls/{id}/return-decision`                       | 404          |
| A3  | —                              | axe (WCAG 2.1 A/AA) on Capture's Start a roll and a roll's page | 0 violations |

## 6. Out of scope / known issues

- Phase 30E-2 (the planning calendar) is the next session: How often still offers every 1 h and 3
  h, and plans still apply from tomorrow.
- Rolls with Returned to supplier, Kept or Fully used from before stay as history and may show.
- `batches.spec.ts` needs a batch due today (fails between 00:00 and 01:00 Manila).
