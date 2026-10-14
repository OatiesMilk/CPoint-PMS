# QA report: Phase 13 material requests, run 3 (e2e only)

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Date      | 2026-10-14 11:24 (local time)                               |
| Handoff   | `qa/handoffs/2026-10-14-phase-13-material-requests-run3.md` |
| Tested by | Codex                                                       |
| Verdict   | **FAIL**                                                    |

## 1. Summary

The production build passed. The parallel and serial e2e suites each had one failure: Axe found a serious color-contrast issue in the Record delivery dialog, and the required standalone rerun reproduced it. The three Run 2 test-harness failures (E1-E3) did not recur.

Scenarios: 1 passed, 2 failed, 0 blocked, 3 total.

## 2. Environment

| Item            | Value                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows                                                                                                              |
| Node / npm      | Node v25.2.1 / npm 11.7.0; Playwright 1.63.0                                                                         |
| Branch / commit | `main` @ `c044511` (working tree was already dirty; QA created files only under `qa/reports/`)                       |
| How the app ran | `npm run build`; Playwright started the built app with `npm run start -- -p 3100` and stopped it after each run      |
| Base URL        | `http://127.0.0.1:3100`                                                                                              |
| Database        | Docker `cpoint-pms-db-1`, healthy; `db:deploy` reported no pending migrations; the specs created their own test data |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                          |
| Viewport        | 1440 x 900 (Playwright config)                                                                                       |

No CPoint dev server was running or started. The other project's Vite server on port 3000 was left alone. The e2e server stopped after the runs; the database container remains running.

## 3. Scenario results

| ID  | Scenario                              | Result | Notes / evidence                                                                                                  |
| --- | ------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| T1  | `npm run build`                       | PASS   | Exit 0. `artifacts/2026-10-14-phase-13-material-requests-run3/build.log`                                          |
| T2  | Five-spec parallel Playwright command | FAIL   | 44 passed, 1 failed of 45. F1 is the sole failure. `artifacts/2026-10-14-phase-13-material-requests-run3/e2e.log` |
| T3  | Procurement spec with `--workers=1`   | FAIL   | 14 passed, 1 failed of 15. Same F1. `artifacts/2026-10-14-phase-13-material-requests-run3/e2e-serial.log`         |

Existing automated tests run:

| Command                                                                                                                                                                                                                                       | Result                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `npm run build`                                                                                                                                                                                                                               | PASS, exit 0                               |
| `npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run3/e2e-results` | 44 passed, 1 failed of 45; exit 1          |
| `npx playwright test tests/e2e/procurement.spec.ts --workers=1 --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run3/e2e-results-serial`                                                                                   | 14 passed, 1 failed of 15; exit 1          |
| `npx playwright test tests/e2e/procurement.spec.ts --grep 'order, a short delivery with proof, then close short: only what arrived is in stock' --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run3/e2e-results-retest`  | 0 passed, 1 failed; exit 1. Reproduced F1. |

`npm run db:up` exited 0. `npm run db:deploy` exited 0 and reported no pending migrations. Their logs are in the same artifact folder.

## 4. Failures

### F1 - T2/T3: Serious color-contrast finding in the Record delivery dialog

- **Severity:** High (serious accessibility impact)
- **Role / page:** Floor Manager / ordered request / Record delivery dialog
- **Steps to reproduce:** 1. Run the procurement spec or the five-spec command. 2. In the test `order, a short delivery with proof, then close short: only what arrived is in stock (D-041, D-042)`, open the ordered request as Floor Manager. 3. Click `Record delivery`; Axe runs at `tests/e2e/procurement.spec.ts:616`.
- **Expected:** Axe reports no serious or critical WCAG 2.1 A/AA violations in the dialog.
- **Actual:** The test failed at `tests/e2e/procurement.spec.ts:616` (soft assertion in helper line 31) with this exact finding in all three runs:

  ```text
  Error: axe on the Record delivery dialog
  color-contrast (serious): .sm\\:grid-cols-\\[minmax\\(0\\,1fr\\)_11rem\\] > .gap-1.flex-col > .text-sm | .pointer-events-none | .font-normal
  ```

  The affected nodes are the muted outstanding-quantity hint, the muted unit suffix (`roll`), and the muted `(optional)` text in the Note label. Per the handoff, this Axe soft assertion is an **app** finding. The Playwright error-context snapshots show the Quality Inspector Overview rather than the open dialog, so those snapshots do not visually show the affected elements; the Axe target and test location are recorded in each context file.

- **Evidence:** `artifacts/2026-10-14-phase-13-material-requests-run3/e2e-results/procurement-order-a-short--dd4ef-ed-is-in-stock-D-041-D-042--chromium/error-context.md`, matching contexts under `e2e-results-serial/` and `e2e-results-retest/`, plus `e2e.log`, `e2e-serial.log`, and `e2e-retest.log`.
- **Judgment:** **App wrong.** Axe consistently reports a serious `color-contrast` violation on muted foreground text in the dialog, including in the standalone rerun.
- **Suggested fix:** Increase the contrast of the muted foreground token used by these elements, likely `src/styles/tokens.css:28` for light mode (and verify the dark-mode token at line 97). If a global token change is too broad, apply a higher-contrast class to the affected text in `src/app/(app)/procurement/[id]/delivery-dialog.tsx`.

## 5. Other observations

- **E1: Fixed.** The specific `Note` selector ambiguity from Run 2 no longer fails; the short-delivery test reaches the Axe assertion at line 616.
- **E2: Fixed.** The cancel-and-copy test passes; Axe accepts the helper-created page context.
- **E3: Fixed.** The partly rejected copy test passes in both the full and serial suites.
- The full parallel run logged 25 occurrences of `The destination stream closed early`, up from 15 in Run 2. The wording and digest `3349080732` are unchanged. The serial run logged 4 occurrences and the standalone rerun logged 1.

## 6. Suggested fixes (priority order)

1. Fix the serious muted-text contrast finding in the Record delivery dialog, starting with `src/styles/tokens.css:28`; keep the affected text at or above the required contrast ratio. Re-run the procurement test after the app change.
