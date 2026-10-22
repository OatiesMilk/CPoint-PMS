# QA report: Phase 22 Attendance, run 2

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| Date      | 2026-10-21 13:14 (Asia/Shanghai)                     |
| Handoff   | `qa/handoffs/2026-10-21-phase-22-attendance-run2.md` |
| Tested by | Codex                                                |
| Verdict   | **PASS**                                             |

## 1. Summary

The build and database migration check passed. R1 to R4 passed; the full e2e suite had no failures and one expected skip for missing capture model files. The dev database's attendance was restored to its pre-run empty state.

Scenarios: 4 passed, 0 failed, 0 blocked, 4 total.

## 2. Environment

| Item            | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| OS              | Windows, PowerShell                                                                        |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                  |
| Branch / commit | `main` @ `cc612ee` (working tree dirty with pre-existing phase changes and this QA report) |
| How the app ran | `npm run dev` with `PORT=3001`                                                             |
| Base URL        | `http://localhost:3001`                                                                    |
| Database        | Docker `cpoint-pms-db-1`, database `cpoint_pms`; pre-run attendance-day list was empty     |
| Browser         | Playwright 1.63.0, Chromium 153.0.8010.12, headless                                        |
| Viewport        | 1440 × 900                                                                                 |

## 3. Scenario results

| ID  | Scenario                                | Result | Notes / evidence                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | FM attendance and home card             | PASS   | Saved 34 of 34 Shoe Constructors present and 0 others present. The Floor Manager home card showed the same summary. Screenshots: `qa/reports/artifacts/2026-10-21-phase-22-attendance-run2/R1-attendance.png`, `R1-home-card.png`.                                                                                                 |
| R2  | FM save attribution and reload          | PASS   | Save button read `Save attendance (5 changes)`. After unticking one constructor and Ivy, summary was 33 of 34 Shoe Constructors present and 4 others present; it said `Last saved by Ivy`. Reload preserved the marks and disabled Save. Screenshot: `qa/reports/artifacts/2026-10-21-phase-22-attendance-run2/R2-attendance.png`. |
| R3  | `auth.spec.ts` and `attendance.spec.ts` | PASS   | 19 passed, 0 failed. Log: `qa/reports/artifacts/2026-10-21-phase-22-attendance-run2/r3.log`.                                                                                                                                                                                                                                       |
| R4  | Full `npm run test:e2e` suite           | PASS   | 94 passed, 1 expected skip, 0 failed (95 total). The skipped test is `capture API › without the model files the app answers 503 with where to put them`. Log: `qa/reports/artifacts/2026-10-21-phase-22-attendance-run2/e2e.log`.                                                                                                  |

Build and database checks:

| Command             | Result                      | Evidence                                                                 |
| ------------------- | --------------------------- | ------------------------------------------------------------------------ |
| `npm run db:up`     | PASS                        | `qa/reports/artifacts/2026-10-21-phase-22-attendance-run2/db-up.log`     |
| `npm run db:deploy` | PASS; no pending migrations | `qa/reports/artifacts/2026-10-21-phase-22-attendance-run2/db-deploy.log` |
| `npm run build`     | PASS                        | `qa/reports/artifacts/2026-10-21-phase-22-attendance-run2/build.log`     |

Attendance cleanup: the saved pre-run query returned 0 rows (`attendance-days-before.txt`). The run created days `2026-10-20` and `2026-10-21`; cleanup deleted their 44 marks first, then the 2 days. The final day query returned 0 rows and the marks count was 0. Evidence: `attendance-days-after-tests.txt`, `attendance-cleanup.log`, and `attendance-marks-after-cleanup.txt` in the same artifact directory.

## 4. Failures

None.

## 5. Other observations

- The first dev browser attempt used `127.0.0.1`; Next.js blocked its HMR request. The R1/R2 run used `localhost:3001` and passed.
- The dev log contains a React hydration diagnostic for an input `style={{caret-color:"transparent"}}` attribute mismatch during headless automation. No scenario failed or displayed a functional issue.
- npm v11 emitted unknown `--output` config warnings from the artifact-directory argument; Playwright still ran the full 95-test suite and its output is saved in `e2e.log`.
- The e2e log contains repeated `Error: The destination stream closed early.` server messages; the suite still completed with 94 passed, 1 expected skip, and 0 failed.

## 6. Suggested fixes (priority order)

None.
