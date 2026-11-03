# QA report: Materials weeks Run 2 (R1–R3)

| Field     | Value                                          |
| --------- | ---------------------------------------------- |
| Date      | 2026-11-02 22:59 (Asia/Shanghai)               |
| Handoff   | `qa/handoffs/2026-11-02-materials-weeks.md` §7 |
| Tested by | Codex                                          |
| Verdict   | **FAIL**                                       |

## 1. Summary

Run 2 covered only R1–R3 against the existing `npm run dev` server at `http://localhost:3000`. R2 passed all 24 tests and the full suite with two workers passed 88 tests with 2 skips. R1 failed its unchanged-schedule assertion; the serial batches spec stopped, leaving five tests not run. Overall verdict is FAIL because R1 had a failure.

## 2. Environment

| Item            | Value                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------- |
| OS              | Windows                                                                                         |
| Node / npm      | v25.2.1 / 11.7.0                                                                                |
| Branch / commit | `main` @ `2e63908` (working tree already dirty; no application or test files changed by QA)     |
| How the app ran | Existing `npm run dev` server                                                                   |
| Base URL        | `http://localhost:3000` (`/api/health`: app and database up)                                    |
| Database        | Docker `cpoint-pms-db-1`, healthy; no reset or migration run                                    |
| Browser         | Playwright Chromium 153.0.8010.12, headless per the handoff; in-app Materials tab remained open |
| Viewport        | Playwright default 1440 × 900                                                                   |

## 3. Run results

| ID  | Command                                                                                           | Result                             | Notes / evidence                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `npx playwright test tests/e2e/batches.spec.ts`                                                   | **1 failed, 5 did not run**        | Expected unchanged-schedule notice was absent after the second save; details below. The serial suite stopped after the failure.               |
| R2  | `npx playwright test tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts tests/e2e/admin.spec.ts` | **24 passed, 0 failed, 0 skipped** | All three specs passed, including the Run 1 inventory, smoke and admin failures.                                                              |
| R3  | `npm run test:e2e -- --workers=2`                                                                 | **88 passed, 0 failed, 2 skipped** | 90 total; the skips were the demo-tools test incompatible with `DEMO_LOGIN_TOOLS=true` and the no-model test while model files are installed. |

The R1 log and Playwright error context, R2 and R3 logs, and database snapshots are in `qa/reports/artifacts/2026-11-02-materials-weeks/`.

## 4. Failure

### F1 — R1: Unchanged schedule save did not report “Nothing changed”

- **Severity:** Medium
- **Role / page:** Floor Manager / Plan batches and quota
- **Steps to reproduce:** Run `npx playwright test tests/e2e/batches.spec.ts` against the dev server.
- **Expected:** After reload, re-enter the schedule that already applies tomorrow and save it again. The app shows “Nothing changed: this schedule already applies from …, so nothing was saved,” and the history row count stays the same.
- **Actual:** The expected notice did not appear within 10 seconds. The captured page snapshot showed a new `08:00 to 17:00, once at the end of the day, Mon to Fri` history entry at 10:52 PM alongside an earlier identical entry at 7:19 PM. The test failed at `tests/e2e/batches.spec.ts:183`; the other five serial tests did not run.
- **Evidence:** `qa/reports/artifacts/2026-11-02-materials-weeks/run2-r1/batches-the-Floor-Manager--0cead-f-the-day-and-the-one-quota-chromium/error-context.md`. Playwright saved a text page context, not a screenshot attachment.
- **Suggested fix:** Investigate why the repeated save created a history entry instead of returning the no-change result.

## 5. Other observations

- The R1–R3 runs left one test-created schedule, lunch and quota record. I removed only those three rows after matching their values to the test data. The restored snapshot exactly matches the pre-run snapshot: 6 schedules, 7 lunch rows and 3 quotas. Before and restored snapshots are in the artifacts folder.
- No application code, tests, migrations, config or `.env` were changed.

## 6. Suggested fixes (priority order)

1. Investigate the unchanged schedule save result and history entry shown in F1.
2. Keep the two-worker full-suite command as the stable rerun for the Run 1 parallel-suite failures; R3 passed with 88 tests and 2 environment-specific skips.
