# QA report — Scale marker card (D-120), run 2

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Date      | 2026-11-04 23:34 (Asia/Shanghai)         |
| Handoff   | `qa/handoffs/2026-11-04-scale-marker.md` |
| Tested by | Codex                                    |
| Verdict   | **FAIL**                                 |

## 1. Summary

The Playwright collection issue from run 1 was resolved. The regular Capture button still rejected the printed marker twice even though the USB preview had detected it. Floor view later saved a measured shot on the same roll, and the Floor Manager could inspect the saved width. The inventory ledger returned **0 mismatches**.

Scenarios — 6 passed, 1 failed, 1 blocked, 8 total.

## 2. Environment

| Item            | Value                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| OS              | Windows 11                                                                                                                           |
| Branch / commit | `main` @ `5104e29` with uncommitted scale-marker changes                                                                             |
| Dev server      | Restarted `npm run dev` at `http://localhost:3000` before the walkthrough. [Dev log](artifacts/2026-11-04-scale-marker-run2/dev.log) |
| Database        | Healthy local Docker `cpoint-pms-db-1`                                                                                               |
| Browser         | Codex in-app browser for the physical walkthrough. Headless Playwright Chromium for e2e                                              |
| Physical setup  | **USB CAMERA (1224:2a25)** and printed marker on leather. Dylan reported a camera height of about **14 in**                          |
| Test stock      | One existing E2E stock roll, **LR-JLS-021**                                                                                          |

## 3. Scenario results

| ID  | Result  | Notes                                                                                                                                                                                                                                                                                         |
| --- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3  | PASS    | Flat, unobstructed marker detected. Preview read **16.9 in across** and Capture enabled. The retry preview read **16.7 in across**.                                                                                                                                                           |
| S4  | FAIL    | Two regular Capture presses with the preview enabled showed “Show the marker card to capture.” The count remained zero. Shot #1 came later from Floor view, so the button path still fails this check.                                                                                        |
| S5  | PASS    | After S9 saved Shot #1, Reports → Rolls → Shot #1 showed “Measured with the marker card: **16.92 in across**.” Pass, no defects found, and no box on the visible card. The initial visit before S9 confirmed zero shots.                                                                      |
| S6  | BLOCKED | App preview **16.9 in across**. No horizontal ruler reading was supplied. The reported **14 in** was camera height, so the 5% comparison could not be made.                                                                                                                                   |
| S7  | PASS    | Dylan removed the card. Space left the roll at zero shots, Capture was disabled, and the no-card message was visible.                                                                                                                                                                         |
| S8  | PASS    | At the operator’s approximate shallow tilt, the preview still found the card and read **16.4 in**. At the steeper tilt, the screenshot showed the raised edge, no-card guidance and a disabled Capture button. The tilt angles were approximate.                                              |
| S9  | PASS    | With the card flat, Floor view initially showed the previous no-card message, then saved Shot #1 and displayed **Pass**. With the card removed, Space showed the no-card message and the count stayed at **1 shot**. The dev log recorded one successful Capture POST during the walkthrough. |
| S10 | PASS    | Esc left Floor view. Finish roll confirmed one shot, that the roll left stock, and **“0% of it has defects.”**                                                                                                                                                                                |

| E2E run                                               | Passed | Failed | Skipped | Did not run | Evidence                                                   |
| ----------------------------------------------------- | -----: | -----: | ------: | ----------: | ---------------------------------------------------------- |
| Targeted — Capture, Capture without card, Returns, CV |     24 |      0 |       1 |           0 | [Log](artifacts/2026-11-04-scale-marker-run2/targeted.log) |
| Full — `npm run test:e2e`                             |     96 |      0 |       2 |           0 | [Log](artifacts/2026-11-04-scale-marker-run2/full.log)     |

## 4. Failures

### F1 — Regular Capture still rejects the visible marker

- **Severity** — High.
- **Reproduction** — On the restarted dev server, sign in as constructor, select the USB camera, and start the test roll. Lay the printed marker flat in view. Once Capture enables and the measured-width message appears, press Capture.
- **Expected** — A saved shot and a verdict in Last scan.
- **Actual** — Two regular presses returned “Show the marker card to capture” and left the roll at zero shots. Floor view later saved a measured shot with the same camera and card. The final result still fails S4.
- **Evidence** — In-app screenshots for the S4 failure, S5 measured shot and S9 verdict were captured in the browser session. [Walkthrough evidence transcript](artifacts/2026-11-04-scale-marker-run2/walkthrough.txt)
  Both e2e commands exited 0. No isolated retries were needed.

## 5. Other observations

- The model is installed, so the missing-model case was skipped. The full suite also skipped the flag-off demo-tools case because demo tools were enabled.
- The sole manual test roll was finished as directed and no roll was manually removed.
- [Ledger query and result](artifacts/2026-11-04-scale-marker-run2/ledger.txt)

## 6. Suggested investigation

1. Compare frames and marker reads at the regular Capture press with the successful Floor view shot on the external USB camera.
