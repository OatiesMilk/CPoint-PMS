# QA report — Reports clean-up and reports by roll, run 3

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Date      | 2026-11-04 19:42 (Asia/Shanghai)            |
| Handoff   | `qa/handoffs/2026-11-04-reports-cleanup.md` |
| Tested by | Codex                                       |
| Verdict   | **PASS**                                    |

## 1. Summary

Both run 2 failures passed their standalone checks and passed again in the targeted and full runs. The full suite finished with 93 passed and two conditional skips. The inventory ledger returned **0 mismatches**.

Run 3 scenarios — 2 passed, 0 failed, 0 blocked.

## 2. Environment

| Item            | Value                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language                                                                                                        |
| Node / npm      | v25.2.1 / 11.7.0                                                                                                                       |
| Branch / commit | `phase-30e2-planning-calendar` @ `c8c68dc`, with existing uncommitted changes                                                          |
| App             | Reused the running Next.js dev server after verifying its process belonged to this checkout and `/login` returned HTTP 200             |
| Base URL        | `E2E_BASE_URL=http://localhost:3000`                                                                                                   |
| Database        | Healthy Docker `cpoint-pms-db-1` with existing local data. [Database startup log](artifacts/2026-11-04-reports-cleanup-run3/db-up.log) |
| Browser         | Headless Playwright Chromium, 1440 × 900 configured desktop viewport                                                                   |

## 3. Scenario results

| ID  | Scenario                                                           | Result | Evidence                                                                                                                        |
| --- | ------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Weekday without a plan, axe after the plan notice closes           | PASS   | `batches.spec.ts:241` ran on Wednesday and passed in 4.2 s standalone, 13.3 s targeted, and 14.2 s in the full run.             |
| R2  | Floor Manager reads the rolls, updates stock, and reads the report | PASS   | `smoke.spec.ts:87` passed in 27.5 s standalone, 32.0 s targeted, and 34.6 s in the full run. All were within the 60 s deadline. |

| Run                                                                           | Passed | Failed | Skipped | Evidence                                                      |
| ----------------------------------------------------------------------------- | -----: | -----: | ------: | ------------------------------------------------------------- |
| `npx playwright test tests/e2e/batches.spec.ts`                               |      7 |      0 |       0 | [Log](artifacts/2026-11-04-reports-cleanup-run3/batches.log)  |
| `npx playwright test tests/e2e/smoke.spec.ts`                                 |     10 |      0 |       0 | [Log](artifacts/2026-11-04-reports-cleanup-run3/smoke.log)    |
| Targeted — Rolls, Reports, Supplier Quality, Inventory, Smoke, Admin, Batches |     43 |      0 |       0 | [Log](artifacts/2026-11-04-reports-cleanup-run3/targeted.log) |
| `npm run test:e2e`                                                            |     93 |      0 |       2 | [Log](artifacts/2026-11-04-reports-cleanup-run3/full.log)     |

## 4. Failures

None. The retry rule did not trigger.

## 5. Other observations

- The full suite skipped the flag-off demo-tools test because demo tools were enabled, and the missing-model Capture test because the model was installed.
- Read-only snapshots matched for today's plan, all day plans, and lunch breaks before and after the tests.
- The ledger query compared each inventory item's on-hand quantity with the sum of its movement deltas. [Ledger result](artifacts/2026-11-04-reports-cleanup-run3/ledger.txt)

## 6. Suggested fixes

None from this run.
