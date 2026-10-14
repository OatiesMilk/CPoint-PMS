# QA report: Phase 13 material requests, run 4

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Date      | 2026-10-14 11:44 (local time)                               |
| Handoff   | `qa/handoffs/2026-10-14-phase-13-material-requests-run4.md` |
| Tested by | Codex                                                       |
| Verdict   | **FAIL**                                                    |

## 1. Summary

The build passed, and the short-delivery test passed all three standalone runs. The Run 3 contrast finding did not recur after the test waited for dialog animations to finish; this confirms the prior finding came from the test measuring mid-fade, not from an app contrast fault. The parallel suite had one separate `ECONNRESET` failure; the serial procurement suite passed all 15 tests.

Scenarios: 3 passed, 1 failed, 0 blocked, 4 total.

## 2. Environment

| Item            | Value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| OS              | Windows                                                                                                           |
| Node / npm      | Node v25.2.1 / npm 11.7.0; Playwright 1.63.0                                                                      |
| Branch / commit | `main` @ `c044511` (working tree was already dirty; QA created files only under `qa/reports/`)                    |
| How the app ran | `npm run build`; Playwright started the built app with `npm run start -- -p 3100`, then stopped it after each run |
| Base URL        | `http://127.0.0.1:3100`                                                                                           |
| Database        | Docker `cpoint-pms-db-1`, healthy; `db:deploy` reported no pending migrations; specs created their own test data  |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                       |
| Viewport        | 1440 x 900 (Playwright config)                                                                                    |

No CPoint dev server was running. The other project's server on port 3000 was left alone. The Playwright server stopped after the runs; the database container remains running.

## 3. Scenario results

| ID  | Scenario                                   | Result | Notes / evidence                                                                                                    |
| --- | ------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------- |
| T1  | `npm run build`                            | PASS   | Exit 0. `artifacts/2026-10-14-phase-13-material-requests-run4/build.log`                                            |
| T2  | Short-delivery test, three standalone runs | PASS   | Each run: 1 passed, 0 failed. Logs: `single-1.log`, `single-2.log`, `single-3.log`.                                 |
| T3  | Five-spec parallel Playwright command      | FAIL   | 44 passed, 1 failed of 45. The single failure is F1. `artifacts/2026-10-14-phase-13-material-requests-run4/e2e.log` |
| T4  | Procurement spec with `--workers=1`        | PASS   | 15 passed, 0 failed. `artifacts/2026-10-14-phase-13-material-requests-run4/e2e-serial.log`                          |

Existing automated tests run:

| Command                                                                                                                                                                                                                                       | Result                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `npm run db:up`                                                                                                                                                                                                                               | Exit 0; local database already running. `db-up.log` |
| `npm run db:deploy`                                                                                                                                                                                                                           | Exit 0; no pending migrations. `db-deploy.log`      |
| `npm run build`                                                                                                                                                                                                                               | PASS, exit 0                                        |
| `npx playwright test tests/e2e/procurement.spec.ts --grep "order, a short delivery with proof" --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run4/single-1-results` (run 1)                                             | 1 passed, 0 failed; `single-1.log`                  |
| Same command with `single-2-results` (run 2)                                                                                                                                                                                                  | 1 passed, 0 failed; `single-2.log`                  |
| Same command with `single-3-results` (run 3)                                                                                                                                                                                                  | 1 passed, 0 failed; `single-3.log`                  |
| `npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run4/e2e-results` | 44 passed, 1 failed of 45; exit 1                   |
| `npx playwright test tests/e2e/procurement.spec.ts --workers=1 --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run4/e2e-results-serial`                                                                                   | 15 passed, 0 failed; exit 0                         |

## 4. Failures

### F1 - T3: D-031 request POST reset during the parallel suite

- **Severity:** Medium (intermittent API failure in the parallel run)
- **Role / page:** Shoe Constructor / New material request
- **Steps to reproduce:** 1. Run the five-spec parallel suite. 2. In `every constructor requests supplies; leather rolls need the Floor Manager's OK, effective on the next request (D-031)`, create a supply and a leather-roll request item. 3. After the Floor Manager enables leather-roll requests and the row shows `Can request`, submit the next request.
- **Expected:** The next request POST returns HTTP 201.
- **Actual:** At `tests/e2e/procurement.spec.ts:609` (the `page.request.post` call is in the helper at line 587), Playwright reported exactly: `Error: apiRequestContext.post: read ECONNRESET`. The error context shows the Constructor's `New material request` form; its picker still shows leather rolls as disabled because the constructor page was not reloaded after the Floor Manager enabled the permission. The valid POST to `/api/v1/procurement/requests` received no HTTP response. This test passed in the serial procurement suite.
- **Evidence:** `artifacts/2026-10-14-phase-13-material-requests-run4/e2e-results/procurement-every-construc-da1e6--on-the-next-request-D-031--chromium/error-context.md`; full and serial logs are in the same artifact folder. Authentication cookie headers in text artifacts were redacted.
- **Judgment:** **App/server wrong, intermittent.** The request was reset at the HTTP connection rather than returning an application status; the same test passed serially, so the failure appeared only under parallel execution.
- **Suggested fix:** Investigate the request path at `src/server/controllers/procurement.controller.ts:111` and its `createRequest` service call; ensure exceptions during parallel requests return a controlled HTTP response. The logs do not identify a more specific failing source line.

## 5. Other observations

- Run 3 F1 did not recur: the short-delivery test passed three times after waiting for entrance animations to finish. The Run 3 contrast result was a test-measurement fault, not an app contrast fault.
- The parallel e2e run logged 25 `The destination stream closed early` lines.

## 6. Suggested fixes (priority order)

1. Investigate and resolve the parallel-run request reset in the D-031 procurement request path, starting at `src/server/controllers/procurement.controller.ts:111` and `createRequest`.
