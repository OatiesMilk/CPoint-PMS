# QA report for System Admin modules (D-119, run 2)

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Date      | 2026-11-06, 11:27–11:39 Manila            |
| Handoff   | `qa/handoffs/2026-11-06-admin-modules.md` |
| Prompt    | `qa/CODEX_PROMPT_ADMIN_MODULES_RUN2.md`   |
| Tested by | Codex                                     |
| Verdict   | **PASS**                                  |

## 1. Summary

The same-browser role switch now denies the Admin's first visit to the exact photo URL while the Floor Manager can still load the photo twice. The Early model notice names Capture, and the original enabled setting was restored and verified after reload. The auth spec passed, and all six full-suite timeouts passed on the prescribed isolated reruns.

Scenarios: **2 passed, 0 failed, 0 blocked, 2 total**.

## 2. Environment

| Item            | Value                                                                 |
| --------------- | --------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language                                       |
| Node / npm      | v25.2.1 / 11.7.0                                                      |
| Branch / commit | `main` @ `12448b5`, with uncommitted D-119 fixes                      |
| How the app ran | Restarted `npm run dev` with Next.js 16.3.8 before R1                 |
| Base URL        | `http://localhost:3000` via `E2E_BASE_URL` for Playwright             |
| Database        | Healthy Docker Postgres `cpoint-pms-db-1` with the run 1 roll fixture |
| Browser         | Codex in-app browser and headless Playwright 1.63.0 Chromium          |
| Time gate       | Started at 11:27 Manila, after 01:00                                  |

## 3. Scenario results

| ID  | Scenario                                                        | Result   | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Recheck run 1's F1 after the Floor Manager to Admin role switch | **PASS** | Floor Manager opened LR-MLT-003 Section #1 twice. The 480 × 360 photo rendered both times. After sign-out and Admin sign-in in the same tab, the first visit to the exact image URL showed `FORBIDDEN` without a photo. Headless Chromium reproduced status 403 with zero visible image width. `R1-iab.json`, `R1-fm-first-load.jpg`, `R1-fm-second-load.jpg`, `R1-admin-first-load.jpg`, `A1-cache-repro.json`. |
| R2  | Settings → Thresholds → Early model notice                      | **PASS** | The checkbox read “Show ‘Early model’ on Capture” and the help text referred to constructors on Capture. The off save produced “The early-model notice is off.” The restore toast read “Capture now says the model is an early one.” Reload confirmed the original checked setting. `R2-notice.json`, `R2-notice-off.jpg`, `R2-notice-restored.jpg`.                                                             |

### R1 response evidence

The image path was `/api/v1/scans/01a1ae64-e9f3-7602-b43d-a0ea8c973dce/image`.

| Observation                                                          | Result                                                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Floor Manager first image request                                    | 200                                                                                |
| Floor Manager response headers                                       | `Cache-Control: private, no-cache`, `ETag: "01a1ae64-e9f3-7602-b43d-a0ea8c973dce"` |
| Floor Manager second section visit                                   | 304 in the dev server log, with the photo visible at 480 × 360                     |
| Floor Manager matching `If-None-Match` request in the headless repro | 304                                                                                |
| First Admin image navigation after the role switch                   | 403 in both browser runs, with no photo                                            |
| Headless fresh Admin API request and reload                          | 403 each                                                                           |

The run 1 headless repro was copied into this run's artifact directory and extended to record the ETag, conditional response, and second photo dimensions. The server log excerpt in `R1-image-requests.txt` records the in-app sequence of 200, 304, and 403 before the headless requests.

### Automated tests

Counts are passed / failed / skipped. Playwright output directories are under this run's artifact folder.

| Command                                                  | Result                                             | Evidence                           |
| -------------------------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| `npx playwright test tests/e2e/auth.spec.ts --workers=1` | **21 / 0 / 1**                                     | `auth-single-worker.log`           |
| `npm run test:e2e`                                       | **93 / 6 / 2**, plus **1 did not run** (102 total) | `full-e2e.log`, `playwright/full/` |
| Isolated `admin.spec.ts`                                 | **6 / 0 / 0**                                      | `admin-rerun.log`                  |
| Isolated `inventory.spec.ts`                             | **8 / 0 / 0**                                      | `inventory-rerun.log`              |
| Isolated `reports.spec.ts`                               | **3 / 0 / 0**                                      | `reports-rerun.log`                |
| Isolated `returns.spec.ts`                               | **4 / 0 / 0**                                      | `returns-rerun.log`                |
| Isolated `rolls.spec.ts`                                 | **6 / 0 / 0**                                      | `rolls-rerun.log`                  |

The five isolated reruns total **27 / 0 / 0**. The full-suite counts above retain the original failures. Artifact filenames are relative to `qa/reports/artifacts/2026-11-06-admin-modules-run2/`.

## 4. Failures

| Full-suite test                                          | Initial result                                        | Isolated result |
| -------------------------------------------------------- | ----------------------------------------------------- | --------------- |
| `admin.spec.ts:136`, camera found-at settings            | 30-second timeout                                     | Passed          |
| `admin.spec.ts:216`, deactivated supplier                | 30-second timeout during reload                       | Passed          |
| `inventory.spec.ts:336`, inventory role access           | 30-second timeout before QI reached Batches           | Passed          |
| `reports.spec.ts:80`, quality report counts and CSV      | 30-second timeout navigating to the quality report    | Passed          |
| `returns.spec.ts:121`, over-limit roll and claim sheet   | 30-second timeout waiting for the claim sheet heading | Passed          |
| `rolls.spec.ts:28`, finished roll details and tag search | 30-second timeout                                     | Passed          |

The full run's `admin.spec.ts:177` test did not run following the earlier camera settings timeout. It passed on the isolated admin run. The D-119 auth test passed in both required runs.

## 5. Other observations

The existing demo-mode-disabled auth test was skipped with demo mode enabled. The full suite also skipped the missing-model case because the model was present.

## 6. Suggested fixes

None from this run.
