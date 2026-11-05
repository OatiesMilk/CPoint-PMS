# QA report — Scale marker card (D-120), run 1

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Date      | 2026-11-04 23:16 (Asia/Shanghai)         |
| Handoff   | `qa/handoffs/2026-11-04-scale-marker.md` |
| Tested by | Codex                                    |
| Verdict   | **FAIL**                                 |

## 1. Summary

The live USB camera preview detected the printed marker and enabled Capture, but the shutter repeatedly reported “Show the marker card to capture” and saved zero shots. The requested targeted and full Playwright commands both stopped during test collection. The ledger returned **0 mismatches**.

Scenarios — 8 passed, 3 failed, 3 blocked, 14 total.

## 2. Environment

| Item             | Value                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS               | Windows 11                                                                                                                                                       |
| Node / npm       | v25.2.1 / 11.7.0                                                                                                                                                 |
| Branch / commit  | `main` @ `5104e29` plus scale-marker worktree changes                                                                                                            |
| Server           | Existing CPoint-PMS `npm run dev` server at `http://localhost:3000`                                                                                              |
| Database         | Docker `cpoint-pms-db-1`, existing demo data                                                                                                                     |
| Dependency setup | `npm install` succeeded and package manifest and lockfile hashes matched before and after. [Install log](artifacts/2026-11-04-scale-marker-run1/npm-install.log) |
| Browser          | Codex in-app browser for the walkthrough. Headless Chromium for supplemental S11 and axe                                                                         |
| Camera and stock | **USB CAMERA (1224:2a25)**, physical printed card on leather, one existing E2E stock roll **LR-JLS-021**                                                         |

## 3. Scenario results

| ID  | Result  | Evidence                                                                                                                                                                                                                                                                                                                                                   |
| --- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | PASS    | With the card out of view and the roll selected, the caution and button hint both said “Show the marker card to capture.” The print link appeared and Capture was disabled.                                                                                                                                                                                |
| S2  | PASS    | The print link opened a one-page PDF with two cards and the requested placement and coverage instructions.                                                                                                                                                                                                                                                 |
| S3  | PASS    | Flat card in view, “Marker card found. This shot will be measured (16.8 in across).” Capture enabled.                                                                                                                                                                                                                                                      |
| S4  | FAIL    | Capture repeatedly rejected the full-frame recheck despite the preview detecting the card and enabling the button. The count stayed at zero. No Shot #1 or verdict appeared.                                                                                                                                                                               |
| S5  | BLOCKED | The FM’s Rolls report showed LR-JLS-021 as Being scanned with zero shots. There was no shot page on which to verify the saved scale or boxes.                                                                                                                                                                                                              |
| S6  | BLOCKED | App reading **16.8 in** at S3. Physical ruler reading **unavailable**. The 5% comparison could not be made.                                                                                                                                                                                                                                                |
| S7  | PASS    | With the card physically removed, Space left the count at zero. Capture stayed disabled and the no-card message was visible.                                                                                                                                                                                                                               |
| S8  | FAIL    | With the near-square card image the preview still detected it. After raising one edge further, Capture disabled and showed the generic no-card message. The requested tilt-specific wording was not observed. The actual angle was not independently measured.                                                                                             |
| S9  | FAIL    | Floor view showed “Show the marker card to capture” with zero shots, including a Space attempt with the flat card visible. No verdict appeared. The no-card warning was visible in Floor view.                                                                                                                                                             |
| S10 | BLOCKED | Finish roll stayed disabled because no shots were saved. Used the app’s Put roll back flow to restore the test roll to stock.                                                                                                                                                                                                                              |
| S11 | PASS    | Supplemental Playwright request with an image and UUID only returned HTTP 422, with the expected `markerCorners is required: show the marker card to capture` prefix. [API and axe log](artifacts/2026-11-04-scale-marker-run1/api-axe.log)                                                                                                                |
| S12 | PASS    | Live marker text and Capture fit at 390 × 844 in-app. Document scroll width was 375 px and the button fit from x=16 to x=359. Whole-page axe WCAG 2.1 A/AA returned zero violations at the same viewport using the repository’s simulated marker video. [Phone screenshot from the axe run](artifacts/2026-11-04-scale-marker-run1/s12-headless-phone.jpg) |
| A1  | PASS    | Signed-out PDF request redirected to `/login?callbackUrl=%2Fcpoint-scale-marker-2in.pdf`.                                                                                                                                                                                                                                                                  |
| A2  | PASS    | Floor Manager, Quality Inspector and System Admin were each redirected to `/forbidden` from `/camera/capture`.                                                                                                                                                                                                                                             |

| E2E command                   | Passed | Failed | Skipped | Collection errors | Evidence                                                   |
| ----------------------------- | -----: | -----: | ------: | ----------------: | ---------------------------------------------------------- |
| Targeted Capture, Returns, CV |      0 |      0 |       0 |                 1 | [Log](artifacts/2026-11-04-scale-marker-run1/targeted.log) |
| Full `npm run test:e2e`       |      0 |      0 |       0 |                 1 | [Log](artifacts/2026-11-04-scale-marker-run1/full.log)     |

## 4. Failures

### F1 — Enabled Capture rejects the visible card

- **Severity** — High.
- **Reproduction** — Sign in as constructor, choose the external USB camera and start the test roll. Lay the printed marker flat, fully in view. Once the measured-width message appears and Capture enables, press Capture.
- **Expected** — Shot #1 and a verdict, with a measured shot accessible from the roll.
- **Actual** — The full-frame recheck showed the no-card message while the live preview recovered to “Marker card found”. The roll stayed at zero shots across repeated attempts with the card repositioned and at phone size. The same no-card response was observed in Floor view.
- **Evidence** — In-app screenshots recorded S1, S3, the zero-shot Rolls listing for S5, and the Floor view failure for S9. The S5 shot-detail screenshot was blocked by the absence of a saved shot.

### F2 — Playwright collection stops in Capture

- **Severity** — High for QA coverage.
- **Reproduction** — Run either requested e2e command.
- **Expected** — Tests collect and run.
- **Actual** — `capture.spec.ts:419` calls `test.use(fakeCamera(false))` inside a describe group. Playwright rejected the nested `launchOptions` because they force a new worker. Both commands exited 1 before executing any test. No timeout or connection-reset retry applied.

## 5. Other observations

- The temporary phone viewport was reset after the check.
- Ledger mismatch count **0** after the test roll was put back. [Ledger query and result](artifacts/2026-11-04-scale-marker-run1/ledger.txt)

## 6. Suggested investigation

1. Compare the marker detection result from the live preview with the full-resolution USB frame read at shutter time.
2. Review the scope of the worker-level camera fixture so Playwright can collect the requested suites.
