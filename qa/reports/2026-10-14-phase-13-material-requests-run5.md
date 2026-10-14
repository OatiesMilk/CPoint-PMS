# QA report: Phase 13 material requests, run 5

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Date      | 2026-10-14 12:06 (local time)                               |
| Handoff   | `qa/handoffs/2026-10-14-phase-13-material-requests-run5.md` |
| Tested by | Codex                                                       |
| Verdict   | **FAIL**                                                    |

## 1. Summary

The build passed, and I confirmed the live e2e server ran with `--keepAliveTimeout 70000`. D-031 passed in all three parallel runs with no `ECONNRESET`; run 1 had one unrelated 30-second test timeout, while runs 2 and 3 passed all 45 tests.

Scenarios: 2 passed, 1 failed, 0 blocked, 3 total.

## 2. Environment

| Item            | Value                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| OS              | Windows                                                                                                       |
| Node / npm      | Node v25.2.1 / npm 11.7.0; Playwright 1.63.0                                                                  |
| Branch / commit | `main` @ `c044511` (working tree was already dirty; QA added files only under `qa/reports/`)                  |
| How the app ran | Playwright `webServer`: `npm run start -- -p 3100 --keepAliveTimeout 70000`; started and stopped for each run |
| Base URL        | `http://127.0.0.1:3100`                                                                                       |
| Database        | Docker `cpoint-pms-db-1`, healthy; `db:deploy` found no pending migrations; specs created their test data     |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                   |
| Viewport        | 1440 x 900 (Playwright config)                                                                                |

There was no listener on port 3100 before testing. The port 3000 server was left alone. No Chrome process or e2e server remained after the runs; the database container remains running.

## 3. Scenario results

| ID  | Scenario                                      | Result | Notes / evidence                                                                                                                                                                                                                                                                     |
| --- | --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T1  | `npm run build`                               | PASS   | Exit 0. `artifacts/2026-10-14-phase-13-material-requests-run5/build.log`                                                                                                                                                                                                             |
| T2  | Confirm live e2e server keep-alive option     | PASS   | Inspected process command lines while run 1 was active; both `npm run start` and the `next start` process included `-p 3100 --keepAliveTimeout 70000`. `artifacts/2026-10-14-phase-13-material-requests-run5/server-commandline-run1.txt`; config source: `playwright.config.ts:35`. |
| T3  | Five-spec parallel suite, three separate runs | FAIL   | Run 1 had one test timeout; runs 2 and 3 passed. Per-run results below.                                                                                                                                                                                                              |

| Run | Passed | Failed | `The destination stream closed early` lines | `ECONNRESET` lines | Log                                                              |
| --- | -----: | -----: | ------------------------------------------: | -----------------: | ---------------------------------------------------------------- |
| 1   |     44 |      1 |                                          14 |                  0 | `artifacts/2026-10-14-phase-13-material-requests-run5/e2e-1.log` |
| 2   |     45 |      0 |                                          19 |                  0 | `artifacts/2026-10-14-phase-13-material-requests-run5/e2e-2.log` |
| 3   |     45 |      0 |                                          25 |                  0 | `artifacts/2026-10-14-phase-13-material-requests-run5/e2e-3.log` |

Existing automated tests run:

| Command                                                                                                                                                                                                                                                 | Result                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `npm run db:up`                                                                                                                                                                                                                                         | Exit 0; `cpoint-pms-db-1` was running. `db-up.log`        |
| `npm run db:deploy`                                                                                                                                                                                                                                     | Exit 0; 9 migrations found, none pending. `db-deploy.log` |
| `npm run build`                                                                                                                                                                                                                                         | PASS, exit 0                                              |
| `npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run5/e2e-results-1` (run 1) | 44 passed, 1 failed; exit 1                               |
| Same five-spec command with `--output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run5/e2e-results-2` (run 2)                                                                                                                            | 45 passed, 0 failed; exit 0                               |
| Same five-spec command with `--output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run5/e2e-results-3` (run 3)                                                                                                                            | 45 passed, 0 failed; exit 0                               |

## 4. Failures

### F1 - T3, run 1: procurement request detail check exceeded the test timeout

- **Severity:** Medium (intermittent parallel-run test failure)
- **Role / page:** Shoe Constructor / material request detail page
- **Steps to reproduce:** Run the five-spec parallel suite. In `a constructor asks, the Floor Manager approves and receives, and stock goes up`, complete the request and delivery flow, then reach the requester’s final request detail reload.
- **Expected:** The request detail page displays the `Received` status after the Floor Manager records delivery.
- **Actual:** The run reached the test’s 30-second timeout. The exact failure at `tests/e2e/procurement.spec.ts:260` was:

  ```text
  Test timeout of 30000ms exceeded.

  Error: expect(locator).toBeVisible() failed
  Locator: locator('header, main').getByText('Received').first()
  Expected: visible
  Received: undefined

  Call log:
    - Expect "toBeVisible" locator('header, main').getByText('Received').first() with timeout 5000ms
    - waiting for locator('header, main').getByText('Received').first()
    - Protocol error (Runtime.callFunctionOn): Internal server error, session closed.
  ```

  The failure context snapshot showed the Constructor’s request detail page with `Loading the request` in the main area. The same flow passed in run 2 (23.2s) and run 3 (21.2s).

- **Evidence:** `artifacts/2026-10-14-phase-13-material-requests-run5/e2e-1.log`; `artifacts/2026-10-14-phase-13-material-requests-run5/e2e-results-1/procurement-a-constructor--06cef--receives-and-stock-goes-up-chromium/error-context.md`.
- **Judgment:** **Test wrong / flaky under parallel load.** The test hit its 30-second deadline while the page still showed its loading state; the same flow passed in the next two runs, and no `ECONNRESET` occurred. The captured state does not establish that the page would have remained loading after the test deadline.
- **Suggested fix:** Increase the timeout for this long end-to-end test at `tests/e2e/procurement.spec.ts:158` (for example, to 45 seconds), keeping the `Received` assertion at line 260.

## 5. Other observations

- Run 4’s F1 did not recur: D-031 passed in all three runs, and each run had zero `ECONNRESET` lines.
- At startup, each run logged a Next.js warning that `next start` does not work with `output: standalone` and suggested `node .next/standalone/server.js`. The configured server still became reachable and the suites ran. The launch command is in `playwright.config.ts:35`.

## 6. Suggested fixes (priority order)

1. Give the long procurement flow a 45-second test timeout at `tests/e2e/procurement.spec.ts:158` to avoid an intermittent timeout in the six-worker parallel suite.
2. Align the Playwright server command at `playwright.config.ts:35` with the standalone build output, or change the output mode, to remove the Next.js startup warning.
