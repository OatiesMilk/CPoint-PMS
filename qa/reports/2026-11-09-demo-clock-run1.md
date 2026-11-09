# QA report — Demo clock (D-125), run 1

| Field     | Value                                  |
| --------- | -------------------------------------- |
| Date      | 2026-11-09 15:43 (Manila, UTC+08:00)   |
| Handoff   | `qa/handoffs/2026-11-09-demo-clock.md` |
| Tested by | Codex                                  |
| Verdict   | **FAIL**                               |

## 1. Summary

The login band showed Manila real time and the blank and out-of-range dates were rejected correctly. Valid changes failed before saving. The D-125 migration was pending, PostgreSQL had no `demo_clock` table, and the generated Prisma client lacked its `demoClock` delegate. The clock-dependent checks could not be verified on this setup.

Of 12 scenarios, 3 passed, 3 failed, 5 were blocked and 1 was skipped.

## 2. Environment

| Item            | Value                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Checkout        | `D:\IMPORTANT SHIT HERE\12th Term - BSIT\CAP2\CPoint-PMS`                                                                      |
| OS              | Windows NT 10.0.26200                                                                                                          |
| Node / npm      | v24.18.0 / 11.16.0                                                                                                             |
| Branch / commit | `feature/varied-demo-defects` @ `ca71fcf`, with uncommitted D-125 changes                                                      |
| How the app ran | Dylan's `npm run dev` from the specified checkout                                                                              |
| Base URL        | `http://localhost:3000`                                                                                                        |
| Database        | Docker `db`, PostgreSQL 18, with demo accounts and a seeded week                                                               |
| Migration       | `npx prisma migrate status` reported `20261109090000_demo_clock` pending. PostgreSQL confirmed `public.demo_clock` was absent. |
| Browser         | Codex in-app browser for manual checks. Playwright 1.63.0, headless Chromium for C12.                                          |
| Viewport        | In-app browser default. Playwright 1440 × 900 by default, with spec overrides.                                                 |

The first port check found Docker's app container on 3000. Dylan stopped it and started Next dev. The scenario observations below are from the dev server.

## 3. Scenario results

| ID  | Scenario                                              | Tool                                                | Result  | Evidence                                                                                                                                                                      |
| --- | ----------------------------------------------------- | --------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Login band                                            | Codex in-app browser                                | PASS    | Exact band text below. **Change time** was visible.                                                                                                                           |
| C2  | Empty date                                            | Codex in-app browser                                | PASS    | Clearing the native date field and submitting showed “Pick the date to show, for example 2026-11-13.” The band stayed on real time.                                           |
| C3  | Date two years ahead                                  | Codex in-app browser                                | PASS    | `2028-11-09` showed “Pick a date from 2025-11-08 to 2027-11-10: the demo clock goes up to a year either way.”                                                                 |
| C4  | Floor Manager moves clock to a weekday at 15:55       | Codex in-app browser                                | FAIL    | Rodel submitted `2026-11-09 15:55`. The clock stayed on real time and the form showed a server error. Batches still showed the real Monday. Exact band text below.            |
| C5  | QI sees the shared clock and Finish batch notice      | Codex in-app browser, second tab                    | BLOCKED | Maricel signed in on localhost. The band showed real time, and Batch 2 (13:00–17:00) said “Can be finished from 16:50.” The moved time needed for the notice was unavailable. |
| C6  | Constructor captures with the clock moved             | Codex in-app browser precondition check             | BLOCKED | No clock offset could be saved. A real-time shot would leave both the future-date acceptance and timer behavior unverified. No manual shot was submitted.                     |
| C7  | Wednesday stock reminder                              | Codex in-app browser                                | FAIL    | Rodel submitted `2026-11-11 10:00`. The server refused the change and the Wednesday reminder did not appear.                                                                  |
| C8  | Reset while moved seeds the week through the demo day | Codex in-app browser precondition check             | BLOCKED | The moved clock could not be established. The reset performed at the end of the run was at real time.                                                                         |
| C9  | Clock audit rows                                      | Codex in-app browser and read-only PostgreSQL query | BLOCKED | Jerome could open Audit log, but the Action list had no `demo_clock.set` option. PostgreSQL returned zero matching rows. No successful clock change was available to audit.   |
| C10 | Back to real time                                     | Codex in-app browser                                | BLOCKED | The clock was already on real time, so the button was absent. Batches showed “Today, Mon, 9 Nov.” Exact band text below.                                                      |
| C11 | Demo tools off                                        | Not run                                             | SKIPPED | Skipped as requested because the scenario requires an `.env` change and restart. The disabled-mode 404 was untested.                                                          |
| C12 | Full e2e suite                                        | Playwright, headless Chromium                       | FAIL    | 83 passed, 16 failed, 2 skipped and 1 did not run in 5.6 minutes (exit 1). All six isolated spec reruns passed.                                                               |

### Exact band text

**C1 — Login**

```text
Demo mode: quick sign-in and Reset demo data are on. Never use this setup for real work.
Real time: Mon, 9 Nov 2026 · 15:30
Change time
```

**C4 — After submitting Monday at 15:55**

```text
Demo mode: quick sign-in and Reset demo data are on. Never use this setup for real work.
Real time: Mon, 9 Nov 2026 · 15:31
Date (Manila)
Time
Set clock
Cancel
The server hit an error, so nothing was saved. Try again in a moment.
```

The fields still showed `2026-11-09` and `15:55`.

**C10 — Batches while the clock was already on real time**

```text
Demo mode: quick sign-in and Reset demo data are on. Never use this setup for real work.
Real time: Mon, 9 Nov 2026 · 15:32
Change time
The server hit an error, so nothing was saved. Try again in a moment.
```

The alert persisted from the unsuccessful C7 submission. There was no **Back to real time** button to press.

### Existing automated tests

| Command                                                                                                                                     | Result                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `$env:E2E_BASE_URL="http://localhost:3000"; npx playwright test --output qa/reports/artifacts/2026-11-09-demo-clock-run1/playwright-output` | 83 passed, 16 failed, 2 skipped and 1 did not run in 5.6 minutes (exit 1). All six isolated spec reruns passed. |

## 4. Failures

### F1 — C4, A valid clock change fails

- **Severity** — High.
- **Role / page** — Floor Manager, Overview.
- **Reproduce** — Sign in as Rodel, click **Change time**, set `2026-11-09 15:55` and click **Set clock**.
- **Expected** — The band says `Demo clock: Mon, 9 Nov 2026 · 15:55` and offers **Back to real time**.
- **Actual** — The clock stays on real time and the form shows the server error quoted above.
- **Evidence** — The migration status lists `20261109090000_demo_clock` as pending. `to_regclass('public.demo_clock')` returned null. A direct read through the application's clock model returned the following.

  ```text
  Generated Prisma demoClock delegate: undefined
  TypeError: Cannot read properties of undefined (reading 'findUnique')
  ```

- **Suggested fix** — Apply the existing migration and regenerate the client from the D-125 schema before restarting Next dev. A restart alone uses the same generated client.

### F2 — C5, QI notice requires a shared moved clock

- **Severity** — High.
- **Reproduce** — Sign in as Maricel in another tab after C4 and check Batch 2 at 16:50 demo time.
- **Expected** — The same demo clock appears and the Finish batch notice opens for the 13:00–17:00 batch.
- **Actual and evidence** — The second tab showed real time and the upcoming 16:50 threshold. F1 prevented reaching that threshold on the demo clock.
- **Suggested fix** — Resolve F1 and repeat with a planned 13:00–17:00 batch.

### F3 — C6, Capture cannot be verified with a moved clock

- **Severity** — High.
- **Reproduce** — Set a future demo time, then capture a roll section as a constructor.
- **Expected** — The shot is accepted and the scanning timer runs from the demo time.
- **Actual and evidence** — F1 prevented setting the required time. The model and Playwright's marker-card fixture were present, but the moved-clock capture was blocked before shooting.
- **Suggested fix** — Resolve F1, then capture with the clock ahead of real time and observe the timer.

### F4 — C7, Wednesday cannot be selected for the stock reminder

- **Severity** — High.
- **Reproduce** — As Rodel, submit `2026-11-11 10:00` from the clock form.
- **Expected** — The demo clock moves to Wednesday and the Floor Manager sees the stock update reminder.
- **Actual and evidence** — The form displayed “The server hit an error, so nothing was saved. Try again in a moment.” The date stayed Monday and the reminder was absent.
- **Suggested fix** — Resolve F1 and retest on a Wednesday without a saved update.

### F5 — C8, Demo-date reset could not be exercised

- **Severity** — High.
- **Reproduce** — Move the clock, sign out and reset demo data. Then open Reports → Rolls as the Floor Manager.
- **Expected** — The newest demo rolls belong to the demo day.
- **Actual and evidence** — F1 prevented setting a demo date. The final reset at real time did not exercise C8.
- **Suggested fix** — Resolve F1 and repeat with a demo day different from the real date.

### F6 — C9, No clock audit events to inspect

- **Severity** — High.
- **Reproduce** — After a successful clock change, sign in as Jerome and inspect `demo_clock.set` in Audit log.
- **Expected** — The row identifies the actor and includes the before and after times.
- **Actual and evidence** — The Audit log loaded, but the Action filter had no `demo_clock.set` and a read-only count returned zero. No clock change saved.
- **Suggested fix** — Resolve F1 and check the audit after a user change and a signed-out change.

### F7 — C10, Return to real time could not be exercised

- **Severity** — High.
- **Reproduce** — Move the clock, then click **Back to real time** and open Batches.
- **Expected** — The band returns to real time and Batches returns to the actual day.
- **Actual and evidence** — Real time and today's Batches were visible throughout. There was no offset to clear or return control to press.
- **Suggested fix** — Resolve F1 and repeat the round trip across dates.

### F8 — C12, Full Playwright suite

- **Severity** — High for the suite result.
- **Reproduce** — Run the full suite against the same dev URL using the command in section 3.
- **Expected** — The full suite passes.
- **Actual** — 83 passed, 16 failed, 2 skipped and 1 did not run in 5.6 minutes (exit 1). All six isolated spec reruns passed. Fifteen of the 16 failures reached the 30-second test limit. No `ECONNRESET` was reported. The full run also passed both the fake-camera shot and scanning timer at real time, which does not exercise C6.
- **Evidence** — `qa/reports/artifacts/2026-11-09-demo-clock-run1/e2e.log` has the initial results. The Next trace recorded first compiles for routes the failed specs exercised, including `/admin/settings`, `/admin/tokens`, `/inventory/update`, `/api/v1/reports/operations.csv`, `/reports/rolls/[id]` and `/reports/claims/[rollId]`. Each corresponding spec was rerun alone once on the warm server with the original timeouts. See `rerun-<spec>.log` in the same artifacts directory.

| Spec rerun alone           | Full run                          | Isolated rerun |
| -------------------------- | --------------------------------- | -------------- |
| `admin.spec.ts`            | 2 passed, 3 failed, 1 did not run | 6 passed       |
| `cv.spec.ts`               | 5 passed, 2 failed                | 7 passed       |
| `inventory.spec.ts`        | 4 passed, 4 failed                | 8 passed       |
| `reports.spec.ts`          | 3 failed                          | 3 passed       |
| `rolls.spec.ts`            | 5 passed, 1 failed                | 6 passed       |
| `supplier-quality.spec.ts` | 2 passed, 1 failed                | 3 passed       |

The other two failures were a navigation timeout to the already warmed `/reports/rolls` in `returns.spec.ts:121` and a timeout waiting for the Floor Manager landing URL in `smoke.spec.ts:151`. The trace did not tie either to a first compile, so these two were left as failures in the full-run result.

- **Suggested fix** — Recheck the full suite after the D-125 setup is complete. Use the initial log and the isolated rerun results to investigate any failures that persist.

## 5. Other observations

- The run skipped C11 as requested. QA left `.env` and project code untouched.
- Cleanup — Confirmed `Real time: Mon, 9 Nov 2026 · 15:43` on the login page. **Back to real time** was absent because the clock had never moved. Submitted **Reset demo data** once after the suite and reruns. The dialog confirmed “Fresh demo week loaded. Sign in with one of the demo buttons.”
- The vault at `C:\dev\capstone-obsidian` was absent, so a Daily entry could not be added.

## 6. Suggested fixes (priority order)

1. Apply `20261109090000_demo_clock`, regenerate the Prisma client and restart the dev server.
2. Rerun C4–C10 with a clock change that persists, then confirm the final reset at real time.
3. Review the remaining Playwright failures recorded above.
