# QA report: Phase 27 — Batches as check-in intervals

| Field     | Value                                        |
| --------- | -------------------------------------------- |
| Date      | 2026-10-25 02:04 (Asia/Shanghai)             |
| Handoff   | `qa/handoffs/2026-10-24-phase-27-batches.md` |
| Tested by | Codex                                        |
| Verdict   | **FAIL**                                     |

## 1. Summary

Phase 27 browser, access, demo-data, migration, and accessibility checks were run. The host build failed on stale generated Next.js route types, so the e2e web server could not start and Playwright discovered no tests. S2 also exposed a mismatch between the handoff’s three short days and the two below-quota days in the seeded data.

Scenarios: **25 passed, 1 failed, 1 blocked, 27 total**. E2E: **0 passed, 0 failed, 0 tests discovered**.

## 2. Environment

| Item                 | Value                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| OS                   | Windows 11 Home Single Language                                                                                  |
| Node / npm           | v25.2.1 / 11.7.0                                                                                                 |
| Branch / commit      | `main` @ `33fe2b3` (worktree already contained Phase 27 changes; QA added only report artifacts and this report) |
| How the app ran      | `npm run dev` on port 3001; `npm run start` could not start because the host production build failed             |
| Base URL             | `http://localhost:3001`                                                                                          |
| Database             | Existing Docker `cpoint-pms-db-1`, demo week; restored to the pre-run query state                                |
| Browser              | Playwright Chromium 153.0.8010.12, headless                                                                      |
| Viewports            | 1440 × 900 desktop; 390 × 844 phone                                                                              |
| Throwaway demo stack | `cpoint-qa`, app on 3002 and database on 5434; removed after U1/U2                                               |

`npx prisma migrate status` found 22 migrations and reported the database schema up to date. `npm run db:generate` passed. The build log is in `artifacts/2026-10-24-phase-27-batches/build.log`.

### Dev database queries before and after

The five setup queries and final queries matched. Full output is in the baseline `.log` files and `artifacts/2026-10-24-phase-27-batches/after.txt`.

| Query                         | Before                                                                                                                                     | After |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| `lunch_breaks`                | One default row: 11:00–12:00, effective 2000-01-01                                                                                         | Same  |
| `daily_quotas`                | One row: 128 pairs, effective 2026-10-19                                                                                                   | Same  |
| `production_check_ins` by day | 2026-10-19: 2 / 162 finished / 2 failed; 10-20: 2 / 148 / 3; 10-21: 1 / 50 / 2; 10-22: 2 / 162 / 3; 10-23: 2 / 124 / 3; 10-24: 2 / 136 / 3 | Same  |
| `production_schedules`        | Default 08:00–17:00, 240 minutes, effective 2000-01-01                                                                                     | Same  |
| Removed tables                | No `shoe_types` or `production_counts` relations                                                                                           | Same  |

The host build compiled successfully, then TypeScript failed because `.next/dev/types/validator.ts` references the deleted `production` pages and `shoe-types` routes. Since the host had no successful production build, `npm run start` also failed. Manual browser scenarios were run against the development server on port 3001. The clean throwaway Docker production build started successfully.

## 3. Scenario results

| ID  | Scenario                                | Result  | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Role sidebars                           | PASS    | FM, QI, Admin, Constructor sidebars matched the handoff; no Production nav item. `screenshots/s1-*-sidebar.png`                                                                                                                                                                                                                                                                                              |
| S2  | Default batches and recent days         | FAIL    | Sunday 2026-10-25 correctly had no scheduled batches. Recent days showed `2 of these 6 working days were below quota`, versus three expected. Screenshot: `screenshots/s2-batches-default-desktop.png`                                                                                                                                                                                                       |
| S3  | Plan batches and quota schedule options | PASS    | All interval previews and once-at-end preview matched; saved and restored 4 hours. Axe had no serious/critical violations. `screenshots/s3-plan-schedule-preview.png`                                                                                                                                                                                                                                        |
| S4  | Invalid shift                           | PASS    | `Shift end must be after shift start.` appeared under Shift end and focus moved there. `screenshots/s4-invalid-shift.png`                                                                                                                                                                                                                                                                                    |
| S5  | Daily quota                             | PASS    | Zero rejected with the expected message; suggestion was 144 pairs; save and unchanged-save messages matched. Axe had no serious/critical violations. `screenshots/s5-quota-suggestion.png`                                                                                                                                                                                                                   |
| S6  | Admin lunch change                      | PASS    | 11:30–12:30 applied tomorrow, today remained 11:00–12:00, FM preview reflected the change; restored 11:00–12:00. Settings axe had no serious/critical violations. `screenshots/s6-lunch-settings.png`, `screenshots/s6-fm-tomorrow-lunch-preview.png`                                                                                                                                                        |
| S7  | Invalid and no-lunch settings           | PASS    | Reverse and outside-shift messages matched; no-lunch saved, then lunch was restored. `screenshots/s7-no-lunch-saved.png`                                                                                                                                                                                                                                                                                     |
| S8  | QI notices and bell                     | PASS    | At due time, Batch 2 banner, bell count and `(1)` title persisted on home, Batches, Camera, Scans, and Reports. Not now hid the banner while the notice stayed in the bell. `screenshots/s8-batch2-due-home.png`, `screenshots/s8-batch2-bell-open.png`, `screenshots/s8-batch2-not-now.png`                                                                                                                 |
| S9  | Pre-due QI notice with default schedule | BLOCKED | Sunday had no default-schedule batches; `/api/v1/production/today` returned 200 with `workingDay:false` and `rows:[]`, so there was no batch to clock. `screenshots/s9-default-day-phone.png`                                                                                                                                                                                                                |
| S10 | Finish batch validation and save        | PASS    | Empty count and failed-over-finished validations matched; Batch 1 saved as 12 pairs / 2 failed with the note. `screenshots/s10-finish-batch-sheet.png`, `screenshots/s10-finished-batch.png`                                                                                                                                                                                                                 |
| S11 | Phone Batches layout and axe            | PASS    | At 390 × 844: no sideways scroll, no Recent days for QI, fixed 44 px Finish button. No serious/critical axe violations. `screenshots/s11-phone-batches.png`                                                                                                                                                                                                                                                  |
| S12 | Concurrent finish                       | PASS    | Second tab showed `Maricel Dizon already finished Batch 1 at 01:19. Refresh to see it.` `screenshots/s12-stale-second-tab.png`                                                                                                                                                                                                                                                                               |
| S13 | Early finish refusal                    | PASS    | Upcoming Batch 3 returned 409: `Batch 3 can be finished from 02:50.`                                                                                                                                                                                                                                                                                                                                         |
| S14 | Correction and audit                    | PASS    | Missing reason showed `Say why you're correcting this batch, at least 5 characters.`; correction to 11 pairs with “Counted one rack twice” appeared in the card and audit row with 12 → 11. `screenshots/s14-corrected-batch.png`, `screenshots/s14-audit-log.png`                                                                                                                                           |
| S15 | FM coverage when QI is absent           | PASS    | With QI present, FM had no banner, bell or Finish button; API returned 403 with the expected message. With QI absent and Batch 2 due, FM finished 3 pairs / 0 failed under Rodel Pascual. Attendance was returned to its original untaken state. `screenshots/s15-fm-qi-present.png`, `screenshots/s15-fm-qi-absent-due.png`, `screenshots/s15-fm-finish-sheet.png`, `screenshots/s15-fm-finished-batch.png` |
| S16 | FM and QI home cards                    | PASS    | QI Next batch showed due Batch 2 and Finish; after FM coverage, QI showed Batch 3 in progress. FM showed 9 of 128 passed before coverage and 12 of 128 with Batch 3 in progress after. `screenshots/s16-qi-home-due.png`, `screenshots/s16-fm-home-after-cover.png`, `screenshots/s16-qi-home-after-fm-cover.png`                                                                                            |
| S17 | Reports → Operations and CSVs           | PASS    | 7-day Operations view showed Pairs finished, Failed inspection, Of quota, Rolls finished, passed-pair production rows and attention links. Production CSV returned 200 with the exact handoff header; Operations CSV also returned 200. Files: `production.csv`, `operations.csv`; screenshot: `screenshots/s17-reports-operations-7days.png`                                                                |
| S18 | Admin Batches read-only                 | PASS    | Admin had no Plan link, Finish button or notice. `screenshots/s18-admin-batches.png`                                                                                                                                                                                                                                                                                                                         |
| S19 | Leftover search                         | PASS    | No target fields/columns, check-in buttons/headings, Production page title, or Enter count controls found. Crawl covered 168 FM, 22 QI, 34 Admin, and 1 Constructor page. “Production” appeared only as the expected Operations section.                                                                                                                                                                     |
| A1  | Constructor access to Batches           | PASS    | `/batches` redirected to `/forbidden`; API returned 403. `screenshots/a1-constructor-forbidden.png`                                                                                                                                                                                                                                                                                                          |
| A2  | FM access to lunch settings API         | PASS    | `PUT /api/v1/settings/lunch-break` returned 403.                                                                                                                                                                                                                                                                                                                                                             |
| A3  | QI access to Plan and quota API         | PASS    | `/batches/plan` redirected to `/forbidden`; quota PUT returned 403.                                                                                                                                                                                                                                                                                                                                          |
| A4  | Admin access to Plan and finish API     | PASS    | `/batches/plan` redirected to `/forbidden`; check-in POST returned 403.                                                                                                                                                                                                                                                                                                                                      |
| A5  | Removed routes and API                  | PASS    | For each role, `/production`, `/production/plan`, and `/api/v1/shoe-types` returned 404.                                                                                                                                                                                                                                                                                                                     |
| A6  | QI access to lunch settings             | PASS    | `/admin/settings?tab=lunch` redirected to `/forbidden`.                                                                                                                                                                                                                                                                                                                                                      |
| U1  | Throwaway seeded demo week              | PASS    | One default lunch, one quota of 128, six past days with at most two batches and failed pairs on every day, default schedule and no shoe tables. Batches and Operations UI loaded. `u1-*.log`, `screenshots/u1-batches.png`, `screenshots/u1-reports.png`                                                                                                                                                     |
| U2  | Throwaway `demo:reset`                  | PASS    | Dry run exited 0 and listed lunch breaks; the 5434 preflight printed `True`; `--yes` seeded a fresh week with one default lunch, one quota and six days of batches. Stack, upload folder and process variables were removed. `u2-*.log`, `screenshots/u2-batches.png`, `screenshots/u2-reports.png`                                                                                                          |

Axe results: Batches at 390 × 844 and 1440 × 900, Plan batches, quota, and Settings → Lunch break all had **0 serious/critical violations**. Full results are in `s8-s11-s13-final-results.json`, `s2-axe-s17-results.json`, `s3-result.json`, `s5-final-result.json`, and `s6-final-verified.json` under the artifacts folder.

Existing automated tests run:

| Command            | Result                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:e2e` | 0 passed, 0 failed; Playwright webServer failed before test discovery. No spec failed, so no `e2e-rerun.log` applies. See `e2e.log`. |

## 4. Failures

### F1 — S2: seeded recent days show two below-quota days instead of three

- **Severity:** Medium
- **Role / page:** Floor Manager, `/batches`
- **Steps to reproduce:** Open Batches with no test schedule on the dev database on Sunday 2026-10-25; read the Recent days summary and rows.
- **Expected:** Three short days, each with its sentence, per the handoff.
- **Actual:** `2 of these 6 working days were below quota.` The table shows 48/128 on Oct 21 and 121/128 on Oct 23; Oct 24 is 133/128. The display agrees with the saved rows.
- **Evidence:** `screenshots/s2-batches-default-desktop.png`; baseline query `checkins-by-day.log`.
- **App or test:** The report math matches its inputs; this appears to be the demo seed data not matching the handoff expectation.
- **Suspected file and line:** `src/server/services/demo-seed.service.ts:428-429,460` — the comment says days with 2, 3, and 5 absences should be below quota, while the generated 2-absence day passes quota.

### F2 — Host production build fails; e2e cannot start

- **Severity:** High
- **Steps to reproduce:** Run `npm run build`, then the requested single `npm run test:e2e` attempt.
- **Expected:** Build succeeds and Playwright starts the configured production server.
- **Actual build error:**

  ```text
  .next/dev/types/validator.ts(188,39): Cannot find module '../../../src/app/(app)/production/page.js'
  .next/dev/types/validator.ts(197,39): Cannot find module '../../../src/app/(app)/production/plan/page.js'
  .next/dev/types/validator.ts(647,39): Cannot find module '../../../src/app/api/v1/shoe-types/[id]/route.js'
  .next/dev/types/validator.ts(656,39): Cannot find module '../../../src/app/api/v1/shoe-types/route.js'
  npm: Failed to type check.
  ```

  `npm run test:e2e` then stopped with `Could not find a production build in the '.next' directory` and `Process from config.webServer was not able to start. Exit code: 1`. No tests were discovered, so there are no failing test titles or test lines to list. `npm run start` produced the same missing-production-build error. The Docker production build used by U1/U2 did start successfully.

- **Evidence:** `build.log`, `e2e.log`, `app-start.log`; screenshots `screenshots/build-failure-log.png` and `screenshots/e2e-startup-failure-log.png`.
- **App or test:** The e2e runner failure follows the failed host build; this is not a failing test spec. The generated route validator appears stale because it references routes deleted by Phase 27; the clean Docker build succeeded.
- **Suspected file and line:** `.next/dev/types/validator.ts:188,197,647,656` (generated artifact). No source file was changed by QA.

## 5. Other observations

- `npm run dev` on port 3001 was used for manual browsing after `npm run start` failed. The existing CPoint-PMS containers on port 3000/5432 were left running.
- Dev data restored: removed the test schedule and no-lunch row after S15; deleted two QA check-ins, today’s attendance day and marks, two schedule rows, one quota row, and 13 lunch history rows created during testing. The final queries match the initial baseline. No user names were edited. `.env` stayed unchanged (`SEED_DEMO_USERS=true`, `SEED_DEMO_WEEK=false`).
- Append-only audit history remains on the dev database for QA actions: 1 `attendance.take`, 5 `attendance.update`, 2 `production.checkin`, 1 `production.checkin.correct`, 13 `production.lunch.set`, 3 `production.quota.set`, and 2 `production.schedule.set` rows. The QA records they describe were removed as above.
- No passwords were written to artifacts or the report; a scan found zero matches for `DEMO_USER_PASSWORD`.

## 6. Suggested fixes (priority order)

1. Reconcile the demo seed values with the handoff’s three-short-day expectation; check the 2-absence day produced by `DEMO_RATE` at `src/server/services/demo-seed.service.ts:460`.
2. Investigate why the host build’s generated `.next/dev/types/validator.ts` still references deleted routes and refresh the generated route types before typechecking.

## Needs Dylan

- **S9 (BLOCKED):** Today is Sunday and the default schedule is Mon–Sat, so there are no batches to use for the pre-due browser-clock notice check.
- **S2 default batch layout subcheck:** The same Sunday prevented verifying the default weekday batch intervals. The visible Recent days portion failed as described in F1.
