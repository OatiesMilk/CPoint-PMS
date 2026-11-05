# QA report — Scale marker card (D-120), run 3

| Field     | Value                                    |
| --------- | ---------------------------------------- |
| Date      | 2026-11-05 00:31 (Asia/Shanghai)         |
| Handoff   | `qa/handoffs/2026-11-04-scale-marker.md` |
| Tested by | Codex                                    |
| Verdict   | **FAIL**                                 |

## 1. Summary

All five regular Capture button presses saved a shot with the printed marker in view. The preview measured **16.8 in** across versus **17.5 in** measured with a tape, a **4.0%** difference. The test roll finished with six shots and **0.6% defects**. The inventory ledger returned **0 mismatches**.

Scenarios — 6 passed, 0 failed, 1 partially verified.

## 2. Environment

| Item            | Value                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| OS              | Windows 11                                                                                                                           |
| Branch / commit | `main` @ `5104e29`, with the scale-marker worktree changes                                                                           |
| App             | Restarted `npm run dev` at `http://localhost:3000` before the walkthrough. [Dev log](artifacts/2026-11-04-scale-marker-run3/dev.log) |
| Database        | Healthy local Docker `cpoint-pms-db-1`                                                                                               |
| Browser         | Codex in-app browser for the physical walkthrough. Playwright headless Chromium for e2e                                              |
| Camera / stock  | **USB CAMERA (1224:2a25)**, physical printed marker on leather, one E2E stock roll **LR-Q2786-030**                                  |

## 3. Scenario results

| ID  | Result  | Notes                                                                                                                                                                                                                               |
| --- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3  | PASS    | Flat printed marker detected at **16.8 in across**. Capture was enabled.                                                                                                                                                            |
| S4  | PASS    | **5/5 regular Capture button presses** saved a shot. The observed count progressed **0 → 1 → 2 → 3 → 4 → 5** and Last scan showed Pass for each. The former phone-setup prompt did not appear.                                      |
| S5  | PASS    | Floor Manager Reports showed five shots, five passed and zero rejected. Shot #5 read **“Measured with the marker card: 16.84 in across.”** The visible box followed the tape, outside the printed card.                             |
| S6  | PASS    | Dylan measured **17.5 in across** and **10 in down**. The **16.8 in** preview width was **0.7 in lower**, or **4.0%** of the measured width, within the handoff’s approximately 5% tolerance.                                       |
| S7  | PASS    | With the marker physically out of view, Space left the count at **5**. Capture was disabled and the no-card message was visible.                                                                                                    |
| S9  | PARTIAL | The separate Floor view Space press with the card in view saved **Shot #6** and displayed **Pass**. After the card was removed, Space left the count at six. I left Floor view before confirming the expected no-card warning text. |
| S10 | PASS    | Finish roll confirmed **6 shots**, that the roll left stock, and **“0.6% of it has defects.”**                                                                                                                                      |

| E2E run                                               | Passed | Failed | Skipped | Did not run | Evidence                                                             |
| ----------------------------------------------------- | -----: | -----: | ------: | ----------: | -------------------------------------------------------------------- |
| Targeted — Capture, Capture without card, Returns, CV |     24 |      0 |       1 |           0 | [Log](artifacts/2026-11-04-scale-marker-run3/targeted.log)           |
| Full — `npm run test:e2e`                             |     91 |      2 |       2 |           3 | [Log](artifacts/2026-11-04-scale-marker-run3/full.log)               |
| Inventory alone, one worker                           |      8 |      0 |       0 |           0 | [Log](artifacts/2026-11-04-scale-marker-run3/inventory-isolated.log) |
| Batches alone, one worker                             |      3 |      1 |       0 |           3 | [Log](artifacts/2026-11-04-scale-marker-run3/batches-isolated.log)   |

## 4. Failures and verification gaps

- The initial camera connection reported that another app was using the USB camera. After Dylan confirmed it was free, Retry opened the selected USB source and the physical test proceeded.
- S9’s no-card warning wording remained unverified. The in-app roll count and dev-server requests confirmed six shots total.
- **Inventory timeout recovered.** In the full suite, the role-access test hit its 30-second deadline while making the Quality Inspector API request at `inventory.spec.ts:360`. The isolated Inventory spec passed all eight tests.
- **Batches timeout reproduced.** The Quality Inspector phone test waited 10 seconds for the due banner at `batches.spec.ts:366`. The same check failed on the isolated run and three later serial tests did not run. The full-run snapshot showed no batches due and the first batch could be finished from 00:50. Both runs took place before 00:50. The fixture assumes the first batch is already due, which explains the observed failure. This unrecovered timeout determines the verdict. [Full-run failure context](artifacts/2026-11-04-scale-marker-run3/full-contexts/batches-the-Quality-Inspec-4db9a-the-batch-with-failed-pairs-chromium.md)

## 5. Other observations

- S4 and S5 screenshots were captured in the in-app browser session. The transcript records the button outcomes, shot detail, and server evidence. [Walkthrough transcript](artifacts/2026-11-04-scale-marker-run3/walkthrough.txt)
- The model marked the visible measuring tape as a scratch in Shot #5. Shot #6 with the tape removed passed and showed no defects. The roll’s final reported percentage includes the five shots taken with the tape visible.
- The model-installed environment skipped the missing-model test. The full suite also skipped the flag-off demo-tools branch.
- [Ledger query and result](artifacts/2026-11-04-scale-marker-run3/ledger.txt)

## 6. Suggested follow-up

Complete the Floor view no-card wording check on a roll already in a QA walkthrough.
