# QA report — Reports clean-up and reports by roll, run 2

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Date      | 2026-11-04 19:30 (Asia/Shanghai)            |
| Handoff   | `qa/handoffs/2026-11-04-reports-cleanup.md` |
| Tested by | Codex                                       |
| Verdict   | **FAIL**                                    |

## 1. Summary

The corrected Operations total matched Batches and the standalone Reports spec passed. The full suite failed an accessibility assertion on Batches after the Floor Manager dismissed the plan notice. That assertion fails the run 2 acceptance rule. The inventory ledger returned **0 mismatches**.

Run 2 checks — 2 passed, 0 failed, 0 blocked. Full-suite failures are detailed below.

## 2. Environment

| Item            | Value                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language                                                                                   |
| Node / npm      | v25.2.1 / 11.7.0                                                                                                  |
| Branch / commit | `phase-30e2-planning-calendar` @ `c8c68dc`, with existing uncommitted changes                                     |
| App             | Restarted `npm run dev` with Next.js 16.3.8                                                                       |
| Base URL        | `E2E_BASE_URL=http://localhost:3000`                                                                              |
| Database        | Docker `cpoint-pms-db-1`, existing local data. Prisma reported no pending migrations and generated Client 7.10.0. |
| Browser         | Desktop in-app browser for R1 and headless Playwright Chromium for e2e                                            |

## 3. Scenario results

| ID  | Scenario                                                 | Result | Evidence                                                                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Corrected S15, Operations Pairs finished matches Batches | PASS   | Operations showed **652** for Oct 22–Nov 4. Batches Recent days showed **148 + 126 + 114 + 148 + 46 = 582**, and Today showed **70 finished**, including 10 failed. **582 + 70 = 652**. Operations described the count as all pairs counted at Finish batch, including failed pairs. |
| R2  | Standalone Reports spec                                  | PASS   | All three passed, including the whole-roll Quality count and CSV test with the corrected exact-title assertion.                                                                                                                                                                      |

| Run                                                                     | Passed | Failed | Skipped | Did not run | Evidence                                                                |
| ----------------------------------------------------------------------- | -----: | -----: | ------: | ----------: | ----------------------------------------------------------------------- |
| Standalone Reports                                                      |      3 |      0 |       0 |           0 | [Log](artifacts/2026-11-04-reports-cleanup-run2/reports-standalone.log) |
| Targeted — Rolls, Reports, Supplier Quality, Inventory, Smoke, Admin    |     35 |      1 |       0 |           0 | [Log](artifacts/2026-11-04-reports-cleanup-run2/targeted.log)           |
| Full — `npm run test:e2e`                                               |     86 |      2 |       2 |           5 | [Log](artifacts/2026-11-04-reports-cleanup-run2/full.log)               |
| Smoke retry — `npx playwright test tests/e2e/smoke.spec.ts --workers=1` |     10 |      0 |       0 |           0 | [Log](artifacts/2026-11-04-reports-cleanup-run2/smoke-isolated.log)     |
| Extra run from PowerShell argument error                                |     92 |      1 |       2 |           0 | [Log](artifacts/2026-11-04-reports-cleanup-run2/reports.log)            |

## 4. Failures

### F1 — Batches plan notice dismissal fails axe

- **Severity** — Medium
- **Role / page** — Floor Manager, `/batches`, on a weekday without a plan.
- **Steps** — Open Batches, click the visible batch bell, verify the plan notice appears, press Escape, then run axe as in `tests/e2e/batches.spec.ts:241`.
- **Expected** — The axe check after Escape returns an empty violation list.
- **Actual** — The assertion at line 263 returned `aria-hidden-focus: .contents | main`. Five later tests in the serial group did not run. This assertion was outside the timeout retry rule. [Playwright context](artifacts/2026-11-04-reports-cleanup-run2/full-contexts/batches-a-weekday-with-no--2be34-er-is-told-to-plan-it-A-37--chromium.md)

### F2 — Floor Manager Smoke journey timed out

- **Severity** — Medium
- **Test** — `tests/e2e/smoke.spec.ts:87`, “Floor Manager journey: read the rolls, update stock, read the report.”
- **Expected** — The journey completes within its 30-second test deadline.
- **Actual** — The targeted run hit the deadline waiting for the stock-update toast to become fully opaque at line 140. The full and extra runs also reported the 30-second deadline. The isolated spec passed all 10 tests and the affected journey finished in 9.7 seconds.

## 5. Other observations

- The initial standalone Reports invocation used PowerShell splatting on a scalar path, which expanded it into individual characters and ran 95 tests. I let that run finish so fixture teardown could run. The literal Reports command ran after the targeted and full runs, followed by the single Smoke retry.
- The full suite's two conditional skips covered demo tools being enabled and the local capture model being installed.
- The read-only before and after snapshots matched for today’s plan, all day plans, and lunch break rows.
- The ledger query compared each inventory item's on-hand quantity against the sum of its movement deltas. [Result](artifacts/2026-11-04-reports-cleanup-run2/ledger.txt)

## 6. Suggested investigation

1. Trace focus and `aria-hidden` as the Batches plan notice closes, using the saved axe failure to locate the affected elements.
