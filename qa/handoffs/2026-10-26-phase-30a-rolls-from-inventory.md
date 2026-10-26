# QA handoff: Phase 30A, leather rolls come from Inventory

| Field           | Value                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Date            | 2026-10-26                                                                                                              |
| Feature         | phase-30a-rolls-from-inventory                                                                                          |
| Branch          | `main` (`c827311`, Phase 29 merged) + uncommitted Phase 30A in `C:\dev\CPoint-PMS`                                      |
| Spec / prompt   | `docs/prompts/factory-visit-changes.md` Phase 30 (reordered); plan `docs/prompts/plans/phase-30a-plan.md`; D-103, D-104 |
| Written by      | Claude                                                                                                                  |
| Previous report | `qa/reports/2026-10-25-phase-29-run2.md`                                                                                |

## 1. What changed

- **Floor Manager, Inventory:** a leather roll item (category Leather roll) has a **Rolls** card.
  **Add rolls** asks the day they arrived, then one row per roll with its **Area** (sq ft) and the
  **Supplier's tag** (optional); **Add another roll**; **Save N rolls**. Each roll gets a code like
  `LR-MLT-001` (the supplier's short code) and adds 1 to the item. The table lists Roll, Area,
  Arrived, Status, Shots, Rejected, Defects found, **Defect %** ("To be implemented") and
  **Remove**, with status chips (All, Not scanned, Being scanned, Scanned, Fully used, Removed).
- A leather item starts at 0 (no opening stock) and its row on **Update stock** is read-only:
  "Counted from its rolls. Add or remove rolls on the item". Other materials are unchanged.
- **Shoe Constructor, Capture:** no more Start roll with a supplier. **Scan a roll** lists the rolls
  not scanned yet ("LR-MLT-001 · Black cowhide (school shoes) · Meycauayan Tannery · 24.5 sq ft")
  with **Scan this roll** and a **Find a roll** box when there are more than five. The roll line
  reads "Roll LR-MT-004 · item · 24.5 sq ft · N shots". **Put roll back** (no shots) returns it to
  the list. **Scan another roll** picks the next.
- **Quality Inspector, Batches → Finish batch:** a new optional part, **Rolls fully used**: check
  boxes for scanned rolls not yet used. Ticked rolls leave stock (−1). The finished batch row reads
  "Fully used: LR-…". A same-day **Correct** shows the batch's ticks checked and can untick them
  (back into stock) or tick more.
- **Floor Manager, Reports → Rolls:** an Area column; statuses read Not scanned, Being scanned,
  Scanned, Fully used, Removed. A roll's page shows its leather item, area, received, scanned and
  fully used; **Remove roll…** with a reason on any roll not fully used. The claim sheet shows the
  area.
- **System Admin, Settings → Suppliers:** a **Code** column and field (2 to 6 capital letters or
  digits, unique). Left blank, a new supplier gets its initials (Marikina Leather Trading → MLT).
- Old rolls (`R-…`, `B-…`) stay in the reports with no item or area; they can't be ticked.

## 2. Files touched

| File                                                                                                | Change                                                        |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `prisma/migrations/20261028090000_rolls_from_inventory`                                             | New statuses, the roll's item, area and users, supplier codes |
| `src/lib/roll-rules.ts`, `src/lib/domain.ts`                                                        | Codes, area rules, the roll's moves and ticks, status labels  |
| `src/server/{models/roll.model,services/roll.service}.ts`                                           | Add, pick, finish, put back, remove, tick and untick          |
| `src/server/services/supplier-code.service.ts`                                                      | Supplier codes from initials                                  |
| `src/server/services/{production,inventory,stock-update,settings}.service.ts`                       | Ticks at Finish batch; leather rules; supplier code           |
| `src/app/api/v1/{inventory/[id]/rolls,rolls/ready,rolls/[id]/start,rolls/[id]/remove}`              | New routes; `POST /api/v1/rolls` is 405                       |
| `src/app/(app)/inventory/[id]/**`, `inventory/item-form.tsx`, `inventory/update/update-sheet.tsx`   | Rolls card, Add rolls, leather read-only                      |
| `src/app/(app)/camera/capture/**`                                                                   | Scan a roll, Put roll back                                    |
| `src/app/(app)/batches/**`                                                                          | Rolls fully used                                              |
| `src/app/(app)/reports/rolls/**`, `reports/claims/[rollId]`                                         | Area, statuses, Remove                                        |
| `src/app/(app)/admin/settings/page.tsx`                                                             | Supplier Code                                                 |
| `src/server/services/demo-seed.service.ts`, `models/demo-reset.model.ts`                            | Demo rolls with areas, ticks                                  |
| `tests/e2e/{capture,rolls,batches,inventory,admin,smoke,supplier-quality}.spec.ts`, `cv-helpers.ts` | Updated for 30A                                               |

Database migration in this change: **yes** (name: `20261028090000_rolls_from_inventory`)

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up
npm run db:deploy      # applies 20261028090000_rolls_from_inventory
npm run build
npm run start          # PORT=3001 if 3000 is taken
```

Dylan runs `npm run demo:reset -- --yes` before the run, so the demo week has rolls in Inventory.

Shots: the Capture page needs a camera. Use headless Chromium with
`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`. The fake camera gives Pass
only, which is enough here. If the model files are missing from `cv/models/` (the page says "The
camera model isn't installed on the server"), mark the shot steps BLOCKED and use the e2e suite's
coverage instead.

Existing automated tests that cover this area:

```bash
npx playwright test tests/e2e/capture.spec.ts tests/e2e/rolls.spec.ts tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page         |
| ----------------- | -------------------------- | ----------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`  |
| Quality Inspector | `inspector@cpoint.local`   | `/batches`        |
| System Admin      | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture` |

Data: after `demo:reset`, three leather items, **Black cowhide (school shoes)** (LR-001,
Meycauayan Tannery, codes `LR-MT-…`), **Brown suede (topsiders)** (LR-002, Marikina Leather
Trading, `LR-MLT-…`) and **Black cowhide (store)** (LR-003, JM Leather Supply, `LR-JLS-…`). Some
rolls are Not scanned, one is Being scanned, some Scanned, most Fully used, one Removed ("Water
damage in storage; the supplier was told."). Create your own leather item for S2 to S6 (code
starting `QA30-`), with the supplier **Meycauayan Tannery**.

S10 to S12 need a batch that can be finished today: Finish batch opens 10 minutes before a
batch's end and stays open until midnight. With the default schedule, Batch 1 (08:00–13:00) can
be finished from 12:50. If the QI has finished every batch due today, S10 and S11 are BLOCKED;
write which batches you saw.

## 5. Test scenarios

| ID  | Role                    | Steps                                                                                                                                                                                                  | Expected result                                                                                                                                                                                                                                                                 | Priority |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Admin                   | Settings → Suppliers.                                                                                                                                                                                  | A **Code** column: Meycauayan Tannery MT, Marikina Leather Trading MLT, JM Leather Supply (Divisoria) JLS.                                                                                                                                                                      | High     |
| S2  | FM                      | Inventory → Add item: category Leather roll, supplier Meycauayan Tannery, code `QA30-1`, name `QA30 hide`, reorder 0. Look for Opening stock. Save.                                                    | No opening stock field for leather (a hint instead). The item is saved with **0 rolls**; the page has a **Rolls** card with **Add rolls**; no **Update stock** button ("Counted from its rolls").                                                                               | High     |
| S3  | FM                      | On `QA30 hide`: **Add rolls**. Leave Area blank; **Save 1 roll**. Then type `0`, then `24.125`, then `abc`.                                                                                            | Each time a message under the field naming Roll 1 and the fix, e.g. "Roll 1: enter its area in square feet, like 24.5." and "Roll 1: use at most two decimals, like 24.75."; nothing saved.                                                                                     | High     |
| S4  | FM                      | Add rolls: **Add another roll** twice; areas `24.5`, `31.75`, `18`; tag `T-1` on the second; **Save 3 rolls**.                                                                                         | Toast "3 rolls added to QA30 hide: LR-MT-… to LR-MT-…". On hand **3 rolls**. The table lists 3 rows, Not scanned, with their areas; Defect % reads "To be implemented"; Stock history shows three Added rows "Roll LR-MT-… added".                                              | High     |
| S5  | FM                      | Inventory → **Update stock**; find `QA30 hide`.                                                                                                                                                        | Its row is read-only: "Counted from its rolls. Add or remove rolls on the item" with a link; no boxes.                                                                                                                                                                          | High     |
| S6  | FM                      | On `QA30 hide`, the third roll (18 sq ft): **Remove**, empty reason, then reason `Wrong colour`.                                                                                                       | Empty: "Write why this roll is removed."; then the roll reads **Removed**, on hand **2 rolls**, history has a Used row for it.                                                                                                                                                  | High     |
| S7  | Constructor (390 × 844) | Capture: **Scan another roll** (or the list on a fresh page).                                                                                                                                          | The list shows the rolls Not scanned with item, supplier and area, including your two QA30 rolls, not the removed one. More than five: a **Find a roll** box; typing `QA30` leaves only your QA30 rolls.                                                                        | High     |
| S8  | Constructor (390 × 844) | **Scan this roll** on your 24.5 sq ft roll; then **Put roll back**; then pick it again; take 2 shots; **Finish roll**.                                                                                 | Line "Roll LR-MT-… · QA30 hide · 24.5 sq ft · 0 shots". **Put roll back** asks "Put LR-MT-… back?"; then the toast "LR-MT-… is back with the rolls waiting to be scanned." After 2 shots and Finish, the roll is gone from the Roll dropdown. Screenshot at 390 px.             | High     |
| S9  | FM                      | `QA30 hide`'s page and Reports → Rolls (find the code).                                                                                                                                                | The roll reads **Scanned**, Shots 2, area 24.5 sq ft; on Reports its page shows the item link, Area, and **Remove roll…**.                                                                                                                                                      | High     |
| S10 | QI (390 × 844)          | Batches → **Finish batch N** (the one that's due). Look at **Rolls fully used**. Tick your scanned QA30 roll; pairs 10, failed 0; finish.                                                              | The list shows only **Scanned** rolls (not your Not scanned one, not Being scanned ones). Toast "Batch N finished. 1 roll marked fully used." The row reads "Fully used: LR-MT-…". `QA30 hide` on hand drops to **1 roll**; its row reads **Fully used**. Screenshot at 390 px. | High     |
| S11 | QI                      | On that batch: **Correct**, reason `Roll not finished`, untick the roll, save.                                                                                                                         | The checkbox started ticked. After saving, "Fully used" is gone from the row; `QA30 hide` is back to **2 rolls** and the roll reads **Scanned**.                                                                                                                                | High     |
| S12 | FM                      | On the Scanned QA30 roll's page in Reports → Rolls, **Remove roll…** with a reason. On a demo **Fully used** roll's page, look for Remove.                                                             | The scanned roll is removed (−1). A Fully used roll has no Remove button.                                                                                                                                                                                                       | Medium   |
| S13 | Admin                   | Settings → Suppliers → Add: name `QA30 Leather Works`, no code; save. Then edit it with code `MT`; then `2AB`.                                                                                         | Saved with code `QLW`. `MT` is refused: "MT is already another supplier's code. Choose another, like MT2."; `2AB` gets "Enter a short code of 2 to 6 capital letters or digits, starting with a letter, like MLT."                                                              | Medium   |
| S14 | FM                      | Inventory → `Black cowhide (school shoes)`: status chips Not scanned, Fully used, Removed; page through.                                                                                               | Each chip filters the table; the pager reads "Roll pages"; no person's name anywhere in the table (D-008).                                                                                                                                                                      | Medium   |
| S15 | FM                      | Open any **old** `R-…` roll in Reports → Rolls (if the database has one).                                                                                                                              | Shows "Before rolls came from Inventory": no item, area "—". Not in the QI's tick list.                                                                                                                                                                                         | Low      |
| S16 | all                     | axe (WCAG 2.1 A/AA) on: the leather item page with the Add rolls dialog open, Capture's Scan a roll list (390 px), Finish batch with Rolls fully used (390 px), Reports → Rolls, Settings → Suppliers. | No serious or critical violation.                                                                                                                                                                                                                                               | High     |
| S17 | —                       | After S4, S6, S10, S11 and S12, the ledger query in the prompt.                                                                                                                                        | `off_ledger` stays 0 throughout.                                                                                                                                                                                                                                                | High     |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                                          | Expected                            |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| A1  | QI, Admin, Constructor         | `POST /api/v1/inventory/{a leather item id}/rolls` with one roll                                       | 403                                 |
| A2  | FM, QI, Admin                  | `GET /api/v1/rolls/ready`, `POST /api/v1/rolls/{id}/start`                                             | 403                                 |
| A3  | QI, Admin, Constructor         | `POST /api/v1/rolls/{id}/remove` with a reason                                                         | 403                                 |
| A4  | anyone signed in               | `POST /api/v1/rolls` with `{}`                                                                         | 405                                 |
| A5  | FM                             | `POST /api/v1/inventory/updates` with a line for a leather item (`seenQuantity` its count, `added: 1`) | 422, "… is counted from its rolls." |

## 6. Out of scope / known issues

- Defect % is "To be implemented" on purpose (Phase 30C).
- The fake camera gives Pass only; Reject needs real leather (as before).
- How much of a roll a batch used isn't tracked; someone tells the QI (D-104).
- A leather count from before 30A has no roll records until the FM adds rolls; `demo:reset` makes
  the demo items match.
- The e2e suite adds `LR-E2E-…` leather items and rolls to the dev database (as other specs add
  items).
