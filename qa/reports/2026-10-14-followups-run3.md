# QA report: Follow-ups, run 3

| Field     | Value                                      |
| --------- | ------------------------------------------ |
| Date      | 2026-10-14 21:32 (Asia/Shanghai)           |
| Handoff   | `qa/handoffs/2026-10-14-followups-run3.md` |
| Tested by | Codex                                      |
| Verdict   | **PASS**                                   |

## 1. Summary

All three required seven-spec runs passed, including their production builds, and the full Playwright suite passed once. Across all four test invocations, 246 tests passed and none failed; the token-revocation and inventory-unit checks passed each time. The known server log warnings appeared but did not fail a run.

Scenarios: 4 passed, 0 failed, 0 blocked, 4 total.

## 2. Environment

| Item            | Value                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows, PowerShell                                                                                                                                      |
| Node / npm      | v25.2.1 / 11.7.0                                                                                                                                         |
| Branch / commit | `main` @ `e88e7de`; working tree was already not clean, with builder changes present. QA created files only under `qa/reports/`.                         |
| How the app ran | `npm run db:up`, `npm run db:deploy`; three production builds and E1 runs; Playwright `webServer` launched the production app on port 3100 for each run. |
| Base URL        | `http://127.0.0.1:3100`                                                                                                                                  |
| Database        | Docker `cpoint-pms-db-1`, PostgreSQL 18, existing local test/dev data. Deploy reported no pending migrations; no reset or manual fixtures were used.     |
| Browser         | Playwright 1.63.0 Chromium 153.0.8010.12, headless                                                                                                       |
| Viewport        | 1440 × 900                                                                                                                                               |

## 3. Scenario results

| ID   | Scenario                  | Result | Notes / evidence                                                                                                                                 |
| ---- | ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1.1 | Seven-spec command, run 1 | PASS   | Build exit 0; 57 passed, 0 failed. Logs: `qa/reports/artifacts/2026-10-14-followups-run3/build-1.log`, `e2e-1.log`; Playwright output: `e2e-1/`. |
| E1.2 | Seven-spec command, run 2 | PASS   | Build exit 0; 57 passed, 0 failed. Logs: `build-2.log`, `e2e-2.log`; Playwright output: `e2e-2/`.                                                |
| E1.3 | Seven-spec command, run 3 | PASS   | Build exit 0; 57 passed, 0 failed. Logs: `build-3.log`, `e2e-3.log`; Playwright output: `e2e-3/`.                                                |
| E2   | Full Playwright suite     | PASS   | 75 passed, 0 failed; exit 0. Log: `e2e-4-full-suite.log`; Playwright output: `e2e-4/`.                                                           |

Per-spec counts below are **passed / failed**. A dash means that spec was outside the seven-spec E1 command.

| Spec                     | E1 run 1   | E1 run 2   | E1 run 3   | E2 full suite |
| ------------------------ | ---------- | ---------- | ---------- | ------------- |
| `admin.spec.ts`          | 6 / 0      | 6 / 0      | 6 / 0      | 6 / 0         |
| `auth.spec.ts`           | —          | —          | —          | 12 / 0        |
| `batches.spec.ts`        | 8 / 0      | 8 / 0      | 8 / 0      | 8 / 0         |
| `cv.spec.ts`             | 8 / 0      | 8 / 0      | 8 / 0      | 8 / 0         |
| `inventory.spec.ts`      | 5 / 0      | 5 / 0      | 5 / 0      | 5 / 0         |
| `outcomes.spec.ts`       | 5 / 0      | 5 / 0      | 5 / 0      | 5 / 0         |
| `procurement.spec.ts`    | 15 / 0     | 15 / 0     | 15 / 0     | 15 / 0        |
| `reports.spec.ts`        | —          | —          | —          | 3 / 0         |
| `rework-columns.spec.ts` | —          | —          | —          | 1 / 0         |
| `smoke.spec.ts`          | 10 / 0     | 10 / 0     | 10 / 0     | 10 / 0        |
| `theme.spec.ts`          | —          | —          | —          | 2 / 0         |
| **Total**                | **57 / 0** | **57 / 0** | **57 / 0** | **75 / 0**    |

Existing automated tests run:

| Command                                       | Result                                    |
| --------------------------------------------- | ----------------------------------------- |
| `npm run build` + seven named E1 specs, run 1 | Build passed; 57 passed, 0 failed; exit 0 |
| `npm run build` + seven named E1 specs, run 2 | Build passed; 57 passed, 0 failed; exit 0 |
| `npm run build` + seven named E1 specs, run 3 | Build passed; 57 passed, 0 failed; exit 0 |
| `npx playwright test` (full suite)            | 75 passed, 0 failed; exit 0               |

Each invocation used its own `--output=qa/reports/artifacts/2026-10-14-followups-run3/e2e-<n>` directory. The console logs and build logs are saved beside the corresponding output folders.

## 4. Failures

None. All three production builds and all four Playwright invocations exited successfully.

## 5. Other observations

- The known `[WebServer] Error: The destination stream closed early` messages and the Next standalone/`next start` warning appeared in the run logs. The handoff identifies them as harmless; all associated runs completed successfully.
- Node also printed `NO_COLOR` / `FORCE_COLOR` environment warnings. They did not affect test results.
- After testing, port 3100 was clear and Docker reported the PostgreSQL container healthy and still running.

## 6. Suggested fixes (priority order)

1. None indicated by this run; the requested runs all passed.
