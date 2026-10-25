# QA handoff: Phase 29, stock updated on one sheet, reminders, Reports → Materials

| Field           | Value                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Date            | 2026-10-25                                                                                          |
| Feature         | phase-29-stock-updates                                                                              |
| Branch          | `main` + uncommitted Phase 29 in `C:\dev\CPoint-PMS` (base `4eb28e5`)                               |
| Spec / prompt   | `docs/prompts/factory-visit-changes.md` Phase 29; plan `docs/prompts/plans/phase-29-plan.md`; D-102 |
| Written by      | Claude                                                                                              |
| Previous report | `qa/reports/2026-10-25-phase-28-run2.md`                                                            |

## 1. What changed

- **Floor Manager:** Inventory → **Update stock** is one sheet of every active item with three
  boxes, **Added (+)**, **Used (−)** and **Correction**, and a **Reason** that opens only when a
  correction is typed. **After** shows the new stock as you type. Rows left blank are left alone.
  **Save update (N items)** saves every filled row at once and shows "Stock updated: N items.".
- The item page no longer has Receive stock, Use stock, Stock count or Undo. It has **Update
  stock** (opens the sheet on that item), Edit and Deactivate. The history shows **Added**,
  **Used** and **Correction** badges.
- A **Leather roll** item needs a **Supplier** (Add item and Edit). Other categories show no
  Supplier field. The Inventory list shows the supplier under the name and a **Last updated**
  column.
- **Reminder:** on a reminder day (Wednesday and Friday by default, ticks under the sheet), until
  an update is saved that day, the FM home shows **Stock update today** as its first card and the
  bell beside the logo lists "Stock update today. Update stock.".
- **Reports → Materials** (new tab, FM): per item this week and last week with the change, an
  8-week trend, per 100 pairs and days left (last 28 days), a "May run out before the next update"
  badge and banner; a Leather rolls table (used from the sheet beside rolls the camera checked);
  **Materials CSV**. Corrections and Added never count as use.
- `stock.csv` says "Added in period" instead of "Received in period".
- The QI and Admin still can't open Inventory or the reports.

## 2. Files touched

| File                                                                                                                     | Change                                      |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261027090000_stock_updates/`                                                | StockUpdate, InventorySettings, two columns |
| `src/lib/inventory-rules.ts`, `src/lib/stock-rules.ts`                                                                   | `planStockLine`, weeks, reminder, pace      |
| `src/server/models/{stock-update,materials,inventory,demo-reset}.model.ts`                                               | queries                                     |
| `src/server/services/{stock-update,materials,inventory,demo-seed,bootstrap,ops-report}.service.ts`                       | the save, the report, demo week             |
| `src/server/controllers/{stock-update,inventory,report}.controller.ts`, `src/server/validators/inventory.validator.ts`   | API and messages                            |
| `src/app/api/v1/inventory/{updates,settings}/route.ts`, `src/app/api/v1/reports/{materials,materials-used.csv}/route.ts` | new routes                                  |
| `src/app/api/v1/inventory/[id]/movements/route.ts`; `inventory/movements/[id]/undo` deleted                              | GET only                                    |
| `src/app/(app)/inventory/**` (update sheet, item page, form, list, actions)                                              | the screens                                 |
| `src/app/(app)/reports/materials/page.tsx`, `reports/_components/report-tabs.tsx`                                        | Materials tab                               |
| `src/app/(app)/{layout,floor-manager/page}.tsx`, `sidebar.tsx`, `batch-notices.tsx`, `stock-update-card.tsx`             | the reminder                                |
| `tests/unit/*` (3 new, 5 updated), `tests/e2e/{inventory,smoke}.spec.ts`, `.github/workflows/ci.yml`                     | tests                                       |

Database migration in this change: **yes** (`20261027090000_stock_updates`)

## 3. How to run the app locally

Prerequisites as usual (`.env` with `AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`,
`SEED_DEMO_USERS=true`).

```bash
npm run db:up
npm run db:deploy      # applies stock_updates
npm run build
npm run start          # PORT=3001 if 3000 is taken
```

Dylan resets the dev database before the run (`npm run demo:reset -- --yes`), so the demo week has
its Wednesday and Friday updates. If `/inventory/update` shows no Recent updates, say so in the
report and go on.

Existing automated tests that cover this area:

```bash
npm run build && npx playwright test tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts
```

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD`.

| Role              | Email                      | Home page         |
| ----------------- | -------------------------- | ----------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`  |
| Quality Inspector | `inspector@cpoint.local`   | `/batches`        |
| System Admin      | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture` |

Data: the demo inventory (LR-001, LR-002, NL-001, AD-001, TH-001). Make your own items for the
scenarios that change stock (codes starting `QA29-`), so the demo items stay as seeded.

## 5. Test scenarios

Run **S1 to S3 first, before any save today** (and before the e2e run): a save clears today's
reminder.

| ID  | Role | Steps                                                                                                                                                                                                                                                                                                                                                                              | Expected result                                                                                                                                                                                                | Priority |
| --- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | FM   | Inventory → Update stock. Under **Reminder days**, tick today's weekday as well, **Save reminder days**.                                                                                                                                                                                                                                                                           | Toast "Reminder days saved: …". The page now shows the info banner "Today is a stock update day. Save an update to clear the reminder."                                                                        | High     |
| S2  | FM   | Open the FM home, then the bell beside the logo.                                                                                                                                                                                                                                                                                                                                   | **Stock update today** is the first card with **Update stock**. The bell lists "Stock update today. Update stock."; its link opens `/inventory/update`.                                                        | High     |
| S3  | FM   | Make a `QA29-A` item (Other, unit box, reorder 0, opening 10). On the sheet find it, type **Used** 2, save. Go back to the FM home.                                                                                                                                                                                                                                                | "Stock updated: 1 item.". The home no longer shows Stock update today and the bell no longer lists it. Then untick today's weekday and save, so the days read "Wednesday and Friday" again.                    | High     |
| S4  | FM   | Add item: Category Leather roll, leave Supplier empty, Add item. Then choose a supplier and add it. Then Add item with Category Nails.                                                                                                                                                                                                                                             | Error under Supplier "Choose the supplier of this leather roll."; with one chosen it saves and the item page shows the supplier. Nails has no Supplier field.                                                  | High     |
| S5  | FM   | Make `QA29-B` (Thread, opening 5). Item page → **Update stock**.                                                                                                                                                                                                                                                                                                                   | The sheet opens found on QA29-B; its row says "not updated yet". The item page has no Receive, Use or Stock count button.                                                                                      | High     |
| S6  | FM   | On QA29-B type Added 3, Used 9, Save update (1 item).                                                                                                                                                                                                                                                                                                                              | Under Used: "Only 8 spools of … in stock. Enter a smaller amount."; focus is on Used; nothing saved.                                                                                                           | High     |
| S7  | FM   | Used 6, Correction −0.5 (the Reason box was greyed out before you typed it), Save.                                                                                                                                                                                                                                                                                                 | Under Reason: "Enter a reason for the … correction, like “Recounted the shelf.”". After shows 1.5 spools.                                                                                                      | High     |
| S8  | FM   | Reason "Half a spool was tangled", Save. Open QA29-B's page.                                                                                                                                                                                                                                                                                                                       | Toast "Stock updated: 1 item."; on hand 1.5 spools, Low. History newest first: Correction −0.5 (with the reason), Used −6, Added +3, Opening stock. Recent updates on the sheet: "… · 1 item · Rodel Pascual". | High     |
| S9  | FM   | Partial save: fill two QA29 items, leave the rest blank, Save update (2 items).                                                                                                                                                                                                                                                                                                    | "Stock updated: 2 items."; the blank items keep their stock and Last updated.                                                                                                                                  | Medium   |
| S10 | FM   | Type a number on a row, then click Inventory in the sidebar.                                                                                                                                                                                                                                                                                                                       | The browser asks before leaving; Cancel keeps the entry.                                                                                                                                                       | Medium   |
| S11 | FM   | Two tabs on the sheet. In tab 1 save Used 1 on QA29-A. In tab 2 (not refreshed) save Added 1 on QA29-A.                                                                                                                                                                                                                                                                            | Tab 2: "<QA29-A name> changed while you were updating (now N boxes). Check it and save again."; nothing saved from tab 2.                                                                                      | High     |
| S12 | FM   | Reports → **Materials**.                                                                                                                                                                                                                                                                                                                                                           | Used per material with This week, Last week, Change, Last 8 weeks, Per 100 pairs, On hand, Days left; QA29-B shows 6 this week (the correction isn't use). Leather rolls table under it.                       | High     |
| S13 | FM   | Check one demo row by hand: from LR-001's history, add up the Used entries per week and compare with This week and Last week; Per 100 pairs = Used in the last 28 days ÷ pairs finished since the later of 28 days ago and the item's first history entry × 100 (the card's pair count is for the full 28 days, so for an item with a shorter history count its pairs on Batches). | The figures match (2 decimals).                                                                                                                                                                                | Medium   |
| S14 | FM   | **Materials CSV**.                                                                                                                                                                                                                                                                                                                                                                 | `cpoint-materials-used-<from>_<to>.csv` with the header `Week (Monday),Item code,Item,Category,Supplier,Unit,Used,Pairs finished,Used per 100 pairs`, 8 rows per item.                                         | Medium   |
| S15 | FM   | Reports → Operations → stock CSV.                                                                                                                                                                                                                                                                                                                                                  | Header has "Added in period" (not "Received in period").                                                                                                                                                       | Low      |
| S16 | FM   | axe (WCAG 2.1 A/AA) on `/inventory/update`, `/reports/materials`, `/inventory/new` with Leather roll chosen, and the FM home with the reminder card (during S2).                                                                                                                                                                                                                   | No serious or critical violation.                                                                                                                                                                              | High     |
| S17 | FM   | At 1280 and 1024 px wide: the sheet and Materials.                                                                                                                                                                                                                                                                                                                                 | No sideways page scroll; a wide table scrolls inside itself.                                                                                                                                                   | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                      | Expected     |
| --- | ------------------------------ | ------------------------------------------------------------------ | ------------ |
| A1  | QI, Admin                      | `/inventory/update`, `/reports/materials`                          | `/forbidden` |
| A2  | QI, Admin                      | `POST /api/v1/inventory/updates`, `PUT /api/v1/inventory/settings` | `403`        |
| A3  | FM                             | `POST /api/v1/inventory/{id}/movements`                            | `405`        |
| A4  | FM                             | `POST /api/v1/inventory/movements/{any id}/undo`                   | `404`        |

## 6. Out of scope / known issues

- The reminder can only be seen on a reminder day; S1 makes today one and S3 puts it back.
- Days left and per 100 pairs are only as good as what was entered as Used (D-102).
- Older movements keep their old reasons ("Delivery received", "Stock count"); their badges read
  Added, Used or Correction now.
- The e2e suite adds `E2E item …` and `E2E cement …` items to the dev database (as before).
