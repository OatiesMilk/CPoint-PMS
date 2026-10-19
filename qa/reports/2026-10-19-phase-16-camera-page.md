# QA report: Phase 16 camera page

| Field     | Value                                            |
| --------- | ------------------------------------------------ |
| Date      | 2026-10-19 15:07 (Asia/Shanghai)                 |
| Handoff   | `qa/handoffs/2026-10-19-phase-16-camera-page.md` |
| Tested by | Codex                                            |
| Verdict   | **FAIL**                                         |

## 1. Summary

Ran all Phase 16 scenarios and access checks against the local dev app, plus the listed E2E specs and the station pytest suite. Nineteen of 21 scenario/access checks passed, one failed (S14), and A4 is blocked because the axe scan did not cover every transient camera state. The full E2E rerun also has one stale snapshot assertion; the implementation returns the new action and found-at fields that the assertion omits.

Scenarios: 19 passed, 1 failed, 1 blocked, 21 total. S3b was not applicable because the webcam worked and S3 was completed.

## 2. Environment

| Item            | Value                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11, build 26200                                                                                                                     |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                                                   |
| Branch / commit | `main` @ `57694eb` (dirty; Phase 16 changes were already uncommitted)                                                                       |
| How the app ran | `npm run dev` on the host; Docker PostgreSQL service `db`                                                                                   |
| Base URL        | `http://localhost:3000`                                                                                                                     |
| Database        | Docker `postgres:18-alpine`; dev database already reset by the user. `npm run db:deploy` found no pending migrations. S12 was dry-run only. |
| Browser         | Playwright 1.63.0 Chromium 153.0.8010.12, headless                                                                                          |
| Viewport        | 1440 × 900                                                                                                                                  |

At completion, the dev server had stopped and the Docker `db` container was healthy. Scratch was restored to Rework; found-at was restored to 50%; the early-model notice was restored on; reject/rework thresholds were 90%/60%; the camera batch selector was restored to Automatic. The QA station token remains revoked as required by S17. The E2E specs created their expected `e2e-rule-*` defect types after S13.

## 3. Scenario results

| ID  | Scenario                                     | Result  | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | FM camera disconnected state                 | PASS    | `/camera` showed **Not connected** and the expected stale station/scan copy. `S1.log`, `S1.png`.                                                                                                                                                                                                                                                                                                                    |
| S2  | No batch at Preparation                      | PASS    | Empty Prep state showed “No batch is at Preparation…” and the Start a batch link. `S2.log`, `S2.png`. A first browser assertion raced hydration; the retry passed (`S2-attempt1-harness.log`, `S2-attempt2-harness.log`).                                                                                                                                                                                           |
| S3  | Station check-in                             | PASS    | Started batch B-2026-0015 at Preparation; `.venv/Scripts/python -m cpoint_cv run webcam` connected and the page showed **Station connected** / waiting for the next section. `S3.log`, `S3.png`, `S3-station.log`.                                                                                                                                                                                                  |
| S4  | Camera capture state                         | PASS    | Sent a real Space key to the interactive station. `/camera` showed **Camera station active**, model `yolo-v1-1d729fb0`, and the early-model notice. `S4.log`, `S4.png`, `S3-station.log`.                                                                                                                                                                                                                           |
| S5  | Change camera batch                          | PASS    | While the station waited, selected B-2026-0016. Console printed the batch change once and the next capture went to B-2026-0016. `S5.log`, `S5.png`, `S3-station.log`. Selector restored to Automatic after the E2E run.                                                                                                                                                                                             |
| S6  | Folder capture and Rules used                | PASS    | From `cv/`, ran `.venv/Scripts/python -m cpoint_cv run folder "C:\Users\micro\OneDrive\Pictures\Sample Photos (CAP2)" --interval 5` (exit 0). All five verdicts matched; detail pages showed Reject cut/hole, Rework crease/scratch, found-at 50%, then 90%/60% thresholds. `S6.log`, `S6-station.log`, and `S6-IMG_6320.png` through `S6-IMG_6742.png`.                                                            |
| S7  | Simulator status and timeout                 | PASS    | `npm run cv:simulate -- --count 3 --interval 2` (exit 0 with `CV_DEVICE_TOKEN` supplied to the process from `cv/.env`). Page showed **Simulator active** and no early-model notice; after two minutes it showed **Not connected**, never Station connected. `S7-simulate.log`, `S7-now.png`, `S7-after2min.log`, `S7.png`.                                                                                          |
| S8  | Early-model notice switch                    | PASS    | With a station scan as latest, turned notice off; toast appeared and model stayed named without the notice. Restored the switch on. `S8.log`, `S8-off.png`, `S8.png`, `S8-settings-off.png`.                                                                                                                                                                                                                        |
| S9  | Scratch Reject action                        | PASS    | Changed Scratch to Reject; simulated and posted an exact 55% scratch detection. API returned 201 / REJECT and scan Rules used included Scratch under Reject when found. Restored Scratch to Rework. `S9-check.log`, `S9-055-api.log`, `S9-simulate.log`, `S9.png`, settings screenshots.                                                                                                                            |
| S10 | Found-at validation and save                 | PASS    | 100 showed “Use a value above 0% and below 100%.”; 0 showed “The found-at value must be above 0 and at most 100.”; 60 saved; restored 50. `S10.log`, `S10-100.png`, `S10-0.png`, `S10-60.png`, `S10.png`. The first assertion omitted the trailing `%`; corrected assertion passed (`S10-attempt1-assertion.log`).                                                                                                  |
| S11 | Audit trail                                  | PASS    | Exact action filters `settings.thresholds`, `settings.model_notice`, and `defect_type.update` each showed before/after entries for the changes. `S11.log`, `S11.png`, `S11-settings-*.png`. First attempt hit a loading race; retry passed (`S11-attempt1-loading.log`).                                                                                                                                            |
| S12 | Reset dry run                                | PASS    | Ran only `npm run demo:reset` (exit 0), without `--yes`. It printed “Nothing changed”; before/after snapshots across 22 tables were identical. `S12.log`, `S12.before.json`, `S12-after.json`.                                                                                                                                                                                                                      |
| S13 | Current reset end state                      | PASS    | Read-only check: four demo accounts; the two expected active tokens; no E2E shoe types, suppliers, or defect types; required defect actions and inactive types; first audit action `system.demo_reset`; inventory balances matched movement ledgers. All four demo accounts signed in. No reset was run. `S13-db-check.log`, `S13-browser.log`, `S13.png`, `S13-login-*.png`, `S13-audit.png`, `S13-inventory.png`. |
| S14 | Evaluate sample photos                       | FAIL    | Exact command from `cv/`: `.venv/Scripts/python -m cpoint_cv evaluate "C:\Users\micro\OneDrive\Pictures\Sample Photos (CAP2)" --out out/qa-eval.md` (exit 0). It reported **1 of 5**, expected 5 of 5. See F1 and `S14.log`, `S14-evaluation.md`.                                                                                                                                                                   |
| S15 | Doctor redacts unreachable camera credential | PASS    | Ran `.venv/Scripts/python -m cpoint_cv doctor --config out/qa-doctor.toml` from `cv/` (exit 1 as expected for the unreachable test RTSP camera). Camera line named `rtsp://10.255.255.1/stream` and said it could not be opened; password was absent from output. `S15.log`.                                                                                                                                        |
| S16 | Unknown defect review                        | PASS    | `npm run cv:simulate -- --count 5 --classes qa-unknown` (exit 0). Three scans with detections entered NEEDS_REVIEW and appeared in the QI queue; clean scans passed. `S16-simulate.log`, `S16.log`, `S16.png`.                                                                                                                                                                                                      |
| S17 | Revoked token stops station                  | PASS    | Revoked QA station token while webcam command was waiting. Station received 401, printed the refused-token guidance, and stopped (expected nonzero exit). Token page showed Revoked. `S17-station.log`, `S17-revoke.log`, `S17.png`.                                                                                                                                                                                |
| A1  | Constructor cannot access camera             | PASS    | Constructor `/camera` redirected to `/forbidden` with 403 copy and no Camera nav link. `A1.log`, `A1.png`.                                                                                                                                                                                                                                                                                                          |
| A2  | FM/QI cannot access camera settings          | PASS    | Both roles were forbidden at `/admin/settings?tab=thresholds`; `PUT /api/v1/settings/cv` returned 403 for each. `A2.log`, `A2-FM.png`, `A2-QI.png`.                                                                                                                                                                                                                                                                 |
| A3  | Device token cannot edit camera settings     | PASS    | `PUT /api/v1/settings/cv` returned 401. This ran after S17, so the station token was revoked; 401 is the expected result. `A3.log`.                                                                                                                                                                                                                                                                                 |
| A4  | axe on camera states and settings            | BLOCKED | axe reported 0 violations on `/camera` for FM, QI, and Admin in Not connected state, and on Thresholds and Defect types settings. It did not scan the transient Station connected, Camera station active, or Simulator active states. After S17 the station token was revoked, so those states could not be recreated without changing the token state. `A4.log`, `A4-camera-*.png`, `A4-settings-*.png`.           |

S3–S5 used one interactive webcam command, `.venv/Scripts/python -m cpoint_cv run webcam`, left alive while those scenarios ran and stopped after S5. S6 used the station folder command above. S9 additionally posted the labeled 55% detection through the API because the simulator’s generated confidence is random. The simulator runs received the token through the child process environment; no token value was written to the report or artifacts.

Existing automated tests run:

| Command                                                                                                                                                          | Result                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run build && npx playwright test tests/e2e/cv.spec.ts tests/e2e/outcomes.spec.ts tests/e2e/reports.spec.ts tests/e2e/admin.spec.ts tests/e2e/smoke.spec.ts` | Build passed. Final E2E rerun: 30 passed, 1 failed, 1 skipped (exit 1). `existing-e2e-rerun.log`. |
| `cd cv && .venv/Scripts/python -m pytest`                                                                                                                        | 156 passed in 0.96s (exit 0). `station-pytest.log`.                                               |

The first E2E run had 29 passed, 2 failed, 1 skipped because S5’s selected batch leaked into the camera selection test. The selection was restored to Automatic and the suite rerun; that failure cleared. The remaining failure is F2.

## 4. Failures

### F1 — S14: Evaluator uses confidence thresholds without the configured per-type actions

- **Severity:** Medium
- **Role / page:** Shell, `cv/`
- **Steps to reproduce:** From `cv/`, run `.venv/Scripts/python -m cpoint_cv evaluate "C:\Users\micro\OneDrive\Pictures\Sample Photos (CAP2)" --out out/qa-eval.md` using the current `config.toml`.
- **Expected:** The preview matches all five labels (5 of 5) under the configured Phase 16 actions.
- **Actual:** Process exits 0 but reports 1 of 5. The per-photo results were: IMG_6320 expected REWORK / preview PASS (crease 0.51); IMG_6693 expected REJECT / preview REWORK (hole 0.88); IMG_6725 matched REJECT; IMG_6728 expected REJECT / preview REWORK (scratch 0.89, cut 0.84); IMG_6742 expected REJECT / preview REWORK (cut 0.51). The report says thresholds 0.90/0.60 and lists active types, but has no “With today’s actions” sweep. The current `cv/config.toml` preview has no `found_at_or_above` or `[preview.actions]`, so the Python preview falls back to confidence-only decisions while the DB uses per-type actions.
- **Evidence:** `qa/reports/artifacts/2026-10-19-phase-16-camera-page/S14.log`, `S14-evaluation.md`.

  ```text
  The preview matched the expected verdict on 1 of 5 photos.
  IMG_6320.jpg | REWORK | PASS | crease 0.51
  IMG_6693.jpg | REJECT | REWORK | hole 0.88, hole 0.38
  IMG_6725.jpg | REJECT | REJECT | ...
  IMG_6728.jpg | REJECT | REWORK | scratch 0.89, cut 0.84, ...
  IMG_6742.jpg | REJECT | REWORK | scratch 0.66, cut 0.51, ...
  ```

- **Suggested fix:** Sync `[preview] found_at_or_above` and `[preview.actions]` in the local `cv/config.toml` with Settings (the corresponding values are shown in `cv/config.example.toml`), or make the handoff’s S14 setup provide a temporary matching preview config. This run did not edit `cv/config.toml`.

### F2 — Existing E2E: threshold snapshot assertion omits Phase 16 fields

- **Severity:** Medium
- **Role / page:** System Admin, `/admin/settings` and the scan detail API
- **Steps to reproduce:** Run the listed Playwright command; in `tests/e2e/admin.spec.ts`, save reject 85% / rework 50%, post the test cut scan, then compare `thresholdsSnapshot` at line 155.
- **Expected:** The test accepts a snapshot containing the configured thresholds plus Phase 16’s found-at and per-type action fields.
- **Actual:** The scan verdict is correctly REJECT, but the assertion expects only `{ rejectAtOrAbove: 0.85, reworkAtOrAbove: 0.5 }`. Actual snapshot also has `foundAtOrAbove: 0.5` and `actions: { crease: REWORK, cut: REJECT, hole: REJECT, scratch: REWORK }`, so the deep equality assertion fails. The `afterAll` restores 90%/60% thresholds.
- **Evidence:** `qa/reports/artifacts/2026-10-19-phase-16-camera-page/existing-e2e-rerun.log` (failure at `tests/e2e/admin.spec.ts:155`).

  ```text
  Expected: rejectAtOrAbove 0.85, reworkAtOrAbove 0.5
  Received: actions { crease: REWORK, cut: REJECT, hole: REJECT, scratch: REWORK },
            foundAtOrAbove 0.5, rejectAtOrAbove 0.85, reworkAtOrAbove 0.5
  ```

- **Suggested fix:** Update the expected snapshot in `tests/e2e/admin.spec.ts` around line 155 to include `foundAtOrAbove` and `actions`, or assert the relevant fields with a partial matcher.

### A4 — Camera axe coverage incomplete

- **Severity:** Low (coverage gap; tested states had no violations)
- **Role / page:** FM, QI, Admin `/camera`
- **Steps to reproduce:** Run the Phase 16 A4 axe check for each role and each camera state reached during S1–S8.
- **Expected:** axe 0 WCAG 2.1 A/AA violations for every reached camera state and both settings tabs.
- **Actual:** The captured `/camera` state for all three roles was Not connected. Station connected, Camera station active, and Simulator active were not axe-scanned. Settings Thresholds and Defect types were scanned with 0 violations each. S17 had revoked the station token by the time A4 ran, so those camera states were no longer available.
- **Evidence:** `A4.log`; screenshots `A4-camera-fm.png`, `A4-camera-qi.png`, `A4-camera-admin.png`, `A4-settings-thresholds.png`, `A4-settings-defects.png`.
- **Suggested fix:** Re-run A4 while each reachable station state is active, before revoking the station token.

## 5. Other observations

- Browser console recorded React hydration mismatch warnings on Settings and Review pages. The diff showed client inputs with `style={{caret-color:"transparent"}}` absent from server-rendered markup. The A4 scan still found 0 accessibility violations. Evidence: `A4.log`, `S9-check.log`, `S10-attempt1-assertion.log`, `S13-browser.log`, `S16.log`.
- The production E2E web server logged a `next start does not work with output: standalone` warning and repeated `[WebServer] Error: The destination stream closed early.` messages. Tests completed; details are in `existing-e2e-rerun.log`.
- S13 was checked before E2E ran, when the demo-reset end state had no E2E reference rows and both expected tokens were active. S17 then revoked the QA station token, and the E2E tests created their expected `e2e-rule-*` defect types.
- Final settings check (`scripts/final-settings.cjs`) confirmed found-at 0.5, early-model notice on, thresholds 0.9/0.6, Scratch Rework, Cut/Hole Reject, and Abrasion/Dirt inactive.
- The CV station’s JSONL log was copied to `cv-station-log.jsonl`; a content scan confirmed no device token appears in the text artifacts. The evaluator output and S15 doctor log are also preserved in the artifact folder.
- Temporary scenario outputs remain in `cv/out/` (`qa-eval.md`, `qa-doctor.toml`, `logs/`, and `spool/`). The execution tool rejected the attempted PowerShell deletion commands, so these were not removed. The persistent `cv/out/qa/` folder was left untouched.

## 6. Suggested fixes (priority order)

1. Bring the S14 preview config in sync with the saved app actions and found-at value, then rerun S14.
2. Update the threshold snapshot assertion in `tests/e2e/admin.spec.ts` for the Phase 16 fields.
3. Re-run A4 axe checks for all transient camera states while they are available.
