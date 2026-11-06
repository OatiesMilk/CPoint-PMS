# QA report: the card once per roll and a scanning timer per roll (D-121)

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| Date      | 2026-11-05 21:32 Manila                              |
| Handoff   | `qa/handoffs/2026-11-05-card-once-per-roll-timer.md` |
| Tested by | Codex                                                |
| Verdict   | **FAIL**                                             |

## 1. Summary

Ran D-121 in the local app after 01:00 Manila using the USB camera and printed marker card. The first-shot card flow, later shots, reload, floor view, roll page, and role access checks worked; however, the timer counted the full evening duration despite the 08:00–17:00 work-hours rule, and the CSV minutes rounded to one decimal. The full e2e run reported 87 passed, 11 failed, 2 skipped and 1 not run; the ledger check returned 0.

Scenarios: 13 passed, 2 failed, 1 blocked, 1 skipped, 17 total.

## 2. Environment

| Item            | Value                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language                                                                               |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                     |
| Branch / commit | `main` @ `1793138` (dirty: expected uncommitted D-121 changes)                                                |
| How the app ran | `npm run dev` at `http://localhost:3000`; Docker Postgres; `npm run db:deploy` reported no pending migrations |
| Database        | Docker database with the demo dataset; two 25 sq ft rolls added through Inventory for this run                |
| Browser         | Codex in-app browser for manual checks; Playwright Chromium 153.0.8010.12, headless, for e2e                  |
| Viewport        | 1440 × 900 default; S15 attempted at 390 × 844                                                                |

The manual roll was LR-MT-010 (Black cowhide (school shoes), tag QA-D121-R1-20261105), started at about 20:43:50 Manila and finished at about 21:04:16 Manila. LR-MT-011 (QA-D121-R2-20261105) was returned with zero shots.

## 3. Scenario results

| ID  | Scenario                                             | Result  | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Start scanning with USB camera                       | PASS    | Timer appeared and counted up from 00:00. Start about 20:43:50 Manila.                                                                                                                                                                                                                                                                                                                                           |
| S2  | First shot with card absent                          | PASS    | Required-card message displayed; Capture disabled.                                                                                                                                                                                                                                                                                                                                                               |
| S3  | First shot with card present                         | PASS    | Shot #1 saved. After removing the card, scale line showed 16.9 in across and Read the card again. `artifacts/2026-11-05-card-once-timer-run1/S3-first-card-shot.png`, `S3-scale-set.png`                                                                                                                                                                                                                         |
| S4  | Four more shots without card                         | PASS    | Three Capture clicks and one Space press saved shots #2–#5; all passed. Scale line remained and Capture stayed enabled. `S4-five-shots-no-card.png`                                                                                                                                                                                                                                                              |
| S5  | Reload                                               | PASS    | Same roll and scale returned; timer restored to 10:11 after camera startup, then continued to 11:08. A brief 00:00 appeared while the camera initialized. `S5-reload-timer.png`                                                                                                                                                                                                                                  |
| S6  | Later shot with card still visible                   | PASS    | Shot #6 saved; “Marker card found” appeared.                                                                                                                                                                                                                                                                                                                                                                     |
| S7  | Read the card again                                  | PASS    | With card away, the required-card warning appeared and Capture disabled. With card back, shot #7 saved and the scale line returned. `S7-read-card-again.png`                                                                                                                                                                                                                                                     |
| S8  | Floor view with card away, Space                     | PASS    | Shot #8 saved in Floor view and the verdict band showed Pass; Esc exited Floor view.                                                                                                                                                                                                                                                                                                                             |
| S9  | Finish roll and compare clock                        | FAIL    | App displayed 20:53. Clock elapsed about 20:26 (20:43:50–21:04:16), a 27-second difference, but all elapsed time was outside 08:00–17:00 and should have been excluded. `S9-finish-message.png`                                                                                                                                                                                                                  |
| S10 | Reports → Rolls                                      | PASS    | LR-MT-010 showed 20:53, 8 shots, 8 passed, 0 rejected. Average was 22:40 over 78 rolls (lunch left out). `S10-rolls-report.png`                                                                                                                                                                                                                                                                                  |
| S11 | Roll page and shots #2 and #1                        | PASS    | Roll page showed 20:53 (lunch left out). Shot #2 referenced the marker card from Shot #1; shot #1 referenced the marker card. Both showed 16.92 in across. `S11-roll-page.png`, `S11-shot-2-page.png`, `S11-shot-1-page.png`                                                                                                                                                                                     |
| S12 | Download Rolls CSV                                   | FAIL    | Required columns were present. LR-MT-010 had Scanning time 20:53 and Scanning time (min) 20.9; the example’s two-decimal precision implies 20.88. `artifacts/2026-11-05-card-once-timer-run1/rolls.csv`                                                                                                                                                                                                          |
| S13 | Start the second roll without card, then put it back | PASS    | LR-MT-011 required the card and had Capture disabled. Put roll back returned it to the waiting list with zero shots.                                                                                                                                                                                                                                                                                             |
| S14 | Lunch pause                                          | SKIPPED | Run was not between 11:00 and 12:00 Manila (“not in lunch”).                                                                                                                                                                                                                                                                                                                                                     |
| S15 | 390 × 844 with scale set                             | BLOCKED | At 390 × 844 the selected existing open roll (LR-ES2-050, 2 shots) had no saved scale and still required a first-shot card. Document width was 375 px, so no sideways scroll was observed. The automated phone Capture test passed its 390 × 844 axe check with 0 violations, but the scale line, Read button, and timer could not be checked together in the required state. `S15-scale-unavailable-mobile.png` |
| A1  | CSV endpoint as Constructor, QI, Admin               | PASS    | Each role received a FORBIDDEN response for `GET /api/v1/reports/rolls.csv`.                                                                                                                                                                                                                                                                                                                                     |
| A2  | CSV endpoint signed out                              | PASS    | Signed-out request received an UNAUTHENTICATED response.                                                                                                                                                                                                                                                                                                                                                         |

### Automated tests

| Command                                                                                                   | Result                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/rolls.spec.ts` | 19 passed, 3 failed, 1 skipped. Log: `artifacts/2026-11-05-card-once-timer-run1/targeted-e2e.log`                                                                                                         |
| Isolated rerun: `npx playwright test tests/e2e/capture.spec.ts`                                           | 12 passed, 1 failed, 1 skipped. The role-matrix test timed out again and remained on `/login`. Log: `artifacts/2026-11-05-card-once-timer-run1/capture-spec-rerun.log`                                    |
| `npm run test:e2e`                                                                                        | 87 passed, 11 failed, 2 skipped, 1 did not run (101 total). Log: `artifacts/2026-11-05-card-once-timer-run1/full-e2e.log`                                                                                 |
| Isolated timeout reruns                                                                                   | `admin.spec.ts` 6/0/0; `inventory.spec.ts` 8/0/0; `reports.spec.ts` 3/0/0; `returns.spec.ts` 4/0/0; `rolls.spec.ts` 6/0/0; `smoke.spec.ts` 10/0/0 (passed/failed/skipped). Each recovered when run alone. |
| Ledger query                                                                                              | 0 mismatched inventory items. Output: `artifacts/2026-11-05-card-once-timer-run1/ledger-check.txt`                                                                                                        |

The two `capture-no-card.spec.ts` D-121 tests failed in both targeted and full runs because `POST /api/v1/rolls/:id/start` returned 401 where the test expected 200. They were not timeout or ECONNRESET failures. The `capture.spec.ts` role-matrix test also failed in the targeted run, its isolated rerun, and the full suite; on the isolated rerun it timed out while the page stayed on `/login`.

## 4. Failures

### F1 — S9: Evening hours counted by the roll timer

- **Severity:** High
- **Role / page:** Shoe Constructor, Capture and Finish roll
- **Steps to reproduce:** Start LR-MT-010 around 20:43:50 Manila; capture eight shots; finish around 21:04:16 Manila.
- **Expected:** D-121/A-49 excludes time outside 08:00–17:00. Since this scan began and ended after 17:00, the working-time total should be approximately 00:00.
- **Actual:** Finish displayed `Scanning time: 20:53`, close to the full 20:26 wall-clock interval.
- **Evidence:** `artifacts/2026-11-05-card-once-timer-run1/S9-finish-message.png`; roll detail `S11-roll-page.png`.
- **Suggested fix:** In `src/lib/roll-timer.ts`, count only the portion of each interval inside the 08:00–17:00 Manila work window, in addition to excluding lunch.

### F2 — S12: CSV minutes lose the expected precision

- **Severity:** Medium
- **Role / page:** Floor Manager, Reports → Rolls CSV
- **Steps to reproduce:** Download the Rolls CSV for the report row containing LR-MT-010.
- **Expected:** The minute value should match the displayed seconds to two decimals; 20:53 is approximately 20.88 minutes, consistent with the handoff example 12:34 → 12.57.
- **Actual:** CSV contains 20.9.
- **Evidence:** `artifacts/2026-11-05-card-once-timer-run1/rolls.csv`.
- **Suggested fix:** In the Rolls CSV generation path, emit minute values to two decimal places.

### B1 — S15: Scale-set mobile state unavailable

- **Status:** BLOCKED
- **Role / page:** Shoe Constructor, Capture at 390 × 844
- **Steps:** Set the in-app browser viewport to 390 × 844 and select an existing open roll.
- **Expected:** Verify the scale line, Read the card again button, and timer fit together, with no sideways scroll and axe reporting zero violations.
- **Actual:** The available open roll had no saved first-shot scale and displayed the first-shot card requirement. The required scale-set state was unavailable after completing S13 and returning LR-MT-011.
- **Evidence:** `artifacts/2026-11-05-card-once-timer-run1/S15-scale-unavailable-mobile.png`; the automated 390 × 844 Capture phone test passed with no sideways scroll and axe 0.
- **Suggested fix:** Run the mobile check while a scale-set roll is open, before returning the second test roll.

## 5. Other observations

- The S5 reload briefly showed 00:00 during camera initialization before restoring the timer to 10:11.
- Timeout-related failures in admin, inventory, reports, returns, rolls, and smoke specs passed on their one-time isolated reruns. The remaining e2e failures are the D-121 start endpoint 401s and the capture role-matrix login timeout described above.
- Artifacts and logs are in `qa/reports/artifacts/2026-11-05-card-once-timer-run1/`.

## 6. Suggested fixes (priority order)

1. Correct the work-hours calculation for nighttime intervals in `src/lib/roll-timer.ts`.
2. Preserve the expected two-decimal minute precision in the Rolls CSV.
3. Investigate why the D-121 start endpoint receives 401 in the e2e request context and why the capture role-matrix test remains on `/login`.
