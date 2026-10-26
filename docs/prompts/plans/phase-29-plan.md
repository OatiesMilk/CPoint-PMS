# Phase 29 plan: stock updated on one sheet, reminders on Wednesdays and Fridays, weekly use

Brief: `docs/prompts/factory-visit-changes.md` → Phase 29 (C-16, C-32; A-21, A-22).
Status: **approved by Dylan on 25 Oct 2026 and built** (QA next). Decision: D-102.

The first draft (stock counts with "Counted now" and "Received since last count") was replaced
after Dylan's answers below. This file records the plan as approved and built.

## 0. Dylan's answers (25 Oct 2026)

1. There are no deliveries to receive any more. The FM just enters what went up (+) or down (−)
   per item.
2. A leather roll item carries its **supplier** (CPoint's own leather suppliers), on the item.
   Other materials are bought anywhere and have none.
3. Pairs that failed final inspection **count as made**: the camera is a pre-filter on leather,
   not a verdict on shoes.
4. A partial save clears the Wednesday/Friday reminder.
5. Days left from the last 4 weeks: ok.
6. "Go with the correction option": a miscount is entered as a **Correction** with a reason, and
   it is never counted as use.

## 1. Data (migration `stock_updates`)

- `StockUpdate` (`stock_updates`): `id`, `day` (Manila date), `createdById`, `note?`, `createdAt`.
- `InventoryMovement.updateId?` links each entry to its save (`SET NULL`).
- `InventoryItem.supplierId?` (`SET NULL`), required for `LEATHER_ROLL` by the validator.
- `InventorySettings` (single row): `reminderDays Int[]` default `{3,5}`; the migration inserts it.
- No conversion: old movements stay as ledger history.

## 2. Rules (pure, unit-tested)

- `planStockLine` (`inventory-rules.ts`): per item **Added** (IN, ≥ 0), **Used** (OUT, ≥ 0, not
  below zero after what was added), **Correction** (ADJUST, signed, not below zero, reason ≥ 3);
  at least one per line; stale when the stock isn't what the sheet saw.
- `stock-rules.ts`: Manila weeks Monday to Sunday, the last 8 weeks, the reminder due (a reminder
  day with no save that day), days to the next reminder day, the change against last week, used
  per 100 pairs (pairs finished, failed included), days left at the pace of the last 28 days (or
  since the item was added), may run out (days left < days to the next reminder day).
- Only **Used** counts as use. Added and Correction never do.

## 3. Screens

- **Inventory → Update stock** (`/inventory/update`, FM, any day): every active item with On hand,
  **Added (+)**, **Used (−)**, **Correction**, **Reason for a correction** (enabled only with a
  correction) and After (live). Find, Category, 15-row pager. **Save update (N items)** saves every
  filled row; blank rows are left alone; leaving with entries asks first. Errors under their field
  (D-038), a summary at 3 or more. Reminder days (checkboxes) and Recent updates below.
- Item page: **Update stock** (the sheet found on the item), Edit, Deactivate. Receive stock, Use
  stock, Stock count and Undo go.
- Item form: **Supplier** for a Leather roll.
- Inventory list: supplier under the name, **Last updated**.
- Reminder: **Stock update today** first on the FM home and in the bell.
- **Reports → Materials** (FM) and `materials-used.csv`; `stock.csv` "Added in period".

## 4. API

`GET`/`POST /api/v1/inventory/updates`, `GET`/`PUT /api/v1/inventory/settings`,
`GET /api/v1/reports/materials`, `GET /api/v1/reports/materials-used.csv`.
`POST /api/v1/inventory/{id}/movements` → `405`; the undo route is removed. Permissions unchanged
(`inventory:manage`, `inventory:read`, `report:production`; FM only).

## 5. Seeds

Demo items LR-001 (Meycauayan Tannery) and LR-002 (Marikina Leather Trading) get suppliers. The
demo week's deliveries and use are saved through the real service on each past Wednesday and
Friday at 16:30; the Friday sheet corrects the tacks by −1 with a reason. `demo:reset` deletes the
updates and puts Wednesday and Friday back. Bootstrap makes the settings row.

## 6. Tests

Unit: the rules, the update service (one transaction, STALE, field errors), the materials
service, validators, the demo seed. E2E (written, not run): the sheet (refused Used, correction
with reason, history), STALE and `405` through the API, reminder days, Materials and its CSV, a
leather roll's supplier, access. CI's Docker job checks the settings row and the updates.
