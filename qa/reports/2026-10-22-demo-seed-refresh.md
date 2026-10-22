# QA report: demo seed refresh

| Field     | Value                                         |
| --------- | --------------------------------------------- |
| Date      | 2026-10-22 22:14 (Asia/Shanghai)              |
| Handoff   | `qa/handoffs/2026-10-22-demo-seed-refresh.md` |
| Tested by | Codex                                         |
| Verdict   | **PASS**                                      |

## 1. Summary

Validated the refreshed demo seed on an isolated Docker stack and ran the full e2e suite against the dev database. Build passed, D1–D10 passed, and e2e completed with 99 passed, 0 failed, and 1 conditional skip. The e2e web server emitted non-failing “destination stream closed early” warnings; details are recorded below.

Scenarios: 10 passed, 0 failed, 0 blocked, 10 total.

## 2. Environment

| Item            | Value                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11, version 10.0.26200                                                                                                      |
| Node / npm      | v25.2.1 / 11.7.0                                                                                                                    |
| Branch / commit | `docs/agent-workflow-vault` @ `0e8e06f` (worktree dirty before QA due to existing D-090 changes; QA did not edit application files) |
| How the app ran | Isolated Docker Compose project `cpoint-qa`; full e2e ran against the existing dev database                                         |
| Base URL        | `http://localhost:3002`                                                                                                             |
| Database        | Isolated Docker `cpoint-qa` DB, seeded with demo users and demo week                                                                |
| Browser         | Playwright 1.63.0 Chromium revision 1243, headless                                                                                  |
| Viewport        | 1440 × 900                                                                                                                          |

Setup evidence: `artifacts/2026-10-22-demo-seed-refresh/db-up.log`, `db-deploy.log`, `build.log`, `seed-complete.log`, `demo-health.json`, `stock-ledger-check.txt`, and `scan-count.txt`. The isolated demo had 120 scans and 0 stock-ledger mismatches. Database deploy found 18 migrations and no pending migrations.

## 3. Scenario results

| ID  | Scenario                                | Result | Notes / evidence                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Floor Manager account name              | PASS   | Home and account menu show Rodel Pascual. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D1-manager-name.png`                                                                                                                                                                                  |
| D2  | Scan source, model, and roll size       | PASS   | Scan shows Webcam and `yolo-v1-1d729fb0`; batches show 10-section rolls. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D2-scan-detail.png`, `artifacts/2026-10-22-demo-seed-refresh/screenshots/D2-batches.png`                                                                               |
| D3  | Camera model and simulator state        | PASS   | Model card names `yolo-v1-1d729fb0`; no Simulator active badge. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D3-camera-model.png`                                                                                                                                                            |
| D4  | Past attendance and constructors        | PASS   | Navigated Oct 16–21; Maricel Dizon is absent on Oct 19 and the refreshed constructor names appear. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D4-attendance-qi-absent.png`                                                                                                                 |
| D5  | Historical production and check-ins     | PASS   | Production includes Oct 19; audit confirms both check-ins were entered by Rodel Pascual. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D5-production-history.png`; `artifacts/2026-10-22-demo-seed-refresh/seed-data-audit-final.txt`                                                         |
| D6  | Leather supplier quality ranking        | PASS   | All three leather suppliers appear; Marikina Leather Trading ranks worst-first. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D6-supplier-quality.png`                                                                                                                                        |
| D7  | Procurement requests and supplier names | PASS   | All 9 requests appear; leather requests name Marikina Leather Trading and other supplies name San Roque Shoe Supplies. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D7-procurement.png`                                                                                                      |
| D8  | Constructor camera permission           | PASS   | Noel Manalo is listed as Can capture. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D8-camera-operator.png`                                                                                                                                                                                   |
| D9  | QI review queue                         | PASS   | Two pending flagged sections appear on newest scanned roll B-2026-0012. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D9-review-queue.png`                                                                                                                                                    |
| D10 | Seeded-data placeholder search          | PASS   | 17 page states searched; no seeded-data placeholders. One static Camera help sentence says “realistic test scans”; it is UI copy, not seeded data. `artifacts/2026-10-22-demo-seed-refresh/screenshots/D10-search-reviewed-pages.png`; `artifacts/2026-10-22-demo-seed-refresh/search-results.json` |

Existing automated tests run:

| Command                                                                                             | Result                                                                                       |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `npm run test:e2e -- --output=qa/reports/artifacts/2026-10-22-demo-seed-refresh/playwright-results` | 99 passed, 0 failed, 1 skipped (100 total); `artifacts/2026-10-22-demo-seed-refresh/e2e.log` |

The skipped test was the conditional “without the model files the app answers 503 with where to put them” case (`tests/e2e/capture.spec.ts:64`); model files were installed. No e2e tests failed.

## 4. Failures

None.

## 5. Other observations

- The e2e web server logged repeated `Error: The destination stream closed early.` messages, but the process exited successfully and all non-skipped tests passed. See `artifacts/2026-10-22-demo-seed-refresh/e2e.log`.
- The dev database cleanup removed 794 rows added by e2e and 42 associated upload files (38 scan images and 4 proof files). The post-cleanup snapshot returned table counts to baseline except for one expired session revocation pruned during sign-out (9 to 8). Attendance Save regenerated IDs for 8 pre-existing attendance marks while retaining 24 marks total. No test-created upload files remained in the captured run window.
- The isolated `cpoint-qa` containers, network, and volumes were removed. The pre-existing `cpoint-pms` app and database remain running.
- QA did not change application code, tests, configuration, migrations, package files, or `.env`.

## 6. Suggested fixes (priority order)

1. None required for this QA run. Investigate the non-failing web server stream warnings if they recur in a run with test failures.
