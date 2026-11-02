# QA report: Weekdays-only schedule

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Date      | 2026-11-02 16:16 (Asia/Shanghai)                   |
| Handoff   | `qa/handoffs/2026-11-02-weekdays-only-schedule.md` |
| Tested by | Codex                                              |
| Verdict   | **FAIL**                                           |

## 1. Summary

I checked the migration and S10 data before reset, built and started the app, exercised the requested UI and API scenarios, ran both focused and full Playwright suites, then ran S8 with the requested reset command. S1–S7, S9–S11, A11y, A1 and A2 passed; S8 failed its supplied weekend SQL assertion, although a timestamp diagnostic indicates the two rows counted by that predicate are Monday in Manila when interpreted as UTC-naive Prisma timestamps.

Scenarios: 13 passed, 1 failed, 0 blocked, 14 total.

The vault steps were skipped as instructed because the Obsidian vault is not on this PC. No code, tests, migrations, config or `.env` files were changed.

## 2. Environment

| Item            | Value                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 10.0.26200                                                                                            |
| Node / npm      | Node v24.18.0 / npm 11.16.0                                                                                   |
| Branch / commit | `main` @ `e8fae83` (dirty before QA; Phase D-105 changes were already uncommitted)                            |
| How the app ran | `npm run build`; `npm run start` on port 3001 because port 3000 was occupied                                  |
| Base URL        | `http://127.0.0.1:3001`                                                                                       |
| Database        | Docker `db`; 25 migrations up to date; S8 reset seeded 10 rolls, 100 scans, 4 attendance days and 8 check-ins |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                   |
| Viewport        | 1440 × 900                                                                                                    |

Build passed. `next start` emitted its standalone-output warning but ran on port 3001. Migration status and pre-reset S10 output are in `qa/reports/artifacts/2026-11-02-weekdays-only/migrate-status-pre-reset.txt` and `S10-pre-reset-queries.txt`.

## 3. Scenario results

| ID   | Scenario                                                         | Result | Notes / evidence                                                                                                                                                                                                                                             |
| ---- | ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1   | Plan schedule shows Monday–Friday and factory hours              | PASS   | `S1-plan-form.png`                                                                                                                                                                                                                                           |
| S2   | Reject 07:00–18:00 in the UI                                     | PASS   | Both messages shown, Shift start focused; no save request, toast or history change. `S2-invalid-schedule.png`                                                                                                                                                |
| S3   | Save 08:00–16:00, then restore 08:00–17:00                       | PASS   | Preview/history ended by 16:00; restored afterward. `S3-saved-16-00.png`, `S3-restored-17-00.png`                                                                                                                                                            |
| S4   | Reject end before start                                          | PASS   | Message under Shift end and focus on Shift end. `S4-order-validation.png`                                                                                                                                                                                    |
| S5   | Reject weekend and early-start schedule API requests             | PASS   | Both responses 422 with expected messages. Bodies in `manual-scenarios.json`                                                                                                                                                                                 |
| S6   | Weekday-only reminder controls; save another day and restore     | PASS   | Temporarily added Monday; restored reminder days to `{3,5}`. `S6-reminder-days-weekdays.png`                                                                                                                                                                 |
| S7   | Reject Saturday/Sunday reminder API requests                     | PASS   | Both responses 422; saved days remained `{3,5}`. Bodies in `manual-scenarios.json`                                                                                                                                                                           |
| S8   | Reset demo data; inspect weekend activity and run supplied query | FAIL   | Attendance was not taken on Sat 31 Oct or Sun 1 Nov. The query returned 0 check-ins and 2 weekend starts; see F1. UI and SQL evidence in `S8-ui.json`, `S8-weekend-query.txt`, and `S8-timezone-diagnostic.txt`                                              |
| S9   | Admin lunch-break hint                                           | PASS   | Says “The same on every working day.” and contains no Saturday reference. `S9-lunch-break-hint.png`                                                                                                                                                          |
| S10  | Migration status and schedule/reminder data                      | PASS   | Up to date; legacy 2000 row remains Mon–Sat; newest row after S3 restore is Mon–Fri, 08:00–17:00; S3's intermediate 08:00–16:00 rows are also weekdays and within the allowed window; reminders are `{3,5}`. Pre-reset output in `S10-pre-reset-queries.txt` |
| S11  | Today's weekday batches                                          | PASS   | Batch 1 08:00–13:00 with lunch; Batch 2 13:00–17:00. `S11-todays-batches.png`                                                                                                                                                                                |
| A11y | Axe on plan, inventory update and admin lunch settings           | PASS   | Zero violations on all three pages. `A11y-axe-results.json`                                                                                                                                                                                                  |
| A1   | Inspector plan page and schedule API access                      | PASS   | Page redirected to `/forbidden`; API returned 403. `A1-inspector-forbidden.png`                                                                                                                                                                              |
| A2   | Admin inventory-settings API access                              | PASS   | API returned 403. Response in `manual-scenarios.json`                                                                                                                                                                                                        |

Existing automated tests run:

| Command                                                                     | Result                                                                                                                                                                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx playwright test tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts` | First run: 13 passed, 1 failed (`ERR_ABORTED` navigating to `/login` in the reminder-days test). Immediate rerun: 14 passed, 0 failed, 0 skipped. Outputs: `e2e-focused.txt`, `e2e-focused-rerun.txt` |
| `npm run test:e2e`                                                          | 88 passed, 0 failed, 2 skipped. Output: `e2e-full.txt`                                                                                                                                                |

The two full-suite skips had explicit guards: demo tools with the flag off was skipped because `DEMO_LOGIN_TOOLS=true`; the “without the model files” capture case was skipped because the model is installed.

## 4. Failures

### F1 — S8: supplied weekend query reports two starts

- **Severity:** Medium
- **Role / page:** Floor Manager, Batches / Attendance; read-only database query
- **Steps to reproduce:** Run `npm run demo:reset '--' --yes`; then run the S8 query in handoff §5.
- **Expected:** Both query counts are 0.
- **Actual:** `production_check_ins` count was 0; the supplied `batches.startedAt` predicate returned 2.
- **Exact query:**

  ```sql
  SELECT count(*) FROM production_check_ins WHERE EXTRACT(ISODOW FROM day) IN (6, 7);
  SELECT count(*) FROM batches WHERE "startedAt" IS NOT NULL
    AND EXTRACT(ISODOW FROM ("startedAt" AT TIME ZONE 'Asia/Manila')) IN (6, 7);
  ```

  Output: first count `0`; second count `2`.

- **Evidence:** `qa/reports/artifacts/2026-11-02-weekdays-only/S8-weekend-query.txt` and `S8-weekend-rows.txt`. The two rows are `LR-MT-005` (`2026-11-02 00:02:39.063`) and `LR-MLT-004` (`2026-11-02 02:35:38.513`). `S8-timezone-diagnostic.txt` shows that converting those UTC-naive timestamps from UTC to Manila yields Monday 08:02 and 10:35, respectively; the handoff expression treats them as Sunday. The Prisma field is `Roll.startedAt DateTime?` at `prisma/schema.prisma:266`; the demo seeder builds its `workingDays` list with an ISO weekday ≤ 5 at `src/server/services/demo-seed.service.ts:293–295`. Attendance UI for both weekend dates says it has not been taken, with all visible attendance boxes unchecked. The Recent days table shows Saturday as `0 of 2 · 2 missed`, derived from the preserved historical Mon–Sat schedule.
- **Suggested fix:** Correct the S8 SQL predicate to interpret the stored timestamps as UTC before converting to Manila, then rerun S8. The current query result does not establish that the demo seeded weekend rolls.

## 5. Other observations

- The first focused E2E run had one navigation abort at `cv-helpers.ts:136`; the same test set passed on immediate rerun. The full suite had no failures.
- The first manual runner diagnostics (`manual-scenarios-run.txt` and `*-FAIL.png`) captured false failures from a server-action response matcher and selectors; the reported manual results use the corrected `manual-scenarios-rerun.txt` and `manual-scenarios.json` run.
- Port 3000 was occupied, so the app ran on the handoff-approved port 3001.
- The vault Daily note was skipped per the user’s instruction; the vault is not on this PC.
- The final read-only S10 query after the focused and full E2E runs showed reminder days `{3,5}`; all rows from 2026-11-03 onward were weekdays and within 08:00–17:00, including the intermediate 08:00–16:00 S3 rows. Output: `S10-post-e2e-pre-reset-queries.txt`.

## 6. Suggested fixes (priority order)

1. Correct the S8 timestamp conversion in the handoff query and repeat the weekend check.
