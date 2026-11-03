# QA report: no repeat schedule or lunch saves

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| Date      | 2026-11-02 19:25 (Asia/Shanghai)                     |
| Handoff   | `qa/handoffs/2026-11-02-no-repeat-schedule-saves.md` |
| Tested by | Codex                                                |
| Verdict   | **FAIL**                                             |

## 1. Summary

S1–S10 and access checks A1–A2 passed. The targeted batches spec passed 6/0/0 and the full e2e suite passed 88/0/2; the required axe scan failed because the pages have moderate landmark violations.

Scenarios: 12 passed, 1 failed, 0 blocked, 13 total.

## 2. Environment

| Item            | Value                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language, build 26200                                                        |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                           |
| Branch / commit | `main` @ `2e63908` (working tree not clean; D-107 changes were already present before QA)           |
| How the app ran | `npm run build`; `PORT=3001 npm run start`; Playwright started its own server on port 3100 for e2e  |
| Base URL        | `http://localhost:3001` for browser scenarios; e2e used `http://127.0.0.1:3100`                     |
| Database        | Docker `cpoint-pms-db-1`, existing demo data and demo sign-in enabled                               |
| Browser         | Playwright Chromium 153.0.8010.12, headless for automated tests; live preview in the in-app browser |
| Viewport        | 1440 × 900 for Playwright                                                                           |

`npx prisma migrate status` reported the database schema up to date. `npm run build` passed. The app health endpoint returned 200.

## 3. Scenario results

| ID  | Scenario                                        | Result | Notes / evidence                                                                                                                                     |
| --- | ----------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Save tomorrow’s unchanged schedule              | PASS   | Exact “Nothing changed” toast; schedule history remained at 2 rows.                                                                                  |
| S2  | Repeat unchanged schedule save three times      | PASS   | Same toast each time; history remained at 2 rows.                                                                                                    |
| S3  | Change interval, save, then save unchanged      | PASS   | Every 2 hours saved from Tue, 3 Nov with one new row; second save showed “Nothing changed” and added none. Restored every 4 hours afterward.         |
| S4  | Untick and re-tick Monday, then save            | PASS   | The Mon–Fri set showed “Nothing changed”; no history row added.                                                                                      |
| S5  | PUT exact current schedule through API          | PASS   | HTTP 200; `data.saved: false`; `effectiveFrom: 2026-11-03`.                                                                                          |
| S6  | Save unchanged lunch break                      | PASS   | Exact “Nothing changed” toast; lunch history remained at 1 row at that point.                                                                        |
| S7  | Change lunch, repeat, save no lunch, repeat     | PASS   | Real changes each added one row; both repeated saves showed “Nothing changed” and added none.                                                        |
| S8  | Filter audit log for schedule and lunch changes | PASS   | Four `production.schedule.set` and six `production.lunch.set` events after e2e and restoration, matching real saves; unchanged saves added no event. |
| S9  | Save lunch 06:00–07:00 outside the shift        | PASS   | Field showed “Lunch must be inside the shift (08:00 to 17:00).”; lunch history stayed at 4 rows during this check.                                   |
| S10 | Save unchanged quota                            | PASS   | “Nothing changed, so nothing was saved.”; quota history remained at 1 row at that point.                                                             |
| A1  | Quality Inspector PUT schedule                  | PASS   | HTTP 403.                                                                                                                                            |
| A2  | Floor Manager PUT lunch break                   | PASS   | HTTP 403.                                                                                                                                            |
| AXE | Axe after no-change toast on both pages         | FAIL   | `/batches/plan`: 2 moderate violations; `/admin/settings?tab=lunch`: 1 moderate violation. Details below.                                            |

### Existing automated tests run

| Command                                                                                                              | Result                         |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `npx playwright test tests/e2e/batches.spec.ts --output qa/reports/artifacts/2026-11-02-no-repeat-saves/batches-e2e` | 6 passed, 0 failed, 0 skipped  |
| `npm.cmd run test:e2e -- --output=qa/reports/artifacts/2026-11-02-no-repeat-saves/full-e2e`                          | 88 passed, 0 failed, 2 skipped |

The two skips had reasons: the “demo tools off” case was skipped because `DEMO_LOGIN_TOOLS=true`; the “without the model files” case was skipped because the model is installed.

## 4. Failures

### F1 — AXE: landmark violations on both tested pages

- **Severity:** Medium
- **Role / page:** Floor Manager `/batches/plan`; System Admin `/admin/settings?tab=lunch`
- **Steps to reproduce:** Sign in with the demo role, open each page, save the unchanged value, then run axe.
- **Expected:** 0 violations on both pages.
- **Actual:** `/batches/plan` reported `landmark-unique` for a `nav[aria-label="Pagination"]` because both history sections use that same landmark name, and `region` for the demo-mode banner outside any landmark. The lunch page reported the same `region` violation for the demo-mode banner.
- **Evidence:** `qa/reports/artifacts/2026-11-02-no-repeat-saves/axe-details.json`, `axe-batches-plan.png`, and `axe-lunch-settings.png`.
- **Suggested fix:** Give the schedule and quota pagination landmarks distinct names; place the demo-mode banner inside an appropriate page landmark.

## 5. Other observations

- The original effective settings were schedule 08:00–17:00 every 4 hours Monday–Friday, quota 128, and lunch 11:00–12:00. The full e2e suite changed them, so QA restored all three. Final values are back to the originals; append-only history now has 6 schedule rows, 3 quota rows, and 7 lunch rows. Evidence: `restored-after-e2e.json`, `restored-batches.png`, and `restored-lunch.png`.
- The first live-tab lunch save returned a generic server response error and redirected to sign-in without persisting a row. A fresh-session replay succeeded. For S9, the in-app browser’s `fill()` on time inputs displayed the new values without reliably updating the controlled form state; one trial therefore submitted the prior value. S9 was rerun in headless Playwright, which confirmed the expected field validation and unchanged history, and the original settings were restored. See `S7-lunch-save-success.json`, `S9-results.json`, and `S9-validation.png`.
- `next start` warned that it does not support the project’s `output: standalone` configuration and suggested `.next/standalone/server.js`; the app still served successfully and the e2e suite completed.
- The first full-suite launch attempt failed before test discovery because PowerShell’s `npm` shim consumed the `--output` argument. It was rerun successfully with `npm.cmd`; the unsuccessful invocation is preserved as `full-e2e-argument-error.log` and is not included in the e2e counts.
- QA changed no application code, tests, migrations, config, `package.json`, or `.env`.

## 6. Suggested fixes (priority order)

1. Fix the duplicate pagination landmark name and include the demo-mode banner within an appropriate landmark.
