# QA report: Overview clean-up (D-131), run 2

| Field     | Value                                        |
| --------- | -------------------------------------------- |
| Date      | 2026-11-21 13:27 +08:00 (Asia/Shanghai)      |
| Handoff   | `qa/handoffs/2026-11-21-overview-cleanup.md` |
| Prompt    | `qa/CODEX_PROMPT_OVERVIEW_CLEANUP_RUN2.md`   |
| Tested by | Codex                                        |
| Verdict   | **PASS WITH ISSUES**                         |

## 1. Summary

The headless Playwright clock form worked: its POST contained `{"date":"2026-11-25","time":"09:00"}`, the band showed **Wed, 25 Nov 2026 · 09:00**, and `GET /api/v1/production/today` returned `day:"2026-11-25"`. No direct clock-API fallback was needed. O1, O2, O3, O6, O7 and O8 passed; the missing O1/O2/O4 screenshots are now saved as PNGs.

O5 is **partially checked / BLOCKED by fixture data**, not a confirmed application defect: a fresh demo reset deliberately leaves open repairs, work waiting for inspection, and one roll open at Capture. Moving to a future weekday clears that day's counts but does not clear those outstanding items. Consequently the exact zero-repairs / zero-open-roll branches cannot be verified with this fixture. The script's two literal empty-state assertions failed and are retained in the evidence; they are not counted as application failures because their empty-data preconditions were absent.

Run-2 scope: **7 passed, 0 application failures, 1 partially blocked, 8 scenarios** (seven requested reruns plus O4 screenshot/layout evidence). Including the explicitly carried-forward O9 and A1: **9 passed, 0 failed, 1 blocked, 10 total**. This is not a full acceptance pass while O5's empty-data branches remain uncovered.

## 2. Environment

| Item            | Value                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows                                                                                                                     |
| Node / npm      | v25.2.1 / 11.7.0                                                                                                            |
| Branch / commit | `main` @ `68f3c21`; pre-existing uncommitted Overview changes                                                               |
| How the app ran | Fresh `npm run dev`, Next.js 16.3.8; existing dev process replaced; Docker app remained stopped                             |
| Base URL        | `http://localhost:3000`                                                                                                     |
| Database        | Healthy Docker `cpoint-pms-db-1`; demo reset before and after checks                                                        |
| Browser         | Playwright 1.63.0, Chromium 153.0.8010.12, headless                                                                         |
| Viewports       | 1280 × 1000, 1536 × 1000, 768 × 1000, 700 × 1000; screenshots full page                                                     |
| Accessibility   | Installed `@axe-core/playwright` 4.13.0; WCAG 2 A/AA and 2.1 A/AA; no exclusions                                            |
| Writes          | QA report/artifacts and one Daily Agent sessions line only; clock, stock-save and attendance changes removed by final reset |

All artifact names below are relative to `qa/reports/artifacts/2026-11-21-overview-cleanup/`. The QA-only script is `run2-browser.cjs`; raw browser/API observations and assertion results are retained in JSON and matching logs. A pre-reset database backup and baseline file hashes were saved there. No visible Chrome window was opened. The optional visible in-app-browser check was not used, as the run-2 prompt requires script evidence.

## 3. Scenario results

| ID  | Scenario                                                         | Result                         | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O1  | Future unplanned weekday: Overview row, other-page banners, bell | **PASS**                       | Wed 25 Nov 09:00 verified in band and API. Plan today was the first main-content card below the greeting; one Plan today heading and one action link styled as a button. No Overview plan banner. Today's batches said “Nothing to count until today is planned.” with no plan action. `/batches`, `/attendance`, `/reports` retained the full plan banner. Bell accessible name and both menu items matched exactly. `run2-unplanned.json`, `run2-O1-unplanned-1280-light.png`, `run2-O1-bell-1280-light.png`.                                                                                                                                                                                   |
| O2  | Planned weekday, no attention zone, aligned top cards            | **PASS**                       | Real date was Saturday, so used seeded Fri 20 Nov 09:00, a planned day with a saved stock update. Neither due row nor Needs attention existed; first top cards followed the header with normal spacing. At 1280 both top cards y=177.41, h=274; at 1536 both y=177.41, h=234. `run2-planned.json`, `run2-O2-planned-1280-light.png`, `run2-O2-planned-1536-light.png`.                                                                                                                                                                                                                                                                                                                            |
| O3  | Due-row order and filled/outlined actions                        | **PASS**                       | On Wed 25 Nov both rows appeared in DOM/reading order: Plan today, Stock update today. Exactly one primary action: Plan today filled, Update stock outlined. After saving one stock update through the signed-in public API (Contact cement +1), Stock update today disappeared and the remaining Plan today action stayed filled. The final reset removes this stock change. `run2-unplanned.json`, `run2-resume.json`, `run2-O3-plan-only-after-stock-save.png`.                                                                                                                                                                                                                                |
| O4  | Lower-card screenshot/layout evidence                            | **PASS**                       | Captured at Real time. 1280: two equal-height pairs (first y=515.41/h=270; second y=801.41/h=286). 1536: four cards in one row, y=475.41/h=310. 700: one column; 768: two columns. Daily summary footer sat at its bottom content edge, 21 px inside the card border (20 px padding + 1 px border). No sideways overflow. `run2-real.json`, `run2-O4-real-1280-light.png` and the 1536/700/768 variants.                                                                                                                                                                                                                                                                                          |
| O5  | Future-weekday quiet states                                      | **BLOCKED (partial)**          | All four stages displayed “–” plus screen-reader text “not counted today”; exactly one muted “No stage has been counted today.” Attendance said “Not taken yet today.” with outlined Take attendance. Rolls showed the correct no-finished-roll sentence and 0 scanned / 0 returned, but 1 still open. WIP showed “17 pairs in repair. 1 batch and 1 repair waiting for inspection.” rather than the required empty footer. Low stock checked as seeded: Contact cement, 3 cans · reorder at 4. Cards kept their size and did not overlap. Empty repairs/open-roll branches require a different fixture; see F1. `run2-unplanned.json`, `run2-unplanned.log`, `run2-O1-unplanned-1280-light.png`. |
| O6  | Covering manager's due-batch banner                              | **PASS**                       | Read-only seed inspection found unfinished `B-261117-2`. At Tue 17 Nov 17:05, marked the QI absent through Attendance and verified the saved API state. Overview showed “B-261117-2 is due. Finish it now.”, **Finish B-261117-2**, and Not now. Banner y=77/h=78, greeting y=187: banner above title. No plan banner; manager `canEnter:true`. Restored QI present through Attendance and verified it in API before returning to Real time. `run2-due-retry.json`, `run2-O6-due-1280-light.png`.                                                                                                                                                                                                 |
| O7  | Unplanned-weekday QI Today and Admin home                        | **PASS**                       | QI Batches → Today showed “No batches yet today. The Floor Manager plans them first.” on API-confirmed 25 Nov. Admin home showed System overview; no Admin Batches navigation was attempted. Neither page showed a plan banner or Needs attention. `run2-qi.json`, Admin check in `run2-resume.json`, `run2-O7-inspector-today.png`, `run2-O7-admin-home.png`.                                                                                                                                                                                                                                                                                                                                    |
| O8  | Themes, 768 px, keyboard, accessibility                          | **PASS**                       | Both light and dark blue alert rows were readable in screenshots. At 768, scrollWidth=clientWidth=768 and lower cards remained two columns. Needs attention was a labelled region with an `sr-only` heading; card titles were visible headings. Actual keyboard order and both axe scans passed; details below. `run2-resume.json`, `run2-O8-768-light.png`, `run2-O8-768-dark.png`.                                                                                                                                                                                                                                                                                                              |
| O9  | Targeted and full E2E suites                                     | **PASS — run 1, not repeated** | Per run-2 instruction: no E2E rerun. Run 1 recorded targeted 34 passed/2 skipped, full 121 passed/4 skipped, zero failed. See `2026-11-21-overview-cleanup-run1.md` and its `targeted-e2e.log` / `full-e2e.log`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| A1  | Other roles denied Floor Manager Overview                        | **PASS — run 1, not repeated** | Outside run-2 rerun scope. Run 1 recorded QI, Constructor and Admin receiving Forbidden at `/floor-manager`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Bell and accessibility evidence

The visible bell was `data-testid="batch-bell"`, accessible name **“Notices: today has no plan, stock update due”**. Its menu items were:

- “Today has no plan yet. Plan today.”
- “Stock update today. Update stock.”

Keyboard focus, starting at Plan today and advancing with Tab, followed **Plan today → Update stock → Today's batches Open → Work in progress Open → Take attendance → Rolls → Inventory → Contact cement → Reports → Download 14-day CSV**. Both light and dark 768-px axe scans returned **zero violations**, including zero serious/critical findings. The dark theme was activated through the sidebar switch using keyboard focus and Enter.

### Execution records

| Command / harness mode                                            | Result                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run demo:reset '--' --yes` before checks                     | Exit 0; 145 s; 250 rolls, 1,139 scans, 10 attendance days, 19 check-ins, 4 stock updates. `demo-reset-run2-before.log`.                                                                                 |
| `node <artifact-dir>/run2-browser.cjs unplanned`                  | O1 and initial O3 passed; O5 exact empty-data assertions failed as described in F1; stopped on the Next.js dev-indicator interception of the theme click. Original JSON/log preserved.                  |
| `node <artifact-dir>/run2-browser.cjs resume`                     | Continued remaining checks at the same Wednesday setting; O8, Admin and stock-save branch passed. Initial QI attempt used an incorrect harness locator (`role=tab`), recorded as a timeout.             |
| `node <artifact-dir>/run2-browser.cjs qi`                         | QI check passed using the existing `tab-today` link's test ID. No application change.                                                                                                                   |
| `node <artifact-dir>/run2-browser.cjs planned`                    | All O2 checks passed; 1280/1536 screenshots saved.                                                                                                                                                      |
| `node <artifact-dir>/run2-browser.cjs due 2026-11-17`             | First harness waited for an Attendance PUT, while the UI used a server action (`POST /attendance`). The save happened, but response wait timed out; cleanup save also happened. Original log preserved. |
| `node <artifact-dir>/run2-browser.cjs due-retry 2026-11-17`       | Corrected only the artifact harness wait; O6 passed, QI present restoration verified.                                                                                                                   |
| `node <artifact-dir>/run2-browser.cjs real`                       | Clock restored to Real time; all O4 sizes/footers passed and screenshots saved.                                                                                                                         |
| `npm run demo:reset '--' --yes` last, then read-only verification | Exit 0; reset 129 s; clock offset 0, QI present, original stock-update dates restored, health HTTP 200, protected-file comparison passed. See cleanup record below.                                     |

Existing repository tests were not rerun, changed, skipped or loosened. Harness corrections above fixed mistaken automation assumptions; all failed attempts remain in the artifacts. No application error was recorded in the successful browser runs.

## 4. Failures and blocks

### F1 — O5: supplied demo fixture cannot reach all specified empty states

- **Severity:** Medium coverage/setup issue; no confirmed application defect.
- **Role / page:** Floor Manager, `/floor-manager`.
- **Steps to reproduce:** 1. Run `npm run demo:reset '--' --yes`. 2. Sign in as manager. 3. Set the demo clock with the form to `2026-11-25` `09:00`. 4. Confirm Wednesday in the band and `day:"2026-11-25"` from the production API. 5. Inspect Work in progress and Rolls today.
- **Expected:** O5 asks for “No repairs open. Nothing is waiting for inspection.” and 0 in every Rolls today figure.
- **Actual:** All stages were uncounted today and no roll finished that day, but outstanding seeded work remained. WIP said **“17 pairs in repair. 1 batch and 1 repair waiting for inspection.”** Rolls scanned=0, returned=0, still open=1. This was already present immediately after reset, before any stock or attendance change. No double full stops, collapsed cards or overlap appeared.
- **Evidence:** `run2-O1-unplanned-1280-light.png`, `run2-unplanned.json` → `observations.quietCards`, and `run2-unplanned.log`:

  ```text
  Expected substring: "No repairs open. Nothing is waiting for inspection."
  Received: "17 pairs in repair. 1 batch and 1 repair waiting for inspection."
  Rolls still open: expected "0", received "1"
  ```

- **Suggested fix:** Claude should supply an authorized QA fixture with no open repair/inspection work and no roll open at Capture, or clarify O5's seeded-data expectation. Current service definitions describe these as outstanding work / rolls open now, so changing the date alone does not establish the empty precondition. QA did not clear unrelated work or alter application behavior to force a pass. The low-stock empty alternative was not exercised because the handoff permits the existing low-stock state.

## 5. Other observations

- Run 1's clock blocker was an input-tool issue: headless Playwright `fill()` reached React state, submitted the intended values and persisted them. The bell was present under its specified accessible name on Wednesday.
- The Next.js dev indicator intercepted the first theme pointer click at the compact sidebar's bottom. Keyboard focus + Enter on the same theme switch worked. This is recorded as harness/dev-environment friction, not an application theme defect.
- The reset command emitted the existing `pg` client concurrent-query deprecation warning and completed successfully before the run.
- Required 1280-px light PNGs: **`run2-O1-unplanned-1280-light.png`**, **`run2-O2-planned-1280-light.png`**, **`run2-O4-real-1280-light.png`**. Each was written by `page.screenshot({ path, fullPage:true })` and visually inspected. Additional bell, dark, role, responsive and due-banner screenshots are retained alongside them.

### Cleanup record

The QI was restored to present before leaving the 17 Nov test date; the clock was returned to **Real time** before the final `npm run demo:reset '--' --yes`. That reset exited **0**, reporting **129 s**, **250 replayed rolls**, **1,139 scans**, **10 attendance days**, **19 check-ins**, and **4 stock updates** (`demo-reset-run2-after.log`). No clock, attendance, stock or production mutations were performed afterward.

Read-only verification at **2026-11-21 13:27:24 +08:00** (`run2-final-verification.json`) confirmed:

- Persisted demo clock `offsetMs:"0"` (Real time).
- QI present on `2026-11-17` after the reset.
- Exactly four stock updates, on 11, 13, 18 and 20 Nov; the QA stock save on 25 Nov was removed.
- Database counts: 275 roll records in total (the reset's 250 refers to the replayed rolls), 1,139 scans, 10 attendance days and 19 check-ins.
- The freshly restored seed again contains 11 AT_STAGE repair jobs / 17 pairs and one BACK_FOR_INSPECTION job, corroborating O5's fixture limitation.
- `/api/health` HTTP 200 with both app and database `up`.
- All three required PNGs are 1280 px wide and readable; their dimensions and sizes are recorded in the verification JSON.
- **Zero changed or missing baseline protected files and zero new files outside `qa/reports/`.** Application code, repository tests, docs, migrations and configuration remain byte-identical to the pre-run baseline. The only vault edit is the requested single Agent sessions line in `Daily/2026-11-21.md`.

## 6. Suggested fixes (priority order)

1. Resolve O5's fixture/expectation mismatch and rerun only its uncovered empty-repairs and zero-open-roll branches. No application fix is established by this run.
