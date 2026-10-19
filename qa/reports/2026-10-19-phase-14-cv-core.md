# QA report: Phase 14, camera YOLO model intake and inference core

| Field     | Value                                        |
| --------- | -------------------------------------------- |
| Date      | 2026-10-19 09:35 (Asia/Shanghai)             |
| Handoff   | `qa/handoffs/2026-10-19-phase-14-cv-core.md` |
| Tested by | Codex                                        |
| Verdict   | **FAIL**                                     |

## 1. Summary

The station checks and contract test passed except S6, whose copied config points to a model path under `cv/out/` and exits before the SHA check. S8 is blocked by the unavailable local PostgreSQL service: the build passed, but the eight browser tests could not sign in. The app change itself was not validated end to end.

Scenarios: 8 passed, 1 failed, 1 blocked, 10 total.

## 2. Environment

| Item            | Value                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11 Home Single Language, PowerShell                                                                                                                               |
| Node / npm      | v25.2.1 / 11.7.0                                                                                                                                                          |
| Branch / commit | `main` @ `63138dc`; working tree was already unclean with Phase 14 changes present. QA report, logs, screenshots and one capture script were created under `qa/reports/`. |
| How the app ran | `npm run db:up` failed because the Docker Desktop engine was unavailable. `npm run dev` started, but without PostgreSQL; it logged connection refusals.                   |
| Base URL        | `http://localhost:3000`                                                                                                                                                   |
| Database        | No Docker database was available; `http://localhost:3000/api/health` returned HTTP 503. `npm run db:deploy` was not run because `db:up` failed.                           |
| Browser         | Playwright 1.63.0 Chromium 153.0.8010.12, headless                                                                                                                        |
| Viewport        | 1440 × 900                                                                                                                                                                |

## 3. Scenario results

All station commands below ran from `cv/` using `.venv/Scripts/python`. Full logs are in `qa/reports/artifacts/2026-10-19-phase-14-cv-core/`.

| ID  | Scenario                           | Result  | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | `predict out/qa` on three JPEGs    | PASS    | Exact command: `.venv/Scripts/python -m cpoint_cv predict out/qa`; exit 0. Header reported `Model yolo-v1-1d729fb0 (segment)`, all four classes and `device cuda:0`; summary: `preview: PASS 1, REWORK 0, REJECT 2, NEEDS_REVIEW 0`. Log: `S1.log`.                                                                                                                                                                                                                      |
| S2  | Save overlays and Markdown summary | PASS    | Exact command: `.venv/Scripts/python -m cpoint_cv predict out/qa --save-overlay out/qa-overlay --summary-md out/qa-summary.md`; exit 0. Three overlay JPEGs were created; the inspected overlay caption read `yolo-v1-1d729fb0 preview REJECT`; summary contained both required tables. Log: `S2.log`.                                                                                                                                                                   |
| S3  | JSON output                        | PASS    | Exact command: `.venv/Scripts/python -m cpoint_cv predict out/qa --json`; exit 0. Three JSON lines contained the required fields; each `x + width` was ≤ 1.0001. Log: `S3.log`.                                                                                                                                                                                                                                                                                          |
| S4  | CPU override                       | PASS    | Exact PowerShell command: `$env:CPOINT_CV_MODEL_DEVICE="cpu"; .venv/Scripts/python -m cpoint_cv predict out/qa`; exit 0. Settings reported `device cpu`; detections and verdicts matched S1; median inference time was 824.9 ms vs 255.5 ms in S1. Log: `S4.log`.                                                                                                                                                                                                        |
| S5  | Missing model path                 | PASS    | Exact PowerShell command: `$env:CPOINT_CV_MODEL_PATH="models/missing.pt"; .venv/Scripts/python -m cpoint_cv predict out/qa`; exit 2. The CLI emitted the expected missing-model error and no predictions. Log: `S5.log`.                                                                                                                                                                                                                                                 |
| S6  | Wrong SHA in copied config         | FAIL    | Exact command: `.venv/Scripts/python -m cpoint_cv predict out/qa --config out/bad.toml`; exit 2. Instead of the SHA warning and predictions, it reported that `cv\out\models\yolo-v1.pt` was missing. See F1 and `S6.log`.                                                                                                                                                                                                                                               |
| S7  | Invalid confidence floor           | PASS    | Exact command: `.venv/Scripts/python -m cpoint_cv predict out/qa --config out/bad.toml`; exit 2. Output included `error: [mapper] confidence_floor must be from 0.0 to 1.0; got 1.5.` Log: `S7.log`.                                                                                                                                                                                                                                                                     |
| S8  | Production build and CV e2e spec   | BLOCKED | `npm run build` exited 0. `npm run db:up` exited 1 because Docker could not connect to `dockerDesktopLinuxEngine`; dev server started but health returned 503. The Playwright command, pointed at that running server, exited 1 with 8 tests failing at manager sign-in (`/login` instead of `/floor-manager`). Screenshots: `S8-failure-01.png` through `S8-failure-08.png`; logs: `app-start.log`, `server.log`, `S8-health.log`, `S8-build.log`, `S8-playwright.log`. |
| S9  | CV contract Vitest                 | PASS    | Exact command: `npx vitest run tests/unit/cv-contract.test.ts`; exit 0, 2 passed. Log: `S9.log`.                                                                                                                                                                                                                                                                                                                                                                         |
| S10 | Ignore rules                       | PASS    | `git status --short -uall cv` exited 0; ignored model, config, output and venv did not appear. `git check-ignore -v cv/models/yolo-v1.pt cv/config.toml cv/out` exited 0 and showed `.gitignore` rules for all three queried paths. Logs: `S10-status.log`, `S10-check-ignore.log`.                                                                                                                                                                                      |
| A1  | No route or permission changes     | N/A     | The handoff says nothing needs checking beyond S8. S8 was blocked by the database prerequisite.                                                                                                                                                                                                                                                                                                                                                                          |

Existing automated tests run:

| Command                                                                    | Result                                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                                                            | Passed; exit 0.                                                                                                     |
| `npx playwright test tests/e2e/cv.spec.ts` against `http://localhost:3000` | 0 passed, 8 failed; exit 1. Classified BLOCKED because the local DB was unavailable and sign-in could not complete. |
| `npx vitest run tests/unit/cv-contract.test.ts`                            | 2 passed, 0 failed; exit 0.                                                                                         |

## 4. Failures

### F1 — S6: copied config resolves the model under `cv/out/`

- **Severity:** Medium
- **Role / page:** None; command-line scenario.
- **Steps to reproduce:** 1. From `cv/`, copy `config.toml` to `out/bad.toml`. 2. Set its `sha256` to 64 zeroes. 3. Run `.venv/Scripts/python -m cpoint_cv predict out/qa --config out/bad.toml`.
- **Expected:** A warning showing the expected and actual SHA values, predictions, and exit code 0.
- **Actual:** `error: the model file C:\Users\micro\OneDrive\Desktop\CPoint-PMS\cv\out\models\yolo-v1.pt wasn't found.` Exit code 2; the SHA check was not reached. The copied config retains `path = "models/yolo-v1.pt"`, which resolves relative to its new `out/` location.
- **Evidence:** `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S6.log`
- **Suggested fix:** Correct the S6 handoff steps to set the temporary config's model path to `../models/yolo-v1.pt` after copying it, or keep the temporary config beside the model so its relative path remains valid.

### B1 — S8: local database unavailable, e2e could not validate the feature

- **Severity:** Medium (environment blocker)
- **Role / page:** Floor Manager sign-in at `/login`.
- **Steps to reproduce:** 1. Run `npm run db:up`; it exits 1 because the Docker Desktop engine pipe is unavailable. 2. Start `npm run dev`. 3. Run `npm run build`, then `E2E_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/cv.spec.ts` (PowerShell used `$env:E2E_BASE_URL='http://localhost:3000'`).
- **Expected:** Build succeeds and all CV e2e tests pass against the running app.
- **Actual:** Build passed. The dev server started, but `/api/health` returned HTTP 503 and the server logged `ECONNREFUSED` on port 5432. All 8 tests stayed on `/login` after manager sign-in and failed their `/floor-manager` URL assertion; Playwright exited 1. No CV business assertions could be reached.
- **Evidence:** `qa/reports/artifacts/2026-10-19-phase-14-cv-core/S8-health.log`, `server.log`, `S8-playwright.log`, and `S8-failure-01.png` through `S8-failure-08.png`. Browser console capture reported no console errors.
- **Suggested fix:** Start Docker Desktop and the local DB, deploy migrations, then rerun S8. No application code fix is indicated by this run.

## 5. Other observations

- Vitest printed a non-failing warning that `vite-tsconfig-paths` can be replaced by Vite's native `resolve.tsconfigPaths` option; both contract tests passed.
- The first model run used CUDA on an NVIDIA GeForce RTX 3060 Laptop GPU. The reported predictions are simulator-image previews, not a real-leather accuracy assessment.
- The dev server was stopped after S8. The database could not be left running because Docker was unavailable.
- Removed the temporary `cv/out/qa/`, `cv/out/qa-overlay/`, `cv/out/qa-summary.md`, and `cv/out/bad.toml`. Existing baseline and smoke outputs under `cv/out/` were preserved. `cv/config.toml` was not changed.

## 6. Suggested fixes (priority order)

1. Fix the S6 handoff's relative model path so the intended SHA warning can be tested.
2. Rerun S8 after Docker/PostgreSQL is available; the current result does not establish whether the CV e2e scenarios pass.
