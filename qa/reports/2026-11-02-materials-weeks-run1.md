# QA report: Materials by week of the month (D-109)

| Field     | Value                                       |
| --------- | ------------------------------------------- |
| Date      | 2026-11-02 20:27 (Asia/Shanghai)            |
| Handoff   | `qa/handoffs/2026-11-02-materials-weeks.md` |
| Tested by | Codex                                       |
| Verdict   | **FAIL**                                    |

## 1. Summary

Tested S1–S11 and A1 in the visible in-app browser at `http://localhost:3000`. Eleven of 12 scenarios passed; S11 did not wrap the filters at 1280 px. The focused inventory e2e passed 8/8; the full e2e run recorded 4 failures, 2 skipped and 6 not run. The required isolated rerun of `admin.spec.ts` passed 6/6 after its first-compile timeout.

Scenarios: 11 passed, 1 failed, 0 blocked, 12 total.

## 2. Environment

| Item            | Value                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| OS              | Windows                                                                                                  |
| Node / npm      | v25.2.1 / 11.7.0                                                                                         |
| Branch / commit | `main` @ `2e63908` (working tree was already dirty at start; no application or test files changed by QA) |
| How the app ran | `npm run dev` at port 3000; Docker demo app remained stopped                                             |
| Base URL        | `http://localhost:3000`                                                                                  |
| Database        | Docker `cpoint-pms-db-1`, healthy; existing stock data retained; no reset or migration run               |
| Browser         | Visible in-app browser for S1–S11; Playwright Chromium 153.0.8010.12 headless for e2e and axe            |
| Viewport        | Default in-app viewport; 1280 × 900 and 1024 × 900 for S11                                               |

## 3. Scenario results

| ID  | Scenario                              | Result                       | Notes / evidence                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Default current week                  | PASS                         | 2026 / November / Week 1 · Nov 1–7 selected; comparison line showed the partial current week against Oct Week 5 (3 days against 7).                                                                                                                                                  |
| S2  | November week choices                 | PASS                         | Week 1–5 listed; weeks after today and December disabled.                                                                                                                                                                                                                            |
| S3  | Retain or clamp week on month change  | PASS                         | October Week 5 → September Week 5 · Sep 29–30; February 2026 clamped to Week 4 · Feb 22–28.                                                                                                                                                                                          |
| S4  | Leap-year February                    | PASS (unit-only per handoff) | Year dropdown contains only 2026. `tests/unit/month-weeks.test.ts`: 17 passed, including month-week rules.                                                                                                                                                                           |
| S5  | Invalid URL values                    | PASS                         | Week 9, month 13, future year and non-numeric week fell back to today’s Week 1 without an error page.                                                                                                                                                                                |
| S6  | Week comparison and trend             | PASS                         | October Week 4 selected 4 rolls vs 0 previous; trend ended at 4 and Leather rolls began with Week 4 · Oct 22–28 (9 / 11 / 570). Per 100 pairs remained 0.64 rolls and Days left about 16 days, matching S1.                                                                          |
| S7  | Case-insensitive name and code search | PASS                         | ` CEMENT` became `q=CEMENT`; lower-case `ad-001` matched Contact cement and retained October Week 4 in the URL.                                                                                                                                                                      |
| S8  | Empty search and clear                | PASS                         | No-match message and Clear button appeared; clearing the search removed `q` and restored material rows.                                                                                                                                                                              |
| S9  | Filtered CSV                          | PASS                         | Exact expected header; 8 rows for `AD-001`, from Sep 8 through selected Week 4 · Oct 22–28. Copy: `artifacts/2026-11-02-materials-weeks/materials-week4-ad-001.csv`.                                                                                                                 |
| S10 | Keyboard access                       | PASS                         | Tab reached Year, Month, Week, Find material, Clear the search and table links with focus-visible styling and labels. Arrow keys changed Month and Week, then values were restored.                                                                                                  |
| S11 | Responsive filters                    | FAIL                         | No horizontal page overflow at either width. At 1024 px the Find field wrapped; at 1280 px all four controls stayed on one row, contrary to the handoff’s wrapping expectation. Screenshots: `artifacts/2026-11-02-materials-weeks/s11-1280-one-row.png` and `s11-1024-wrapped.png`. |
| A1  | axe on S1, S7, S8                     | PASS                         | `AxeBuilder.analyze()` with default rules on all three states: 0 violations each.                                                                                                                                                                                                    |

### Automated tests run

| Command                                                                              | Result                                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `npx vitest run tests/unit/month-weeks.test.ts`                                      | 17 passed                                                |
| `npx playwright test tests/e2e/inventory.spec.ts`                                    | 8 passed, 0 failed, 0 skipped                            |
| `npm run test:e2e`                                                                   | 78 passed, 4 failed, 2 skipped, 6 did not run (90 total) |
| `npx playwright test tests/e2e/admin.spec.ts` (isolated rerun after compile timeout) | 6 passed, including the previously timed-out camera test |

Logs and copied Playwright error contexts are in `artifacts/2026-11-02-materials-weeks/`.

## 4. Failures

### F1 — S11: Filters did not wrap at 1280 px

- **Severity:** Low
- **Role / page:** Floor Manager / Reports → Materials
- **Steps to reproduce:** Set the in-app browser width to 1280 px and open Materials.
- **Expected:** Filters wrap at 1280 px and 1024 px, with no sideways page scroll.
- **Actual:** At 1280 px all four filter controls shared one row. At 1024 px Find material wrapped. Neither width had horizontal page overflow.
- **Evidence:** `artifacts/2026-11-02-materials-weeks/s11-1280-one-row.png`; filter container is `src/app/(app)/reports/materials/material-filters.tsx:66`.
- **Suggested fix:** Review the wrapping breakpoint or available filter width for the 1280 px viewport.

### F2 — Full e2e: Admin camera test timed out during first compile

- **Severity:** Medium (transient on isolated rerun)
- **Role / page:** System Admin / camera settings
- **Steps to reproduce:** Run `npm run test:e2e` against the dev server.
- **Expected:** The camera settings test completes.
- **Actual:** The first full run exceeded 30 seconds while the page snapshot still showed Next.js Dev Tools “Compiling.” The required isolated `admin.spec.ts` rerun passed all 6 tests.
- **Evidence:** `artifacts/2026-11-02-materials-weeks/full-e2e-admin-camera-error-context.md`; test location `tests/e2e/admin.spec.ts:136`.
- **Suggested fix:** Treat as dev-server compile contention unless it recurs after the isolated pass.

### F3 — Full e2e: Saving the same schedule added a history row

- **Severity:** Medium
- **Role / page:** Floor Manager / Plan batches and quota
- **Steps to reproduce:** Run the schedule-save scenario in `tests/e2e/batches.spec.ts`.
- **Expected:** Saving the unchanged schedule again adds no history row; the row count stays at 8.
- **Actual:** The second save left 9 rows; assertion failed at `tests/e2e/batches.spec.ts:177`.
- **Evidence:** `artifacts/2026-11-02-materials-weeks/full-e2e-batches-error-context.md`.
- **Suggested fix:** Investigate the unchanged schedule save path and its persistence comparison.

### F4 — Full e2e: Inventory role check lost its browser session

- **Severity:** Medium
- **Role / page:** Admin and Quality Inspector / Inventory access
- **Steps to reproduce:** Run the role refusal scenario in `tests/e2e/inventory.spec.ts`.
- **Expected:** The Quality Inspector reaches `/forbidden` and the API returns 403.
- **Actual:** The browser log showed navigation to `/forbidden`, then Playwright returned `Runtime.evaluate: Internal server error, session closed` before the assertion completed; test failed at line 342.
- **Evidence:** `artifacts/2026-11-02-materials-weeks/full-e2e-inventory-error-context.md`; `tests/e2e/inventory.spec.ts:342`.
- **Suggested fix:** Investigate browser-session stability under the full parallel suite.

### F5 — Full e2e: Reports link did not become stable for click

- **Severity:** Medium
- **Role / page:** Floor Manager / Reports
- **Steps to reproduce:** Run the Floor Manager journey in the full e2e suite.
- **Expected:** The Reports navigation link can be clicked after the report page passes accessibility checks.
- **Actual:** The locator resolved to the Reports link, but Playwright timed out waiting for it to become stable; test failed at `tests/e2e/smoke.spec.ts:145`.
- **Evidence:** `artifacts/2026-11-02-materials-weeks/full-e2e-smoke-error-context.md`.
- **Suggested fix:** Investigate navigation stability or motion during the full suite.

## 5. Other observations

- The e2e suite left one schedule row that was absent from the pre-run snapshot. I removed that exact test-created row; schedule, lunch and quota snapshots then matched the baseline exactly (6 schedules, 7 lunch rows, 3 quotas). Snapshots are in the artifacts folder.
- The two skipped tests had reasons: `DEMO_LOGIN_TOOLS=true` on the dev server and the computer-vision model files are installed. Some tests in the serial batches group did not run after its first test failed.
- Playwright emitted its default ignored `test-results/` directory outside `qa/reports/`; the four failure contexts were copied into the requested artifacts folder. The runner emitted text contexts, not screenshot attachments. Cleanup of the generated directory was blocked by filesystem policy.
- The working tree was already dirty at the start. QA did not modify application code, tests, migration, config or `.env`.

## 6. Suggested fixes (priority order)

1. Check whether the 1280 px wrap expectation is intentional; if so, adjust the Materials filter layout threshold.
2. Fix or clarify the unchanged schedule save behavior that adds a history row.
3. Reduce full-suite dev-server/browser contention and stabilize the affected navigation tests.
