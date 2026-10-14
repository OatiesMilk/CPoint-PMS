# QA report: Full-width pages and MR request numbers

| Field     | Value                                           |
| --------- | ----------------------------------------------- |
| Date      | 2026-10-14 15:28 (Asia/Shanghai)                |
| Handoff   | `qa/handoffs/2026-10-14-full-width-mr-codes.md` |
| Tested by | Codex                                           |
| Verdict   | **FAIL**                                        |

## 1. Summary

The database migration preserved all six existing request suffixes, the new request and delivery flows used MR numbers, and the full-width layout behaved across the role routes and tested viewports. Two checks failed: Procurement's Status column is cut off at 1440 px, and an older inventory movement still displays `PR-2026-0001`. The production build succeeded and all 39 listed e2e tests passed.

Scenarios: 10 passed, 2 failed, 0 blocked, 12 total.

## 2. Environment

| Item            | Value                                                                                                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows, local PowerShell environment                                                                                                                                                                                                                                                                       |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                                                                                                                                                                                                                   |
| Branch / commit | `main` @ `e88e7de` (working tree not clean; builder changes present)                                                                                                                                                                                                                                        |
| How the app ran | `npm run db:up` and `npm run db:deploy` succeeded. A CPoint dev server was already running on port 3000; a port 3001 start attempt found the same repo's Next dev lock, so I verified `/api/health` returned 200 and reused `http://localhost:3000`. Stopped the verified dev server after browser testing. |
| Base URL        | `http://localhost:3000`                                                                                                                                                                                                                                                                                     |
| Database        | Docker `cpoint-pms-db-1`, healthy; existing demo data, not reset or reseeded                                                                                                                                                                                                                                |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                                                                                                                                                                                                                 |
| Viewport        | 1440 × 900 default; also 1920 × 1080, 1280 × 800 and 1024 × 768                                                                                                                                                                                                                                             |

The pre-migration code list is in `qa/reports/artifacts/2026-10-14-full-width-mr-codes/codes-before.txt`; the post-migration list is in `codes-after.txt`. Six `PR-2026-NNNN` codes became `MR-2026-NNNN` with the same suffix. The Docker database container was left running.

## 3. Scenario results

| ID  | Scenario                                                            | Result | Notes / evidence                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | FM Procurement All at 1440 × 900                                    | FAIL   | Sidebar-to-title gap was 41 px. The table ended at x=1493 in a 1440 px viewport; the Status header and badges are clipped. `scrollWidth=1440`, `innerWidth=1440`. See `artifacts/2026-10-14-full-width-mr-codes/S1.png`.                                          |
| S2  | FM Procurement All at 1920 × 1080                                   | PASS   | Table right edge x=1879 (41 px from the window edge); description width 731 px; Status column visible; no page overflow. See `S2.png`.                                                                                                                            |
| S3  | Sidebar routes for all roles at 1440 × 900 and 1280 × 800           | PASS   | Visited 60 role-route combinations. No page overflow or sidebar/main overlap. Forms stayed left aligned: batch/item 576 px, Settings 672 px, material request 768 px. See `S3.png`, `S3-1440.png`, `S3-1280.png`; detailed metrics are in `browser-results.json`. |
| S4  | Constructor home request card and numbers                           | PASS   | Card width 1120 px matched the 1120 px content area; visible request numbers used `MR-`. See `S4.png`.                                                                                                                                                            |
| S5  | Existing request code migration                                     | PASS   | All six before/after suffixes matched; no `PR-` request remained in the All list. See `S5.png`, `codes-before.txt`, `codes-after.txt`.                                                                                                                            |
| S6  | Constructor creates a request with the next number                  | PASS   | The next number after existing test data was `MR-2026-0012`; the new detail and toast showed the MR number. See `S6.png`.                                                                                                                                         |
| S7  | FM approves, orders and receives with proof; check Inventory ledger | FAIL   | New deliveries used `Delivery for MR-…`, but the older movement still read `Received for PR-2026-0001`. See `S7-inventory.png` and the S7 entry in `browser-results.json`.                                                                                        |
| S8  | Copy a rejected request                                             | PASS   | Form and timeline said `Copied from MR-2026-0002`; new request was `MR-2026-0013`. The blank starter line had to be removed after reselecting the rejected item. See `S8.png`.                                                                                    |
| S9  | Duplicate open-item note and submit                                 | PASS   | Note read `MR-2026-0013 already asks for this`; submission succeeded as `MR-2026-0014`. See `S9.png`.                                                                                                                                                             |
| S10 | Admin audit keeps historical PR numbers                             | PASS   | Filtered to PurchaseRequest and paged to page 2; older entries retained `PR-2026-0006` through `PR-2026-0003`. See `S10.png` and `s10-retest.json`.                                                                                                               |
| S11 | FM Procurement and Reports at 1024 × 768                            | PASS   | Both pages kept `scrollWidth=1024`. Procurement table used an internal horizontal scroller (client width 702 px, table width 1212 px). See `S11.png`, `S11-procurement.png`, `S11-reports.png`.                                                                   |
| A1  | QI cannot access Procurement                                        | PASS   | Procurement was absent from the sidebar; direct access redirected to `/forbidden` with Error 403. See `A1.png`.                                                                                                                                                   |

Existing automated tests run:

| Command                                                                                                                                                                                                                                   | Result                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                                                                                                                                                                                           | Passed; optimized production build completed. Log: `artifacts/2026-10-14-full-width-mr-codes/build.log`.                                           |
| `npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts tests/e2e/reports.spec.ts tests/e2e/admin.spec.ts --output qa/reports/artifacts/2026-10-14-full-width-mr-codes/playwright-results` | 39 passed, 0 failed. Per spec: procurement 15, inventory 5, smoke 10, reports 3, admin 6. Log: `artifacts/2026-10-14-full-width-mr-codes/e2e.log`. |

## 4. Failures

### F1 — S1: Procurement Status column is clipped at 1440 px

- **Severity:** Medium
- **Role / page:** Floor Manager, `/procurement?status=all`, 1440 × 900
- **Steps to reproduce:** 1. Sign in as `manager@cpoint.local`. 2. Open Procurement and select All at 1440 × 900.
- **Expected:** The table fits beside the sidebar with page padding at its right edge, and the Status header and badges are fully visible without page-side scrolling.
- **Actual:** The title starts 41 px after the sidebar, as expected, but the table extends 53 px past the viewport. Its bounds were x=281 to x=1493 and the Status header ended at x=1493. The document itself did not scroll (`scrollWidth=1440`), so the right side of the table is clipped inside the viewport.
- **Evidence:** `qa/reports/artifacts/2026-10-14-full-width-mr-codes/S1.png`, `browser-results.json`, `server.log`.

  ```text
  viewport: 1440 × 900
  document scrollWidth / innerWidth: 1440 / 1440
  main: x=240, width=1200
  table: x=281, width=1212, right=1493
  Status header: x=1341, width=153, right=1493
  ```

- **Suggested fix:** Adjust the Procurement table columns or wrapping in `src/app/(app)/procurement/page.tsx` so the status column fits the available content width at 1440 px. Review the shared table overflow behavior if the page-level column changes are insufficient.

### F2 — S7: Legacy inventory movement still shows a PR number

- **Severity:** Medium
- **Role / page:** Floor Manager, Shoe tacks Inventory detail
- **Steps to reproduce:** 1. As a Constructor, send a Shoe tacks request. 2. As a Floor Manager, approve it, mark it ordered, record a delivery with a proof image, then open the Shoe tacks item in Inventory.
- **Expected:** The new and older delivery ledger rows use `Delivery for MR-…`.
- **Actual:** The new delivery row was correct (`Delivery for MR-2026-0012`), but the older row remained `Received for PR-2026-0001`.
- **Evidence:** `qa/reports/artifacts/2026-10-14-full-width-mr-codes/S7-inventory.png`, `browser-results.json`, `server.log`.

  ```text
  Oct 14, 2026  Received  +2  Delivery for MR-2026-0012
  Oct 9, 2026   Received  +5  Received for PR-2026-0001
  ```

- **Suggested fix:** Extend `prisma/migrations/20261014090000_material_request_codes/migration.sql` to handle the legacy `Received for PR-…` reason as well as `Delivery for PR-…`, and write the expected `Delivery for MR-…` value.

## 5. Other observations

- When copying rejected request MR-2026-0002, checking Brown suede adds that item but leaves the empty starter row in place. Sending then shows required-field errors until the empty row is removed. After removing it, the copy and timeline worked as expected.
- Manual scenario runs recorded no browser console or page errors. The saved dev log includes older entries from before this QA run: a hydration mismatch and repeated unresolved `@/lib/pagination` compile errors. There were no new manual-run browser errors, and `npm run build` succeeded. During e2e, Next's WebServer output repeated `The destination stream closed early`; all 39 tests still passed.
- The manual flow created test requests MR-2026-0007 through MR-2026-0014 and recorded test deliveries. E2e specs also ran against the existing dev database; no reset or reseed was performed.

## 6. Suggested fixes (priority order)

1. Make Procurement's Status column and badges visible at 1440 px without horizontal table scrolling.
2. Update the migration for the legacy `Received for PR-…` inventory movement reason.
3. When a rejected item is reselected in a copied request, reuse or remove the empty starter row so it does not block submission.
