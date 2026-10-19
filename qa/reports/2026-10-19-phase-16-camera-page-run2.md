# QA report: Phase 16 camera page fixes (run 2)

| Field     | Value                                                 |
| --------- | ----------------------------------------------------- |
| Date      | 2026-10-19 15:35 (Asia/Shanghai)                      |
| Handoff   | `qa/handoffs/2026-10-19-phase-16-camera-page-run2.md` |
| Tested by | Codex                                                 |
| Verdict   | **PASS WITH ISSUES**                                  |

## 1. Summary

All four run 2 scenarios passed. The evaluator matched all five labels, the no-actions warning appeared as requested, all nine role/live-state axe checks reported zero violations, and the updated E2E specs and station tests passed. A PowerShell `npm` shim initially dropped simulator flags and created 11 extra simulator scans before it was stopped; the intended two-scan command was then run successfully through `npm.cmd`.

Scenarios: 4 passed, 0 failed, 0 blocked, 4 total.

## 2. Environment

| Item            | Value                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11, build 26200                                                                                                             |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                                           |
| Branch / commit | `main` @ `57694eb` (dirty; Phase 16 changes were already uncommitted)                                                               |
| How the app ran | `npm run dev` on the host; Docker PostgreSQL service `db`                                                                           |
| Base URL        | `http://localhost:3000`                                                                                                             |
| Database        | Docker `postgres:18-alpine`; existing dev data. `npm run db:deploy` found no pending migrations. No destructive demo reset was run. |
| Browser         | Playwright 1.63.0 Chromium 153.0.8010.12, headless                                                                                  |
| Viewport        | 1440 × 900                                                                                                                          |

Before R3, the camera selector was **Automatic** and batches including B-2026-0015 were in progress at Preparation. The configured `CV_DEVICE_TOKEN` matched an active token; it was not revoked. The `cv/out/qa-*` files created for R1 and R2 were removed. The pre-existing `cv/out/qa/` folder was left in place. At completion, the dev server was stopped and the Docker database remained healthy.

## 3. Scenario results

| ID  | Scenario                                        | Result | Notes / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Evaluate with the current preview settings      | PASS   | From `cv/`, ran `.venv/Scripts/python -m cpoint_cv evaluate "C:\Users\micro\OneDrive\Pictures\Sample Photos (CAP2)" --out out/qa-eval.md` (exit 0). Output: “The preview matched the expected verdict on 5 of 5 photos.” Settings line contained the found-at value and all four actions in the expected order. No warning. `R1.log`, `R1-evaluation.md`.                                                                                                                                                                                                                                                            |
| R2  | Preview warning with no configured actions      | PASS   | Copied `config.toml` to `out/qa-noactions.toml`, removed `found_at_or_above` and `[preview.actions]`, and ran `.venv/Scripts/python -m cpoint_cv evaluate "C:\Users\micro\OneDrive\Pictures\Sample Photos (CAP2)" --config out/qa-noactions.toml --out out/qa-noactions.md` (exit 0). It printed the expected warning and the no-actions settings line. `R2.log`, `R2-evaluation.md`; initial copy path issue is recorded in `R2-attempt1-path.log`.                                                                                                                                                                 |
| R3  | axe on live camera states for FM, QI, and Admin | PASS   | Checked Station connected, then Camera station active after one real Space press, then Simulator active. axe reported 0 WCAG 2.1 A/AA violations for each role in each state. All nine scans had zero browser console errors before and after screenshots. Logs: `R3-station-axe.log`, `R3-capture-axe.log`, `R3-simulator-axe.log`. Screenshots: `R3-station-fm.png`, `R3-station-qi.png`, `R3-station-admin.png`, `R3-capture-fm.png`, `R3-capture-qi.png`, `R3-capture-admin.png`, `R3-simulator-fm.png`, `R3-simulator-qi.png`, `R3-simulator-admin.png`. Server check-in and scan requests are in `server.log`. |
| R4  | Listed Playwright command                       | PASS   | `npm run build && npx playwright test tests/e2e/admin.spec.ts tests/e2e/cv.spec.ts` (exit 0): build passed; 14 tests passed, including the threshold snapshot test. `R4-e2e.log`.                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Existing automated tests run:

| Command                                                                             | Result                                                    |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `npm run build && npx playwright test tests/e2e/admin.spec.ts tests/e2e/cv.spec.ts` | Build passed; 14 passed, 0 failed (exit 0). `R4-e2e.log`. |
| `cd cv && .venv/Scripts/python -m pytest`                                           | 158 passed in 0.94s (exit 0). `station-pytest.log`.       |

## 4. Failures

No R1–R4 scenario failures or blocked checks.

## 5. Other observations

- R2’s first temporary config copy exited 2 because the model path is relative to the config file and the copy was under `out/`. I preserved that attempt in `R2-attempt1-path.log`, corrected the model path to `../models/yolo-v1.pt` in the temporary copy only, and reran R2 successfully. The repository’s `cv/config.toml` was not changed by this run.
- The first PowerShell invocation of `npm run cv:simulate -- --count 2 --interval 2` was parsed by `npm.ps1` as `tsx scripts/cv-simulate.ts 2 2`; npm warned that `--count` and `--interval` were unknown config options, then the simulator defaulted to 20 scans. I stopped it after 11 scans had been sent. I then ran `npm.cmd run cv:simulate -- --count 2 --interval 2` (exit 0), which sent the intended two scans and was used for the Simulator active axe checks. The 11 earlier scans remain in the dev database; no reset or scan deletion was performed. Evidence: `R3-simulate.log` and `R3-simulate-corrected.log`.
- The E2E runner emitted `next start does not work with output: standalone`, `The destination stream closed early`, and Node `NO_COLOR`/`FORCE_COLOR` warnings. The build and all 14 tests passed. Details are in `R4-e2e.log`.

## 6. Suggested fixes (priority order)

1. On Windows PowerShell, use `npm.cmd run cv:simulate -- --count 2 --interval 2` so the flags reach the simulator script.
2. For temporary config copies under `cv/out/`, adjust relative model paths inside the copy, leaving `cv/config.toml` unchanged.
