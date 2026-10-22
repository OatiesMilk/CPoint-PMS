# QA report: Phase 22 Attendance

| Field     | Value                                           |
| --------- | ----------------------------------------------- |
| Date      | 2026-10-21 12:50 (local time)                   |
| Handoff   | `qa/handoffs/2026-10-21-phase-22-attendance.md` |
| Tested by | Codex                                           |
| Verdict   | **FAIL**                                        |

## 1. Summary

The migration and production build passed. The access, API validation, pager, and demo seed/reset checks worked. S1’s summary omitted “0 others present,” S2 expected the seeded name “Demo Floor Manager” while the existing dev account is named Ivy, and the full e2e suite had two stale auth expectations.

Scenarios: 16 passed, 2 failed, 0 blocked, 18 total (including E1, the automated attendance checks).

## 2. Environment

| Item            | Value                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| OS              | Microsoft Windows NT 10.0.26200.0                                                                                                                |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                                                        |
| Branch / commit | `main` @ `cc612ee` (working tree already contained Phase 20–22 changes; QA artifacts added under `qa/reports/`)                                  |
| How the app ran | `npm run dev`                                                                                                                                    |
| Base URL        | `http://localhost:3001` (port 3000 belonged to an unrelated app and was left untouched)                                                          |
| Database        | Docker `cpoint-pms-db-1`; `SEED_DEMO_USERS=false`, `SEED_DEMO_WEEK=false`; existing dev roster had 18 active Shoe Constructors and 4 other roles |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                                                      |
| Viewport        | 1440 × 900                                                                                                                                       |

`db:deploy` reported no pending migrations. `npm run build` passed. Setup output is in `qa/reports/artifacts/2026-10-21-phase-22-attendance/`.

The dev database had no attendance days before testing. The e2e and manual checks created days for 2026-10-20 and 2026-10-21; I removed their 27 marks first, then removed those two days. Final verification found 0 attendance days, 0 attendance marks, and 0 temporary `qa-pager` users. The saved baseline was restored.

## 3. Scenario results

| ID  | Scenario                                                  | Result | Notes / evidence                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | FM opens Attendance from Production                       | FAIL   | Attendance was first under Production; role badges, Present boxes and disabled Next day were present. The saved-day summary showed “1 of 18 Shoe Constructors present” but omitted the expected “· 0 others present.” Roster: 22 people, page 1 of 2. See F1. `S1-attendance-today.png`                               |
| S2  | Mark everyone present, change two people, save and reload | FAIL   | Save read “Save attendance (2 changes)”; summary was “17 of 18 Shoe Constructors present · 3 others present”; reload preserved ticks and disabled Save. Attribution was “Last saved by Ivy,” not the handoff’s “Demo Floor Manager.” See F2. `S2-attendance-saved.png`                                                |
| S3  | FM home Attendance card                                   | PASS   | Card matched S2’s saved summary and Edit linked to `/attendance`. `S3-floor-manager-card.png`                                                                                                                                                                                                                         |
| S4  | Edit yesterday and return to today                        | PASS   | Saved one change for 2026-10-20; Back to today returned to 2026-10-21. `S4-yesterday-saved.png`                                                                                                                                                                                                                       |
| S5  | Locked day and seven-day boundary                         | PASS   | 2026-10-13 was locked with no edit controls; 2026-10-14 remained editable. `S5-locked-day.png`                                                                                                                                                                                                                        |
| S6  | Unsaved navigation prompts                                | PASS   | Day change and Batches link showed “Leave without saving attendance? Your ticks on this day will be lost.” Reload emitted `beforeunload`; clean navigation did not prompt. Screenshot captures the dirty page immediately before the browser-native modal; see `S6-leave-prompt.txt`.                                 |
| S7  | Stale save across two tabs                                | PASS   | Tab 2 showed “Someone else saved this day’s attendance. Refresh to see it.” Reload showed tab 1’s save and discarded tab 2’s tick. `S7-stale-save.png`                                                                                                                                                                |
| S8  | Find, role filter and pager                               | PASS   | Search and both role filters narrowed correctly. The existing 22-person roster had 7 rows on page 2; a tick survived paging, search and filtering, and Save showed 1 change. `S8-filter-and-pager.png`                                                                                                                |
| S9  | Invalid dates                                             | PASS   | `2026-02-30` and `nonsense` both displayed the invalid-date warning and today’s heading.                                                                                                                                                                                                                              |
| S10 | Invalid attendance API saves                              | PASS   | Future day: 409 “Attendance can’t be taken for a future day.” Locked day: 409 “Days more than 7 days ago are locked.” Off-roster ID: 409 “Someone in this list isn’t on the roster for 21 Oct. Refresh the list.” Duplicate ID: 422 “The same person is in the list twice. Refresh the page and save again.”          |
| S11 | Per-person attendance figures                             | PASS   | Inspected `/reports` and `/admin/users`; found no per-person attendance history, count, percentage or streak. `S11-reports.png`, `S11-users.png`                                                                                                                                                                      |
| A1  | Quality Inspector access                                  | PASS   | No Attendance nav; page redirected to `/forbidden`; GET API returned 403.                                                                                                                                                                                                                                             |
| A2  | Shoe Constructor access                                   | PASS   | No Attendance nav; page redirected to `/forbidden`; GET API returned 403.                                                                                                                                                                                                                                             |
| A3  | System Admin read-only access                             | PASS   | Read-only message visible, no edit controls; PUT API returned 403.                                                                                                                                                                                                                                                    |
| A4  | Signed-out access                                         | PASS   | Page redirected to `/login`; GET API returned 401.                                                                                                                                                                                                                                                                    |
| D1  | Seeded demo attendance week                               | PASS   | Today was untaken. The five prior non-Sunday workdays had 1, 5, 0, 3, 2 constructors absent, 12 constructors on each, saved by Demo Floor Manager at 7:50 AM. Today had 12 seeded demo constructors plus the demo Shoe Constructor account (13 constructors total). `D1-today-not-taken.png`, `D1-oldest-workday.png` |
| D2  | Throwaway demo reset                                      | PASS   | Dry run targeted the throwaway stack and reported 14 batches and 5 attendance days. After reset, 12 demo constructors remained; 14 batches and 5 attendance days were reseeded.                                                                                                                                       |
| E1  | Attendance e2e coverage                                   | PASS   | All 7 tests in `attendance.spec.ts` passed as part of the full suite.                                                                                                                                                                                                                                                 |

Existing automated tests run:

| Command             | Result                                                |
| ------------------- | ----------------------------------------------------- |
| `npm run db:up`     | PASS; dev DB container already running                |
| `npm run db:deploy` | PASS; no pending migrations                           |
| `npm run build`     | PASS                                                  |
| `npm run test:e2e`  | 92 passed, 2 failed, 1 skipped (95 tests in 15 files) |

The one skipped test was the model-dependent “without the model files…” capture test; the model was present. The full console output is saved in `qa/reports/artifacts/2026-10-21-phase-22-attendance/e2e.log`.

## 4. Failures

### F1 — S1: Summary omits the zero-other count

- **Severity:** Medium (expected count is missing from a user-visible summary)
- **Role / page:** Floor Manager / `/attendance`
- **Steps to reproduce:** Open today’s saved attendance when a Shoe Constructor is present and no other role is present.
- **Expected:** `1 of 18 Shoe Constructors present · 0 others present`.
- **Actual:** `1 of 18 Shoe Constructors present`.
- **Evidence:** `qa/reports/artifacts/2026-10-21-phase-22-attendance/S1-attendance-today.png`
- **Suggested fix:** `src/lib/attendance-rules.ts:119` returns early when `othersPresent === 0`. Always append the other-role count, including zero.

### F2 — S2: Saved-by label differs from the handoff’s demo account name

- **Severity:** Medium (scenario expectation / local fixture mismatch; save behavior was correct)
- **Role / page:** Floor Manager / `/attendance`
- **Steps to reproduce:** Sign in as `manager@cpoint.local`; mark everyone present; untick one constructor and one other role; save and reload.
- **Expected:** Save summary and “Last saved by Demo Floor Manager, …”.
- **Actual:** Save count and summary were correct, but the page said “Last saved by Ivy, Oct 21, 2026, 12:35 PM.” The configured dev account is Ivy, so the app displayed the active saver’s name.
- **Evidence:** `qa/reports/artifacts/2026-10-21-phase-22-attendance/S2-attendance-saved.png`
- **Suggested fix:** Update `qa/handoffs/2026-10-21-phase-22-attendance.md:127` to expect the configured Floor Manager name (or run S2 against the seeded demo account). No app change is indicated.

### F3 — Full e2e: `constructor signs in, lands on their home and sees only their nav`

- **Severity:** Low (stale test expectation)
- **Role / page:** Shoe Constructor / `/constructor`
- **Failing test:** `auth.spec.ts › constructor signs in, lands on their home and sees only their nav` (`tests/e2e/auth.spec.ts:60:7`); assertion fails at line 64.
- **Steps to reproduce:** Run `npm run test:e2e`; sign in as the constructor account; the nav assertion compares the visible links to `EXPECTED_NAV.constructor`.
- **Expected:** `Home`, `Material requests`.
- **Actual / error:** The sidebar also contains `Capture`. Playwright reported `expect(received).toEqual(expected)`: expected `['Home', 'Material requests']`; received `['Home', 'Material requests', 'Capture']`. The app’s Capture link is visible and the assertion is stale.
- **Evidence:** `qa/reports/artifacts/2026-10-21-phase-22-attendance/E1-auth-constructor-nav.png`, `e2e-constructor-error-context.md`; failing assertion at `tests/e2e/auth.spec.ts:64`.
- **Suggested fix:** Add `Capture` to the constructor expected list at `tests/e2e/auth.spec.ts:55`.

### F4 — Full e2e: `sign out returns to login and protects pages again`

- **Severity:** Low (stale test locator)
- **Role / page:** System Admin / `/admin`
- **Failing test:** `auth.spec.ts › sign out returns to login and protects pages again` (`tests/e2e/auth.spec.ts:109:5`); failure at line 113.
- **Steps to reproduce:** Run `npm run test:e2e`; sign in as `admin@cpoint.local`; the sign-out test clicks a button matching `/Demo System Admin/`.
- **Expected:** A button whose accessible name matches `Demo System Admin`.
- **Actual / error:** The page’s account button is “System Admin System Admin.” Playwright reported `locator.click: Test timeout of 30000ms exceeded`, waiting for `getByRole('button', { name: /Demo System Admin/ })`.
- **Evidence:** `qa/reports/artifacts/2026-10-21-phase-22-attendance/E2-auth-admin-home.png`, `e2e-admin-signout-error-context.md`; failure at `tests/e2e/auth.spec.ts:113`.
- **Suggested fix:** Update the test locator at `tests/e2e/auth.spec.ts:113` to match the configured System Admin account name or use a stable role-based locator.

## 5. Other observations

- The dev roster did not match the handoff’s stated “no demo constructors” assumption: despite both seed flags being `false`, it contained 18 active Shoe Constructors and 4 other roles. The roster included existing E2E Constructor accounts. I did not remove pre-existing users.
- The dev screenshots include Next.js’s development indicator. The leave prompt is browser-native: headless Chromium recorded its message but did not include the modal in the screenshot. Computer Use reported no available local browser surface, so `S6-leave-prompt.png` shows the dirty page state immediately before the prompt.
- The throwaway project was removed with `docker compose -p cpoint-qa down -v`; the `cpoint-pms` database was not stopped or volume-removed. `.env` was not changed.

## 6. Suggested fixes (priority order)

1. Always show the zero-other count in the attendance summary (`src/lib/attendance-rules.ts:119`).
2. Make the S2 handoff expectation use the configured Floor Manager name instead of the fixed “Demo Floor Manager” label (`qa/handoffs/2026-10-21-phase-22-attendance.md:127`).
3. Add `Capture` to the constructor nav expectation (`tests/e2e/auth.spec.ts:55`).
4. Match the actual System Admin account label in the sign-out test (`tests/e2e/auth.spec.ts:113`).

## Needs Dylan

None. No scenarios were blocked.
