# QA report: Full-width/MR and pagination follow-ups, run 2

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Date      | 2026-10-14 20:54 (Asia/Shanghai)           |
| Handoff   | `qa/handoffs/2026-10-14-followups-run2.md` |
| Tested by | Codex                                      |
| Verdict   | **FAIL**                                   |

## 1. Summary

All eight browser scenarios passed: Procurement fits at the required widths, legacy ledger reasons use MR numbers, pager grammar is correct, copied requests have no extra blank row, and both Review lists page independently and accept a decision from page 2. Both production builds passed, but R9 failed: e2e run 1 had 55 passed and 2 failed; run 2 had 56 passed and 1 failed. The previous login assertion failures did not recur; the remaining failures concern token pagination and an intermittent inventory unit default.

Scenarios: 8 passed, 1 failed, 0 blocked, 9 total.

## 2. Environment

| Item            | Value                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| OS              | Windows, PowerShell                                                                                                                  |
| Node / npm      | v25.2.1 / 11.7.0                                                                                                                     |
| Branch / commit | `main` @ `e88e7de`; working tree not clean, builder changes present                                                                  |
| How the app ran | `npm run db:up`, `npm run db:deploy`, then `npm run dev`; two production build/e2e runs; brief production-server diagnosis afterward |
| Base URL        | Browser scenarios: `http://localhost:3000`; e2e: `http://127.0.0.1:3100`; failure diagnosis: `http://localhost:3001`                 |
| Database        | Docker `cpoint-pms-db-1`, PostgreSQL 18, existing local dev/demo/e2e rows; not reset or reseeded                                     |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                                          |
| Viewport        | 1440 x 900 default; R1 additionally 1280 x 800 and 1920 x 1080                                                                       |

Read the QA README, handoff, report template, and both previous reports before testing. Artifacts are under `qa/reports/artifacts/2026-10-14-followups-run2/`.

Before deployment, the prescribed query found three ledger reasons containing `PR-`. Migration `20261014120000_material_request_codes_legacy` applied successfully; afterward the same query found zero rows, and `codes-after.txt` is zero bytes. Evidence: `codes-before.txt`, `codes-after.txt`, `db-up.log`, `db-deploy.log`.

Created the authorized Review fixture through the existing helpers: batch `B-2026-0038` at Preparation and 16 scans using unknown class `qa-followups-run2-unknown`. One fixture scan was passed in R8, and the temporary device token was revoked. Passwords and full token secrets were not written into the report or result logs.

The dev server was stopped before R9, and port 3100 was checked clear before each e2e run. After e2e, an unrelated Vite project occupied port 3000, so the additional diagnosis used port 3001. That CPoint server was also stopped; ports 3001 and 3100 were clear at cleanup. The unrelated Vite app was left alone, and Docker `db` remained running and healthy. See `ports-run1.txt`, `ports-run2.txt`, `cleanup.txt`, and `database-final.txt`.

## 3. Scenario results

| ID  | Scenario                                               | Result | Notes / evidence                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Procurement table at 1440, 1280, and 1920 px           | PASS   | Status is visible and there is no internal table overflow at 1440 or 1920. At 1280 the card has 54 px internal overflow, with zero document overflow, which the handoff permits. Measurements below; `R1.png`, `R1-1440.png`, `R1-1280.png`, `R1-1920.png`.                            |
| R2  | Multi-item and partly approved request rows            | PASS   | Checked MR-2026-0001 and MR-2026-0048. Item summaries occupy at most two 20 px lines; their `title` contains the full summary for native hover text. The partial-approval line sits below its badge with a 2 px gap. Rows remain readable. `R2.png`, `R2-multi.png`, `R2-partial.png`. |
| R3  | Legacy Shoe tacks ledger reason                        | PASS   | The older +5 movement now reads `Delivery for MR-2026-0001`. No matching PR ledger reasons remain in the saved after-query. `R3.png`, `codes-before.txt`, `codes-after.txt`.                                                                                                           |
| R4  | Singular/plural pager grammar                          | PASS   | Observed `1 supplier that matches`, `2 suppliers that match`, `1 account that matches`, and `1 Shoe Constructor that matches`. Also rechecked `1 shoe type that matches` and `1 defect type that matches`. `R4.png`, `R4-suppliers-many.png`, `R4-user.png`, `R4-requester.png`.       |
| R5  | Copy an entirely rejected request and send             | PASS   | Copied MR-2026-0002. Ticking Brown suede filled the sole starter row; there was one populated item row and no blank row. After setting Needed by, sending succeeded as MR-2026-0053 without removing any row or encountering a validation error. `R5-before-send.png`, `R5.png`.       |
| R6  | Copy a request with one approved and one rejected item | PASS   | Used existing cancelled fixture MR-2026-0048 as its owning Shoe Constructor, `sc-64406cf6@e2e.local`. One carried item became two populated rows after ticking the rejected item; neither was blank. No new request was submitted for this scenario. `R6.png`.                         |
| R7  | Independent Review pending/automatic pagination        | PASS   | Pending list had 23 scans; automatic list had 31 calls. Paging pending to page 2 left automatic rows unchanged; paging automatic to page 2 preserved pending rows and produced `/review?page=2&autoPage=2`. Pending Previous also preserved `autoPage=2`. `R7.png`.                    |
| R8  | Decide a scan on pending page 2                        | PASS   | Passed B-2026-0038 section #9. The row disappeared, pending total changed 23 to 22, and the scan API confirmed `finalVerdict: PASS`. Both page parameters remained, with no browser error. `R8.png`.                                                                                   |
| R9  | Required build/e2e command twice                       | FAIL   | Both builds passed. Run 1: 55 passed, 2 failed. Run 2: 56 passed, 1 failed. Token-row assertion failed in both; inventory default-unit assertion failed only in run 1. These were after the first wave, not login failures. Details below and in `e2e-summary.json`.                   |

R1 table geometry (CSS px; rounded to two decimal places):

| Viewport    | Table x / y  | Table width / height | Table right | Status header right | Card right | Internal overflow | Page overflow |
| ----------- | ------------ | -------------------- | ----------- | ------------------- | ---------- | ----------------- | ------------- |
| 1440 x 900  | 281 / 390.41 | 1118 / 807.50        | 1399        | 1399                | 1400       | 0                 | 0             |
| 1280 x 800  | 281 / 427.41 | 1012.34 / 947.50     | 1293.34     | 1293.34             | 1240       | 54                | 0             |
| 1920 x 1080 | 281 / 316.41 | 1598 / 704.50        | 1879        | 1879                | 1880       | 0                 | 0             |

At 1440 and 1920, the table and Status header are within the card and main area. At 1280, the card is the horizontal scroll container; the document width remains 1280. Detailed browser results are in `manual-results.json`.

Existing automated tests run:

```text
npm run build && npx playwright test tests/e2e/admin.spec.ts tests/e2e/procurement.spec.ts tests/e2e/outcomes.spec.ts tests/e2e/cv.spec.ts tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts
```

Only an `--output` argument was added to separate each run's result artifacts. No test code or application configuration was changed by QA.

| Command                              | Run 1                                  | Run 2                                  |
| ------------------------------------ | -------------------------------------- | -------------------------------------- |
| `npm run build`                      | PASS, exit 0                           | PASS, exit 0                           |
| Listed `npx playwright test` command | 55 passed, 2 failed, 0 skipped; exit 1 | 56 passed, 1 failed, 0 skipped; exit 1 |

| Spec                  | Run 1 passed / failed | Run 2 passed / failed |
| --------------------- | --------------------- | --------------------- |
| `admin.spec.ts`       | 6 / 0                 | 6 / 0                 |
| `procurement.spec.ts` | 15 / 0                | 15 / 0                |
| `outcomes.spec.ts`    | 5 / 0                 | 5 / 0                 |
| `cv.spec.ts`          | 7 / 1                 | 7 / 1                 |
| `batches.spec.ts`     | 8 / 0                 | 8 / 0                 |
| `inventory.spec.ts`   | 4 / 1                 | 5 / 0                 |
| `smoke.spec.ts`       | 10 / 0                | 10 / 0                |
| **Total**             | **55 / 2**            | **56 / 1**            |

Logs: `build-run1.log`, `build-run2.log`, `e2e-run1.log`, `e2e-run2.log`. Failure contexts are in `e2e-run1-results/` and `e2e-run2-results/`. Both runs used six workers and finished in approximately 1.7 minutes each. All tests in the initial six-test wave passed; failing scheduled tests were #21 and #23 in run 1, and #21 in run 2.

## 4. Failures

### F1 - R9: Token lifecycle e2e assertion does not account for pagination after revocation

- **Severity:** Medium
- **Role / page:** System Admin, `/admin/tokens`; `tests/e2e/cv.spec.ts:219`
- **Steps to reproduce:** 1. Run the listed e2e command with more than 15 device tokens in the existing dev database. 2. In the device-token test, create a token and revoke it from page 1. 3. The test checks for `Revoked` in the same page's row without paging.
- **Expected:** The lifecycle test locates the revoked token and completes its subsequent assertion that the token can no longer post scans.
- **Actual:** Both runs timed out at `tests/e2e/cv.spec.ts:246`, because the token row was no longer on page 1. Tokens sort active first, then revoked, before pagination. Follow-up read-only inspection confirmed that both test tokens were revoked in the database and visible as Revoked on later pages. After both runs, the run-1 token was at rank 44/page 3 and the run-2 token at rank 46/page 4. The subsequent 401 assertion at line 247 was not reached in these tests. This is a repeatable test/pagination mismatch; the evidence does not show a failed revocation.
- **First wave:** No. Scheduled test #21 in both runs; sign-in completed.
- **Evidence:** `qa/reports/artifacts/2026-10-14-followups-run2/R9.png` shows page 1 without these rows; `R9-token-1.png` and `R9-token-2.png` show their Revoked status on later pages; `diagnosis.json` records the ranks and database state. Exact original errors are in both e2e logs and the `cv-an-admin-creates-a-devi-bf123-sees-it-once-and-revokes-it-chromium/error-context.md` file within each run's result directory.

  ```text
  expect(locator).toBeVisible() failed
  Locator: getByRole('row', { name: /E2E camera .../ }).getByText('Revoked')
  Timeout: 10000ms
  Error: element(s) not found
  ```

- **Suggested fix:** Update the assertion in `tests/e2e/cv.spec.ts:246` to find the token across the paginated list, then still perform the token-rejection check. Account for the active-first ordering in `src/server/models/api-token.model.ts` and pagination in `src/app/(app)/admin/tokens/page.tsx`.

### F2 - R9: Inventory default unit remained roll after selecting Thread in one run

- **Severity:** Medium
- **Role / page:** Floor Manager, `/inventory/new`; `tests/e2e/inventory.spec.ts:45`
- **Steps to reproduce:** 1. Run the listed e2e command against a freshly started production server. 2. The inventory test signs in, opens New item, and selects category `THREAD`. 3. It waits for Unit to become `spool`.
- **Expected:** Selecting Thread changes the untouched default Unit from `roll` to `spool`.
- **Actual:** In run 1, Unit remained `roll` for the full 10-second assertion timeout at `tests/e2e/inventory.spec.ts:53`. The same test passed in run 2. Three additional browser checks on the production build all selected THREAD and observed `spool`; the failure was not reproduced in those checks. No item was saved by the failed test before this assertion.
- **First wave:** No. Scheduled test #23 in run 1; sign-in completed.
- **Evidence:** `qa/reports/artifacts/2026-10-14-followups-run2/e2e-run1.log`, `e2e-run1-results/inventory-the-Floor-Manage-9d9f9-and-undoes-and-counts-stock-chromium/error-context.md`. The successful additional checks are recorded in `diagnosis.json` and `R9-unit-recheck.png`; that screenshot is a recheck, not the original failure.

  ```text
  expect(locator).toHaveValue(expected) failed
  Locator: getByLabel('Unit')
  Expected: "spool"
  Received: "roll"
  Timeout: 10000ms
  ```

- **Suggested fix:** Investigate the category-change/default-unit path in `src/app/(app)/inventory/item-form.tsx` and form readiness at `tests/e2e/inventory.spec.ts:52`. A hydration/event timing issue is a possibility, but the root cause is unsure; simply extending the assertion timeout did not resolve this occurrence.

## 5. Other observations

- Previous full-width failures are resolved in this run: Procurement Status clipping (R1) and the legacy Shoe tacks PR reason (R3). The copied-request blank starter-row observation is also resolved (R5 and R6).
- Previous pagination grammar issues are resolved for Suppliers, Users, requesters, Shoes, and Defects (R4). The previously blocked Review tests are now exercised and passed (R7/R8). The previous 16 post-login URL assertion failures did not recur in either complete e2e run.
- Components remains empty with no Find field, as explicitly intended by this handoff. Confirmed the empty state and did not add a component; it is not treated as a blocker in this run. Evidence: `observation-components.png`.
- Browser scenarios and the additional diagnostic checks recorded zero console/page errors. The new dev-server log did not reproduce the old unresolved `@/lib/pagination` errors or the screenshot-related caret-color hydration warning. Both final production builds passed.
- `The destination stream closed early` recurred in e2e and the diagnostic production-server log, as listed in the handoff's known issues. The known standalone/`next start` warning also appeared. These messages are recorded separately from the actual assertion failures above.
- QA harness attempts are preserved in the artifacts. R1 initially hit a serialized-callback helper error, and R4 initially used an incorrect search selector; corrected harness rechecks passed. One initial build picked up the throwaway QA `.ts` script through the application's TypeScript include glob and failed on harness-only types. Renaming it to `.cts` under the same artifacts folder resolved that interference; both required production builds then passed. No app, test, migration, package, or environment file was edited by QA.
- The new MR-2026-0053 request and permitted review fixture remain in the dev database. Its device token was revoked, and temporary browser session-state files were removed. Existing e2e specs also created their normal test data. No reset or reseed was performed.

## 6. Suggested fixes (priority order)

1. Make the device-token e2e assertion follow the token after active-first sorting moves it to a later page, and ensure the revoked-token 401 assertion still executes.
2. Diagnose the intermittent inventory Unit default failure under the complete six-worker run, checking form hydration and the category-change handler.
3. After those fixes, repeat the same two full build/e2e runs; the direct follow-up browser scenarios are currently passing.
