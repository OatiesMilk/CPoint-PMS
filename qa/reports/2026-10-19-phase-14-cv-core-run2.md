# QA report: Phase 14, camera YOLO model intake and inference core — run 2

| Field     | Value                                        |
| --------- | -------------------------------------------- |
| Date      | 2026-10-19 09:41 (Asia/Shanghai)             |
| Handoff   | `qa/handoffs/2026-10-19-phase-14-cv-core.md` |
| Tested by | Codex                                        |
| Verdict   | **FAIL**                                     |

## 1. Summary

After Docker was enabled, S8 passed: the production build succeeded and all 8 CV Playwright tests passed against the running app. The literal S6 command still exits before its SHA check because the copied config resolves the model under `cv/out/`; a diagnostic run with the copied config path corrected produced the expected warning and predictions. Other scenario results below are carried forward from run 1 and were not repeated.

Current S1–S10 status: 9 passed, 1 failed, 0 blocked, 10 total. Rerun in this report: S6 and S8.

## 2. Environment

| Item            | Value                                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language, PowerShell                                                                                                                      |
| Node / npm      | v25.2.1 / 11.7.0                                                                                                                                                 |
| Branch / commit | `main` @ `63138dc`; working tree remains unclean with Phase 14 builder changes.                                                                                  |
| How the app ran | `npm run db:up`, `npm run db:deploy`, then `npm run dev`. The dev server was stopped after S8.                                                                   |
| Base URL        | `http://localhost:3000`                                                                                                                                          |
| Database        | Docker `cpoint-pms-db-1`, PostgreSQL 18, healthy. `db:deploy` found no pending migrations; existing demo data was available. Database container remains running. |
| Browser         | Playwright 1.63.0 Chromium 153.0.8010.12, headless                                                                                                               |
| Viewport        | 1440 × 900                                                                                                                                                       |

## 3. Scenario results

S1–S5, S7, S9 and S10 are carried forward from [run 1](2026-10-19-phase-14-cv-core.md); they were not repeated. Logs for rerun scenarios and the database/app startup are in `qa/reports/artifacts/2026-10-19-phase-14-cv-core-run2/`.

| ID  | Scenario                         | Result       | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | GPU prediction on three JPEGs    | PASS (run 1) | Not rerun. Run 1 log: `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S1.log`.                                                                                                                                                                                                                                                                                                                                                             |
| S2  | Overlays and Markdown summary    | PASS (run 1) | Not rerun. Run 1 log: `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S2.log`.                                                                                                                                                                                                                                                                                                                                                             |
| S3  | JSON output                      | PASS (run 1) | Not rerun. Run 1 log: `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S3.log`.                                                                                                                                                                                                                                                                                                                                                             |
| S4  | CPU override                     | PASS (run 1) | Not rerun. Run 1 log: `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S4.log`.                                                                                                                                                                                                                                                                                                                                                             |
| S5  | Missing model path               | PASS (run 1) | Not rerun. Run 1 log: `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S5.log`.                                                                                                                                                                                                                                                                                                                                                             |
| S6  | Wrong SHA in copied config       | FAIL         | Repeated exact command `.venv/Scripts/python -m cpoint_cv predict out/qa --config out/bad.toml`; exit 2, same missing `cv\out\models\yolo-v1.pt` error before SHA verification. A diagnostic run after changing only the temporary config path to `../models/yolo-v1.pt` exited 0, printed expected zero SHA vs found `1d729fb0…`, and produced predictions. Logs: `S6-exact.log`, `S6-corrected-config-diagnostic.log`.                     |
| S7  | Invalid confidence floor         | PASS (run 1) | Not rerun. Run 1 log: `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S7.log`.                                                                                                                                                                                                                                                                                                                                                             |
| S8  | Production build and CV e2e spec | PASS         | `npm run build` exit 0; `npm run db:up` exit 0; `npm run db:deploy` exit 0 (no pending migrations); health returned HTTP 200 with app/database up. PowerShell command `$env:E2E_BASE_URL='http://localhost:3000'; npx playwright test tests/e2e/cv.spec.ts` exited 0: 8 passed, 0 failed. Evidence: `db-up.log`, `db-deploy.log`, `health.log`, `S8-build.log`, `S8-playwright.log`, `server.log`, `S8-final.png`, `S8-browser-console.log`. |
| S9  | CV contract Vitest               | PASS (run 1) | Not rerun. Run 1 log: `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S9.log`.                                                                                                                                                                                                                                                                                                                                                             |
| S10 | Ignore rules                     | PASS (run 1) | Not rerun. Run 1 logs: `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S10-status.log` and `S10-check-ignore.log`.                                                                                                                                                                                                                                                                                                                         |
| A1  | No route or permission changes   | N/A          | No change per handoff; S8 passed on this run.                                                                                                                                                                                                                                                                                                                                                                                                |

Existing automated tests rerun:

| Command                                                                    | Result                      |
| -------------------------------------------------------------------------- | --------------------------- |
| `npm run build`                                                            | Passed; exit 0.             |
| `npx playwright test tests/e2e/cv.spec.ts` against `http://localhost:3000` | 8 passed, 0 failed; exit 0. |

## 4. Failures

### F1 — S6: copied config resolves the model under `cv/out/`

- **Severity:** Medium
- **Role / page:** None; command-line scenario.
- **Steps to reproduce:** 1. From `cv/`, copy `config.toml` to `out/bad.toml`. 2. Set `sha256` to 64 zeroes. 3. Run `.venv/Scripts/python -m cpoint_cv predict out/qa --config out/bad.toml`.
- **Expected:** A SHA mismatch warning, predictions, and exit code 0.
- **Actual:** Exit code 2 with `error: the model file ...\cv\out\models\yolo-v1.pt wasn't found.` The config path is relative to the copied config's `out/` directory. When the temporary path was corrected to `../models/yolo-v1.pt`, the diagnostic run emitted the expected warning and predictions with exit code 0.
- **Evidence:** `qa/reports/artifacts/2026-10-19-phase-14-cv-core-run2/S6-exact.log` and `S6-corrected-config-diagnostic.log`.
- **Suggested fix:** Update the S6 handoff steps to correct the temporary config's model path after copying it, or place the temporary config beside the model.

## 5. Other observations

- The successful end screenshot is `qa/reports/artifacts/2026-10-19-phase-14-cv-core-run2/S8-final.png`. The browser console capture reported no errors; server log records successful bootstrap and requests.
- `cv/out/qa/` and temporary `cv/out/bad.toml` were removed. Existing baseline and smoke outputs were preserved; `cv/config.toml` was not changed.
- The dev server is stopped. The Docker database container is healthy and remains running.

## 6. Suggested fixes (priority order)

1. Fix the S6 handoff's copied-config model path. The diagnostic confirms the SHA warning and prediction behavior work when the path is valid.
2. None indicated for S8; all 8 CV browser tests now pass.
