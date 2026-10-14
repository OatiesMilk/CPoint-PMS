# QA handoff: Phase 13 material requests, run 5 (e2e stability)

| Field           | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Date            | 2026-10-14                                                 |
| Feature         | phase-13-material-requests (run 5)                         |
| Branch          | `main` checkout at `c044511`, **uncommitted** changes      |
| Spec / prompt   | `material-requests.md` (project root), Phase 13            |
| Written by      | Claude                                                     |
| Previous report | `qa/reports/2026-10-14-phase-13-material-requests-run4.md` |

Run 4 confirmed the run 3 contrast finding was a measuring fault in the test (the short-delivery
test passed three times out of three). Its one failure (F1) was an intermittent
`apiRequestContext.post: read ECONNRESET` in the D-031 leather-roll test, in the parallel run only.
This run checks whether that is gone. There are **no manual scenarios**.

Claude ran lint and typecheck after this change. Claude did **not** run any e2e test.

## 1. What changed

Only `playwright.config.ts`: the e2e server now starts with `--keepAliveTimeout 70000`. **No
application code and no test changed.**

Why: Node closes an idle HTTP connection after 5 seconds. The failing call in the D-031 test comes
after a pause of several seconds (the Floor Manager's page opens and a button is clicked), and
Playwright's API client then reuses a connection the server has just closed. The server logged no
error for the failed request in run 4, which is what a dropped connection looks like and not what
an exception in the app looks like (that returns HTTP 500 and is logged).

This is Claude's reading of the log and the test's timing. **It was not reproduced.** Run 4's
report judged it "app/server wrong, intermittent"; this run is the check on which reading holds.

## 2. Files touched

| File                   | Change                                          |
| ---------------------- | ----------------------------------------------- |
| `playwright.config.ts` | e2e server keeps idle connections open for 70 s |

Database migration in this change: **no**.

## 3. How to run

Docker Desktop running, `.env` filled in, no CPoint-PMS dev server running. **Make sure nothing is
already listening on port 3100**: the config reuses an existing server there, and an old one would
not have the new option.

```bash
npm run db:up
npm run db:deploy
npm run build
npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts
```

## 4. Test accounts and data

None to prepare.

## 5. Test scenarios

| ID  | Role | Steps                                                                                                                                                  | Expected result                | Priority |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ | -------- |
| T1  | —    | `npm run build`                                                                                                                                        | Exit 0                         | High     |
| T2  | —    | Confirm the e2e server was started with the new option: the first lines of the Playwright output, or the process list, show `--keepAliveTimeout 70000` | The option is present          | High     |
| T3  | —    | The five-spec command (parallel), run **three separate times**                                                                                         | 45 passed, 0 failed, each time | High     |

An intermittent failure is not proven fixed by green runs; three clean parallel runs is the bar
for this handoff. Report the passed and failed counts for each of the three runs separately.

**If any run shows `ECONNRESET` again**, the reading above is wrong or incomplete. Report: the
test title, the failing line, the full call log Playwright prints, how many seconds passed between
that test's previous API call and the failing one if the log shows it, and every `[WebServer]`
line within a few lines of the failure.

For any other failing test, report the title, the failing line, the exact error, what the page
showed, whether the app or the test is wrong, and the smallest fix.

### Access checks

None in this run.

## 6. Out of scope / known issues

- All manual scenarios from runs 1 and 2.
- The "destination stream closed early" lines: give the count for each run, nothing more.
