# QA report: the card once per roll and scanning timer (D-121, run 2)

| Field     | Value                                                                       |
| --------- | --------------------------------------------------------------------------- |
| Date      | 2026-11-05 22:00 Manila                                                     |
| Handoff   | `qa/handoffs/2026-11-05-card-once-per-roll-timer.md`, including Run 1 fixes |
| Prompt    | `qa/CODEX_PROMPT_CARD_ONCE_TIMER_RUN2.md`                                   |
| Tested by | Codex                                                                       |
| Verdict   | **FAIL**                                                                    |

## 1. Summary

Manual R1–R4 passed using the USB camera and printed card: card-free reuse and reload worked, the mobile scale controls fit with axe 0, evening timing matched the clock, and CSV minutes had two decimals. Overall **FAIL** because the no-card e2e test's first capture request returned 422 rather than 201 in both required runs. All four full-suite timeout failures passed on the prescribed isolated spec reruns; the inventory ledger count was 0.

Manual scenarios: 4 passed, 0 failed, 0 blocked, 4 total.

## 2. Environment

| Item            | Value                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language                                                                     |
| Node / npm      | v25.2.1 / 11.7.0                                                                                    |
| Branch / commit | `main` @ `1793138`, expected uncommitted D-121 changes                                              |
| How the app ran | Restarted `npm run dev`; Next.js 16.3.8 at `http://localhost:3000`                                  |
| Database        | Docker Postgres `cpoint-pms-db-1`, healthy                                                          |
| Browser         | Codex in-app browser for manual USB checks; Playwright 1.63.0 Chromium, headless, for automation    |
| Viewport        | Normal desktop size, temporarily 390 × 844 for R2 and then restored; e2e desktop default 1440 × 900 |
| Camera          | USB CAMERA (1224:2a25), 1920 × 1080                                                                 |
| Time gate       | Started after 01:00 Manila; timed manual roll ran at 21:48–21:51 Manila                             |

Added one 25 sq ft roll through Inventory: **LR-MT-012**, Black cowhide (school shoes), Meycauayan Tannery, tag **QA-D121-RUN2-20261105**. It finished with 2 passed shots, 0 rejected, and 0% defects, and came off stock. Manual stock went from 3 rolls to 4 on addition and back to 3 on finishing.

## 3. Scenario results

| ID              | Scenario                                                | Result | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | ------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 (S1, S3, S5) | Start, first card shot, later shot without card, reload | PASS   | Shot #1 saved with the card; shot #2 saved without it. Scale was 17.1 in across. Reload initially showed `Scanning time --:--`, then resumed at 01:02 with the same roll and scale. A separate reload observation recorded `--:-- → 02:11`, with no 00:00 sample. Evidence: `R1-first-card-shot.png`, `R1-second-no-card.png`, `R1-reload-initial.png`, `R1-reload-restored.png`, `R2-axe.json`.    |
| R2 (S15)        | Scale-set roll at 390 × 844                             | PASS   | In-app browser scale line wrapped within the width; Read the card again and timer fit. Viewport width 390, document width 375 (no sideways scroll). Headless axe against the same open roll, same 1920 × 1080 picture size, found **0 violations**; document width 390. Evidence: `R2-mobile-controls.png`, `R2-mobile-scale-set.png`, `R2-axe.json`, `R2-axe-headless.png`. Desktop size restored. |
| R3 (S9)         | Finish and compare time                                 | PASS   | App: **02:40**. Clock: **02:40.702**, a difference of **0.702 s**, within 30 s. Same-day evening time counts under the corrected handoff. Evidence: `R3-timing.json`, `R3-finish-message.png`.                                                                                                                                                                                                      |
| R4 (S10–S12)    | Report, roll page, CSV time                             | PASS   | Reports row and roll page showed **02:40**; filtered average was **02:40 over 1 roll**. CSV showed `Scanning time=02:40` and `Scanning time (min)=2.68`, with exactly two decimals. Stored duration was 160.839 s, which rounds to 2.68 minutes; mm:ss display omits the fractional second. Evidence: `R4-rolls-report.png`, `R4-roll-page.png`, `rolls.csv`, `R4-stored-timing.txt`.               |

All artifact names above are under `qa/reports/artifacts/2026-11-05-card-once-timer-run2/`.

### R3 clock comparison

| Measurement                             | Value                          |
| --------------------------------------- | ------------------------------ |
| Clock at Start scanning click           | 2026-11-05 21:48:20.040 Manila |
| Clock at Finish roll confirmation click | 2026-11-05 21:51:00.742 Manila |
| Clock difference                        | 160.702 s (02:40.702)          |
| App finish message                      | Scanning time: 02:40.          |
| Stored start / finish (UTC)             | 13:48:21.346 / 13:51:02.185    |
| Stored elapsed time                     | 160.839 s                      |

### Automated tests

Counts below are passed / failed / skipped.

| Command                                                                                                   | Result                                          | Evidence                                                            |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/rolls.spec.ts` | **21 / 1 / 1**                                  | `targeted-e2e.log`                                                  |
| `npm run test:e2e`                                                                                        | **94 / 5 / 2**, 101 total, none not run         | `full-e2e.log`                                                      |
| Isolated timeout rerun: `npx playwright test tests/e2e/inventory.spec.ts`                                 | **8 / 0 / 0**                                   | `inventory-spec-rerun.log`                                          |
| Isolated timeout rerun: `npx playwright test tests/e2e/reports.spec.ts`                                   | **3 / 0 / 0**                                   | `reports-spec-rerun.log`                                            |
| Isolated timeout rerun: `npx playwright test tests/e2e/returns.spec.ts`                                   | **4 / 0 / 0**                                   | `returns-spec-rerun.log`                                            |
| Focused R2 accessibility / reload observation                                                             | PASS; axe **0**, timer samples `--:--`, `02:11` | `R2-accessibility.cjs`, `R2-accessibility-retry.log`, `R2-axe.json` |
| Ledger query                                                                                              | **0** mismatched inventory items                | `ledger-check.txt`                                                  |

The full suite's four timeout failures were:

- `inventory.spec.ts:267`: leather rolls are added on the item with their areas.
- `inventory.spec.ts:336`: Inventory is the Floor Manager's alone.
- `reports.spec.ts:80`: quality counts and CSV.
- `returns.spec.ts:121`: over-limit roll at Finish roll.

All four passed when their specs ran alone once. The capture API role test passed in both required runs (32.0 s targeted; 34.6 s full). The D-121 start-timer test passed in both runs, so the previous 401 failures are resolved. The one remaining non-timeout failure is below.

## 4. Failures

### F1 — E2E: The first capture in the no-card regression test returns 422

- **Severity:** High
- **Role / page:** Constructor; `POST /api/v1/scans/capture` in `tests/e2e/capture-no-card.spec.ts`
- **Steps to reproduce:** Run the targeted command above or `npm run test:e2e`. The test “after the roll's first shot with the card, Capture works without it (D-121)” signs in, starts its fixture roll, reads the fake camera's picture size, and posts its first JPEG with `MARKER_ON_SAMPLE`.
- **Expected:** First capture returns 201, allowing the test to verify card-free reuse.
- **Actual:** First capture returns 422 at line 98 in both the targeted and full suite runs. This is an HTTP status assertion failure, not a timeout or ECONNRESET.

  ```text
  Expected: 201
  Received: 422
  tests/e2e/capture-no-card.spec.ts:98
  ```

- **Evidence:** `artifacts/2026-11-05-card-once-timer-run2/targeted-e2e.log`, `full-e2e.log`, and saved full-run error contexts in `full-error-contexts/`.
- **Suggested fix:** Investigate the 422 response body and the marker/image-size fixture in this test and capture validation. The current logs do not establish whether the request fixture or application rejection is the cause. The real USB first shot and card-free second shot passed manually.

## 5. Other observations

- Run 1 F1 was an incorrect handoff expectation. The revised same-day evening timing rule passed in this run.
- During camera initialization after reload, the different-picture-size warning appeared briefly before the original scale returned. The timer showed `--:--` during that initial state.
- The CSV minute value includes the stored fractional second: 160.839 ÷ 60 = 2.68065 → 2.68. Dividing the truncated display 02:40 alone would give 2.67.
- R2's initial accessibility harness attempt encountered an ambiguous label locator. Only the QA artifact script was corrected to target the Roll combobox; its completed check passed. The initial harness log is preserved as `R2-accessibility.log`.
- The ledger check ran after the required suite and isolated reruns and returned 0.

## 6. Suggested fixes (priority order)

1. Resolve the reproducible 422 first-capture failure in `capture-no-card.spec.ts` before the next QA run.
