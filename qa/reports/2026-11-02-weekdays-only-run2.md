# QA report: Weekdays-only schedule, run 2

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Date      | 2026-11-02 16:30 (Asia/Shanghai)                   |
| Handoff   | `qa/handoffs/2026-11-02-weekdays-only-schedule.md` |
| Tested by | Codex                                              |
| Verdict   | **PASS**                                           |

## 1. Summary

After the requested demo reset, the three weekend counts were all 0 and the schedule table contained exactly one 08:00–17:00, every-four-hours, Monday–Friday row. The visible in-app browser showed no weekend rows or weekend missed counts in Recent days, no attendance taken on Sat/Sun, and the expected schedule and batches on the plan and batches pages. The focused E2E run passed 14/14; the full suite passed with 88 passed, 0 failed and 2 skipped.

Scenarios: 3 passed, 0 failed, 0 blocked, 3 total.

The vault Daily note was skipped as requested because the Obsidian vault is not on this PC. No application code, tests, migrations, config, `package.json` or `.env` files were changed.

## 2. Environment

| Item            | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| OS              | Windows 10.0.26200                                                                                        |
| Node / npm      | Node v24.18.0 / npm 11.16.0                                                                               |
| Branch / commit | `main` @ `e8fae83` (dirty; D-105 and run 2 changes were already uncommitted)                              |
| How the app ran | `npm run build`; `npm run start` on port 3001 because port 3000 was occupied                              |
| Base URL        | `http://127.0.0.1:3001`                                                                                   |
| Database        | Docker `db`; reset seeded 10 rolls, 100 scans, 4 attendance days and 8 check-ins; reset schedule verified |
| Browser         | Codex in-app browser visible for R1/R2; Playwright Chromium 153.0.8010.12 headless for R3                 |
| Viewport        | In-app browser default; Playwright 1440 × 900                                                             |

Build passed. `next start` emitted its standalone-output warning and ran on port 3001. Build and reset output are in `qa/reports/artifacts/2026-11-02-weekdays-only-run2/`.

## 3. Scenario results

| ID  | Scenario                    | Result | Notes / evidence                                                                                                                                                                                                                                                                        |
| --- | --------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Rerun S8 after `demo:reset` | PASS   | The three weekend counts were 0. Reset left one schedule row: 08:00, 17:00, 240, `{1,2,3,4,5}`, 2000-01-01. Recent days lists only weekdays; attendance for Sat 31 Oct and Sun 1 Nov was not taken. `R1-demo-reset.txt`, `R1-database-queries.txt`, `R1-R2-in-app-browser-evidence.txt` |
| R2  | Plan batches and quota page | PASS   | Schedule in force is 08:00–17:00 every 4 hours, Mon–Fri. Today's batches are 08:00–13:00 with lunch and 13:00–17:00. `R1-R2-in-app-browser-evidence.txt`                                                                                                                                |
| R3  | Focused and full E2E suites | PASS   | Focused: 14 passed, 0 failed, 0 skipped. Full: 88 passed, 0 failed, 2 skipped. Logs: `R3-focused-e2e.txt`, `R3-full-e2e.txt`                                                                                                                                                            |

The two full-suite skips had explicit reasons: the “demo tools with the flag off” test was skipped because `DEMO_LOGIN_TOOLS=true`, and the “without the model files” capture test was skipped because the model is installed.

## 4. Failures

None.

## 5. Other observations

- Port 3000 was occupied; port 3001 was available and used as allowed by the handoff.
- The in-app browser stayed visible during R1/R2. The automated Playwright suites ran headless.
- The Obsidian vault was unavailable on this PC; the Daily note step was skipped per instruction.

## 6. Suggested fixes (priority order)

None.
