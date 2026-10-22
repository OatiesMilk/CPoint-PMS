# QA report: Phase 23 — Production progression

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Date      | 2026-10-22 10:24 (local time, UTC+08:00)                    |
| Handoff   | `qa/handoffs/2026-10-21-phase-23-production-progression.md` |
| Tested by | Codex                                                       |
| Verdict   | **FAIL**                                                    |

## 1. Summary

The database deployment and production build passed. Of 46 manual scenarios, 45 passed and U1 failed: the Schedule and quota table has a serious axe `scrollable-region-focusable` issue, and the Batches table clips at 375 px instead of scrolling inside its card. The full e2e suite also has five failures from the same axe issue; the production and attendance rerun reproduced it.

Scenarios: 45 passed, 1 failed, 0 blocked, 46 total.

## 2. Environment

| Item            | Value                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language, 10.0.26200 (Build 26200)                                                                                          |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                                                          |
| Branch / commit | `main` @ `cc612ee` (working tree clean? no; 264 paths were reported during report preparation, consistent with the handoff's uncommitted checkout) |
| How the app ran | Dev app via `npm run dev` on port 3001; seeded demo app in disposable Docker project `cpoint-qa` on port 3002; e2e web server on port 3100         |
| Base URL        | Dev `http://localhost:3001`; demo `http://localhost:3002`; e2e `http://127.0.0.1:3100`                                                             |
| Database        | Dev Docker `db` restored to captured baseline; demo users and demo week in throwaway stack, removed after testing                                  |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                                                        |
| Viewport        | 1440 × 900; U1 narrow check 375 × 812                                                                                                              |

## 3. Scenario results

| ID  | Scenario                                             | Result | Notes / evidence                                                                                                                                                                                               |
| --- | ---------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Floor Manager home production card                   | PASS   | School Shoe and Topsider quota bars and next check-in shown; no “Batches by stage”. `screenshots/P1.png`                                                                                                       |
| P2  | FM production page with attendance not taken         | PASS   | Default 12:00, 16:00, 17:00 schedule; no Enter count; attendance-first instruction shown. `screenshots/P2.png`                                                                                                 |
| P3  | Reject shift end before start                        | PASS   | Validation shown under Shift end and focus moved there. `screenshots/P3.png`                                                                                                                                   |
| P4  | Save two-hour schedule for tomorrow                  | PASS   | Preview/effective date correct; today's three default slots unchanged. `screenshots/P4.png`                                                                                                                    |
| P5  | Require a working day                                | PASS   | “Pick at least one working day.”                                                                                                                                                                               |
| P6  | Reject zero School Shoe quota                        | PASS   | Minimum quota validation shown under the field. `screenshots/P6.png`                                                                                                                                           |
| P7  | Set first quotas                                     | PASS   | Saved School Shoe 90 and Topsider 45 from today; Production showed quota of 90. `screenshots/P7.png`                                                                                                           |
| P8  | Defer a quota change                                 | PASS   | Today remained 90; 95 appeared as upcoming from tomorrow. `screenshots/P8.png`                                                                                                                                 |
| P9  | Demo quota suggestion                                | PASS   | With the default three daily check-ins, suggestion was 76 pairs and Use suggestion populated the field; not saved. `screenshots/P9.png`                                                                        |
| P10 | QI next due check-in card                            | PASS   | Late 01:00 check-in showed elapsed time and Enter count. `screenshots/P10.png`                                                                                                                                 |
| P11 | Open count from QI home                              | PASS   | Enter count opened `/production` with that check-in dialog already open.                                                                                                                                       |
| P12 | Require both count fields                            | PASS   | One message per shoe type; first field received focus. `screenshots/P12.png`                                                                                                                                   |
| P13 | Enforce per-check-in maximum                         | PASS   | 2,001 was rejected with the 2,000-pair maximum message.                                                                                                                                                        |
| P14 | Save a check-in                                      | PASS   | Row showed 22 and 10, “Entered late”, attendance state, actor name/time, and note. `screenshots/P14.png`                                                                                                       |
| P15 | Reject duplicate check-in                            | PASS   | API returned 409 `STALE`: “already entered the 01:00 check-in … Refresh to see it.” `screenshots/P15.png`                                                                                                      |
| P16 | Reject future check-in                               | PASS   | API returned 409: “The 11:00 check-in isn't open yet. You can enter it from 11:00.”                                                                                                                            |
| P17 | Require correction reason                            | PASS   | Correction without a reason was refused and the reason validation appeared. `screenshots/P17.png`                                                                                                              |
| P18 | Save correction and audit                            | PASS   | Corrected row showed actor and reason; audit log showed before/after counts. `screenshots/P18.png`                                                                                                             |
| P19 | Check-in before attendance, then attendance          | PASS   | QI could save before attendance; row later said attendance changed after this check-in.                                                                                                                        |
| P20 | Show late check-in state                             | PASS   | A check-in left due over 30 minutes showed “Entered late”. `screenshots/P20.png`                                                                                                                               |
| P21 | Demo recent-day shortfall summary                    | PASS   | Recent days showed 2, 3, and 5 of 12 constructors absent on short days and one missed check-in; no personal names. `screenshots/P21.png`                                                                       |
| C1  | FM blocked when a QI is present                      | PASS   | No Enter count; QI-present message shown; POST returned 403 with the same reason. `screenshots/C1.png`                                                                                                         |
| C2  | FM covers when no QI is present                      | PASS   | All QIs marked absent; FM could enter, saved as FM, and audit had `coveringForQualityInspector=true`. `screenshots/C2.png`                                                                                     |
| C3  | FM home when check-ins are late and no QI is present | PASS   | Card reported late production and directed FM to enter it on Production. `screenshots/C3.png`                                                                                                                  |
| C4  | QI may enter while marked absent                     | PASS   | QI check-in remained allowed. `screenshots/C4.png`                                                                                                                                                             |
| R1  | Start a new roll                                     | PASS   | New roll entered At Preparation; no stage move or target-quota controls. `screenshots/R1.png`                                                                                                                  |
| R2  | Finish a roll                                        | PASS   | Confirmation included scanned/expected count; finished badge and one Preparation History row appeared. `screenshots/R2.png`                                                                                    |
| R3  | Finish roll with Fixable section open                | PASS   | Confirmation called out the open section; finish succeeded and Being handled · 1 remained.                                                                                                                     |
| R4  | Batch status filter and columns                      | PASS   | Only All statuses, Planned, At Preparation, Finished, Cancelled; no Stage or Target columns.                                                                                                                   |
| R5  | Finish a legacy batch                                | PASS   | Legacy Upper Making batch showed “Started before rolls were tracked” and retained History; Finish roll succeeded. `screenshots/R5.png`                                                                         |
| R6  | Reject legacy stage advance                          | PASS   | API returned 422: “Choose start or finish. A roll no longer moves through stages.”                                                                                                                             |
| R7  | QI finish permission                                 | PASS   | QI saw Finish roll only and completed the roll. `screenshots/R7.png`                                                                                                                                           |
| R8  | Capture page roll finish hint                        | PASS   | Scanned count, Finish this roll prompt, and Open B-… link appeared.                                                                                                                                            |
| R9  | Constructor finish hint                              | PASS   | For an allowed-to-capture demo constructor, full-roll hint said to ask FM or QI and had no link. `screenshots/R9.png`                                                                                          |
| O1  | Operations report                                    | PASS   | Production KPIs and section appeared; former stage-monitoring headings were absent. `screenshots/O1.png`                                                                                                       |
| O2  | Below-quota attention item                           | PASS   | “3 of the last 5 working days were below quota” linked to Production.                                                                                                                                          |
| O3  | Production CSV                                       | PASS   | Required 11-column header (with UTF-8 BOM), 12 rows, no names/emails. `screenshots/O3.png`; `production.csv`                                                                                                   |
| O4  | Operations CSV and retired stages CSV                | PASS   | Operations CSV included Rolls started/Rolls finished; `stages.csv` returned 404.                                                                                                                               |
| U1  | Axe, narrow layout, and keyboard check               | FAIL   | See F1. Keyboard Enter count path worked; axe and narrow Batches table checks failed. `screenshots/U1-production_plan-axe.png`, `screenshots/U1-narrow-batches.png`, `screenshots/U1-enter-count-keyboard.png` |
| A1  | Constructor production access                        | PASS   | `/forbidden` on Production and plan; today/days APIs returned 403.                                                                                                                                             |
| A2  | FM check-in restrictions                             | PASS   | FM check-in POST returned 403 both before attendance and with a QI present, with the matching reason.                                                                                                          |
| A3  | Admin plan and write restrictions                    | PASS   | Plan forbidden; schedule, quota, and check-in writes returned 403. `screenshots/A3.png`                                                                                                                        |
| A4  | QI plan and batch write restrictions                 | PASS   | Plan forbidden; schedule/quota and batch start/edit/cancel returned 403; controls absent. `screenshots/A4.png`                                                                                                 |
| A5  | QI/Admin production report access                    | PASS   | Production report JSON and CSV returned 403 for both roles.                                                                                                                                                    |
| A6  | Admin cannot finish roll                             | PASS   | Finish control absent; finish API returned 403. `screenshots/A6.png`                                                                                                                                           |
| A7  | Role navigation                                      | PASS   | FM, QI, and Admin sidebar entries matched their expected role prefixes.                                                                                                                                        |

Automated commands run:

| Command                                                                                     | Result                                                                                                                                       |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:up`                                                                             | Passed; dev DB container healthy. `artifacts/2026-10-22-phase-23-production-progression/db-up.log`                                           |
| `npm run db:deploy`                                                                         | Passed; 18 migrations found, no pending migrations. `artifacts/2026-10-22-phase-23-production-progression/db-deploy.log`                     |
| `npm run build`                                                                             | Passed. `artifacts/2026-10-22-phase-23-production-progression/build.log`                                                                     |
| `npm run test:e2e`                                                                          | 90 passed, 5 failed, 1 skipped, 4 did not run. `artifacts/2026-10-22-phase-23-production-progression/e2e.log`                                |
| `npx playwright test tests/e2e/production.spec.ts tests/e2e/attendance.spec.ts --workers=1` | 7 passed, 1 failed, 4 did not run; the production axe failure repeated. `artifacts/2026-10-22-phase-23-production-progression/e2e-rerun.log` |

## 4. Failures

### F1 — U1: Scrollable tables are inaccessible or clipped

- **Severity:** High (U1's main accessibility and narrow-layout checks cannot pass)
- **Role / page:** Floor Manager, `/production/plan` and `/batches`
- **Steps to reproduce:** 1. In the demo stack, run axe on the tested pages. 2. At 375 × 812, open `/batches` and inspect the table bounds and horizontal scrolling.
- **Expected:** No serious axe violations; any wide table scrolls within its card, without clipping or sideways page scroll.
- **Actual:** Axe reported serious `scrollable-region-focusable` on `/production/plan`, target `.text-card-foreground[data-slot="card"]:nth-child(2) > .pt-0.p-5[data-slot="card-content"] > .max-w-full.overflow-x-auto.rounded-lg`. On `/batches`, the loaded table measured about 585 px wide and extended to x=658 at a 375 px viewport; the content was clipped and the wrapper did not scroll internally. The Enter count keyboard flow passed: its action focused the dialog and Tab reached the first count, second count, and notes fields.
- **Evidence:** `qa/reports/artifacts/2026-10-22-phase-23-production-progression/screenshots/U1-production_plan-axe.png`, `U1-narrow-batches.png`, `U1-enter-count-keyboard.png`; details in `u1-details.json` and `diagnose-batches.json`.

  ```text
  axe: scrollable-region-focusable (serious)
  .text-card-foreground[data-slot="card"]:nth-child(2) > .pt-0.p-5[data-slot="card-content"] > .max-w-full.overflow-x-auto.rounded-lg
  /batches at 375px: table width 585px, right edge x=658; document width 375px; no internal horizontal overflow
  ```

- **App or test:** App. Axe correctly flags a scrollable region without keyboard access; the batch table also visibly clips.
- **Suggested fix:** In `src/components/ui/table.tsx:7`, constrain the wrapper to its card width so wide tables overflow inside it, and make an overflowing region keyboard-focusable with an appropriate accessible name.

### Automated e2e failures — five tests share the same axe defect

The full suite failures are app accessibility failures, not test isolation: the targeted rerun repeated the same failure. Screenshots and the full logs are in the artifact folder noted above.

| Test title                                                                                            | Failure point                            | Error                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `the Floor Manager sets the schedule and a quota, with specific messages` (`production.spec.ts:75:5`) | `production.spec.ts:120:27`              | Axe `scrollable-region-focusable` on the Schedule and quota history table wrapper shown in F1. |
| `dark mode › every page in the manager's sidebar passes axe in dark mode` (`smoke.spec.ts:68:7`)      | `smoke.spec.ts:47:48` (called at `75:7`) | `scrollable-region-focusable (serious): .max-w-full`                                           |
| `every page in the manager's sidebar renders and passes axe` (`smoke.spec.ts:81:7`)                   | `smoke.spec.ts:47:48` (called at `90:7`) | `scrollable-region-focusable (serious): .max-w-full`                                           |
| `every page in the inspector's sidebar renders and passes axe` (`smoke.spec.ts:81:7`)                 | `smoke.spec.ts:47:48` (called at `90:7`) | `scrollable-region-focusable (serious): .max-w-full`                                           |
| `every page in the admin's sidebar renders and passes axe` (`smoke.spec.ts:81:7`)                     | `smoke.spec.ts:47:48` (called at `90:7`) | `scrollable-region-focusable (serious): .max-w-full`                                           |

Smallest likely fix for the shared axe failures is the same wrapper change at `src/components/ui/table.tsx:7` described in F1. Re-run the suite after that app fix to confirm all five assertions.

## 5. Other observations

- Production, Recent days, Operations, and the Production CSV showed aggregate production and attendance counts, not personal pairs, absence counts, or rankings. The only named check-in person was the actor who entered or corrected it, as required; the saved-row screenshot is `screenshots/P14.png` and the correction screenshot is `screenshots/P18.png`.
- The `/attendance` roster displays each worker's name with an individual Present/Absent status while taking attendance. This is the only additional per-person attendance information observed; see `screenshots/attendance-roster.png`. It is on the attendance-taking page, not in production totals or reports.
- No tested UI retained “Batches by stage”, “Move to …”, a Stage filter/column, Target quota, “Time in each stage”, or a Stages CSV. The legacy stage advance API returned the retirement message, and `/api/v1/reports/stages.csv` returned 404. Legacy stage data/history remains available on an old batch by design.
- Dev DB baseline ID lists were empty. After e2e, cleanup removed 95 attendance marks, 2 attendance days, 2 daily quotas, and 3 schedules. After the manual dev scenarios, final cleanup removed 56 marks, 1 day, 5 check-ins, 3 quotas, and 3 schedules (including the bootstrap/default schedule created after the baseline snapshot). Marks were deleted before their day. `dev-final-verification.txt` confirms zero rows in all five tables. Batches created or finished during QA remain, as instructed.
- The throwaway `cpoint-qa` demo stack was stopped with `docker compose -p cpoint-qa down -v`; its temporary test schedule was deleted, and the demo environment variables were cleared. The `cpoint-pms` database container was left running.

## 6. Suggested fixes (priority order)

1. Fix the shared table container in `src/components/ui/table.tsx:7`: keep the container within its card at narrow widths, allow horizontal scrolling inside the container, and provide keyboard focus plus an accessible name for scrollable regions. This should address the U1 clipping and the serious axe failures in the five e2e tests.
2. Rerun `npm run test:e2e` and the U1 checks after the wrapper fix. The repeated single-file production failure shows the current e2e issue is reproducible rather than an isolation-only failure.

## Needs Dylan

None.
