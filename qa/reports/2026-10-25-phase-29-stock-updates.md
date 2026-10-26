# QA report: Phase 29 stock updates

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Date      | 2026-10-25 22:09 Asia/Shanghai                     |
| Handoff   | `qa/handoffs/2026-10-25-phase-29-stock-updates.md` |
| Tested by | Codex                                              |
| Verdict   | **FAIL**                                           |

## 1. Summary

S1 and S2 passed. S3 to S5 exposed a supplier validation error on non-leather categories; S6 to S8, S11 and the QA29-B check in S12 were blocked because the required Thread item could not be created. S9, S10, S14 to S17 and A1 to A4 passed; S13 failed because the report showed no per-100-pairs value where the handoff calculation is 0.97.

Scenarios: 8 passed, 4 failed, 5 blocked, 17 total. The build failed type-checking, Prisma reports `20261027090000_stock_updates` pending, and e2e finished with 86 passed, 1 failed, 2 skipped. The final ledger check remained at zero off-ledger items.

## 2. Environment

| Item            | Value                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| OS              | Windows 11, NT 10.0.26200.0                                                                         |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                           |
| Branch / commit | `main` @ `4eb28e5` (dirty before QA with Phase 29 changes)                                          |
| How the app ran | `npm run start` with `PORT=3001`; `next start` warned that it does not support `output: standalone` |
| Base URL        | `http://localhost:3001`; e2e used its configured port 3100                                          |
| Database        | Docker `db`; demo data present. No reset was run. Baseline had 2 stock updates.                     |
| Browser         | Playwright 1.63.0, Chromium 153.0.8010.12, headless                                                 |
| Viewport        | 1440 x 900; responsive checks at 1280 and 1024 px                                                   |

`npx prisma migrate status` failed: `20261027090000_stock_updates` was listed as not yet applied. `npm run build` compiled, then failed TypeScript checking. The full output is in [build.log](artifacts/2026-10-25-phase-29/build.log); migration output is in [migrate-status.log](artifacts/2026-10-25-phase-29/migrate-status.log).

## 3. Scenario results

| ID  | Scenario                                   | Result  | Notes / evidence                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Add today's weekday to reminder days       | PASS    | Saved Sunday with Wednesday and Friday. The toast and reminder-day banner appeared.                                                                                                                                                                                                                                                                    |
| S2  | FM home reminder card and bell             | PASS    | “Stock update today” appeared as the first home card. The bell menu item linked to `/inventory/update`. See [fm-reminder.png](artifacts/2026-10-25-phase-29/fm-reminder.png) and [fm-bell-reminder.png](artifacts/2026-10-25-phase-29/fm-bell-reminder.png).                                                                                           |
| S3  | Create QA29-A as Other and save Used 2     | FAIL    | Category stayed selected as Other, but submit returned “Choose the supplier of this leather roll. Your entries are kept.” QA29-A was not created. Screenshot: [s3-add-item-result.png](artifacts/2026-10-25-phase-29/s3-add-item-result.png).                                                                                                          |
| S4  | Leather supplier validation and Nails form | FAIL    | Empty Leather roll supplier showed the expected field error; choosing Meycauayan Tannery saved the item and its detail showed the supplier. Nails had no Supplier field, but submit returned the same leather-supplier error and did not create the item. Screenshot: [s4-nails-result.png](artifacts/2026-10-25-phase-29/s4-nails-result.png).        |
| S5  | Create QA29-B Thread with opening 5        | FAIL    | Thread was selected and no Supplier field was present, but submit returned “Choose the supplier of this leather roll. Your entries are kept.” QA29-B was not created. Screenshot: [s5-thread-item-result.png](artifacts/2026-10-25-phase-29/s5-thread-item-result.png).                                                                                |
| S6  | Overuse validation on QA29-B               | BLOCKED | QA29-B could not be created in S5; the requested error and focus check could not be run.                                                                                                                                                                                                                                                               |
| S7  | Correction reason validation on QA29-B     | BLOCKED | QA29-B could not be created in S5; the requested error and after-value could not be run.                                                                                                                                                                                                                                                               |
| S8  | Save and inspect QA29-B history            | BLOCKED | QA29-B could not be created in S5.                                                                                                                                                                                                                                                                                                                     |
| S9  | Partial save                               | PASS    | Two created items with `QA29-` codes saved Added 2 and Added 3 in one update; toast was “Stock updated: 2 items.” Blank LR-001 remained 9 rolls with its last update still Fri, 23 Oct.                                                                                                                                                                |
| S10 | Leave with an unsaved sheet entry          | PASS    | The browser showed “Leave without saving the stock update? What you typed will be lost.” Dismissing it kept the sheet and the typed value. The value was cleared without saving.                                                                                                                                                                       |
| S11 | Two-tab stale save on QA29-A               | BLOCKED | QA29-A could not be created in S3.                                                                                                                                                                                                                                                                                                                     |
| S12 | Reports > Materials and QA29-B usage       | BLOCKED | Materials loaded and showed its tables, but QA29-B was absent, so its expected 6 used this week could not be checked. Screenshot: [materials.png](artifacts/2026-10-25-phase-29/materials.png).                                                                                                                                                        |
| S13 | Hand-check LR-001 totals and per 100 pairs | FAIL    | LR-001 history totals 7 Used this week (4 + 3), 0 last week; the report card shows 718 pairs. Expected per 100 pairs is 7 / 718 x 100 = 0.97, but Materials displayed an em dash. Screenshot: [materials.png](artifacts/2026-10-25-phase-29/materials.png); source rows: [s13-ledger-source.txt](artifacts/2026-10-25-phase-29/s13-ledger-source.txt). |
| S14 | Materials CSV                              | PASS    | Filename `cpoint-materials-used-2026-08-31_2026-10-25.csv`; expected header; 48 data rows for 6 items, 8 rows per item. See [CSV](artifacts/2026-10-25-phase-29/cpoint-materials-used-2026-08-31_2026-10-25.csv) and [s14-materials-csv.log](artifacts/2026-10-25-phase-29/s14-materials-csv.log).                                                     |
| S15 | Operations stock CSV header                | PASS    | Header included “Added in period” and not “Received in period”. See [stock CSV](artifacts/2026-10-25-phase-29/cpoint-stock-2026-10-12_2026-10-25.csv).                                                                                                                                                                                                 |
| S16 | Axe WCAG 2.1 A/AA                          | PASS    | No violations on the reminder home, Update stock, Materials, or Add item with Leather roll selected. Detailed results: [axe.log](artifacts/2026-10-25-phase-29/axe.log).                                                                                                                                                                               |
| S17 | 1280 / 1024 px responsive layout           | PASS    | Neither page had horizontal page overflow at either width; wide tables scrolled inside their containers. See [s17.log](artifacts/2026-10-25-phase-29/s17.log).                                                                                                                                                                                         |

### Access checks

| ID | Role | Request | Result | Expected |
| --- | --- | --- | --- |
| A1 | QI and Admin | GET `/inventory/update`; GET `/reports/materials` | PASS; final URL `/forbidden` for each (HTTP 200) | `/forbidden` |
| A2 | QI and Admin | POST `/api/v1/inventory/updates`; PUT `/api/v1/inventory/settings` | PASS; HTTP 403 for all | 403 |
| A3 | FM | POST `/api/v1/inventory/01a17354-c6dc-753b-a915-6d3a6987134f/movements` | PASS; HTTP 405 | 405 |
| A4 | FM | POST `/api/v1/inventory/movements/00000000-0000-0000-0000-000000000000/undo` | PASS; HTTP 404 | 404 |

All request statuses are saved in [access.txt](artifacts/2026-10-25-phase-29/access.txt).

### Existing automated tests

| Command                                                       | Result                                                                                                                |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                               | FAIL; compiled, then TypeScript failed.                                                                               |
| `npm run test:e2e`                                            | 86 passed, 1 failed, 2 skipped (89 total). Full output: [e2e.log](artifacts/2026-10-25-phase-29/e2e.log).             |
| `npx playwright test tests/e2e/inventory.spec.ts --workers=1` | 6 passed, 1 failed; same item-creation failure. Output: [e2e-rerun.log](artifacts/2026-10-25-phase-29/e2e-rerun.log). |

Failing test: **“the Floor Manager adds an item and updates its stock on the sheet (Phase 29, D-102)”**, `tests/e2e/inventory.spec.ts:65`. `getByRole('heading', { name: 'E2E thread TH-E29D989', level: 1 })` did not appear within 10 seconds; the form remained on Add item with the alert “Choose the supplier of this leather roll. Your entries are kept.” The one-worker rerun reproduced it. The two skipped tests were the demo-tools flag-off case and the capture case without model files. The captured Playwright context is [e2e-error-context.md](artifacts/2026-10-25-phase-29/e2e-error-context.md).

## 4. Failures

### F1 - S3: Other category requires a Leather roll supplier

- **Severity:** High
- **Role / page:** FM / `/inventory/new`
- **Steps to reproduce:** Select Other; enter code `QA29-A`, unit `box`, reorder 0 and opening stock 10; submit Add item.
- **Expected:** Item is created without a supplier; it can then be updated on the sheet.
- **Actual:** The selected category remained Other and no Supplier field was present, but the form showed “Choose the supplier of this leather roll. Your entries are kept.” No item was created.
- **App or test:** App/runtime behavior; the browser showed the chosen category and the form returned the contradictory validation error. The build failed and `next start` emitted a standalone-output warning, so a stale server action/build is also possible.
- **Evidence:** [s3-add-item-result.png](artifacts/2026-10-25-phase-29/s3-add-item-result.png), [s3-add-item-result.log](artifacts/2026-10-25-phase-29/s3-add-item-result.log).
- **Suspected location:** Category change/submit in `src/app/(app)/inventory/item-form.tsx:130` and the conditional supplier rule in `src/server/validators/inventory.validator.ts:64-70`. The checked source only requires a supplier for `LEATHER_ROLL`; verify the category value reaching the action and that the running build matches source.

### F2 - S4: Nails item cannot be saved without a hidden Supplier field

- **Severity:** High
- **Role / page:** FM / `/inventory/new`
- **Steps to reproduce:** Select Nails, enter `QA29-NAILS`, name, unit `box` and reorder 0; submit Add item.
- **Expected:** Nails has no Supplier field and saves without a supplier.
- **Actual:** Supplier field count was 0, but the form showed “Choose the supplier of this leather roll. Your entries are kept.” The item was not created. The Leather roll empty-supplier and chosen-supplier checks themselves behaved as expected.
- **App or test:** App/runtime behavior; category was `NAILS` in the form and no Supplier field was rendered.
- **Evidence:** [s4-nails-result.png](artifacts/2026-10-25-phase-29/s4-nails-result.png).
- **Suspected location:** Same category-to-action validation path as F1: `src/app/(app)/inventory/item-form.tsx:130` and `src/server/validators/inventory.validator.ts:64-70`.

### F3 - S5: Thread item cannot be saved

- **Severity:** High
- **Role / page:** FM / `/inventory/new`
- **Steps to reproduce:** Select Thread, enter `QA29-B`, unit `spool`, reorder 0 and opening stock 5; submit Add item.
- **Expected:** Thread item is created without a Supplier field, then appears on Update stock.
- **Actual:** Thread remained selected with no Supplier field, but the form showed “Choose the supplier of this leather roll. Your entries are kept.” QA29-B was not created. The same result reproduced in the e2e test and the one-worker rerun.
- **App or test:** App/runtime behavior; UI state and error context both show Thread selected. The e2e assertion at line 65 is where the missing item heading is detected.
- **Evidence:** [s5-thread-item-result.png](artifacts/2026-10-25-phase-29/s5-thread-item-result.png), [e2e-error-context.md](artifacts/2026-10-25-phase-29/e2e-error-context.md).
- **Suspected location:** Same category-to-action validation path as F1; `src/app/(app)/inventory/item-form.tsx:130`, `src/server/validators/inventory.validator.ts:64-70`, and e2e assertion `tests/e2e/inventory.spec.ts:65`.

### F4 - S13: Per-100-pairs value is missing

- **Severity:** Medium
- **Role / page:** FM / Reports > Materials
- **Steps to reproduce:** Read LR-001 history: Used -4 on Oct 21 and -3 on Oct 23; compare weekly totals and calculate 7 / 718 pairs x 100.
- **Expected:** This week 7 rolls, last week 0, and 0.97 rolls per 100 pairs.
- **Actual:** Weekly totals matched, but the per-100-pairs cell displayed an em dash.
- **App or test:** App output does not match the handoff calculation.
- **Evidence:** [materials.png](artifacts/2026-10-25-phase-29/materials.png), [s13-ledger-source.txt](artifacts/2026-10-25-phase-29/s13-ledger-source.txt).
- **Suspected location:** Per-item denominator selection at `src/server/services/materials.service.ts:81` (`perHundredPairs(pace, pairsSince.get(from) ?? 0)`).

## Needs Dylan

- **S6-S8:** QA29-B could not be created, so insufficient-stock, correction-reason, saved history and recent-update checks remain unrun.
- **S11:** QA29-A could not be created, so the two-tab stale-save check remains unrun.
- **S12:** Materials loaded, but QA29-B was not present to verify its expected 6 used this week.

## 5. Other observations

- The build output also reports a stale `.next/dev/types/validator.ts` reference to the deleted undo route and Prisma client types that lack `stockUpdate`, `inventorySettings` and `supplier`. See [build.log](artifacts/2026-10-25-phase-29/build.log).
- `next start` emitted: `"next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.`
- The initial e2e invocation was interrupted before a summary; the completed full run is the one reported above. An intermediate inventory-only invocation used incorrect npm argument ordering and defaulted to 6 workers; the required corrected one-worker run is `e2e-rerun.log`.
- Reminder days were restored to Wednesday and Friday. After a reload, the Update stock page showed Wednesday and Friday with Sunday unchecked. The final ledger check reports `off_ledger = 0`, reminder days `{3,5}`, and 10 stock updates after e2e. Baseline and final checks: [ledger.txt](artifacts/2026-10-25-phase-29/ledger.txt), [ledger-after.txt](artifacts/2026-10-25-phase-29/ledger-after.txt). Access statuses: [access.txt](artifacts/2026-10-25-phase-29/access.txt).
- Manual stock changes were limited to the two items with `QA29-` codes. The required e2e suite also wrote its own synthetic test data, including stock updates; no reset was run.

## 6. Suggested fixes (priority order)

1. Reconcile the pending migration and regenerate/check the Prisma client, then get a successful build and serve the standalone output correctly.
2. Trace the selected category from the form through the create action; non-leather categories must not trigger the Leather roll supplier error.
3. Align Materials per-100-pairs calculation with the handoff's 28-day usage and pairs denominator, then rerun S13.
4. After the above fixes, rerun the blocked QA29-B and two-tab scenarios, then the Phase 29 browser and e2e handoff.
