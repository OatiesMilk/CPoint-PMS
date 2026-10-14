# QA report: Pagination on every list

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Date      | 2026-10-14 16:28 (Asia/Shanghai)       |
| Handoff   | `qa/handoffs/2026-10-14-pagination.md` |
| Tested by | Codex                                  |
| Verdict   | **FAIL**                               |

## 1. Summary

Manual browser checks passed for 13 scenarios; S7 and S8 were blocked because the existing review queue has only six pending scans, and S10's Components search could not be checked because the list is empty and has no Find field. The build succeeded, but the required e2e run had 16 failures at role sign-in assertions and one test did not run, so the overall verdict is FAIL.

Scenarios: 13 passed, 0 failed, 3 blocked, 16 total.

## 2. Environment

| Item            | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| OS              | Windows, local PowerShell environment                                                                |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                            |
| Branch / commit | `main` @ `e88e7de` (working tree not clean; project changes were present before/during QA)           |
| How the app ran | `npm run db:up`, `npm run db:deploy`, then `npm run dev` on port 3000; e2e web server used port 3100 |
| Base URL        | `http://localhost:3000`                                                                              |
| Database        | Docker `cpoint-pms-db-1`, healthy; existing demo/e2e data, not reset or reseeded                     |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                          |
| Viewport        | 1440 x 900; S13 also checked at 1280 x 800                                                           |

The app health endpoint returned 200. `db:up` and `db:deploy` completed; there were no pending migrations. After testing, ports 3000 and 3100 had no listener, and the database container remained healthy and running. The manual browser sweep recorded zero console/page errors in `console-errors.json`.

## 3. Scenario results

| ID  | Scenario                                        | Result  | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ----------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Floor Manager batches pagination and search     | PASS    | Page 1: 15 rows; pager `Showing 1–15 of 21 batches · page 1 of 2`. With search `B-2026`, Next kept the filter at `/batches?q=B-2026&page=2`; page 2 differed, Previous returned to page 1, and the last page had no Next. `artifacts/2026-10-14-pagination/S1.png`                                                                                                                                                           |
| S2  | Floor Manager scans pagination and batch filter | PASS    | Page 1: 15 rows; pager `Showing 1–15 of 304 scans · page 1 of 21`. Next opened `/scans?page=2`; page 2 differed and Previous/last-page controls worked. Batch `B-2026-0012` filtered to 29 scans; pager `Showing 1–15 of 29 scans · page 1 of 2`; Next href was `/scans?batch=B-2026-0012&page=2`. `S2.png`                                                                                                                  |
| S3  | Floor Manager inventory and stock ledger        | PASS    | Inventory page 1: 15 rows; pager `Showing 1–15 of 26 items · page 1 of 2`; Next opened `/inventory?page=2`. Shoe tacks ledger page 1: 15 rows; pager `Showing 1–15 of 18 movements · page 1 of 2`; Older opened `/inventory/01a138fa-f252-7470-ab3a-dde7e91e4590?page=2` with 3 rows and Newer returned to page 1. The previously reported `Received for PR-2026-0001` description remains; see Other observations. `S3.png` |
| S4  | Floor Manager Procurement All and tab reset     | PASS    | All page 1: 15 rows; pager `Showing 1–15 of 33 requests · page 1 of 3`; Next opened `/procurement?status=all&page=2`, and the last page had no Next. MR numbers were present. Switching to Pending reset to page 1 (13 rows, pager `13 requests`, no `page=` query). The previously reported Status-column clipping at 1440 px remains; see Other observations. `S4.png`                                                     |
| S5  | Admin users search and audit pagination         | PASS    | Users page 1: 15 rows; pager `Showing 1–15 of 21 accounts · page 1 of 2`; Next opened `/admin/users?page=2`. `e2e.local` search showed 15 rows and pager `Showing 1–15 of 16 accounts that match`. Audit page 1: 15 rows; pager `Showing 1–15 of 1040 entries · page 1 of 70`; Older opened `/admin/audit?page=2`. Page 2 differed; page 70 had 5 rows and no Older. `S5.png`                                                |
| S6  | Floor Manager Salvage tabs and batch filter     | PASS    | Available, Reused, Discarded page 1 counts/pager text were `14 sections`, `8 sections`, and `15 sections`; all were within 15 rows and had no pager buttons, so Next URL was not applicable. Batch filtering by `B-2026-0012` worked; no tab had enough rows for page 2. `S6.png`                                                                                                                                            |
| S7  | Inspector Review independent pagination         | BLOCKED | Needs a decision showed `6 scans waiting, oldest first`, so there was no page 2 and combined `page=2&autoPage=2` could not be checked. The automatic list showed `Showing 1–15 of 22 calls today · page 1 of 2`; Next opened `/review?autoPage=2`, where 7 calls remained. `S7.png`                                                                                                                                          |
| S8  | Inspector makes a decision from pending page 2  | BLOCKED | Could not reach pending page 2 because only 6 scans were waiting. No decision was made or existing review data changed to force pagination. `S8.png`                                                                                                                                                                                                                                                                         |
| S9  | Admin API token list and creation               | PASS    | List had 5 tokens before the check. A newly created token appeared first and raised the total to 6; the secret was not recorded. The test token was revoked after capture. `S9.png`                                                                                                                                                                                                                                          |
| S10 | Admin Settings list searches                    | BLOCKED | Shoes, suppliers, and defects narrowed to one row each; labels read `1 shoe type that match`, `1 supplier that match`, and `1 defect type that match`. The no-hit search showed the expected empty state and client-side paging kept the URL unchanged. Components had zero rows and no Find field, so its search behavior could not be checked. `S10.png`                                                                   |
| S11 | Floor Manager requester search and toggle       | PASS    | Page 1: 15 of 17 Shoe Constructors; pager `Showing 1–15 of 17 Shoe Constructors · page 1 of 2`; Next showed 2 rows and left the URL unchanged. Email search returned one matching constructor, the Allow leather rolls toggle worked, and the row stayed visible. The toggle was restored. The singular pager reads `1 Shoe Constructor that match.` `S11.png`                                                               |
| S12 | Short list has no pager buttons                 | PASS    | Settings suppliers had 2 rows; pager text was `2 suppliers` with no Previous/Next. No Next URL was applicable. `S12.png`                                                                                                                                                                                                                                                                                                     |
| S13 | Changed pages at 1280 x 800                     | PASS    | Checked batches, scans, inventory/detail, Procurement All/requesters, all Salvage tabs, admin users/audit/tokens, all four Settings lists, and Review. Document width stayed at 1280; pagers remained below their tables and inside the main area. `S13.png`                                                                                                                                                                 |
| S14 | Axe WCAG 2.1 A/AA checks                        | PASS    | Zero violations on `/salvage`, `/review`, `/admin/settings?tab=suppliers`, `/procurement?tab=requesters`, and `/admin/tokens`. `S14.png`                                                                                                                                                                                                                                                                                     |
| A1  | Constructor denied Salvage and Review access    | PASS    | Direct `/salvage?page=2` and `/review?page=2` redirected to `/forbidden` (403). `A1.png`, `A1-salvage.png`                                                                                                                                                                                                                                                                                                                   |
| A2  | Inspector Salvage view and actions              | PASS    | Inspector could view Salvage and page 2; no Reuse, Discard, or Unassign actions were available. `A2.png`                                                                                                                                                                                                                                                                                                                     |

Existing automated tests run:

| Command / spec                                                                                                                                                                                            | Result                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                                                                                                                                                           | Passed; optimized Next.js 16.3.8 build and TypeScript checks completed. Log: `artifacts/2026-10-14-pagination/build.log`.                                                 |
| `npx playwright test tests/e2e/admin.spec.ts tests/e2e/procurement.spec.ts tests/e2e/outcomes.spec.ts tests/e2e/cv.spec.ts tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts` | 40 passed, 16 failed, 1 did not run. Full log and per-test contexts: `artifacts/2026-10-14-pagination/e2e.log` and `artifacts/2026-10-14-pagination/playwright-results/`. |
| `admin.spec.ts`                                                                                                                                                                                           | 0 passed, 5 failed, 1 did not run                                                                                                                                         |
| `procurement.spec.ts`                                                                                                                                                                                     | 15 passed, 0 failed                                                                                                                                                       |
| `outcomes.spec.ts`                                                                                                                                                                                        | 5 passed, 0 failed                                                                                                                                                        |
| `cv.spec.ts`                                                                                                                                                                                              | 4 passed, 4 failed                                                                                                                                                        |
| `batches.spec.ts`                                                                                                                                                                                         | 1 passed, 7 failed                                                                                                                                                        |
| `inventory.spec.ts`                                                                                                                                                                                       | 5 passed, 0 failed                                                                                                                                                        |
| `smoke.spec.ts`                                                                                                                                                                                           | 10 passed, 0 failed                                                                                                                                                       |

The one test that did not run was `admin.spec.ts:158`, “an unknown class can be added as a defect type, and later scans are decided automatically.”

## 4. Failures

### F1 - E2E suite: 16 tests fail at sign-in/home-page assertions

- **Severity:** High
- **Role / page:** System Admin, Floor Manager, and Quality Inspector login preconditions in `admin.spec.ts`, `batches.spec.ts`, and `cv.spec.ts`
- **Steps to reproduce:** 1. Run `npm run build`. 2. Run the e2e command listed above against the existing local database.
- **Expected:** Each test signs in as its named demo account and reaches that role's expected home page before exercising the test.
- **Actual:** Sixteen tests failed while checking the post-login URL. The expected role home was `/admin`, `/floor-manager`, or `/quality-inspector`; the observed URL was `/login` or `/`. Counts: admin 5, batches 7, cv 4. Procurement, outcomes, inventory, and smoke passed. The shared failure cause was not isolated.
- **Evidence:** `qa/reports/artifacts/2026-10-14-pagination/e2e.log`, `qa/reports/artifacts/2026-10-14-pagination/playwright-results/`. The CV helper's assertion is at `tests/e2e/cv-helpers.ts:55`.

  ```text
  16 failed
  1 did not run
  40 passed (2.5m)
  Expected role home URL; observed /login or /
  ```

- **Suggested fix:** Investigate the e2e sign-in/session setup in `tests/e2e/helpers.ts`, the CV setup in `tests/e2e/cv-helpers.ts`, and shared demo-account state used by the admin and batch specs. The failures may be related to concurrent tests or account state, but this run did not establish the cause.

### F2 - S7: Review queue page 2 could not be reached for pending scans

- **Severity:** Medium
- **Role / page:** Quality Inspector, `/review`
- **Steps to reproduce:** 1. Sign in as the Inspector. 2. Open Review and inspect “Needs a decision.” 3. Try to page that list while paging the automatic calls list.
- **Expected:** Pending scans can be moved to page 2, then the automatic list can also move to page 2 while preserving both query parameters.
- **Actual:** Only 6 scans were waiting, so there was no pending page 2. The automatic list itself had 22 calls and paged to 7 rows on page 2, but the combined `page=2&autoPage=2` state could not be tested.
- **Evidence:** `qa/reports/artifacts/2026-10-14-pagination/S7.png`, `server.log`.
- **Suggested fix:** Provide an isolated QA fixture with at least 16 pending scans so the independent paging state can be exercised without modifying the reused database. No existing data was changed to force this scenario.

### F3 - S8: Decision from pending page 2 could not be tested

- **Severity:** Medium
- **Role / page:** Quality Inspector, `/review`
- **Steps to reproduce:** 1. Sign in as the Inspector. 2. Open Review and try to reach page 2 of “Needs a decision.”
- **Expected:** Decide a scan on page 2 and see the queue refresh without an error.
- **Actual:** The queue contained 6 pending scans and had no page 2, so the decision flow from that page was not run.
- **Evidence:** `qa/reports/artifacts/2026-10-14-pagination/S8.png`.
- **Suggested fix:** Use an isolated QA fixture with at least 16 pending scans; do not alter the existing shared database merely to manufacture the case.

### F4 - S10: Components search could not be exercised

- **Severity:** Medium
- **Role / page:** System Admin, `/admin/settings?tab=components`
- **Steps to reproduce:** 1. Sign in as System Admin. 2. Open Settings and select Components. 3. Try to enter a search term.
- **Expected:** The handoff calls for a Find box on each Settings list so matching rows can be searched.
- **Actual:** The Components list was empty and no Find field was rendered, so its search behavior could not be verified. Search worked on the populated Shoes, Suppliers, and Defects lists.
- **Evidence:** `qa/reports/artifacts/2026-10-14-pagination/S10.png`.
- **Suggested fix:** Add a Components row in an isolated QA fixture and clarify whether the Find box should still render when a list is empty. No shared database data was added for this check.

## 5. Other observations

- Rechecked the previous full-width report's Procurement issue: at 1440 px the Status column remains clipped at the right edge of the table, although the document itself has no horizontal overflow. See `S4.png` and `qa/reports/2026-10-14-full-width-mr-codes.md`.
- Rechecked the previous report's inventory ledger issue: the older movement still reads `Received for PR-2026-0001`. Pagination and Newer/Older behavior passed; the historical label remains. See `S3.png` and the earlier report.
- Pager result wording is grammatically wrong for singular results in Settings and requesters: “1 shoe type that match,” “1 supplier that match,” “1 defect type that match,” and “1 Shoe Constructor that match.” Search behavior itself worked. Likely shared location: `src/lib/use-paged-rows.ts`.
- During Review, `server.log` recorded a React hydration mismatch on an input whose client DOM had an extra `style` attribute (`caret-color: transparent`). The manual browser console sweep remained empty. This may be an injected browser/input style; it was not reproduced as a visible behavior defect. See the Review entries in `server.log`.
- The e2e web server repeatedly logged `Error: The destination stream closed early.` in `e2e.log`. The production build passed; the e2e failures above are the observed test results.
- The database was not reset or reseeded. The temporary API token was revoked after the screenshot and the requester toggle was restored. Existing e2e specs ran against the shared database and may leave their normal test records.

## 6. Suggested fixes (priority order)

1. Diagnose the role sign-in failures affecting 16 e2e tests before relying on those specs as a regression signal.
2. Add isolated review-queue fixtures for at least 16 pending scans so S7 and S8 can be exercised safely and repeatedly.
3. Fix singular/plural grammar in the shared client-side pager text in `src/lib/use-paged-rows.ts`.
4. Resolve the Procurement Status-column clipping at 1440 px, as also recorded in the full-width report.
5. Decide how legacy inventory reasons such as `Received for PR-2026-0001` should be displayed or migrated.
