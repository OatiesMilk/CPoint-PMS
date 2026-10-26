# QA report: Phase 30A — rolls from Inventory

| Field     | Value                                                      |
| --------- | ---------------------------------------------------------- |
| Date      | 2026-10-26 22:35 (Asia/Shanghai, UTC+8)                    |
| Handoff   | `qa/handoffs/2026-10-26-phase-30a-rolls-from-inventory.md` |
| Prompt    | `qa/CODEX_PROMPT_PHASE_30A.md`                             |
| Tested by | Codex                                                      |
| Verdict   | **FAIL**                                                   |

## 1. Summary

The manual inventory → Capture → Finish batch → Correct → Remove workflow passed, including stock movements and role restrictions. Build and migration checks passed; the ledger stayed balanced throughout. The release gate fails because three e2e tests still fail in their file reruns, including a serious toast contrast finding; demo-item pagination remains blocked by the starting data.

Scenarios: **21 passed, 0 failed, 1 blocked, 22 total** (S1–S17, A1–A5). E2e failures below are additional findings, not counted as manual scenario failures.

Full suite: **81 passed, 4 failed, 2 skipped, 3 did not run** (90 discovered). Single-worker file reruns: **27 passed, 3 failed** across four files. These totals describe separate runs and must not be added as unique tests.

Artifacts: [2026-10-26-phase-30a](artifacts/2026-10-26-phase-30a/). No application code, tests, migrations, configuration, package files or environment files were edited. No reset, branch, commit, push or PR was performed.

## 2. Environment

| Item            | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| OS              | Windows, PowerShell                                                                 |
| Node / npm      | v25.2.1 / 11.7.0                                                                    |
| Branch / commit | `main` @ `c827311`; existing uncommitted Phase 30A changes                          |
| App             | Production build, `npm run start`, port 3001                                        |
| Base URL        | `http://localhost:3001`; e2e used `E2E_BASE_URL` pointing here                      |
| Database        | Local Docker `cpoint-pms-db-1`, existing demo/e2e data                              |
| Browser         | Playwright Chromium 153.0.8010.12, headless throughout                              |
| Viewports       | 1440 × 900; S7/S8/S10 at 390 × 844                                                  |
| Camera          | Fake Chromium media device and permission flags; installed model `yolo-v1-1d729fb0` |
| Credentials     | Loaded from `.env`; not printed or copied into artifacts                            |

Setup outputs: [db-up.txt](artifacts/2026-10-26-phase-30a/db-up.txt), [migrate-status.txt](artifacts/2026-10-26-phase-30a/migrate-status.txt), [build.txt](artifacts/2026-10-26-phase-30a/build.txt), [server.log](artifacts/2026-10-26-phase-30a/server.log). PowerShell rendered native stderr as `NativeCommandError` records in some logs; those records alone do not indicate a failed command. Docker reported Running; migration status reported up to date; the build compiled and completed its route output.

The migration `20261028090000_rolls_from_inventory` has a non-null completion timestamp, verified in the migration table in `ledger.txt`. Starting roll states were OPEN 29, FINISHED 19, CANCELLED 5, with **no IN_STOCK or USED**. Every supplier had a code. The required reset-style starting fixture was therefore absent; the prompt forbids Codex from resetting this project, so it was left intact. The demo LR-001 item showed 9 rolls on hand but had no Inventory-linked roll records. This is a setup limitation, not evidence that the new add-roll transaction lost stock.

## 3. Scenario results

| ID  | Scenario                               | Result      | Observations / evidence                                                                                                                                                                                                                              |
| --- | -------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Supplier codes                         | PASS        | Settings Code column; MT, MLT, JLS verified.                                                                                                                                                                                                         |
| S2  | Create leather item                    | PASS        | Own QA30 hide starts at 0 rolls; no Opening stock input; Rolls card and Add rolls; no Update stock control. `S2-page.txt`. See code-entry variation below.                                                                                           |
| S3  | Area validation                        | PASS        | Blank, 0, 24.125, abc all refused; messages name Roll 1. `S3-errors.json`, `S3-add-rolls-error.png`.                                                                                                                                                 |
| S4  | Add three rolls                        | PASS        | LR-MT-001 = 24.5 sq ft; -002 = 31.75, tag T-1; -003 = 18. Three Not scanned rows; on hand 3; Defect % placeholder; three Added movements. `S4-rolls-table.png`, `S4-page.txt`, `own-item-movements.json`.                                            |
| S5  | Read-only leather stock row            | PASS        | Own leather row contains explanatory link/text and zero inputs.                                                                                                                                                                                      |
| S6  | Remove unscanned roll                  | PASS        | Blank reason: “Write why this roll is removed.” Wrong colour removes LR-MT-003; stock becomes 2; OUT movement -1. `S6-page.txt`.                                                                                                                     |
| S7  | Capture picker, phone                  | PASS        | Lists both remaining QA rolls with item/supplier/area; removed roll absent. Only two ready rolls existed, so the conditional >5 Find box branch was not exercised. `S7-capture-list-390.png`, `S7-page.txt`.                                         |
| S8  | Pick, put back, scan, finish           | PASS        | LR-MT-001 picked with 24.5 sq ft / 0 shots; confirmation and put-back toast; picked again; two real app capture requests using fake camera; finished and absent from dropdown. `S8-capture-picked-390.png`, `S9-item.txt`, `S9-report.txt`.          |
| S9  | Inventory and roll detail              | PASS        | Scanned, 2 shots, 24.5 sq ft, leather item link and Remove control verified. Link includes SKU as well as name.                                                                                                                                      |
| S10 | Fully used at Finish batch             | PASS        | Batch 1 was due (08:00–17:00, finished late). Only scanned own roll offered; ticked it; pairs 10, failed 0; fully-used confirmation and row; stock 1. `S10-finish-batch-390.png`, `S10-batch-finished-390.png`, `S10-fully-used-no-remove.png`.      |
| S11 | Correct unticks                        | PASS        | Checkbox began checked; reason Roll not finished; untick restored Scanned / stock 2; Fully used line disappeared.                                                                                                                                    |
| S12 | Remove scanned / prohibit used removal | PASS        | Own scanned roll removed with reason, stock 1. A Fully used roll had no Remove control, checked while the own roll was USED before S11 (no demo USED roll existed).                                                                                  |
| S13 | Supplier initials and code validation  | PASS        | Own QA30 Leather Works saved QLW. MT duplicate rejected; 2AB rejected with required code-format message. `S13-errors.txt`, `S13-supplier-validation.png`.                                                                                            |
| S14 | Demo-item chips and paging             | **BLOCKED** | LR-001 has no linked roll rows; chips open empty states and no roll pager is available. Own-item Not scanned/Removed populated filters worked; demo-item populated filters/pagination cannot be certified. `S14-filters.json`, `S14-own-rolls.json`. |
| S15 | Legacy roll                            | PASS        | Existing R-… detail shows Before rolls came from Inventory, no linked item or area. Legacy rolls absent from the Inventory-linked tick list. `S15-old-roll.txt`.                                                                                     |
| S16 | Required five axe scans                | PASS        | Zero violations in each required surface; full JSON listed below. Separate e2e toast finding remains unresolved.                                                                                                                                     |
| S17 | Ledger after each transition           | PASS        | 0 after S4, S6, S10, S11, S12, as tabulated below.                                                                                                                                                                                                   |
| A1  | Non-FM add rolls                       | PASS        | QI/Admin/Constructor POST item rolls → 403 (3 requests).                                                                                                                                                                                             |
| A2  | Non-Constructor ready/start            | PASS        | FM/QI/Admin GET ready and POST start → 403 (6 requests).                                                                                                                                                                                             |
| A3  | Non-FM remove                          | PASS        | QI/Admin/Constructor POST remove → 403 (3 requests).                                                                                                                                                                                                 |
| A4  | Removed create-roll endpoint           | PASS        | All four signed-in roles POST `/api/v1/rolls` → 405 (4 requests).                                                                                                                                                                                    |
| A5  | Manual leather stock increase          | PASS        | FM POST inventory updates → 422; message says QA30 hide is counted from its rolls (1 request).                                                                                                                                                       |

All **17 HTTP requests**, with role, method, URL, status and response, are in [access.txt](artifacts/2026-10-26-phase-30a/access.txt).

### Ledger evidence

| Point                                             | off_ledger | Own leather on hand |
| ------------------------------------------------- | ---------- | ------------------- |
| Before browser QA (`ledger.txt`)                  | 0          | Item not created    |
| After S4 (`ledger-S4.txt`)                        | 0          | 3                   |
| After S6 (`ledger-S6.txt`)                        | 0          | 2                   |
| After S10 (`ledger-S10.txt`)                      | 0          | 1                   |
| After S11 (`ledger-S11.txt`)                      | 0          | 2                   |
| After S12 (`ledger-S12.txt`)                      | 0          | 1                   |
| Immediately after full e2e (`ledger-after.txt`)   | 0          | 1                   |
| After reruns and diagnostics (`ledger-final.txt`) | 0          | 1                   |

The three whole-database snapshots also contain status counts and supplier codes. Final own-roll states: LR-MT-001 Removed, LR-MT-002 Not scanned, LR-MT-003 Removed.

### Accessibility evidence

WCAG 2 A/AA and 2.1 A/AA tags were used for every manual axe run.

| Surface                             | Violations / serious / critical | Artifact                 |
| ----------------------------------- | ------------------------------- | ------------------------ |
| Item with Add rolls error dialog    | 0 / 0 / 0                       | `axe-add-rolls.json`     |
| Capture Scan a roll list, 390 px    | 0 / 0 / 0                       | `axe-capture-list.json`  |
| Finish batch with tick list, 390 px | 0 / 0 / 0                       | `axe-finish-batch.json`  |
| Reports Rolls                       | 0 / 0 / 0                       | `axe-reports-rolls.json` |
| Settings Suppliers                  | 0 / 0 / 0                       | `axe-suppliers.json`     |
| Extra: settled stock-update toast   | 0 / 0 / 0                       | `axe-stock-toast.json`   |

The smoke file rerun separately reported **serious color-contrast** on `div[data-title=""]` after stock update. It is recorded as F5, despite the clean required scans and clean supplemental scan.

### Automated tests

Full command: `npm run test:e2e -- --output=qa/reports/artifacts/2026-10-26-phase-30a/playwright`, with the production server selected through `E2E_BASE_URL`. [e2e.log](artifacts/2026-10-26-phase-30a/e2e.log).

Each failed file was then run alone, sequentially, using `npm run test:e2e -- tests/e2e/<file>.spec.ts --workers=1 --output=<artifact directory>`. [e2e-rerun.log](artifacts/2026-10-26-phase-30a/e2e-rerun.log).

| Run                     | Passed | Failed | Skipped | Not run |
| ----------------------- | ------ | ------ | ------- | ------- |
| Full suite              | 81     | 4      | 2       | 3       |
| admin.spec.ts alone     | 5      | 1      | 0       | 0       |
| batches.spec.ts alone   | 6      | 0      | 0       | 0       |
| inventory.spec.ts alone | 7      | 1      | 0       | 0       |
| smoke.spec.ts alone     | 9      | 1      | 0       | 0       |

The full suite's two conditional skips were demo-tools-off coverage while demo tools are on, and model-missing coverage while the model is installed. The three not-run tests were the remaining tests in the serial batches file after its failure (FM fallback, Admin Batches access, Constructor/old-page access); all ran successfully in the batches file rerun. Capture, rolls and supplier-quality changed specs had no failure; changed admin, batches, inventory and smoke findings follow.

## 4. Failures

### F1 — Supplier test still selects rows by supplier name

- **Severity:** High (required e2e gate fails).
- **Test:** `a deactivated supplier disappears from the roll supplier lists (Phase 26)`; declared `tests/e2e/admin.spec.ts:220`, fails at **232** in both runs.
- **Steps:** Add supplier with generated code, fill Find supplier with its name, locate row by that name.
- **Expected:** Row contains `0917 123 4567`.
- **Actual:** `expect(locator).toContainText(expected) failed`; `getByRole('row', { name: 'E2E Supplier 43ba8c' })`; `Error: element(s) not found` after 10000 ms.
- **App or test:** **Test looks wrong.** Supplier was saved. `reference-manager.tsx:185` labels the row using the first column, now Code. Diagnostic name selector matches 0 and code selector matches 1.
- **Evidence:** `F1-admin-code-row.png`, `F1-row-diagnostic.json`, full/rerun admin error-context files.
- **Suggested fix for Claude:** Review name-based row locators in `tests/e2e/admin.spec.ts:232` and later lines against `src/app/(app)/admin/settings/reference-manager.tsx:185`. No fix applied.

### F2 — Batch stock assertion shares an item with parallel tests

- **Severity:** High (test-isolation note after successful rerun).
- **Test:** `the Quality Inspector on a phone gets the notice and finishes the batch with failed pairs`; declared `tests/e2e/batches.spec.ts:211`, fails at **293** in full run.
- **Steps:** Create scanned roll and unscanned roll, snapshot shared item's on-hand count, finish batch ticking scanned roll, assert exact count decreased by one.
- **Expected / actual:** `{status: "USED", onHand: 9}` / `{status: "USED", onHand: 10}`.
- **App or test:** **Test isolation looks wrong.** Entire batches file passes with one worker. `tests/e2e/cv-helpers.ts:64` reuses `LR-E2E-<supplierCode>` across tests; concurrent roll additions can alter the aggregate between snapshots. Manual own-item stock transitions and all ledger checks passed.
- **Evidence:** full batches error-context file; `e2e-rerun.log`; `S10-batch-finished-390.png` (manual equivalent, not original failed test screenshot).
- **Suggested fix for Claude:** Review shared item setup in `tests/e2e/cv-helpers.ts:64` and absolute count assertion at `tests/e2e/batches.spec.ts:293`.

### F3 — Materials test fails to reach its item through pagination

- **Severity:** High (repeatable e2e failure).
- **Test:** `Reports → Materials shows what an item used this week, and the CSV`; declared `tests/e2e/inventory.spec.ts:159`, fails at **187** in both runs.
- **Steps:** Create item, use 4 and correct -1, open report, repeatedly click Next while searching for its row.
- **Expected:** 4 boxes this week and 5 boxes on hand.
- **Actual:** `getByRole('row', { name: /OT-E11E9DD/ }).getByRole('cell').nth(1)` not found after 10000 ms. Rerun similarly fails for `OT-E654190`.
- **App or test:** **Test navigation timing looks wrong.** The loop at lines 180–185 checks immediate locator counts without waiting for the next page's content. A separate read-only diagnostic using completed page loads found rerun item OT-E654190 on page 3 with exactly 4 boxes used / 5 boxes on hand.
- **Evidence:** `F3-materials-item-found.png`, `F3-pagination-diagnostic.json`, full/rerun inventory error-context files.
- **Suggested fix for Claude:** Review navigation synchronization in `tests/e2e/inventory.spec.ts:180`–187. Report pagination is in `src/app/(app)/reports/materials/page.tsx:214`.

### F4 — Smoke stock input timeout in full run

- **Severity:** High.
- **Test:** `Floor Manager journey: read the rolls, update stock, read the report`; declared `tests/e2e/smoke.spec.ts:87`, full failure at **124**.
- **Steps:** Create adhesive, navigate Inventory → item → Update stock, fill Added field.
- **Expected:** `Added to Smoke cement SMK-25009966` becomes available.
- **Actual:** `locator.fill: Test timeout of 30000ms exceeded`, waiting for that label.
- **App or test:** **Test/navigation timing suspected, not conclusively isolated.** File rerun passed this fill/save and failed later on F5. In a read-only diagnostic the unfiltered sheet had zero matching inputs; using Find an item made the input available. This does not prove the original timeout had the same cause, because its item link carries a search query.
- **Evidence:** `F4-update-unfiltered.png`, `F4-update-filtered.png`, `F4-update-diagnostic.json`; full smoke error-context file. Diagnostic screenshots are reproductions of visibility conditions, not screenshots captured at the original failed assertion.
- **Suggested fix for Claude:** Review `tests/e2e/smoke.spec.ts:123`–124 and item-to-sheet navigation readiness; sheet filtering at `src/app/(app)/inventory/update/update-sheet.tsx:282`.

### F5 — Smoke rerun catches serious contrast on stock toast

- **Severity:** High (serious accessibility gate failure).
- **Test:** Same smoke journey; rerun fails at **tests/e2e/smoke.spec.ts:41**, called from **127**.
- **Steps:** Update stock, wait for “Stock updated: 1 item.”, run axe immediately.
- **Expected:** No serious or critical violation.
- **Actual:** `axe on http://localhost:3001/inventory/update?q=SMK-25182539`; received `["color-contrast (serious): div[data-title=\"\"]"]` instead of `[]`.
- **App or test:** **Unresolved; timing-sensitive test finding is plausible.** Supplemental own-item save captured a very faint entering toast in `F5-stock-toast.png`; its later axe result had no violations and computed toast opacity was 1. This supports an entrance-animation sampling issue but does not justify dismissing the failed gate or asserting the app has no accessibility issue.
- **Evidence:** `e2e-rerun.log`, rerun smoke error-context file, `F5-stock-toast.png`, `axe-stock-toast.json`, `F5-toast-style.json`. The original smoke run does not save full axe JSON; the log includes rule, seriousness and selector.
- **Suggested fix for Claude:** Inspect `src/components/ui/toaster.tsx:8`–16, Sonner entrance behavior and the scan timing at `tests/e2e/smoke.spec.ts:127`. No fix or test loosening applied.

### Needs Dylan

**S14 is BLOCKED.** Provide the requested demo setup, with linked Inventory roll records on Black cowhide (school shoes), so populated status chips and Roll pages can be checked. Codex did not run the prohibited reset. The broader starting-fixture mismatch (no IN_STOCK or USED rolls) is documented in `ledger.txt`; manual own-data tests covered the core new states without changing other rolls.

## 5. Other observations

- All manual roll additions, ticks, unticks and removals concerned the single item created by this run. Its code initially saved as `LR-004QA30-1` during the automated form entry, despite filling QA30-1; after noticing this, the own item was edited through the UI to **QA30-1**. `QA-item-code.txt` records the variation. No pre-existing item received rolls or a tick. The cause of the initial combined code was not isolated.
- Created own supplier QA30 Leather Works (QLW) and an extra nonleather QA30-TOAST item for toast diagnostics. QA30-TOAST ends at 1 box. Existing suite adds its normal E2E data; no cleanup/reset was performed. Own leather ends with one unscanned 31.75 sq ft roll in stock.
- Fake camera produced a Pass shot with a listed Hole detection at 29% on one shot (`S9-report.txt`); no claim is made that fake-camera detections are a reliable model-quality test.
- Early manual harness attempts had locator/state timing errors (including treating `constructor` as an inherited object property). Only the final successful checks count above. Their debug logs/screenshots remain in artifacts for transparency; they are not application failures.
- The production server started for QA on port 3001 was stopped after the run. The database container was left running. Artifact text was checked against the loaded demo/admin passwords and auth secret; no matches were found.
- No screenshot-on-failure setting was changed for existing e2e tests. Their original evidence is the unmodified test log and Playwright error-context snapshot. Screenshots for those findings were collected through separate diagnostics or the manual equivalent and are labeled accordingly.

## 6. Suggested fixes (priority order)

1. Claude should resolve the repeatable admin row-selector and materials-pagination test failures (F1, F3).
2. Claude should investigate the smoke contrast finding and its earlier input timeout (F4, F5), retaining the accessibility gate.
3. Claude should isolate the batch test's stock item from parallel roll creation (F2).
4. Dylan should supply the missing demo-linked roll fixture for blocked S14, then request a recheck. No application or test fixes were made by Codex.
