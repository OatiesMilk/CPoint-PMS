# QA report: Materials weeks Run 3 (R4 retest on port 3001)

| Field     | Value                                          |
| --------- | ---------------------------------------------- |
| Date      | 2026-11-03 09:09 (Asia/Shanghai)               |
| Handoff   | `qa/handoffs/2026-11-02-materials-weeks.md` §8 |
| Tested by | Codex                                          |
| Verdict   | **FAIL**                                       |

## 1. Summary

Repeated only R4 twice against the requested `npm run dev` server at `http://localhost:3001`, using that URL for both the in-app browser and Playwright. The first invocation failed during Floor Manager sign-in and the serial suite did not run its remaining five tests. The second invocation passed all six tests. R4 requires both runs to pass, so this port-3001 retest is **FAIL**. The prior report’s two passes were against port 3000 and are not counted for this retest.

## 2. Environment

| Item            | Value                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| OS              | Windows                                                                                               |
| Node / npm      | v25.2.1 / 11.7.0                                                                                      |
| Branch / commit | `main` @ `2e63908` (working tree already dirty; no application or test files changed by QA)           |
| How the app ran | Existing `npm run dev` server                                                                         |
| Base URL        | `http://localhost:3001` (`/api/health`: app and database up)                                          |
| Database        | Docker `cpoint-pms-db-1`, healthy; no reset or migration run                                          |
| Browser         | Visible in-app browser at Materials on port 3001; Playwright Chromium 153.0.8010.12, headless for e2e |
| Viewport        | Playwright default 1440 × 900                                                                         |

## 3. Run results

| ID        | Command                                         | Result                            | Duration / evidence                                                                                                      |
| --------- | ----------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| R4, run 1 | `npx playwright test tests/e2e/batches.spec.ts` | **1 failed, 5 did not run**       | Sign-in did not reach `/floor-manager`; details below. `artifacts/2026-11-02-materials-weeks/run3-repeat-3001-first.log` |
| R4, run 2 | `npx playwright test tests/e2e/batches.spec.ts` | **6 passed, 0 failed, 0 skipped** | 39.7 s; `artifacts/2026-11-02-materials-weeks/run3-repeat-3001-second.log`                                               |

Both invocations set `$env:E2E_BASE_URL='http://localhost:3001'` and wrote Playwright output under `qa/reports/artifacts/2026-11-02-materials-weeks/`.

## 4. Failure

### F1 — R4 run 1: Floor Manager sign-in did not reach the expected home page

- **Severity:** Medium
- **Role / page:** Floor Manager / sign-in to Batches
- **Steps to reproduce:** Set `E2E_BASE_URL` to `http://localhost:3001` and run `npx playwright test tests/e2e/batches.spec.ts`.
- **Expected:** After submitting the Floor Manager sign-in form, navigation reaches `http://localhost:3001/floor-manager`.
- **Actual:** The 10-second URL assertion timed out. The log observed `/login`, then `/`, instead of `/floor-manager`; the captured page snapshot contained an alert region. The test failed at `tests/e2e/batches.spec.ts:55`, called from the R4 test at line 122. The five remaining serial tests did not run.
- **Evidence:** `qa/reports/artifacts/2026-11-02-materials-weeks/run3-repeat-3001-first/batches-the-Floor-Manager--0cead-f-the-day-and-the-one-quota-chromium/error-context.md`. Playwright saved a text context, not a screenshot attachment.
- **Suggested fix:** Investigate the first-run sign-in redirect against the port-3001 dev server.

## 5. Other observations

- The two invocations left one test-created schedule, lunch and quota row. I removed only those rows after checking their values against the batch test data. The restored snapshot exactly matches the pre-run snapshot: 6 schedules, 7 lunch rows and 3 quotas. Before, after and restored snapshots are in the artifacts folder.
- The previous port-3000 R4 run passed 6/6 twice; this retest uses only port 3001 as requested.
- No application code, tests, migrations, config or `.env` were changed.

## 6. Suggested fixes

1. Investigate why the first R4 invocation did not complete Floor Manager sign-in at port 3001.
