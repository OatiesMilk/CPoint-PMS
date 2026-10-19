# QA handoff: Phase 16, run 2 fixes

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Date            | 2026-10-19                                                              |
| Feature         | phase-16-camera-page-run2                                               |
| Branch          | `main` @ `57694eb` plus uncommitted Phase 16 changes                    |
| Spec / prompt   | `camera-yolo-integration.md` Phase 16; `docs/ROADMAP.md` Phase 16       |
| Written by      | Claude                                                                  |
| Previous report | `qa/reports/2026-10-19-phase-16-camera-page.md` (FAIL: S14, A4 blocked) |

## 1. What changed

- **F1 (S14):** the run 1 report was right: Dylan's local `cv/config.toml` had no
  `found_at_or_above` or `[preview.actions]`, so the preview decided by confidence only. They're
  now in it (cut and hole Reject, crease and scratch Rework, found at 0.50). `predict` and
  `evaluate` now print a warning when `[preview.actions]` is empty, and the report's settings line
  says "no "When found" actions (by confidence only)".
- **F2:** `tests/e2e/admin.spec.ts` checks only the two thresholds in `thresholdsSnapshot`
  (`toMatchObject`), since the snapshot also keeps `foundAtOrAbove` and `actions` (D-053).
- **A4:** not a code change. Run the axe checks while each camera state is live, before any token
  is revoked.
- No app code changed.

## 2. Files touched

| File                       | Change                                            |
| -------------------------- | ------------------------------------------------- |
| `cv/cpoint_cv/cli.py`      | `preview_warning`, settings line without actions  |
| `cv/tests/test_cli.py`     | New: 2 tests (158 station tests in all)           |
| `tests/e2e/admin.spec.ts`  | Snapshot assertion checks the thresholds only     |
| `cv/config.toml` (ignored) | `found_at_or_above` and `[preview.actions]` added |

Database migration in this change: **no**

## 3. How to run the app locally

As in `qa/handoffs/2026-10-19-phase-16-camera-page.md` §3 (`npm run db:up`, `npm run db:deploy`,
`npm run dev`). Don't run `demo:reset -- --yes` on the dev database.

Extra steps for this change:

- The "QA station" token was revoked in run 1 (S17). Create a new one as the System Admin under
  **API tokens** (or `npm run cv:token`) and put it in `cv/.env` as `CV_DEVICE_TOKEN`. Revoke it
  only at the very end, if at all.
- Make sure the camera's batch selector is on **Automatic** and a batch is in progress at
  Preparation before R3.

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/admin.spec.ts tests/e2e/cv.spec.ts
cd cv && .venv/Scripts/python -m pytest
```

## 4. Test accounts and data

The demo accounts, as in the run 1 handoff. One batch in progress at Preparation; the new device
token in `cv/.env`.

## 5. Test scenarios

| ID  | Role          | Steps                                                                                                                                                                                                                                                                                          | Expected result                                                                                                                                                                                       | Priority |
| --- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | (shell)       | From `cv/`: `.venv/Scripts/python -m cpoint_cv evaluate "C:\Users\micro\OneDrive\Pictures\Sample Photos (CAP2)" --out out/qa-eval.md`                                                                                                                                                          | "The preview matched the expected verdict on 5 of 5 photos." No warning is printed; the report's settings line includes "when found at 0.50: crease rework, cut reject, hole reject, scratch rework". | High     |
| R2  | (shell)       | Copy `cv/config.toml` to `out/qa-noactions.toml`, delete its `found_at_or_above` line and `[preview.actions]` table, and run the R1 command with `--config out/qa-noactions.toml --out out/qa-noactions.md`.                                                                                   | stderr starts "warning: [preview.actions] is empty, so the preview decides by confidence only."; the report's settings line says "no "When found" actions (by confidence only)".                      | Medium   |
| R3  | FM, QI, Admin | With the station running (`run webcam`, no key pressed, about 30 s), open `/camera` for each role and run axe. Press Space once and, within a minute, run axe again for each role. Then run `npm run cv:simulate -- --count 2 --interval 2` and, within a minute, run axe again for each role. | The badge reads **Station connected**, then **Camera station active**, then **Simulator active**; axe reports 0 WCAG 2.1 A/AA violations in each state for every role.                                | High     |
| R4  | (e2e)         | Run the Playwright command in §3.                                                                                                                                                                                                                                                              | `admin.spec.ts` passes, including the threshold snapshot test.                                                                                                                                        | High     |

## 6. Out of scope / known issues

- Run 1 saw React hydration warnings about `caret-color: transparent` on inputs. Playwright adds
  that style to hide the text cursor in screenshots, so it isn't from the app. Don't report it
  unless it shows up without screenshots.
- Delete the `out/qa-*` files afterwards (git-ignored).
