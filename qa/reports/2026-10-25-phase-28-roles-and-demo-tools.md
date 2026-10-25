# QA report: Phase 28 — roles and demo tools

| Field     | Value                                                   |
| --------- | ------------------------------------------------------- |
| Date      | 2026-10-25 17:58 (Asia/Shanghai)                        |
| Handoff   | qa/handoffs/2026-10-25-phase-28-roles-and-demo-tools.md |
| Tested by | Codex                                                   |
| Verdict   | **FAIL**                                                |

## 1. Summary

Build and migration status passed. All three WCAG 2.1 A/AA axe scans reported zero violations. Of 25 handoff scenarios, 21 passed, 4 failed, and 0 were blocked. Demo sign-in and reset actions worked after a retry, but the first pointer click is consistently swallowed on the login page. The reset audit sequence also starts with production.lunch.default, before the expected system.demo_reset.

The full dev e2e suite had 78 passed, 2 failed, 3 skipped, and 3 did not run. Both failures persisted when rerun separately. The demo-tools e2e run had 1 passed, 2 failed, and 1 skipped. The report is **FAIL**.

## 2. Environment

| Item            | Value                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11, PowerShell 5.1                                                                                           |
| Node / npm      | v25.2.1 / 11.7.0                                                                                                     |
| Branch / commit | main @ 901031b; working tree not clean (Phase 28 builder changes present)                                            |
| How the app ran | npm run start, PORT=3001; stopped after checks                                                                       |
| Base URL        | Dev: http://localhost:3001; throwaway demo stack: http://localhost:3002                                              |
| Database        | Docker dev database at localhost:5432; existing demo data. Dev DEMO_LOGIN_TOOLS was unset/off; .env was not changed. |
| Browser         | Playwright 1.63.0, Chromium 153.0.8010.12, headless                                                                  |
| Viewport        | 1440 × 900; S1/S2 also 390 × 844                                                                                     |

npm run db:up passed. npx prisma migrate status reported 22 migrations and “Database schema is up to date.” npm run build passed. Setup and test outputs are in qa/reports/artifacts/2026-10-25-phase-28/.

The required dev e2e run created data. I removed its new rolls, scans, inventory rows, schedules, quotas, lunch rows, tokens, suppliers and users; removed its added attendance day; and restored the edited attendance marks. The before/after baseline, supplier snapshot and defect-type snapshot match. Append-only audit entries from the test run remain. The demo scenarios ran only on project cpoint-qa; its containers, network and volumes were removed after D6. Temporary environment variables were removed. Nothing in .env was changed.

## 3. Scenario results

| ID  | Scenario                                      | Result | What I saw / evidence                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Constructor home                              | PASS   | Landed on /camera/capture; desktop navigation and the 390 × 844 phone bar show only Capture. home-constructor-desktop.png, home-constructor-phone.png                                                                                                                                                                                                                                                                                         |
| S2  | QI home and notices                           | PASS   | Desktop and phone landed on /batches, with only Batches. The notice bell opened and showed no batch due. Sunday has no working batches, so the batch list is correctly absent. Targeted recheck: s2-targeted.log; screenshots home-qi-desktop-targeted.png, home-qi-phone-targeted.png.                                                                                                                                                       |
| S3  | Floor Manager navigation                      | PASS   | Exactly Overview, Batches, Attendance, Reports, Inventory. home-floor-manager.png                                                                                                                                                                                                                                                                                                                                                             |
| S4  | Admin navigation                              | PASS   | Exactly Overview, Users, Settings, Camera, API tokens, Audit log. home-admin.png                                                                                                                                                                                                                                                                                                                                                              |
| S5  | Floor Manager home                            | PASS   | Today’s batches, Attendance, Rolls today, Low stock and Daily summary present; Latest scans and Today’s inspection split absent; Rolls opens /reports/rolls.                                                                                                                                                                                                                                                                                  |
| S6  | Admin home                                    | PASS   | System health, Users, Camera, Unknown defect classes, Lunch break and Audit log present; Camera status and Lunch break links open their targets.                                                                                                                                                                                                                                                                                              |
| S7  | Admin Camera                                  | PASS   | Status and model cards rendered; no Open scan or See open rolls link. admin-camera.png                                                                                                                                                                                                                                                                                                                                                        |
| S8  | Roll and shot                                 | PASS   | Opened finished roll R-2026-0032 and its shot; the “Roll R-2026-0032” back link returned to the roll. fm-roll-detail.png, fm-scan-detail.png                                                                                                                                                                                                                                                                                                  |
| S9  | Reports links                                 | PASS   | For salvage reads Rolls and opens Rolls; Quality → Defects by type has no links.                                                                                                                                                                                                                                                                                                                                                              |
| S10 | Report tabs and CSV                           | PASS   | Operations and Quality worked; both Operations and Daily CSV downloads completed.                                                                                                                                                                                                                                                                                                                                                             |
| S11 | Removed pages                                 | PASS   | /quality-inspector and /scans returned 404.                                                                                                                                                                                                                                                                                                                                                                                                   |
| S12 | Scans API                                     | PASS   | GET /api/v1/scans returned 405; a real scan detail returned 200.                                                                                                                                                                                                                                                                                                                                                                              |
| S13 | Dev demo tools off                            | PASS   | Login had no Demo sign-in, Reset demo data or Demo mode band.                                                                                                                                                                                                                                                                                                                                                                                 |
| S14 | Dev demo endpoints off                        | PASS   | Both POST endpoints returned 404; dev roll count stayed 36.                                                                                                                                                                                                                                                                                                                                                                                   |
| A1  | QI denied pages/API                           | PASS   | All six pages ended on the 403 page; Quality API returned 403. Screenshot: A1-qi-forbidden.png.                                                                                                                                                                                                                                                                                                                                               |
| A2  | Admin denied pages/APIs                       | PASS   | All seven pages ended on the 403 page; all three APIs returned 403.                                                                                                                                                                                                                                                                                                                                                                           |
| A3  | Floor Manager denied pages                    | PASS   | All four pages ended on the 403 page.                                                                                                                                                                                                                                                                                                                                                                                                         |
| A4  | Constructor denied pages                      | PASS   | All four pages ended on the 403 page.                                                                                                                                                                                                                                                                                                                                                                                                         |
| A5  | Scan read permissions                         | PASS   | QI and Admin scan detail APIs returned 403; Admin image API returned 200.                                                                                                                                                                                                                                                                                                                                                                     |
| D1  | Tools visible with both flags on              | PASS   | Demo band, four buttons in the required order and Reset demo data appeared. D1-demo-login.png                                                                                                                                                                                                                                                                                                                                                 |
| D2  | Demo sign-in buttons                          | FAIL   | First pointer click on each of the four buttons left the page on /login and showed “Enter your email.” A second click reached the right home with the band. Audit query found one user.login with method: demo for each role. Screenshots D2-_-first-click.png, D2-_-home.png; audit: D2-demo-login-audit.log.                                                                                                                                |
| D3  | Lowercase reset confirmation                  | FAIL   | First pointer click on Reset demo data did not open the dialog; retry opened it. Lowercase reset then showed “Type RESET in capitals to reset the demo data.” and did not start progress. D3-first-click-no-dialog.png, D3-lowercase-rejected-final.png                                                                                                                                                                                       |
| D4  | Reset and fresh demo week                     | FAIL   | First pointer click did not open the dialog; retry did. RESET completed and the fresh-week message appeared. A post-reset database snapshot showed 13 demo batches/rolls and 120 scans. The first audit row was production.lunch.default, followed by system.demo_reset with origin login page; expected the reset event first. Screenshots D4-first-click-no-dialog.png, D4-resetting.png, D4-reset-complete.png; audit: D4-audit-order.log. |
| D5  | Concurrent reset lock                         | FAIL   | First pointer click did not open the dialog; retry did. The second POST returned HTTP 409 with the expected in-progress message, and the first reset completed. D5-first-click-no-dialog.png, D5-second-reset-rejected-final.png, D5-second-reset-response.txt                                                                                                                                                                                |
| D6  | Tools disabled when demo users are not seeded | PASS   | After restarting the throwaway app with SEED_DEMO_USERS=false, login had no band/tools and both endpoints returned 404. D6-login-no-tools.png, D6-check.log                                                                                                                                                                                                                                                                                   |

### Access checks and axe

The exact role, URL and HTTP status for A1–A5 and S11–S14 are in artifacts/2026-10-25-phase-28/access.txt. Protected page requests returned HTTP 200 for the page shell, then the browser moved to /forbidden and displayed the 403 page; the API responses were 403 as expected. Removed pages were 404, the scan-list API was 405, and the dev demo endpoints were 404.

| Page               | Axe result   |
| ------------------ | ------------ |
| /login             | 0 violations |
| Floor Manager home | 0 violations |
| Admin home         | 0 violations |

## Existing automated tests

| Command                                                                               | Result                                                                     |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| npm run test:e2e (dev, once)                                                          | 78 passed, 2 failed, 3 skipped, 3 did not run; see e2e.log                 |
| npx playwright test tests/e2e/batches.spec.ts --workers=1                             | 2 passed, 1 failed, 3 did not run; same failure; see e2e-rerun-batches.log |
| npx playwright test tests/e2e/smoke.spec.ts --workers=1                               | 9 passed, 1 failed; same failure; see e2e-rerun-smoke.log                  |
| npx playwright test tests/e2e/auth.spec.ts -g "demo tools" (throwaway stack, flag on) | 1 passed, 2 failed, 1 skipped; see e2e-demo.log                            |

The batch and smoke failures both persisted in isolation; neither is a test-isolation note.

## 4. Failures

### F1 — e2e batches: QI finishes a due batch

- **Severity:** High
- **Role / page:** Quality Inspector, phone viewport, /batches
- **Steps to reproduce:** Run the full e2e suite or the isolated batches spec. The QI sees the due notice and clicks “Finish batch 1”; the URL changes to /batches?finish=....
- **Expected:** A dialog for Batch 1 opens.
- **Actual:** No dialog was found.
- **Exact error:** expect(locator).toContainText(expected) failed; locator getByRole('dialog'); expected substring "Batch 1"; element(s) not found. Failing assertion: tests/e2e/batches.spec.ts:228; test starts at line 203.
- **App or test:** Likely app; navigation reached the expected URL, but the dialog did not open. Suspect src/app/(app)/batches/page.tsx:53,169 where the finish query is compared with the slot and passed to autoOpen. The exact error is in e2e.log and e2e-rerun-batches.log. Related page screenshot: S2-qi-finish-route.png (dev Sunday schedule; the e2e run did not emit a PNG).

### F2 — e2e smoke: QI and FM roll journey

- **Severity:** Medium (test failure; app journey reached the section page)
- **Role / page:** Floor Manager, roll shot page
- **Steps to reproduce:** Run the full suite or isolated smoke spec; the test reaches the FM shot page and invokes axe.
- **Expected:** Axe analyzes the page.
- **Actual / exact error:** Please use browser.newContext(), thrown by AxeBuilder.analyze at tests/e2e/smoke.spec.ts:29, called at line 150. The test created the page with browser.newPage() at line 146.
- **App or test:** Test harness. The app page rendered; suspect the test should create an explicit context before constructing the page. Screenshot: smoke-section-page.png.

### F3 — D2: demo sign-in first click is lost

- **Severity:** High
- **Role / page:** Signed-out login page on the throwaway stack
- **Steps to reproduce:** Load /login and pointer-click any demo role button once.
- **Expected:** The selected role signs in and lands on its home.
- **Actual:** The browser stays on /login; the auto-focused Email field shows Enter your email. after blur. A second click then signs in. This happened for all four roles. The successful retries produced one demo-method audit row per role.
- **App or test:** App issue, also reproduced by its e2e test. tests/e2e/auth.spec.ts test line 197 fails at line 212: expected http://localhost:3002/batches, received http://localhost:3002/login. Likely a layout shift when the email field validates on blur (src/app/(auth)/login/login-form.tsx:36,67) before the click handler in src/app/(auth)/login/demo-tools.tsx:78 can run.
- **Evidence:** D2-floor-manager-first-click.png (same outcome was observed for the other three roles); all role screenshots and exact e2e error are in the artifact folder.

### F4 — D3: reset dialog does not open on first click

- **Severity:** High
- **Role / page:** Login page, throwaway stack
- **Steps to reproduce:** Load /login; pointer-click Reset demo data once; type lowercase reset after opening the dialog.
- **Expected:** Dialog opens on the first click, then lowercase confirmation is rejected without running reset.
- **Actual:** First click left the page on login and showed Enter your email.; retry opened the dialog. Lowercase confirmation then showed the exact rejection and no progress indicator.
- **App or test:** App issue, same login-field blur/layout-shift interaction as D2; reset trigger is src/app/(auth)/login/demo-tools.tsx:136. E2E test tests/e2e/auth.spec.ts:216 timed out at line 221 waiting for the reset input; its page snapshot shows the Email field invalid and reset dialog absent.
- **Evidence:** D3-first-click-no-dialog.png, D3-lowercase-rejected-final.png, e2e-demo.log.

### F5 — D4: reset audit is not the first event

- **Severity:** High
- **Role / page:** Reset demo data on the throwaway login page
- **Steps to reproduce:** Open Reset demo data, enter RESET, submit, wait for the fresh-week message, then inspect the audit log ordered by creation time and ID.
- **Expected:** The audit log starts with system.demo_reset, whose after.origin is login page.
- **Actual:** The reset completed and the fresh-week message appeared; a post-reset data snapshot showed 13 demo batches/rolls and 120 scans. The first row was production.lunch.default at 09:53:40.374; system.demo_reset with origin login page followed at 09:53:40.381.
- **App or test:** App issue. Suspect src/server/services/demo-reset.service.ts:158,165-168, which calls ensureDefaultLunchBreak before recording the reset event; that helper records production.lunch.default at src/server/services/production.service.ts:186-198.
- **Evidence:** D4-reset-complete.png, D4-audit-order.log, D4-verification.log.

### F6 — D5: reset button first click is lost

- **Severity:** Medium
- **Role / page:** Login page, throwaway stack
- **Steps to reproduce:** Open /login, click Reset demo data, submit RESET, then POST a second {"confirm":"RESET"} while the first reset is running.
- **Expected:** Dialog opens on the first click; the concurrent request receives HTTP 409.
- **Actual:** First click left login showing Enter your email.; retry opened the dialog. The second POST returned HTTP 409 with “A reset is already running. Wait for it to finish (about a minute), then sign in.”; the first reset completed.
- **App or test:** App issue for the first click, same as D3. The reset lock behavior itself passed.
- **Evidence:** D5-first-click-no-dialog.png, D5-second-reset-rejected-final.png, D5-second-reset-response.txt.

## 5. Other observations

- S2’s first helper assertion expected a today-batches list on Sunday. The page correctly showed that no batches are scheduled; the targeted desktop and phone recheck passed and is saved in s2-targeted.log.
- npm run start emitted Next’s standalone-output warning but became ready on port 3001 and served the manual checks.
- Dev database baseline counts, supplier snapshot and defect-type snapshot match after e2e cleanup. Test audit rows remain append-only.

## 6. Suggested fixes

1. Prevent the login form’s blur validation from swallowing the first pointer click on the demo sign-in and reset buttons.
2. Make the demo reset audit row the first row as required by the handoff.
3. Check why the finish query reaches /batches without opening the requested batch dialog.
4. Update the smoke test’s page/context setup so AxeBuilder can analyze the page.

## Needs Dylan

None. Blocked scenarios: 0.
