# QA report: Phase 20 QA fixes, run 2

| Field     | Value                                         |
| --------- | --------------------------------------------- |
| Date      | 2026-10-20 14:20 (Asia/Shanghai)              |
| Handoff   | `qa/handoffs/2026-10-20-phase-20-qa-fixes.md` |
| Tested by | Codex                                         |
| Verdict   | **FAIL**                                      |

## 1. Summary

The build and all 14 requested browser scenarios (R1–R10, A1, U1–U3) passed. The full e2e suite finished with four failures and one skipped test, so the overall verdict is FAIL. Two of the four failures are in the ten tests this handoff asked to retest.

Scenarios: 14 passed, 0 failed, 0 blocked, 14 total. E2E: 81 passed, 4 failed, 1 skipped.

## 2. Environment

| Item            | Value                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language                                                                                                                 |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                                                       |
| Branch / commit | `main` @ `cc612ee` (working tree was already dirty before this run)                                                                             |
| How the app ran | Playwright e2e web server at `127.0.0.1:3100`; `npm run dev` at `localhost:3001`; throwaway Docker app at `localhost:3005`                      |
| Base URL        | `http://localhost:3001` for R1–R10 and A1; `http://localhost:3005` for U1–U3                                                                    |
| Database        | Local Docker `cpoint-pms-db-1`; `db:deploy` found no pending migrations. Throwaway `cpoint-qa` used demo users and demo week, then was stopped. |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                                                     |
| Viewport        | 1440 × 900                                                                                                                                      |

Port 3000 was occupied by an unrelated process and was left alone. The host app used port 3001. The throwaway app used ports 3005 and 5440 with an empty certificate mount under this report's artifacts. `docker compose -p cpoint-qa stop` completed; `cpoint-qa` is stopped. The default local database remains running after the required `npm run db:up`.

## 3. Scenario results

| ID  | Scenario                                       | Result | Notes / evidence                                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | QI Review queue buttons and Fixable action     | PASS   | Six waiting rows showed Pass, Fixable, Reject. Clicking Fixable showed the “marked Fixable.” toast. [Screenshot](artifacts/2026-10-20-phase-20-qa-fixes/R1-review-fixable.png)                                                                                                                                 |
| R2  | Fixable scan Override dialog                   | PASS   | The dialog named Fixable, explained movement onto or off the Cut around or clean board and into or out of Salvage, and offered Keep the decision. No “rework” or “repair” wording appeared. [Screenshot](artifacts/2026-10-20-phase-20-qa-fixes/R2-fixable-override.png)                                       |
| R3  | Pass and Reject Override labels                | PASS   | Each dialog named its camera verdict with the same capitalization as the badge.                                                                                                                                                                                                                                |
| R4  | Operations report copy                         | PASS   | Card description matched. Open counts read “4 being handled” and “1 being handled”; no “in repair” text appeared.                                                                                                                                                                                              |
| R5  | Invalid Fixable threshold                      | PASS   | With Reject at 90, Fixable 95 showed “Fixable must start below Reject (90%).” under the invalid field and the invalid-value preview. [Screenshot](artifacts/2026-10-20-phase-20-qa-fixes/R5-threshold-invalid.png)                                                                                             |
| R6  | Corrected Fixable threshold                    | PASS   | Changing Fixable to 60 cleared the error immediately and restored all three preview bands. No test value was saved. [Screenshot](artifacts/2026-10-20-phase-20-qa-fixes/R6-threshold-restored.png)                                                                                                             |
| R7  | Empty Fixable threshold                        | PASS   | Clearing the field showed “Enter a percentage between 0 and 100.” Restored 60 without saving.                                                                                                                                                                                                                  |
| R8  | Reject below Fixable threshold                 | PASS   | Reject 50 showed the shared Fixable-below-Reject error under Fixable. Restored 90 / 60 without saving.                                                                                                                                                                                                         |
| R9  | Rolls CSV export                               | PASS   | Downloaded first header row was `Roll,Batch,Supplier,Sections,Rejected,Defects` after the UTF-8 BOM. Suppliers CSV header matched run 1. [Operations screenshot](artifacts/2026-10-20-phase-20-qa-fixes/R9-supplier-quality.png) · [Downloaded CSV](artifacts/2026-10-20-phase-20-qa-fixes/supplier-rolls.csv) |
| R10 | User-visible terminology sweep                 | PASS   | Review, Fixable scan detail and Override, Operations, Cut around or clean, Floor Manager and Quality Inspector home pages, and Admin defect settings contained none of “Rework”, “repair station”, “In repair”, “camera station”, or “Components”.                                                             |
| A1  | QI supplier-rolls access check                 | PASS   | `GET /api/v1/reports/supplier-rolls.csv` returned 403.                                                                                                                                                                                                                                                         |
| U1  | Supplier quality High badge and attention item | PASS   | On the 30-day range, Marikina Leather showed High with 104 sections, 32% Fixable and 21% rejected. The attention list said “Leather from Marikina Leather has more defects than the rest” and linked to `#supplier-quality`. [Screenshot](artifacts/2026-10-20-phase-20-qa-fixes/U1-supplier-quality.png)      |
| U2  | Scan and received-request proof photos         | PASS   | Scan image loaded at 480 × 360. The Received request proof thumbnail and opened image both loaded at 480 × 336. [Scan screenshot](artifacts/2026-10-20-phase-20-qa-fixes/U2-scan-detail.png) · [Proof screenshot](artifacts/2026-10-20-phase-20-qa-fixes/U2-received-proof.png)                                |
| U3  | Capture with no batch at Preparation           | PASS   | No in-progress batch was at Preparation when checked, so none needed moving. QI Capture showed the no-batch message and Start a batch link; Capture was disabled with “Capture is off until a batch is at Preparation.” [Screenshot](artifacts/2026-10-20-phase-20-qa-fixes/U3-capture-off.png)                |

### Setup and automated tests

| Command                                                                                      | Result                                                                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:up`                                                                              | PASS; local database started                                                                                              |
| `npm run db:deploy`                                                                          | PASS; no pending migrations                                                                                               |
| `npm run build`                                                                              | PASS; production build completed                                                                                          |
| `npm run test:e2e -- --output qa/reports/artifacts/2026-10-20-phase-20-qa-fixes/e2e-results` | **81 passed, 4 failed, 1 skipped** in 3.6 minutes; full output: [e2e.log](artifacts/2026-10-20-phase-20-qa-fixes/e2e.log) |

Eight of the ten e2e tests listed in the handoff passed. The two that still fail are the Defect types settings assertion and the Floor Manager smoke journey. The other two suite failures are the account password-reset test and the partly received procurement test. The one skipped test was the capture API test for a missing model.

## 4. Failures

### F1 — E2E admin reset: new temporary password is sent back to login

- **Severity:** High
- **Role / page:** System Admin and a newly created Quality Inspector; password reset and sign-in.
- **Steps to reproduce:** Create an account, sign in with its temporary password, choose a new password, reset it as Admin, confirm the old password is refused, then sign in with the new temporary password.
- **Expected:** Redirect to `/account/password` to choose a new password.
- **Actual:** Playwright expected `http://127.0.0.1:3100/account/password` but received `http://127.0.0.1:3100/login?reason=password-reset`. The exact failing assertion is `tests/e2e/admin.spec.ts:83`; Playwright also reported `Test timeout of 30000ms exceeded.`
- **App or test:** Likely app session handling. The page says “Your password was changed, so you were signed out” after the new temporary password was submitted, so the fresh sign-in appears to be treated as an old session.
- **Evidence:** [Login screenshot](artifacts/2026-10-20-phase-20-qa-fixes/E2E-F1-admin-reset-login.png) · [Playwright error context](artifacts/2026-10-20-phase-20-qa-fixes/e2e-results/admin-a-new-account-signs--eab48-nd-a-reset-ends-its-session-chromium/error-context.md)
- **Smallest fix to investigate:** Ensure fresh credentials sign-in stamps an `authAt` newer than `sessionsValidFrom` in [auth.config.ts](../../src/server/lib/auth.config.ts:19); compare the sign-in timestamp with the invalidation check in [auth.service.ts](../../src/server/services/auth.service.ts:159).

### F2 — E2E Defect types row is not found on the unfiltered page

- **Severity:** Medium
- **Role / page:** System Admin, Settings → Defect types.
- **Steps to reproduce:** The e2e helper inserts `e2e-clean-only`, then opens `/admin/settings?tab=defects` without searching. The test looks for that row immediately.
- **Expected:** The row contains “Clean before cutting”.
- **Actual:** `getByRole('row', { name: /e2e-clean-only/ })` found no element; `toContainText` failed at `tests/e2e/cut-around-or-clean.spec.ts:75`.
- **App or test:** Test issue. The Defect types table has a Find defect type filter and pages its rows; the assertion assumes this generated row is on the first unfiltered page.
- **Evidence:** [Unfiltered table screenshot](artifacts/2026-10-20-phase-20-qa-fixes/E2E-F2-unfiltered-defect-table.png) · [Playwright error context](artifacts/2026-10-20-phase-20-qa-fixes/e2e-results/cut-around-or-clean-Settin-34175-handled-components-are-gone-chromium/error-context.md)
- **Smallest fix:** In [cut-around-or-clean.spec.ts](../../tests/e2e/cut-around-or-clean.spec.ts:75), fill the Find defect type filter with `CLEAN_KEY` before asserting, as the other settings tests do for generated rows.

### F3 — E2E procurement test's generated constructor did not reach its home

- **Severity:** Medium
- **Role / page:** Shoe Constructor sign-in during the partly received procurement test.
- **Steps to reproduce:** The test creates a second constructor, then signs in through the `signedIn` helper after checking proof access.
- **Expected:** `http://127.0.0.1:3100/constructor`.
- **Actual:** The full suite timed out after 30 seconds; the helper assertion at `tests/e2e/procurement.spec.ts:111` expected `/constructor` and received `/login`.
- **App or test:** Not reproduced as an app issue. A later manual sign-in with the same generated test account reached `/constructor`; the screenshot records that successful recheck. This points to an intermittent e2e fixture or parallel-run issue, but the original failure remains in the suite result.
- **Evidence:** [Constructor recheck screenshot](artifacts/2026-10-20-phase-20-qa-fixes/E2E-F3-constructor-login-state.png) · [Playwright error context](artifacts/2026-10-20-phase-20-qa-fixes/e2e-results/procurement-order-a-short--dd4ef-ed-is-in-stock-D-041-D-042--chromium/error-context.md)
- **Smallest fix to investigate:** Verify the generated constructor row and copied password hash in [cv-helpers.ts](../../tests/e2e/cv-helpers.ts:171) before the sign-in at [procurement.spec.ts](../../tests/e2e/procurement.spec.ts:111); keep the account fixture isolated from concurrent suite work.

### F4 — E2E Floor Manager smoke item receives 422

- **Severity:** Medium
- **Role / page:** Floor Manager smoke journey, inventory API setup.
- **Steps to reproduce:** The test posts an inventory item with `sku: SMOKE-AD-${Date.now()}`, `category: ADHESIVE`, `unit: can`, and `openingStock: 2`, then expects 201.
- **Expected:** API returns 201 and the journey continues.
- **Actual:** `tests/e2e/smoke.spec.ts:105` received 422 instead of 201. The reproduced API response was: “2 fields need fixing. Start with this one: Keep the item code under 20 characters.” The second field error is “Enter the reorder level as a number, like 2 or 2.5.” The generated SKU exceeds the 20-character limit and the request omits required `reorderLevel`.
- **App or test:** Test issue; the inventory validator correctly rejects the payload.
- **Evidence:** [422 response screenshot](artifacts/2026-10-20-phase-20-qa-fixes/E2E-F4-inventory-422.png) · [Response JSON](artifacts/2026-10-20-phase-20-qa-fixes/E2E-F4-inventory-422.json) · [Playwright error context](artifacts/2026-10-20-phase-20-qa-fixes/e2e-results/smoke-Floor-Manager-journe-ec6e3-ceive-stock-read-the-report-chromium/error-context.md)
- **Smallest fix:** In [smoke.spec.ts](../../tests/e2e/smoke.spec.ts:101), shorten the generated SKU to 20 characters or fewer and include `reorderLevel: 0` in the payload; the required field is declared in [inventory.validator.ts](../../src/server/validators/inventory.validator.ts:51).

## 5. Other observations

- The web-server log repeated “The destination stream closed early.” This was also seen in run 1 and the handoff records it as harmless; it was not one of the four failed assertions.
- No user-visible prohibited terms were found during R10.
- QA artifact text files contain none of the `.env` password or token values.
- No application code, tests, configuration, migrations, `package.json`, `.env`, or `cv/config.toml` were edited during this run. New files are confined to `qa/reports/`.

## 6. Suggested fixes (priority order)

1. Fix the new temporary-password session handling at `src/server/lib/auth.config.ts:19` / `src/server/services/auth.service.ts:159`.
2. Search for generated defect rows in `tests/e2e/cut-around-or-clean.spec.ts:75` before asserting.
3. Stabilize the generated constructor fixture and sign-in in `tests/e2e/cv-helpers.ts:171` and `tests/e2e/procurement.spec.ts:111`.
4. Correct the smoke inventory payload in `tests/e2e/smoke.spec.ts:101` with a short SKU and `reorderLevel`.

## Needs Dylan

- [ ] P18 S3 — hold leather or a leather photo under the webcam.
- [ ] P18 S12 — check camera access from a second device over plain HTTP.
- [ ] P18 S13 — use iPhone Safari with a trusted certificate.
- [ ] P18 S14 — verify the iPhone back camera.
- [ ] P18 S15 — deny camera permission and verify the guidance.
- [ ] P18 S18 — open another app that is already holding the webcam.
