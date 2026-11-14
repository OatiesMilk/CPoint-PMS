# CI re-check for PR #50

**2026-11-14 · Run 1 · PASS** — The local `docker` job passed all 28 SQL assertions, including the original failing quota check, and the restart check.

- Branch `feature/claim-sheet-and-demo-output` at `47d1aebba25b62717b65e0e7293ba7ba5180c47b`. The working-tree [CI workflow](../../.github/workflows/ci.yml#L141) already checked `quota=300`.
- Ran the [handoff](../CODEX_PROMPT_CI_RECHECK_feature-claim-sheet-and-demo-output.md) from the supplied D: checkout because `C:devCPoint-PMS` was unavailable. Used project `cpoint-ci`, fresh named volumes, ports 33050 (app) and 55450 (DB), and a temporary copy of the local environment with `SEED_DEMO_WEEK=true`. The repository `.env` hash matched before and after.
- The configured `C:devcapstone-obsidian` vault was unavailable. Its 2026-11-14 Daily note could not be updated.

## Docker job

| Step                       | Result | Observed                                                                                                                                                                                                                           |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build and start            | PASS   | `docker compose up --build -d --wait` exited 0. Both services became healthy.                                                                                                                                                      |
| Health endpoint            | PASS   | `/api/health` returned `status: ok`, with app and database both `up`.                                                                                                                                                              |
| Bootstrap admin            | PASS   | 1 `SYSTEM_ADMIN` (expected 1).                                                                                                                                                                                                     |
| Bootstrap reference data   | PASS   | 6 defect types (expected 6).                                                                                                                                                                                                       |
| Background seed completion | PASS   | `Demo week seeded` appeared after 87,870 ms of seeding. The log reported 250 rolls, 1,139 scans, 19 check-ins, and 4 stock updates.                                                                                                |
| Demo-week SQL assertions   | PASS   | All 26 passed. Individual results follow.                                                                                                                                                                                          |
| Restart idempotency        | PASS   | The app became healthy again. Batch count stayed at 275 after the workflow's 10-second wait.                                                                                                                                       |
| Cleanup                    | PASS   | `docker compose down -v` exited 0. No `cpoint-ci` containers, volumes, or networks remained. The existing `cpoint-pms` containers stayed up and healthy. The build used Compose's configured local image tag, `cpoint-pms:latest`. |

## Demo-week assertions

| Check                                                          | Expected count | Observed | Result   |
| -------------------------------------------------------------- | -------------: | -------: | -------- |
| Batches                                                        |            ≥10 |      275 | PASS     |
| Scans                                                          |            ≥40 |    1,139 | PASS     |
| Detections missing a defect type                               |              0 |        0 | PASS     |
| Shoe constructors with capture access                          |             ≥1 |        4 | PASS     |
| Open batches                                                   |             ≥1 |        1 | PASS     |
| Cancelled batches with a reason                                |              1 |        1 | PASS     |
| Scans with a source other than `PHONE`                         |              0 |        0 | PASS     |
| Lunch breaks from 11:00 to 12:00                               |              1 |        1 | PASS     |
| **Planned days with quota 300 and a 240-minute interval**      |         **≥1** |   **10** | **PASS** |
| Non-working day plans                                          |              1 |        1 | PASS     |
| Check-ins without a matching planned day                       |              0 |        0 | PASS     |
| Legacy `production_schedules` and `daily_quotas` tables        |              0 |        0 | PASS     |
| Production check-ins                                           |             ≥1 |       19 | PASS     |
| Production check-ins with failed pairs                         |             ≥1 |       19 | PASS     |
| Legacy `shoe_types` and `production_counts` tables             |              0 |        0 | PASS     |
| Inventory reminder settings with days `{3,5}`                  |              1 |        1 | PASS     |
| Stock updates                                                  |             ≥1 |        4 | PASS     |
| Inventory movements linked to an update                        |             ≥1 |       19 | PASS     |
| Leather roll items missing a supplier                          |              0 |        0 | PASS     |
| Batches missing an item or area, or lacking an `LR-` code      |              0 |        0 | PASS     |
| In-stock batches                                               |             ≥1 |       24 | PASS     |
| Used or returned batches                                       |              0 |        0 | PASS     |
| Finished batches without exactly one `OUT` movement            |              0 |        0 | PASS     |
| Batches with a finish timestamp missing a defect share         |              0 |        0 | PASS     |
| Detections missing a length                                    |              0 |        0 | PASS     |
| Inventory items whose on-hand quantity differs from the ledger |              0 |        0 | PASS     |

[Compose build and startup log](artifacts/2026-11-14-ci-recheck-pr50-run1/compose-up.log) · [Check and teardown log](artifacts/2026-11-14-ci-recheck-pr50-run1/checks.log) · [App log](artifacts/2026-11-14-ci-recheck-pr50-run1/app.log)
