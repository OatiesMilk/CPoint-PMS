# CI re-check: feature-reports-by-period — 2026-11-21

**PASS, with one unrelated flaky test.** All requested completed commands exited 0. The two previously failing report tests passed in the full suite, alone on the dev database, and on a fresh database with no demo week.

Prompt: [CODEX_PROMPT_CI_RECHECK_feature-reports-by-period](../CODEX_PROMPT_CI_RECHECK_feature-reports-by-period.md). Tested `main` at `1c196bb5d56f286dba06df0b76f1b8aa0e392e93` plus Claude's existing CI fix and uncommitted Phase 35B changes, including `corrections.spec.ts`. This is the current combined working tree. Windows, Node 25.2.1, Next 16.3.8, Playwright 1.63.0; GitHub uses Ubuntu and Node 24.

## Commands and results

Ran in the required order. `CI=true` retained CI's one retry and default worker selection; the full suite used **6 workers**. Playwright started the production server on `http://127.0.0.1:3100` with its configured 70-second keep-alive. Chromium stayed headless.

| Command / step                                                                                         | Database        | Real result                                                                        |
| ------------------------------------------------------------------------------------------------------ | --------------- | ---------------------------------------------------------------------------------- |
| `docker compose stop app`                                                                              | Dev stack       | PASS; Docker app stopped and left stopped                                          |
| `npm run db:up`                                                                                        | Dev             | PASS; existing PostgreSQL healthy                                                  |
| `npm run db:deploy`                                                                                    | Dev             | PASS; 33 migrations found, none pending                                            |
| `npm run build`                                                                                        | Dev environment | PASS; production build and TypeScript completed                                    |
| `npm.cmd run test:e2e`                                                                                 | Dev             | PASS, exit 0: **138 passed, 1 flaky, 4 skipped, 0 failed**; 143 total, 3.9 minutes |
| `npx.cmd playwright test tests/e2e/reports-print.spec.ts tests/e2e/reports-period.spec.ts --workers=2` | Dev             | PASS: **14 passed**, 0 failed/flaky/skipped; 28.2 seconds                          |
| `docker compose -p ci35a up -d --wait db`, then `npm.cmd run db:deploy`                                | Fresh throwaway | PASS; all 33 migrations applied                                                    |
| Same two specs, `--workers=2`                                                                          | Fresh throwaway | PASS: **14 passed**, 0 failed/flaky/skipped; 22.6 seconds                          |
| Stop throwaway host server; `docker compose -p ci35a down --volumes`                                   | Throwaway only  | PASS; container, volume and network removed                                        |

The test commands additionally used `--output` and `--reporter` only to save artifacts under this report's artifact directory. Full-suite reporting was `github,json`; isolated reporting was `list,json`. An initial `npm.ps1` launch consumed those artifact options and was interrupted; it has no completed result and is excluded from the counts above. Its log is retained. The completed full run used `npm.cmd`.

## Which databases

- **Dev/demo data:** `cpoint-pms-db-1`, `localhost:5432/cpoint_pms`, existing persistent database. Initial snapshot: 275 rolls, 1,139 scans, 16 users. The full suite and dev isolated run used this database and left their normal test fixtures. It was never wiped or reset.
- **CI-like empty data:** new `ci35a-db-1`, `127.0.0.1:55435/cpoint_pms`, separate `ci35a_pgdata` volume; `DB_PORT=55435`, `APP_PORT=33135`. Only the Docker database service ran; the same production build ran on the host at `http://127.0.0.1:33135`. Both the app and tests received this separate database URL. `SEED_DEMO_USERS=true`, `SEED_DEMO_WEEK=false`, `DEMO_LOGIN_TOOLS=false`; no `demo:seed` or reset. After migrations: **0 rolls, 0 scans, 0 users**. After normal startup bootstrap, before testing: **0 rolls, 0 scans, 16 users**. After testing: **16 rolls, 0 scans, 16 users**.
- Dev counts immediately before and after the entire throwaway check were identical: **311 rolls, 1,179 scans, 59 users**. No throwaway containers or volumes remained, and ports 3100, 33135 and 55435 had no listeners at final verification.

## Each isolated test

Every row also passed without retry in the full suite. Each spec had **7 passed** in each isolated run. Line numbers refer to the tested working tree; print-header tests share a parameterized definition.

| Test                                                                             | Dev, 2 workers | Empty DB, 2 workers |
| -------------------------------------------------------------------------------- | -------------- | ------------------- |
| `reports-period:18` Day/Week/Month/Custom and CSV                                | PASS           | PASS                |
| `reports-period:47` Picker URL and preserved options                             | PASS           | PASS                |
| `reports-period:66` Future/invalid periods and range bound                       | PASS           | PASS                |
| `reports-period:88` Column sort both ways                                        | PASS           | PASS                |
| `reports-period:120` Rolls sort, leather-item/location controls and filtered CSV | PASS           | PASS                |
| `reports-period:158` Defect-card and supplier filters                            | PASS           | PASS                |
| `reports-period:194` Quality defect filter and CSV                               | PASS           | PASS                |
| `reports-print:25` Operations header/preparer/remarks/signatures                 | PASS           | PASS                |
| `reports-print:25` Quality header/preparer/remarks/signatures                    | PASS           | PASS                |
| `reports-print:25` Rolls header/preparer/remarks/signatures                      | PASS           | PASS                |
| `reports-print:25` Materials header/preparer/remarks/signatures                  | PASS           | PASS                |
| `reports-print:61` Repeating table header and unsplit rows                       | PASS           | PASS                |
| `reports-print:77` Empty remarks lines and white paper in dark mode              | PASS           | PASS                |
| `reports-print:94` Rolls printing beyond 15 rows                                 | PASS           | PASS                |

## Flaky observation and evidence

The full suite's Admin camera-settings test (`tests/e2e/admin.spec.ts:136`, click at line 156) timed out on its first attempt, then **passed on CI's configured retry**:

```text
Test timeout of 30000ms exceeded.
Error: locator.click: Test timeout of 30000ms exceeded.
waiting for getByRole('button', { name: 'Save', exact: true })
element is not enabled
at C:\dev\CPoint-PMS\tests\e2e\admin.spec.ts:156:67
```

Suspect for Claude's investigation: `tests/e2e/admin.spec.ts:156` and the Save button's enabled state; cause not established. No job remains failing. No test, timeout, check, application file or configuration was changed. The tracked working-tree diff hash matched before/after. `check`, `station`, and the Docker-image CI job were not rerun or independently declared passing. No branch, commit, push or PR was created.

Artifacts: [full-suite log](artifacts/2026-11-21-ci-recheck-feature-reports-by-period/05-full-e2e.log), [dev isolated log](artifacts/2026-11-21-ci-recheck-feature-reports-by-period/06-dev-isolated-e2e.log), [empty-database isolated log](artifacts/2026-11-21-ci-recheck-feature-reports-by-period/09-throwaway-e2e.log), and [machine-readable counts and per-test attempts](artifacts/2026-11-21-ci-recheck-feature-reports-by-period/results-summary.json). The same directory contains setup/build/cleanup logs, database snapshots, PDFs, retry trace, and the throwaway runner.

Recorded one CI re-check line under Agent sessions in the vault's `Daily/2026-11-21.md`. Dylan can commit and push Claude's changes so GitHub CI reruns.
