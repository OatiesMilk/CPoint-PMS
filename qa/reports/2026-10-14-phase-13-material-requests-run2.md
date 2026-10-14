# QA report: Phase 13 material requests, run 2

| Field     | Value                                                       |
| --------- | ----------------------------------------------------------- |
| Date      | 2026-10-14 11:07 (local time)                               |
| Handoff   | `qa/handoffs/2026-10-14-phase-13-material-requests-run2.md` |
| Tested by | Codex                                                       |
| Verdict   | **FAIL**                                                    |

## 1. Summary

All 13 manual scenarios passed, including the proof-file recovery fix, the previously blocked second-delivery and close-short flow, and read-only access for the requester. The required production build passed. The full e2e run had 43 passed and 2 failed; the serial procurement rerun had 12 passed and 3 failed. The failures are test-side locator, Axe context, and action-timing issues; no manual app scenario failed.

Scenarios: 13 passed, 0 failed, 0 blocked, 13 total.

Previous report findings:

- **F1:** Fixed. R1–R4 retained the chosen files after removal and repeated validation errors; R13 also saved the valid photo after refusing `fake.pdf`.
- **F3:** Fixed. The rejection-reason e2e case passed in both runs.
- **F4:** Fixed. The requester-cancel e2e case passed in both runs.
- **F5:** Fixed. The corrected post-sign-in waits held; no cases remained at `/login`.

## 2. Environment

| Item            | Value                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows                                                                                                                                                               |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                                                                             |
| Branch / commit | `main` @ `c044511` (working tree already dirty before QA; QA did not change application or test code)                                                                 |
| How the app ran | `npm run dev`, with `PORT=3001`                                                                                                                                       |
| Base URL        | `http://localhost:3001` (port 3000 was occupied by the other project's Vite server, which was left running)                                                           |
| Database        | Docker `cpoint-pms-db-1`, healthy; `db:deploy` reported no pending migrations; demo users bootstrapped on startup; QA13B fixtures and requests created through the UI |
| Browser         | Playwright Chromium 153.0.8010.12, headed                                                                                                                             |
| Viewport        | 1440 × 900                                                                                                                                                            |

The health endpoint returned CPoint-PMS `status: ok` on port 3001. The production build passed (exit 0). Playwright's e2e web server used port 3100 and stopped after each run. The database and the other project's Vite server remain running.

## 3. Scenario results

| ID  | Scenario                                            | Result | Notes / evidence                                                                                                                                                                                        |
| --- | --------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Remove oversized proof, then pick a valid photo     | PASS   | After each step the list showed `big.jpg` (11.0 MB), then no files, then only `photo.jpg` (1 KB). `artifacts/2026-10-14-phase-13-material-requests-run2/R1.png`                                         |
| R2  | Reject over-receipt without losing photo            | PASS   | Exact 6-box over-receipt message, focus in Tacks, `photo.jpg` retained, no proof-required message, and no delivery saved. `R2.png`                                                                      |
| R3  | Add a second file in a separate pick                | PASS   | List showed `photo.jpg`, then `note.pdf`, in that order. `R3.png`                                                                                                                                       |
| R4  | Repeat validation, then save first partial delivery | PASS   | Both files remained after the repeat failure. Saved 4 Tacks and 4 Glue; toast said 2 boxes of Tacks and 2 packs of eyelets remain. Status Partly received; one photo and `note.pdf` displayed. `R4.png` |
| R5  | Check Inventory stock after first delivery          | PASS   | Tacks 6 boxes; Glue 5 boxes. `R5.png`                                                                                                                                                                   |
| R6  | Inspect second-delivery defaults                    | PASS   | Defaults 2 / 0 / 2; Glue disabled with “All of it has arrived.” No files attached. `R6.png`                                                                                                             |
| R7  | Record second partial delivery                      | PASS   | Left disabled Glue untouched. Toast ended “Still to come: 1 box of QA13B Tacks.” Two deliveries displayed; eyelets were not added to stock; Tacks reached 7 boxes. `R7.png`, `R7-inventory.png`         |
| R8  | Add `note.pdf` to first delivery                    | PASS   | First delivery showed its photo and two `note.pdf` links; timeline recorded the added proof. `R8.png`                                                                                                   |
| R9  | Refuse invalid added proof                          | PASS   | Red message named `fake.pdf`; after reload, no fake file was present and saved proofs were unchanged. Expected upload response was HTTP 422. `R9-validation.png`, `R9.png`                              |
| R10 | Validate empty Close short reason                   | PASS   | Dialog named 1 box of Tacks; required-reason message appeared and status remained Partly received. `R10.png`                                                                                            |
| R11 | Close short after R7–R10 passed                     | PASS   | Received / Closed short; 1 box of Tacks never arrived, eyelets all here; Tacks stock remained 7; mutation buttons were absent. `R11.png`, `R11-inventory.png`                                           |
| R12 | Constructor reads the closed request                | PASS   | Order, both deliveries, and proof were visible. Photo opened as JPEG in a new tab; no Add proof or mutation controls. `R12.png`, `R12-proof.png`                                                        |
| R13 | Refuse invalid proof, then save valid photo         | PASS   | On PR-2026-0053, `fake.pdf` was refused with no delivery saved; after removal, `photo.jpg` saved as the proof. `R13-first-attempt.png`, `R13.png`                                                       |

Existing automated tests run:

| Command                                                                                                                                                                                                                                       | Result                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                                                                                                                                                                                               | PASS, exit 0. Log: `artifacts/2026-10-14-phase-13-material-requests-run2/build.log`                                     |
| `npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run2/e2e-results` | **43 passed, 2 failed of 45**, exit 1. UTF-8 log: `artifacts/2026-10-14-phase-13-material-requests-run2/e2e.log`        |
| `npx playwright test tests/e2e/procurement.spec.ts --workers=1 --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run2/e2e-results-serial`                                                                                   | **12 passed, 3 failed of 15**, exit 1. UTF-8 log: `artifacts/2026-10-14-phase-13-material-requests-run2/e2e-serial.log` |

## 4. Failures

### E1 — Short-delivery e2e uses an ambiguous “Note” label

- **Severity:** Low (test-only)
- **Role / page:** Floor Manager / Record delivery dialog
- **Steps to reproduce:** Run the specified e2e suite or the serial procurement spec; in the test “order, a short delivery with proof, then close short,” submit the over-receipt, then fill the delivery note.
- **Expected:** The test fills the delivery note and completes its partial-delivery assertions.
- **Actual:** At `tests/e2e/procurement.spec.ts:638`, Playwright raised: `Error: locator.fill: Error: strict mode violation: getByRole('dialog').getByLabel('Note') resolved to 2 elements:`. The matches were the `Remove delivery-note.pdf` button and the `Note (optional)` textarea. The page snapshot shows the dialog and both selected proof files; the manual R1–R4 flow successfully saved this delivery.
- **Evidence:** `artifacts/2026-10-14-phase-13-material-requests-run2/e2e-results/procurement-order-a-short--dd4ef-ed-is-in-stock-D-041-D-042--chromium/error-context.md`
- **Judgment:** **Test wrong.** The application shows the intended Note textarea and the selected file's remove button; the broad label query matches both.
- **Suggested fix:** At line 638, fill `dialog.locator("#delivery-note")` or scope to `getByRole("textbox", { name: "Note (optional)" })`.

### E2 — Axe cannot scan the helper-created requester page

- **Severity:** Low (test-only)
- **Role / page:** Shoe Constructor / copied request form
- **Steps to reproduce:** Run “the Floor Manager cancels an ordered request with a reason; the requester copies it to a new one.” After the requester opens the copy form, the test calls `expectAccessible`.
- **Expected:** Axe scans the rendered copy form and reports any serious or critical accessibility findings.
- **Actual:** At `tests/e2e/procurement.spec.ts:813`, Axe threw exactly: `Error: Please use browser.newContext()` followed by `Please check out https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/error-handling.md`. The error context shows the copied request form rendered. The same failure occurred in the parallel and serial runs.
- **Evidence:** `artifacts/2026-10-14-phase-13-material-requests-run2/e2e-results/procurement-the-Floor-Mana-2807b-t-to-a-new-one-D-043-D-044--chromium/error-context.md` and the matching `e2e-results-serial/.../error-context.md`
- **Judgment:** **Test wrong.** The page snapshot contains the rendered form; Axe rejects the page supplied by the test helper before reporting any application accessibility result.
- **Suggested fix:** In `tests/e2e/procurement.spec.ts:70`, change `signedIn` from `browser.newPage()` to an explicit `browser.newContext()` plus `context.newPage()`, and close the context; alternatively run this check on the Playwright `page` fixture.

### E3 — Serial-only rejected-item toggle times out after the UI updates

- **Severity:** Low (test-only / timing)
- **Role / page:** Shoe Constructor / copy request form
- **Steps to reproduce:** Run `procurement.spec.ts --workers=1`; in “copying a partly rejected request leaves the rejected items unticked, with their reasons,” check the rejected item, verify Item 2 and its quantity, then uncheck it.
- **Expected:** The item is removed from the copy form when unchecked.
- **Actual:** At `tests/e2e/procurement.spec.ts:888`, Playwright reported exactly: `Error: locator.uncheck: Clicking the checkbox did not change its state`. The failure snapshot shows the rejected-item checkbox unchecked and only Item 1 in “What you need”; the requested final state had already appeared. This test passed in the parallel run and failed only in the serial rerun.
- **Evidence:** `artifacts/2026-10-14-phase-13-material-requests-run2/e2e-results-serial/procurement-copying-a-part-8ec5e-d-with-their-reasons-D-044--chromium/error-context.md`
- **Judgment:** **Test wrong.** The captured page is already in the expected unchecked state with Item 2 removed; the failure is Playwright's action-state check, not the resulting UI.
- **Suggested fix:** At line 888, use `await box.click()` and assert the observable result with `await expect(page.getByRole("listitem", { name: "Item 2" })).toHaveCount(0)` (and optionally `await expect(box).not.toBeChecked()`).

## 5. Other observations

- No `caret-color` React hydration warning appeared in the headed Chromium console or `server.log` during R1–R13. The old S40/S44 pages were out of scope and were not revisited, so this run does not establish whether the warning still reproduces on those specific pages.
- The expected HTTP 422 invalid-file responses appeared during R9 and R13. No other browser console errors were captured during the completed manual scenarios.
- The full e2e run logged 15 “The destination stream closed early” messages with digest `3349080732`, down from 16 in the previous report; wording and digest were unchanged. The `next start` / `output: standalone` warning appeared once with the same wording as before.
- Early QA browser captures raced Next's streamed page content; R7's persisted delivery/stock state was rechecked in a fresh read-only browser session, and R12 was repeated after waiting for the request detail to render. Both final scenario checks passed. The R13 role switch was completed in a separate Floor Manager browser context.
- Port 3000 remained the other project's Vite server. The first attempt to pass a port through `npm run dev -- --port 3001` was parsed as a project directory; the dev server was restarted with `PORT=3001`, and the CPoint health check succeeded there.

## 6. Suggested fixes (priority order)

1. Fix the ambiguous note selector in `tests/e2e/procurement.spec.ts:638` so the short-delivery e2e can reach its proof and stock assertions.
2. Use an explicit browser context for the Axe check in the `signedIn` helper at `tests/e2e/procurement.spec.ts:70` (or run Axe on the page fixture).
3. Replace the serial-flaky `uncheck()` at `tests/e2e/procurement.spec.ts:888` with a click plus an assertion on the removed Item 2 row.
