# QA report — Demo clock (D-125), run 2

| Field        | Value                                      |
| ------------ | ------------------------------------------ |
| Date         | 2026-11-09 16:00 (Manila, UTC+08:00)       |
| Handoff      | `qa/handoffs/2026-11-09-demo-clock.md`     |
| Prompt       | `qa/CODEX_PROMPT_DEMO_CLOCK_RUN2.md`       |
| Previous run | `qa/reports/2026-11-09-demo-clock-run1.md` |
| Tested by    | Codex                                      |
| Verdict      | **PASS WITH ISSUES**                       |

## 1. Summary

The migration and generated client were ready. Clock changes persisted across sign-ins, and Batches, the scanning timer, stock reminders and the seeded demo week followed demo time. The in-app camera did not start, so C6's shot acceptance remains unverified. The full Playwright run had eight timeouts. All six affected specs passed when rerun individually.

Of the eight scenarios in scope for run 2, 6 passed, 1 failed and 1 was blocked. C1–C3 carried forward from run 1. C11 was skipped.

## 2. Environment

| Item             | Value                                                                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout         | `D:\IMPORTANT SHIT HERE\12th Term - BSIT\CAP2\CPoint-PMS`                                                                                                              |
| OS               | Windows NT 10.0.26200                                                                                                                                                  |
| Node / npm       | v24.18.0 / 11.16.0                                                                                                                                                     |
| Branch / commit  | `feature/varied-demo-defects` @ `ca71fcf`, with uncommitted D-125 changes                                                                                              |
| App              | Dylan's `npm run dev` from this checkout on `http://localhost:3000`                                                                                                    |
| Database         | PostgreSQL in Docker `db` only, with demo accounts and a seeded week                                                                                                   |
| Migration        | `npx prisma migrate status` exited 0 with 30 migrations and “Database schema is up to date!” PostgreSQL returned `demo_clock` from `to_regclass('public.demo_clock')`. |
| Generated client | `src/generated/prisma/models/DemoClock.ts` present                                                                                                                     |
| Browser          | Codex in-app browser for C4–C10. Playwright 1.63.0 headless Chromium for C12.                                                                                          |
| Viewport         | In-app browser default. Playwright 1440 × 900 by default, with spec overrides.                                                                                         |

## 3. Scenario results

| ID    | Scenario                                 | Tool                                                | Result           | Evidence                                                                                                                                                                                                                                                                   |
| ----- | ---------------------------------------- | --------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1–C3 | Real-time login band and date validation | Codex in-app browser, run 1                         | PASS IN RUN 1    | Carried forward as instructed.                                                                                                                                                                                                                                             |
| C4    | Floor Manager sets a weekday to 15:55    | Codex in-app browser                                | PASS             | Rodel set Monday, November 9 at 15:55. **Back to real time** appeared and Batches displayed **Today, Mon, 9 Nov**. Exact band below.                                                                                                                                       |
| C5    | Shared clock and Finish batch at 16:55   | Codex in-app browser, second tab                    | PASS             | Today's seeded plan already had an unfinished 13:00–17:00 Batch 2. After signing Rodel out, Maricel signed in in the second tab and saw 15:55. At 16:55, **Finish batch 2** opened the form for 13:00–17:00. The reminder banner appeared after its next update.           |
| C6    | Capture and scanning timer at demo time  | Codex in-app browser                                | BLOCKED          | The same roll's timer changed from `5:08:24` to `5:10:23` when the clock moved from 16:56 to 16:58. The camera stayed on “Starting the camera… Allow the camera when your browser asks.” No permission prompt or live frame appeared, and **Capture** stayed disabled.     |
| C7    | Wednesday stock reminder                 | Codex in-app browser                                | PASS             | At Wed, 11 Nov 2026 · 10:00, Rodel saw **Stock update today**, **Update stock**, and the bell label “Notices: today has no plan, stock update due”.                                                                                                                        |
| C8    | Reset seeds through the demo day         | Codex in-app browser                                | PASS             | Signed out at Wed, 11 Nov 2026 · 10:00 and reset. The app confirmed a fresh week. Reports → Rolls showed active roll `LR-BSA-005`, started November 11 at 8:08 AM, with five shots dated November 11 from 8:08 to 8:10 AM. The newest finished roll was dated November 10. |
| C9    | Actor and before/after on audit rows     | Codex in-app browser                                | PASS             | Jerome opened two `demo_clock.set` rows after C8, one from Rodel and one from the signed-out System. Both had before and after times and offsets. See evidence below.                                                                                                      |
| C10   | Back to real time                        | Codex in-app browser and read-only PostgreSQL check | PASS             | Pressed **Back to real time** from Wednesday. The band showed real Monday time, Batches showed **Today, Mon, 9 Nov**, and the stored offset was `0`. Exact band below.                                                                                                     |
| C11   | Demo tools off                           | Not run                                             | SKIPPED          | The run 2 prompt keeps this scenario skipped.                                                                                                                                                                                                                              |
| C12   | Full e2e suite                           | Playwright, headless Chromium                       | FAIL on full run | 91 passed, 8 failed, 2 skipped and 1 did not run (4.9 minutes, exit 1). Each of the six affected specs was rerun alone once. All six reruns passed.                                                                                                                        |

### Exact band text

**C4 — Floor Manager after setting 15:55**

```text
Demo mode: quick sign-in and Reset demo data are on. Never use this setup for real work.
Demo clock:
Mon, 9 Nov 2026 · 15:55
Change time
Back to real time
```

**C10 — After Back to real time**

```text
Demo mode: quick sign-in and Reset demo data are on. Never use this setup for real work.
Real time:
Mon, 9 Nov 2026 · 15:51
Change time
```

### Audit evidence

The records were displayed at November 9, 2026, 3:51 PM real time. The `at` fields below are UTC, as displayed in the details.

| Actor         | Action           | Before `at`                | After `at`                 |
| ------------- | ---------------- | -------------------------- | -------------------------- |
| Rodel Pascual | `demo_clock.set` | `2026-11-11T02:00:56.727Z` | `2026-11-11T02:05:00.000Z` |
| System        | `demo_clock.set` | `2026-11-11T02:05:14.649Z` | `2026-11-11T02:10:00.000Z` |

### Existing automated tests

| Command                                                                                                                                     | Result                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$env:E2E_BASE_URL="http://localhost:3000"; npx playwright test --output qa/reports/artifacts/2026-11-09-demo-clock-run2/playwright-output` | 91 passed, 8 failed, 2 skipped and 1 did not run (4.9 minutes, exit 1). Each of the six affected specs was rerun alone once. All six reruns passed. |

Each rerun used `npx playwright test tests/e2e/<spec>.spec.ts` with the same base URL and an artifact output path. Timeouts were the same as in the full run.

| Spec                | Full run                          | Isolated rerun |
| ------------------- | --------------------------------- | -------------- |
| `admin.spec.ts`     | 3 passed, 2 failed, 1 did not run | 6 passed       |
| `inventory.spec.ts` | 6 passed, 2 failed                | 8 passed       |
| `reports.spec.ts`   | 2 passed, 1 failed                | 3 passed       |
| `returns.spec.ts`   | 3 passed, 1 failed                | 4 passed       |
| `rolls.spec.ts`     | 5 passed, 1 failed                | 6 passed       |
| `smoke.spec.ts`     | 9 passed, 1 failed                | 10 passed      |

## 4. Failures

### F1 — C6, No live camera frame in the in-app browser

- **Severity** — High for test coverage.
- **Role / page** — Shoe Constructor, Capture.
- **Reproduce** — As Noel, open Capture with the clock ahead of real time and select the active roll `LR-MSA-004`.
- **Expected** — A shot reaches the model and is accepted with the moved capture time. The scanning timer uses the demo clock.
- **Actual and evidence** — The timer followed the clock. The page stayed on “Starting the camera… Allow the camera when your browser asks.” A camera permission prompt did not appear and the Capture button stayed disabled, so no shot was submitted.
- **Suggested fix** — Verify camera access in the in-app browser and repeat the moved-clock shot with a live feed.

### F2 — C12, Full suite hit eight test timeouts

- **Severity** — High for the full-suite result.
- **Reproduce** — Run the full suite against the dev URL as shown in section 3.
- **Expected** — The full suite passes.
- **Actual** — All eight failures reached the 30-second test limit. They occurred during API calls, navigation, UI assertions or the smoke test's axe scan. There was no `ECONNRESET` in the full-run log. Every original failure passed in its isolated rerun. The full run still ended with exit 1.
- **Evidence** — `qa/reports/artifacts/2026-11-09-demo-clock-run2/e2e.log` has the full failure output. Separate `rerun-<spec>.log` files preserve the isolated results.
- **Suggested fix** — Investigate the full-run timeouts under concurrent dev-server load. Keep the initial result and the isolated results distinct.

## 5. Other observations

- C5 used the existing plan for November 9 because it already met the requested 13:00–17:00 schedule. The 16:55 row button opened the dialog before the reminder banner appeared. The banner then read “Batch 2 ends at 17:00. Get ready to count the finished pairs.”
- The two C9 changes were made after the C8 reset so the new audit rows could be inspected.
- After Playwright and its reruns, the login band read `Real time: Mon, 9 Nov 2026 · 16:00`. Submitted **Reset demo data** once for cleanup. The app confirmed “Fresh demo week loaded. Sign in with one of the demo buttons.” PostgreSQL confirmed `offsetMs = 0` and 49 seeded scans after the reset.
- The vault at `C:\dev\capstone-obsidian` was absent on this PC, so a Daily entry could not be added.

## 6. Suggested fixes (priority order)

1. Repeat C6 in the in-app browser with a live camera feed and confirm shot acceptance while the demo time is ahead of real time.
2. Review the eight full-run timeouts using the saved Playwright logs. All eight passed in the corresponding isolated runs.
