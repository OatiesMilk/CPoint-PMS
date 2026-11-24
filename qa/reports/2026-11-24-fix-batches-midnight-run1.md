# QA report: Batches midnight spec fix

| Field     | Value                                             |
| --------- | ------------------------------------------------- |
| Date      | 2026-11-24 13:48 Manila time (Asia/Manila)        |
| Handoff   | `qa/handoffs/2026-11-24-batches-spec-midnight.md` |
| Prompt    | `qa/CODEX_PROMPT_FIX_BATCHES_MIDNIGHT.md`         |
| Tested by | Codex                                             |
| Verdict   | **FAIL**                                          |

## 1. Summary

The changed batches spec passed all 7 tests on the regular hourly path, and its fixture plan and generated production batches were removed after both runs. The full e2e suite failed 15 tests in other specs (114 passed, 3 skipped, 11 did not run), so the handoff's PASS criteria are not met. Manila time was 13:47–13:48 at run start; the midnight branch was **not exercised live**.

Scenarios: 4 passed, 1 failed, 2 not run, 7 total.

## 2. Environment

| Item            | Value                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| OS              | Windows, PowerShell                                                                                      |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                |
| Branch / commit | `main` @ `539762d`; working tree dirty (docs and target spec)                                            |
| How the app ran | `npm run dev` on host; Docker `db` only                                                                  |
| Base URL        | `http://localhost:3000`                                                                                  |
| Database        | Docker `cpoint-pms-db-1`; no pending migrations; today's plan and production batches absent before tests |
| Browser         | Playwright Chromium, headless (Chrome 153.0.8010.12 user agent)                                          |
| Viewport        | 1440 × 900                                                                                               |

Setup: `npm run db:up` kept the CPoint DB running; `npm run db:deploy` reported no pending migrations; `/api/health` returned `status: ok`, with app and database up. The occupied port 3000 was a separate Vite process from `C:\dev\Supply-Chain`; it was stopped per the handoff setup before `npm run dev` started.

## 3. Scenario results

| ID  | Scenario                                  | Result                   | Notes / evidence                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Review the diff                           | PASS                     | Target code diff is limited to `tests/e2e/batches.spec.ts`; no app code or other spec changed. The diff updates the fixture setup and comment. Its only added timeout is `test.setTimeout(6 * 60_000)` scoped to this test to allow the first-hour wait; no other spec timeout or assertion was loosened. |
| B2  | Run the batches spec after 01:00 Manila   | PASS                     | Started 13:47:09 Manila; 7 passed in 49.8s. Log: `qa/reports/artifacts/2026-11-24-fix-batches-midnight-run1/b2.log`.                                                                                                                                                                                      |
| B3  | Read today's `day_plans` row during B2    | PASS                     | Fixture row showed `intervalMinutes=60`, `shiftStart=00:00`, `shiftEnd=23:59`.                                                                                                                                                                                                                            |
| B4  | Run between 00:05 and 01:00 Manila        | NOT RUN (outside window) | B2 started at 13:47 Manila. The midnight branch was not exercised live.                                                                                                                                                                                                                                   |
| B5  | Run between 00:00 and 00:05 Manila        | NOT RUN (outside window) | B2 started at 13:47 Manila. The wait-until-00:05 branch was not exercised live.                                                                                                                                                                                                                           |
| B6  | Verify fixture restoration after each run | PASS                     | Before B2, after B2, and after B7, today's `day_plans` row count and `production_batches` count were both 0.                                                                                                                                                                                              |
| B7  | Run the full e2e suite once               | FAIL                     | Started 13:48:34 Manila; 114 passed, 15 failed, 3 skipped, 11 did not run (143 total, 6.3 minutes). All 7 `batches.spec.ts` tests also passed in this run. Log: `qa/reports/artifacts/2026-11-24-fix-batches-midnight-run1/b7.log`.                                                                       |

## 4. Failures

### F1 — B7: Full e2e suite has 15 failures

- **Severity:** High
- **Role / page:** Multiple e2e specs and pages
- **Steps to reproduce:** With Docker `db` running and the host dev server at `http://localhost:3000`, set `E2E_BASE_URL=http://localhost:3000` and run `npm run test:e2e`.
- **Expected:** Full suite completes without test failures.
- **Actual:** Playwright reported 15 failures. The detailed, redacted run log is `qa/reports/artifacts/2026-11-24-fix-batches-midnight-run1/b7.log`.
- **Evidence:** The output reported `15 failed`, `3 skipped`, `11 did not run`, and `114 passed (6.3m)`. Failure excerpts:

| Failing test                                          | Expected                                          | Actual / error excerpt                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `corrections.spec.ts:164` — past batch correction     | Inspector page loads for the selected past day    | 30s test timeout; `page.goto` ended with `net::ERR_ABORTED` at `/batches?tab=queue&doneDay=2026-10-31`.                  |
| `final-defects.spec.ts:300` — move and inspect repair | Inspector login page loads                        | 30s test timeout; `page.goto: Test ended` while loading `/login`.                                                        |
| `inspection-queue.spec.ts:164` — urgent batch order   | First queue card is `B-261122-1`                  | First card remained `B-261117-2`; `toHaveAttribute` timed out.                                                           |
| `inventory.spec.ts:45` — stock sheet update           | On-hand value is `1.5 spools`                     | `getByTestId('on-hand')` was not found before the 30s test timeout.                                                      |
| `inventory.spec.ts:267` — remove leather roll         | On-hand value becomes `1 roll`                    | UI still showed `2 rolls` after removal; test timed out.                                                                 |
| `inventory.spec.ts:336` — Inventory role access       | Admin/QI login and refusal checks complete        | 30s test timeout; `page.goto: Test ended` while loading `/login`.                                                        |
| `reports-period.spec.ts:47` — period picker           | Day field appears after choosing Day              | `getByLabel('Day')` was not found before the 30s test timeout.                                                           |
| `reports-period.spec.ts:66` — date range limit        | Quality API responds for the requested range      | Request to `/api/v1/reports/quality?from=2020-01-01&to=2999-01-01` timed out at 30s.                                     |
| `reports-period.spec.ts:88` — report sort             | URL changes to `sort=daily.rolls-started&dir=asc` | URL remained at `sort=daily.rolls-scanned&dir=desc`; assertion timed out.                                                |
| `reports-period.spec.ts:158` — clear defect filters   | Clear removes the `remedy` query parameter        | URL still contained `remedy=NOT_FIXABLE`; assertion timed out.                                                           |
| `reports.spec.ts:80` — quality report                 | Login completes and report checks run             | 30s test timeout while loading `/login`.                                                                                 |
| `reports.spec.ts:158` — operations report range       | Selected range shows “7 days”                     | Range text was empty; browser reported `Protocol error (Runtime.callFunctionOn): Internal server error, session closed.` |
| `reports.spec.ts:227` — Reports role access           | Floor Manager lands on `/batches`                 | Redirects were seen at `/login` and `/`; expected `/batches` was not reached.                                            |
| `returns.spec.ts:95` — 3-inch line                    | Constructor lands on `/camera/capture`            | Redirects were seen at `/login` and `/`; expected `/camera/capture` was not reached.                                     |
| `smoke.spec.ts:151` — rejected section link           | Floor Manager sees link `Roll LR-BSA-155`         | Link was not found before the 30s test timeout.                                                                          |

- **Suggested fix:** Review the suite failures in the saved log. This run does not establish a common cause; it shows both navigation/timeouts and assertion mismatches across unrelated specs.

## 5. Other observations

- The full suite log contained no `ECONNRESET` or first-compile timeout, so no isolated spec rerun was triggered by the AGENTS.md retry rule.
- The coder-reported `npm run check` pass was not rerun by QA; this handoff's requested checks were the spec and full e2e suite.
- B4 and B5 depend on the Manila clock and were not forced by changing the clock or code.

## 6. Suggested fixes (priority order)

1. Triage the 15 full-suite failures in `b7.log`; verify which are reproducible independently before changing tests or application code.
2. Re-run this handoff's midnight cases only during their live Manila windows or via the PR CI run in the corresponding UTC window.
