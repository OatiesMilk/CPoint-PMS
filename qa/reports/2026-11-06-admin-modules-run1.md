# QA report: System Admin reaches only the administration modules (D-119, run 1)

| Field     | Value                                     |
| --------- | ----------------------------------------- |
| Date      | 2026-11-06, 10:05–10:25 Manila            |
| Handoff   | `qa/handoffs/2026-11-06-admin-modules.md` |
| Prompt    | `qa/CODEX_PROMPT_ADMIN_MODULES.md`        |
| Tested by | Codex                                     |
| Verdict   | **FAIL**                                  |

## 1. Summary

The Admin navigation, overview, removed Camera route, retained settings, Floor Manager photos, and accessibility checks passed. A1 failed: a fresh request for the shot image as Admin returned 403, but the same browser displayed a previously loaded Floor Manager photo from cache after signing out and switching to Admin. The auth spec passed; all eight full-suite timeouts passed when their specs ran alone.

Scenarios and access checks: **9 passed, 1 failed, 0 blocked, 10 total**.

## 2. Environment

| Item            | Value                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language                                                                       |
| Node / npm      | v25.2.1 / 11.7.0                                                                                      |
| Branch / commit | `main` @ `12448b5` (expected uncommitted D-119 changes)                                               |
| How the app ran | Existing `npm run dev`; health endpoint reported app and database up                                  |
| Base URL        | `http://localhost:3000`; all e2e commands used `E2E_BASE_URL`                                         |
| Database        | Healthy Docker Postgres `cpoint-pms-db-1` with demo accounts and rolls; no app container              |
| Browser         | Codex in-app browser for manual scenarios; Playwright 1.63.0 Chromium, headless, for automated checks |
| Viewport        | S1 at 1440 × 900 and 390 × 844; normal viewport restored                                              |
| Time gate       | Started at 10:05 Manila, after 01:00                                                                  |

## 3. Scenario results

| ID  | Scenario                                     | Result   | Notes / evidence                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Admin navigation at 1440 px and 390 px       | PASS     | Exactly Overview, Users, Settings, API tokens, Audit log on desktop and in the phone's Pages menu. `S1-desktop.jpg`, `S1-mobile.jpg`, `S1-navigation.json`.                                                                                                            |
| S2  | Admin overview cards and token link          | PASS     | System health, Users, Lunch break, Audit log; no Camera card. Camera API tokens opened `/admin/tokens`. `S2-overview.jpg`.                                                                                                                                             |
| S3  | Admin opens `/camera`                        | PASS     | The 404 page displayed “This page doesn’t exist.” The auth spec confirmed HTTP 404. `S3-camera-404.jpg`.                                                                                                                                                               |
| S4  | Turn May capture off and restore it          | PASS     | Demo Constructor started with camera access enabled. Removal and restoration each showed a success toast; Camera badge was present afterward. `S4-may-capture-off.jpg`, `S4-may-capture-restored.jpg`.                                                                 |
| S5  | Save and restore early-model notice          | PASS     | Started checked; both off and on saves showed success toasts. Reload confirmed the original checked setting. `S5-notice-off.jpg`, `S5-notice-restored.jpg`.                                                                                                            |
| S6  | Floor Manager section and claim sheet photo  | PASS     | Roll LR-MLT-003, shot #1. The same image loaded at 480 × 360 on the section page and claim sheet. `S6-section-photo.jpg`, `S6-claim-sheet.jpg`, `S6-photo-evidence.json`.                                                                                              |
| S7  | Axe on `/admin`                              | PASS     | 0 violations (WCAG 2.1 A/AA rules) in a separate headless check at 1440 × 900. `S7-axe.json`.                                                                                                                                                                          |
| A1  | Admin requests the S6 shot image             | **FAIL** | Fresh API request: **403 FORBIDDEN**. After the Floor Manager viewed the same photo and signed out, direct navigation as Admin displayed the cached 480 × 360 image. Reproduced in headless Chromium: status 200, zero bytes transferred; reload returned 403. See F1. |
| A2  | Admin opens `/camera/capture`                | PASS     | Redirected to `/forbidden`; the page identified System Admin as the denied role. `A2-capture-forbidden.jpg`.                                                                                                                                                           |
| A3  | Floor Manager and Constructor open `/camera` | PASS     | Both signed-in roles got the 404 page. `A3-manager-camera-404.jpg`, `A3-constructor-camera-404.jpg`.                                                                                                                                                                   |

Artifact filenames above are relative to `qa/reports/artifacts/2026-11-06-admin-modules-run1/`.

### Automated tests

Counts are passed / failed / skipped. Playwright output was routed into the report's artifact directory.

| Command                                                  | Result                                             | Artifact                           |
| -------------------------------------------------------- | -------------------------------------------------- | ---------------------------------- |
| `npx playwright test tests/e2e/auth.spec.ts --workers=1` | **21 / 0 / 1**                                     | `auth-single-worker.log`           |
| `npm run test:e2e`                                       | **91 / 8 / 2**, plus **1 did not run** (102 total) | `full-e2e.log`, `playwright/full/` |
| `npx playwright test tests/e2e/admin.spec.ts`            | **6 / 0 / 0**                                      | `admin-rerun.log`                  |
| `npx playwright test tests/e2e/inventory.spec.ts`        | **8 / 0 / 0**                                      | `inventory-rerun.log`              |
| `npx playwright test tests/e2e/reports.spec.ts`          | **3 / 0 / 0**                                      | `reports-rerun.log`                |
| `npx playwright test tests/e2e/returns.spec.ts`          | **4 / 0 / 0**                                      | `returns-rerun.log`                |
| `npx playwright test tests/e2e/rolls.spec.ts`            | **6 / 0 / 0**                                      | `rolls-rerun.log`                  |
| `npx playwright test tests/e2e/smoke.spec.ts`            | **10 / 0 / 0**                                     | `smoke-rerun.log`                  |

Six isolated reruns total **37 / 0 / 0**. Each of the eight full-suite failures reported a 30-second timeout and passed alone:

| Full-suite test                                      | Where the timeout occurred                    | Isolated result |
| ---------------------------------------------------- | --------------------------------------------- | --------------- |
| `admin.spec.ts:136`, found-at setting                | Camera settings / scan fixture workflow       | Passed          |
| `admin.spec.ts:216`, deactivated supplier            | Page reload aborted                           | Passed          |
| `inventory.spec.ts:267`, leather roll areas          | Stock roll workflow                           | Passed          |
| `inventory.spec.ts:336`, inventory role restrictions | QI sign-in had not reached Batches            | Passed          |
| `reports.spec.ts:80`, quality report and CSV         | Manager sign-in had not reached the home page | Passed          |
| `returns.spec.ts:121`, over-limit roll               | Finish roll verdict had not appeared          | Passed          |
| `rolls.spec.ts:28`, finished roll and tag search     | Find filter navigation had not completed      | Passed          |
| `smoke.spec.ts:151`, rejected section from roll      | Back-to-roll link had not appeared            | Passed          |

The full run's `admin.spec.ts:177` test did not run following the earlier camera settings timeout; it passed in the isolated admin run. The D-119 auth test passed in both required runs. Its image assertion uses a fresh API request with a well-formed fixture ID, which does not cover reuse of an already cached photo.

## 4. Failures

### F1 — A1: Admin can display a Floor Manager photo cached before role switch

- **Severity:** Critical (a role can view a photo it must not see).
- **Role / page:** Floor Manager → sign out → System Admin, in the same browser profile. `GET /api/v1/scans/01a1ae64-e9f3-7602-b43d-a0ea8c973dce/image`.
- **Steps to reproduce:** 1. Sign in as Floor Manager and open LR-MLT-003, Section #1, so the photo loads. 2. Sign out. 3. Sign in as System Admin in the same browser profile. 4. Navigate directly to the exact image URL.
- **Expected:** Admin receives 403 and the photo is not displayed.
- **Actual:** The in-app browser displayed the previously cached 480 × 360 photo. A reload displayed `FORBIDDEN`. An independent headless reproduction with the same role switch recorded status 200 for the cached navigation, zero transferred bytes, and an image with natural width 480. A fresh Admin API request and a reload each returned 403.
- **Evidence:** `A1-image-visible-after-role-switch.jpg`, `A1-forbidden-after-reload.jpg`, `A1-http-status.json`, `A1-cache-repro.json`, `A1-cache-repro.cjs`.
- **Suggested fix:** In `src/server/controllers/scan.controller.ts:84`, prevent browser reuse of protected photos across sessions. The Floor Manager response advertises `Cache-Control: private, max-age=86400, immutable` and does not vary by session cookie. A `private, no-store` policy would make each image load go through authorization. Add coverage that primes the cache with an actual Floor Manager photo, switches roles in the same browser context, and opens the exact URL.

This finding requires a previously loaded photo in the same browser profile. The server rejected a fresh Admin request; the reproduced exposure was via the browser cache.

## 5. Other observations

- The early-model notice label, help text, and restore toast still refer to the removed Camera page. Both saves succeeded; the stale wording did not block S5.
- Existing conditional skips were the no-model capture check (model present) and the demo-mode-disabled auth check (demo mode enabled).
- The first full-suite launch did not execute tests because the PowerShell npm wrapper consumed the output argument separator. The corrected npm invocation scheduled 102 cases with output under the artifact directory. The launch log is preserved separately.
- Source, tests, configuration, and migrations were unchanged by QA. The original May capture and early-model notice values and the normal browser viewport were restored.

## 6. Suggested fixes (priority order)

1. Prevent reuse of cached scan photos across roles and verify the same-browser role-switch case.
2. Update the early-model notice wording to refer to Capture.
