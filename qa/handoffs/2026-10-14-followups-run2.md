# QA handoff: Full-width/MR and pagination fixes, run 2

| Field           | Value                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| Date            | 2026-10-14                                                                               |
| Feature         | followups-run2                                                                           |
| Branch          | `main` (base commit `e88e7de`, change uncommitted)                                       |
| Spec / prompt   | D-046, D-047; fixes for the two reports below                                            |
| Written by      | Claude                                                                                   |
| Previous report | `qa/reports/2026-10-14-full-width-mr-codes.md` and `qa/reports/2026-10-14-pagination.md` |

## 1. What changed

- **Procurement list fits at 1440 px** (full-width F1, pagination observation 1). The Items,
  Requested by, Sent, Expected and Status cells may now wrap (Items to at most two lines, full
  text on hover), and "1 of 2 items approved" sits on its own line under the status badge.
- **Old ledger rows read MR-** (full-width F2, pagination observation 2). A second data migration,
  `20261014120000_material_request_codes_legacy`, renames "Received for PR-2026-0001" (the wording
  before Phase 13) to "Delivery for MR-2026-0001", and any other PR- number left in ledger reasons
  or request timeline notes. `npm run db:deploy` applies it.
- **Pager grammar** (pagination observation 3): "1 supplier that matches", "3 suppliers that
  match"; same on Users and the leather-roll requesters.
- **Copy to a new request** (full-width observation 1): ticking a rejected item now fills the empty
  starter row instead of adding a second row under it, so the form sends without removing a row.
- **E2E assertions wait 10 s instead of 5 s** (pagination F1). In the last run 16 tests in the first
  wave failed at the post-sign-in URL check while the page was still on `/login` and then `/`; the
  later tests all passed. A cold server signing six workers in at once is the likely cause; this
  run confirms or rules it out.

## 2. Files touched

| File                                                                                                                                         | Change                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `src/app/(app)/procurement/page.tsx`                                                                                                         | Cells may wrap; partly-approved line on its own row      |
| `prisma/migrations/20261014120000_material_request_codes_legacy/migration.sql` (new)                                                         | Legacy PR- text                                          |
| `src/components/features/table-pager.tsx`                                                                                                    | Singular/plural suffix (`MATCHING`)                      |
| `src/app/(app)/admin/users/page.tsx`, `src/app/(app)/admin/settings/reference-manager.tsx`, `src/app/(app)/procurement/requesters-panel.tsx` | Use `MATCHING`                                           |
| `src/app/(app)/procurement/request-form.tsx`                                                                                                 | Reuse the blank starter row when ticking a rejected item |
| `playwright.config.ts`                                                                                                                       | `expect: { timeout: 10_000 }`                            |
| `docs/*`                                                                                                                                     | D-046 note, STATUS, SESSION_LOG                          |

Database migration in this change: **yes** (`20261014120000_material_request_codes_legacy`, data
only).

## 3. How to run the app locally

```bash
npm run db:up
npm run db:deploy      # applies material_request_codes_legacy
npm run dev            # http://localhost:3000 (PORT=3001 if 3000 is taken)
```

Before `db:deploy`, save `SELECT reason FROM inventory_movements WHERE reason LIKE '%PR-%';` to
`codes-before.txt`; after it, the same query should return no rows (save as `codes-after.txt`).

**Test data you may create** (Dylan allows it for this run; the database is a dev database): to
reach page 2 of the Review queue's "Needs a decision" (S7, S8), post at least 10 more scans with
an unknown class key to a batch at Preparation. A throwaway script under
`qa/reports/artifacts/2026-10-14-followups-run2/scripts/` can import `createBatch`,
`createDeviceToken` and `postScan` from `tests/e2e/cv-helpers.ts` (see how `tests/e2e/cv.spec.ts`
uses them, class key e.g. `qa-unknown`). Do not change app code or tests.

Existing automated tests that cover this area (run all of them, twice, and record both runs):

```bash
npm run build && npx playwright test tests/e2e/admin.spec.ts tests/e2e/procurement.spec.ts tests/e2e/outcomes.spec.ts tests/e2e/cv.spec.ts tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts
```

Make sure no other server is listening on port 3100 before each run.

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD` from `.env`: `manager@cpoint.local`,
`inspector@cpoint.local`, `admin@cpoint.local`, `constructor@cpoint.local`.

## 5. Test scenarios

| ID  | Role              | Steps                                                                                                                                                             | Expected result                                                                                                                                                                                                                                                                        | Priority |
| --- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | Floor Manager     | `/procurement?status=all` at 1440 × 900, then 1280 × 800, then 1920 × 1080. Record the table's bounding box and the Status header's right edge.                   | The table's right edge is within the main area (no part cut off, no scroll inside the table card at 1440 and 1920). Status badges fully visible. At 1280 a scroll inside the card is acceptable only if the page itself doesn't scroll sideways; report the overflow in px either way. | High     |
| R2  | Floor Manager     | Same page: a request with several items, and one partly approved.                                                                                                 | Items wrap to at most two lines (hover shows the full list); "1 of 2 items approved" sits under its badge. Rows stay readable.                                                                                                                                                         | Medium   |
| R3  | Floor Manager     | After `db:deploy`, open Inventory → Shoe tacks (the item from the last run).                                                                                      | The older row reads "Delivery for MR-2026-0001". `codes-after.txt` is empty.                                                                                                                                                                                                           | High     |
| R4  | System Admin      | Settings → Suppliers, find a name that matches exactly one supplier; then a word that matches several. Users: search one email. FM: requesters, search one email. | "1 supplier that matches"; "N suppliers that match"; "1 account that matches"; "1 Shoe Constructor that matches".                                                                                                                                                                      | Medium   |
| R5  | Shoe Constructor  | Copy a request where **every** item was rejected; tick one rejected item; set Needed by; send.                                                                    | Only one item row exists after ticking (no empty row above it); the request sends without errors.                                                                                                                                                                                      | High     |
| R6  | Shoe Constructor  | Copy a request with one approved and one rejected item; tick the rejected one.                                                                                    | Two rows (the carried item and the ticked one), no blank row.                                                                                                                                                                                                                          | Medium   |
| R7  | Quality Inspector | With at least 16 pending scans, re-run S7 from `qa/handoffs/2026-10-14-pagination.md`.                                                                            | Each list pages on its own; `page=2&autoPage=2` both kept.                                                                                                                                                                                                                             | High     |
| R8  | Quality Inspector | Re-run S8: decide a scan on pending page 2.                                                                                                                       | Saves; the list refreshes without an error.                                                                                                                                                                                                                                            | Medium   |
| R9  | —                 | Run the e2e command in section 3 twice.                                                                                                                           | Both runs green. If any test fails, give its error and whether it was in the first wave of tests.                                                                                                                                                                                      | High     |

## 6. Out of scope / known issues

- Settings → Components has no Find box while the list is empty, on purpose (nothing to find). Its
  search works like the other three lists once a component exists; no need to add one.
- The audit log keeps PR- numbers on purpose (history).
- A hydration warning about `caret-color: transparent` on an input comes from the headless browser's
  injected style, not from the app.
- `The destination stream closed early` in the e2e server log is known and harmless.
