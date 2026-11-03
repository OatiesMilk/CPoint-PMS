# QA report: no unknown defect classes (D-108) and D-107 axe recheck

| Field     | Value                                          |
| --------- | ---------------------------------------------- |
| Date      | 2026-11-02 20:04 +08:00                        |
| Handoff   | `qa/handoffs/2026-11-02-no-unknown-classes.md` |
| Tested by | Codex                                          |
| Verdict   | **FAIL**                                       |

## 1. Summary

The D-108 migration, scan behavior, reports, Materials label, access check, unchanged saves, and CV checks passed. S3 failed: `GET /api/v1/defect-types/unknown` returns **405** instead of the required **404**; the focused and full e2e runs had zero failures.

Scenarios: **14 passed, 1 failed, 0 blocked, 15 total.**

## 2. Environment

| Item            | Value                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language                                                                                                  |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                                        |
| Branch / commit | `main` @ `2e63908` (working tree was already dirty with D-107/D-108 changes; QA did not change source, tests, config, or `.env`) |
| How the app ran | `npm run build`, then `PORT=3001 npm run start`                                                                                  |
| Base URL        | `http://127.0.0.1:3001`                                                                                                          |
| Database        | Docker `cpoint-pms-db-1`, seeded demo users and data; migration `20261103090000_no_unknown_classes` applied                      |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                                      |
| Viewport        | 1440 × 900                                                                                                                       |

## 3. Scenario results

| ID  | Scenario                                             | Result   | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Back up the database, record counts, apply migration | PASS     | Backup: `storage/backups/before-d108-2026-11-02.dump` (133,753 bytes; SHA-256 `F331D6FB2D4E328115EBF986BBD3E07E368C1D740C59E54E36E3F09B16BD626D`; `pg_restore --list` succeeded). Before: 11 unknown detections, 11 Reject scans with unknown detections, 108 Pass scans. After: no `isUnknownClass` column and 0 detections with null `defectTypeId`. See `artifacts/2026-11-02-no-unknown-classes/backup-manifest.txt`, `pre-migration-counts.txt`, and `post-migration-m1-m2.txt`. |
| M2  | Verify migration audit and count reconciliation      | PASS     | One audit row: 11 scans now Pass, 1 detection joined to a type, 10 deleted. `1 + 10 = 11`; `11 <= 11`; Pass scans rose from 108 to 119. See `migration-audit-after.json`.                                                                                                                                                                                                                                                                                                             |
| M3  | Re-run migration deploy                              | PASS     | `No pending migrations to apply.` See `m3-deploy.log`.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| S1  | Admin home has no unknown-class card/banner          | PASS     | Health, Users, Camera, Lunch break, and Audit log cards present. See `S1-admin-home.png`.                                                                                                                                                                                                                                                                                                                                                                                             |
| S2  | Defect type settings copy                            | PASS     | The unlisted-class note is present and the page contains no “unknown”. See `S2-defect-settings.png`.                                                                                                                                                                                                                                                                                                                                                                                  |
| S3  | Removed unknown endpoint                             | **FAIL** | `GET /api/v1/defect-types/unknown` returned **405**, expected **404**. See F1 and `S3-http-status.txt`.                                                                                                                                                                                                                                                                                                                                                                               |
| S4  | Unknown-only scan                                    | PASS     | `qa-no-type` at 0.95 returned 201 / PASS; no detection for that key was stored.                                                                                                                                                                                                                                                                                                                                                                                                       |
| S5  | Cut plus unlisted class                              | PASS     | Returned 201 / REJECT; only the `cut` detection was stored and it had a defect type.                                                                                                                                                                                                                                                                                                                                                                                                  |
| S6  | Open S5 scan from Reports → Rolls                    | PASS     | One red Reject-toned Cut box; no unknown text or “Unknown classes: Reject” line. See `S6-reject-scan.png` and `S6-check.json`.                                                                                                                                                                                                                                                                                                                                                        |
| S7  | Quality, Operations, and defects CSV                 | PASS     | No `(unknown)` rows; CSV has no “Known type” header.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| S8  | Materials week label                                 | PASS     | Shows **“Week 1: Nov. 2”**, followed by the updated per-100-pairs/days-left explanation; old wording is absent. See `S8-materials.png`.                                                                                                                                                                                                                                                                                                                                               |
| S9  | CV simulator, 10 scans                               | PASS     | Ten simulator scans recorded; all stored detections had types and none used `sim-unknown`. See `cv-simulate.log` and `manual-scan-verification.txt`. The QA device token was revoked afterward.                                                                                                                                                                                                                                                                                       |
| S10 | CV lint, typing, and unit checks                     | PASS     | `ruff check .`: all checks passed; `mypy cpoint_cv`: no issues in 18 files; `pytest`: 102 passed. Logs are `cv-ruff.log`, `cv-mypy.log`, and `cv-pytest.log`.                                                                                                                                                                                                                                                                                                                         |
| R1  | Unchanged schedule/lunch saves and axe recheck       | PASS     | Demo mode region visible; duplicate saves reported “Nothing changed” and added no rows. Unfiltered axe analysis (all rules and impacts) found 0 violations on both pages. See `R1-plan-axe.json`, `R1-lunch-axe.json`, `R1-plan.png`, and `R1-lunch.png`.                                                                                                                                                                                                                             |
| A1  | Floor Manager access to defect settings              | PASS     | Floor Manager received the Error 403 page. See `A1-manager-forbidden.png`.                                                                                                                                                                                                                                                                                                                                                                                                            |

The schedule, lunch, and quota rows were restored to the exact pre-e2e state: schedule 6/6, lunch 7/7, quota 3/3; no baseline rows were added, removed, or changed. See `schedule-lunch-quota-restore-check.txt`.

### Automated tests

| Command                                                                                                                                                                                  | Result                                        |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Focused: `npm.cmd run test:e2e -- --reporter=list --output=... tests/e2e/admin.spec.ts tests/e2e/cv.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/batches.spec.ts` | **32 passed, 0 failed, 0 skipped**            |
| Full: `npm.cmd run test:e2e -- --reporter=list --output=...`                                                                                                                             | **88 passed, 0 failed, 2 skipped** (90 total) |

The full-suite skips were the “demo tools with flag off” case (server has `DEMO_LOGIN_TOOLS=true`) and the “without the model files” case (model is installed here). The app health endpoint returned 200. Logs: `focused-e2e.log` and `full-e2e.log`.

## 4. Failures

### F1 — S3: removed endpoint returns 405 instead of 404

- **Severity:** Medium
- **Role / page:** API; `GET /api/v1/defect-types/unknown`
- **Steps to reproduce:** Send a GET request to `http://127.0.0.1:3001/api/v1/defect-types/unknown`.
- **Expected:** HTTP 404.
- **Actual:** HTTP 405 Method Not Allowed.
- **Evidence:** `artifacts/2026-11-02-no-unknown-classes/S3-http-status.txt`. The deleted static route falls through to `src/app/api/v1/defect-types/[id]/route.ts:3`, which exports PATCH only.
- **Suggested fix:** Make requests to this retired path resolve to 404 rather than the PATCH-only dynamic route.

## 5. Other observations

- The first build attempt hit a stale generated `.next/dev/types/validator.ts` reference to the removed route. After `npm run clean` removed generated build output, `npm run build` passed; see `build.log`.
- `npm run start` emitted Next.js’s warning that `next start` is not the recommended launcher with `output: standalone`; the server still became ready and served the e2e runs.
- No application code, tests, migration files, config, or `.env` were edited for QA. The report, QA artifacts, and requested backup were written to their designated locations; build and test commands also regenerated ignored local outputs.

## 6. Suggested fixes (priority order)

1. Fix F1 so `GET /api/v1/defect-types/unknown` responds 404 as specified.
