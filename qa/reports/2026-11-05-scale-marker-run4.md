# QA report — Scale marker card (D-120), run 4

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Date      | 2026-11-05 08:47 (Manila, UTC+08:00)     |
| Handoff   | `qa/handoffs/2026-11-04-scale-marker.md` |
| Tested by | Codex                                    |
| Verdict   | **PASS**                                 |

## 1. Summary

S9 passed. Floor view saved one shot with the printed marker in view and displayed **Pass**. With the card removed, Space displayed **“Show the marker card to capture.”** and the count stayed at one. The ledger returned **0 mismatches**.

Scenarios — 1 passed, 0 failed, 0 blocked.

## 2. Environment

| Item             | Value                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| OS               | Windows 11                                                                                                       |
| Branch / commit  | `main` @ `5104e29` with scale-marker worktree changes                                                            |
| Dev server       | Existing CPoint-PMS `npm run dev` at `http://localhost:3000`                                                     |
| Database         | Healthy Docker `cpoint-pms-db-1`                                                                                 |
| Browser          | Codex in-app browser for S9 and headless Chromium for e2e                                                        |
| Camera and stock | **USB CAMERA (1224:2a25)**, printed card flat on leather, tape out of frame, E2E stock roll **LR-Q77FB-048**     |
| Time gate        | Verified at **08:32 Manila**, after 01:00. [Time record](artifacts/2026-11-05-scale-marker-run4/manila-time.txt) |

## 3. Scenario results

| ID  | Result | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S9  | PASS   | Card in view, Space saved Shot #1 and the Floor view band displayed **Pass**. Card removed, Space displayed exactly **“Show the marker card to capture.”** with **1 shot** still shown. Captured the screenshot in the in-app browser session before exiting. Esc left Floor view and Finish roll confirmed one shot, stock removal and **0% defects**. [Walkthrough transcript](artifacts/2026-11-05-scale-marker-run4/walkthrough.txt) |

| E2E run                                                     | Passed | Failed | Skipped | Did not run | Evidence                                                  |
| ----------------------------------------------------------- | -----: | -----: | ------: | ----------: | --------------------------------------------------------- |
| `npx playwright test tests/e2e/batches.spec.ts --workers=1` |      7 |      0 |       0 |           0 | [Log](artifacts/2026-11-05-scale-marker-run4/batches.log) |
| Full — `npm run test:e2e`                                   |     76 |     19 |       2 |           1 | [Log](artifacts/2026-11-05-scale-marker-run4/full.log)    |
| Isolated reruns combined, one worker per spec               |     79 |      0 |       2 |           0 | Per-spec logs below                                       |

| Spec             | Full-run timeouts | Isolated passed | Isolated failed | Isolated skipped | Evidence                                                                    |
| ---------------- | ----------------: | --------------: | --------------: | ---------------: | --------------------------------------------------------------------------- |
| admin            |                 4 |               6 |               0 |                0 | [Log](artifacts/2026-11-05-scale-marker-run4/admin-isolated.log)            |
| auth             |                 2 |              20 |               0 |                1 | [Log](artifacts/2026-11-05-scale-marker-run4/auth-isolated.log)             |
| capture          |                 1 |              12 |               0 |                1 | [Log](artifacts/2026-11-05-scale-marker-run4/capture-isolated.log)          |
| cv               |                 2 |               7 |               0 |                0 | [Log](artifacts/2026-11-05-scale-marker-run4/cv-isolated.log)               |
| inventory        |                 4 |               8 |               0 |                0 | [Log](artifacts/2026-11-05-scale-marker-run4/inventory-isolated.log)        |
| reports          |                 1 |               3 |               0 |                0 | [Log](artifacts/2026-11-05-scale-marker-run4/reports-isolated.log)          |
| returns          |                 1 |               4 |               0 |                0 | [Log](artifacts/2026-11-05-scale-marker-run4/returns-isolated.log)          |
| rolls            |                 2 |               6 |               0 |                0 | [Log](artifacts/2026-11-05-scale-marker-run4/rolls-isolated.log)            |
| smoke            |                 1 |              10 |               0 |                0 | [Log](artifacts/2026-11-05-scale-marker-run4/smoke-isolated.log)            |
| supplier-quality |                 1 |               3 |               0 |                0 | [Log](artifacts/2026-11-05-scale-marker-run4/supplier-quality-isolated.log) |

## 4. Failures

The full suite hit 19 test deadlines across 10 specs. Each affected spec was rerun alone once and all 19 timed-out tests passed. The Admin camera-settings serial group left one test unrun in the full suite. That test ran and passed in the isolated Admin spec. The two conditional skips covered demo tools being enabled and the model being installed.

## 5. Other observations

- The Batches Quality Inspector due-notice check passed in the standalone run.
- [Ledger query and result](artifacts/2026-11-05-scale-marker-run4/ledger.txt)

## 6. Suggested fixes

None from this run.
