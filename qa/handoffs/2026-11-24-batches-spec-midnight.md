# QA handoff: `batches.spec.ts` at any hour (fix)

Date: 2026-11-24. Plan: `docs/prompts/plans/fix-batches-spec-midnight-plan.md`. Test-only change in
`tests/e2e/batches.spec.ts` (`beforeAll`'s fixture plan). Codex tests and reports only (D-092);
report to `qa/reports/2026-11-24-fix-batches-midnight-run1.md` and one line in the vault's Daily note.

## Setup

- `npm run db:up && npm run db:deploy`, then `npm run dev` (http://localhost:3000, or the port it
  prints); `$env:E2E_BASE_URL="http://localhost:3000"`.
- Demo clock off (real time). Note the Manila time at the start of each run in the report.

## Scenarios

| #   | What                                                                                        | Expected                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Read the diff: only `tests/e2e/batches.spec.ts` changed (plus docs)                         | No app code, no other spec, no skip, no loosened assertion or other test's timeout                                                                  |
| B2  | `npx playwright test tests/e2e/batches.spec.ts` at any time from 01:00 Manila               | All tests pass                                                                                                                                      |
| B3  | While B2 runs, read `day_plans` for today (`intervalMinutes`, `shiftStart`, `shiftEnd`)     | 60, `00:00`, `23:59`                                                                                                                                |
| B4  | Only if the run can start between 00:05 and 01:00 Manila (16:05 to 17:00 UTC): run the spec | Passes; today's fixture row is 5, `00:00`, `02:00`; test :346 finds a `B-YYMMDD-N is due` banner                                                    |
| B5  | Only if the run can start between 00:00 and 00:05 Manila: run the spec                      | `beforeAll` waits until about 00:05, then passes as B4                                                                                              |
| B6  | After every run: today's `day_plans` row and batches                                        | The plan saved before the run is back (`afterAll`), as before the fix                                                                               |
| B7  | Full suite `npm run test:e2e` once                                                          | Same result as before the fix; report any failure with its error lines (rerun a first-compile timeout or `ECONNRESET` spec alone once, report both) |

B4 and B5 depend on the clock: mark them **not run (outside the window)** if the session isn't in
that hour; don't change the clock or the code to force it. CI on the PR also covers B4 if it lands
in 16:00 to 17:00 UTC.

## Result

PASS when B1 to B3, B6, B7 pass (and B4/B5 pass or are not run for the window). Anything else goes in
the report for Claude to fix.
