# QA report: Overview clean-up (D-131), run 1

| Field     | Value                                        |
| --------- | -------------------------------------------- |
| Date      | 2026-11-21 13:09 +08:00 (Asia/Shanghai)      |
| Handoff   | `qa/handoffs/2026-11-21-overview-cleanup.md` |
| Tested by | Codex                                        |
| Verdict   | **BLOCKED**                                  |

## 1. Summary

The Overview layout and role restrictions were checked in the visible in-app browser; the targeted and full Playwright suites both exited 0 with no failed tests. Seven manual scenarios remain blocked because the Demo clock control returned HTTP 200 but kept the app on Saturday, 21 Nov, so the due-row and planned-weekday cases could not be set up. Required screenshots were not saved: O2 and O4 were displayed in the visible browser tool, while O1's target clock state could not be reached.

Scenarios: 3 passed, 0 failed, 7 blocked, 10 total.

## 2. Environment

| Item            | Value                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| OS              | Windows                                                                                                      |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                    |
| Branch / commit | `main` @ `68f3c21` (dirty with the uncommitted D-131 changes described by the handoff; QA did not edit them) |
| How the app ran | Fresh `npm run dev`; Docker app stopped; Docker database running                                             |
| Base URL        | `http://localhost:3000`                                                                                      |
| Database        | Docker `db`; 33 migrations, none pending; reset to the demo week before manual checks and again after E2E    |
| Browser         | Visible ChatGPT in-app browser for manual checks; Playwright 1.63.0 Chromium headless for E2E                |
| Viewports       | Manual: 1280, 1536, 768 and 700 px widths; E2E specifies its own sizes                                       |

Setup evidence: `db-deploy.log` reports “No pending migrations to apply.” `/api/health` returned `{"status":"ok","checks":{"app":"up","database":"up"},"version":"dev"}` after the final reset. The final reset seeded 250 rolls, 1,139 scans, 10 attendance days, 19 check-ins and 4 stock updates; it exited 0 in 128 seconds. The clock was verified as Real time afterward. Quality Inspector attendance was not manually changed.

## 3. Scenario results

| ID  | Scenario                                                                         | Result  | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Floor Manager plan row, other-page banner and bell on a future unplanned weekday | BLOCKED | Clock set to 2026-11-25 09:00 did not take effect. On Sat 21 Nov the Overview had no Plan today row; `/batches` said “Saturdays and Sundays have no batches.” and “Today isn’t a working day, so there are no batches.” `/attendance` and `/reports` showed no plan banner. No accessible bell button was present; the page exposed only a “Notifications alt+T” region, and Alt+T did not open a notification panel.                                                                   |
| O2  | Real-time no-attention layout at 1280 and 1536                                   | BLOCKED | Required weekday/planned-day precondition was not met (real date was Sat 21 Nov). Layout measurement still showed no Needs attention region and aligned top cards: at 1280 both top cards y=177.4, h=306; at 1536 both y=177.4, h=266. In-app screenshot was emitted, not saved to disk.                                                                                                                                                                                                |
| O3  | Two Needs attention rows and primary/outlined button hierarchy                   | BLOCKED | Could not set a future Wednesday/Friday. The area had no due rows. `overview-layout.spec.ts` also skipped its conditional one-primary test because nothing was due.                                                                                                                                                                                                                                                                                                                     |
| O4  | Lower-card layout at 1280, 1536 and 700                                          | PASS    | At 1280 the cards were two by two: first pair y=515.4/h=270, second pair y=801.4/h=286. At 1536 all four shared y=475.4/h=330. At 700 they stacked in one column; main scrollWidth equaled clientWidth. Daily summary Reports and Download 14-day CSV were at the card footer. A light-theme screenshot was emitted in the in-app browser but not saved as a file.                                                                                                                      |
| O5  | Quiet weekday states for WIP, attendance, rolls and low stock                    | BLOCKED | Could not set a future weekday. On Saturday, stages showed “–” and “No stage has been counted today.”; Attendance showed “Not taken yet today.” and an outlined Take attendance action; Rolls showed “No roll finished at Capture yet today.”, 0 scanned, 0 returned, 1 still open. WIP still showed “17 pairs in repair. 1 batch and 1 repair waiting for inspection.” The low-stock item was Contact cement, 3 cans · reorder at 4.                                                   |
| O6  | Due-batch banner at 17:05 with the Quality Inspector absent                      | BLOCKED | Could not set a planned weekday at 17:05; no absence was recorded manually. The test did not reach the due-batch banner state.                                                                                                                                                                                                                                                                                                                                                          |
| O7  | Quality Inspector and System Admin pages on an unplanned weekday                 | BLOCKED | Role pages were observed on Saturday, not a future unplanned weekday. QI Today showed “Today isn’t a working day, so there are no batches.”; it did not show the expected weekday copy. The System Admin home remained its “System overview” page; its Batches Today route returned 403, so the weekday tab could not be inspected as Admin. Neither role saw the Overview action zone or plan banner.                                                                                  |
| O8  | Dark theme, 768 px, tab order and accessibility                                  | BLOCKED | At 768 dark theme, lower cards were two columns and document scrollWidth equaled clientWidth (753/753); text was readable in the browser. Tab order from Today’s batches Open continued to Work in progress Open, Take attendance, Rolls, Inventory, Contact cement, Reports, then Download 14-day CSV. Due-row buttons and the hidden Needs attention heading could not be checked because no rows were due. `window.axe` was unavailable in the manual tab; the E2E axe check passed. |
| O9  | Targeted E2E files and full suite                                                | PASS    | Targeted: 34 passed, 0 failed, 2 skipped of 36; exit 0. Full: 121 passed, 0 failed, 4 skipped of 125; exit 0. See the two logs under `qa/reports/artifacts/2026-11-21-overview-cleanup/`.                                                                                                                                                                                                                                                                                               |
| A1  | Quality Inspector, Shoe Constructor and System Admin denied `/floor-manager`     | PASS    | Each role received `/forbidden` with “Error 403” and “You don’t have access to that page.” QI and Constructor were directed to their own workspaces; Admin was told the page belongs to another role’s workspace.                                                                                                                                                                                                                                                                       |

### E2E runs

| Command                                                                                                                                                                                                      | Result                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `npx playwright test tests/e2e/overview-layout.spec.ts tests/e2e/batches.spec.ts tests/e2e/stage-wip.spec.ts tests/e2e/reports.spec.ts tests/e2e/inventory.spec.ts tests/e2e/attendance.spec.ts --workers=2` | 34 passed, 0 failed, 2 skipped / 36; exit 0 (`targeted-e2e.log`) |
| `npx playwright test --workers=2`                                                                                                                                                                            | 121 passed, 0 failed, 4 skipped / 125; exit 0 (`full-e2e.log`)   |

Skip reasons: the batch no-plan case skipped on Saturday (“The notice only shows on a weekday.”); the Overview primary-button case skipped because no row was due (“Nothing is due today, so the zone isn’t shown.”). The full suite additionally skipped the demo-tools-off case because `DEMO_LOGIN_TOOLS=true`, and the missing-model case because the model files are installed. No Playwright test failed.

## 4. Failures and blocks

### O1, O3, O5, O6 — Demo clock did not advance

- **Severity:** High for the blocked high-priority scenarios; Medium for O5/O6
- **Role / page:** Floor Manager; Overview, Batches and Attendance
- **Steps to reproduce:** Open Demo mode → Change time; fill Date (Manila) `2026-11-25` and Time `09:00`; click Set clock. Repeated with the same values, and then returned to Real time.
- **Expected:** The app clock moves to Wed 25 Nov 2026 at 09:00 and the future unplanned weekday data loads.
- **Actual:** The form closed and the app logged `POST /api/v1/demo/clock 200`, but the clock banner stayed on Sat 21 Nov 2026 around 12:40. A direct GET of `/api/v1/production/today` returned `day:"2026-11-21"`, `dayLabel:"Sat, 21 Nov"`, `workingDay:false`, `plan:null`, and `planNeeded:false`. The Overview continued to say “Today isn’t a working day.”
- **Evidence:** `dev-server.log` contains successful `/api/v1/demo/clock` POSTs; the production API response was observed in the in-app browser. No error response or exception was returned.
- **Suggested fix:** Inspect the Demo clock form submission/state propagation and confirm the submitted Manila date/time is persisted and used by page/API reads.

### O2 — Weekday precondition unavailable

- **Severity:** High
- **Role / page:** Floor Manager Overview
- **Steps to reproduce:** View the page in real time at 1280 and 1536 px.
- **Expected:** Real-time weekday with a plan and no stock update due, or a day with both rows saved.
- **Actual:** Real time was Sat 21 Nov. The no-attention layout and equal top-card geometry were measurable, but the requested weekday condition could not be verified.
- **Evidence:** In-app browser DOM measurements in the session; no screenshot file was saved.

### O7, O8 — Date-dependent role and alert-row checks unavailable

- **Severity:** Medium
- **Role / page:** Quality Inspector, System Admin and Floor Manager
- **Steps to reproduce:** Open each requested role page and Batches Today; at 768 px inspect theme, keyboard order, and the Needs attention region.
- **Expected:** Unplanned-weekday QI copy and the due-row button/heading behavior.
- **Actual:** QI and FM were on Saturday; Admin was refused Batches with 403. No due rows existed, so O8's alert row button order, hidden region heading and blue info rows could not be observed. The remaining dark-mode layout and tab sequence passed the observed checks.
- **Evidence:** In-app browser snapshots; `overview-layout.spec.ts` passed its automated axe/no-sideways-scroll test in the full suite.

## 5. Other observations

- Screenshot requirement incomplete: O2 and O4 screenshots were emitted in the visible in-app browser output; O1's intended clock state could not be reached. This session exposed no save-to-file path for CUA screenshots, so no O1/O2/O4 PNG or JPG was saved under `qa/reports/artifacts/2026-11-21-overview-cleanup/`.
- The manual alert “bell” could not be located in the page's accessible controls. The browser snapshot exposed a “Notifications alt+T” live region, not a bell button; Alt+T did not change the page state.
- `demo:reset` printed a PostgreSQL client deprecation warning: “Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.” Reset still completed successfully.
- No application code, tests, migrations, configuration, `package.json` or `.env` were changed by QA. The worktree remains dirty with the uncommitted D-131 changes from the handoff.

## 6. Suggested fixes (priority order)

1. Restore or repair Demo clock behavior so date-dependent manual scenarios can be rerun.
2. Rerun O1, O3, O5, O6 and the weekday-dependent portions of O2/O7/O8 after the clock works; capture O1/O2/O4 screenshots as files in the required artifacts directory.
3. Confirm the intended bell/notification entry point for O1 if it is not exposed by the current accessible page controls.
