# QA handoff: Phase 14, camera YOLO model intake and the inference core

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Date            | 2026-10-19                                                               |
| Feature         | phase-14-cv-core                                                         |
| Branch          | `main` (uncommitted, on top of `63138dc`)                                |
| Spec / prompt   | `camera-yolo-integration.md` Phase 14, `docs/ROADMAP.md` Phase 14        |
| Written by      | Claude                                                                   |
| Previous report | `qa/reports/2026-10-19-phase-14-cv-core-run2.md` (FAIL: S6 handoff step) |

## 1. What changed

- Nobody sees a difference in the app. No page, API route, migration or seed changed.
- A new Python package, `cv/cpoint_cv` (the camera station's core), runs the YOLO model
  `cv/models/yolo-v1.pt` on photos. `python -m cpoint_cv predict <folder>` prints each detection,
  the model version `yolo-v1-1d729fb0`, the time per image and a **preview** of the verdict the app
  would give. It posts nothing to the app.
- One shared contract fixture, `tests/fixtures/cv-payload.json`, is checked by pytest (the
  station writes it) and by Vitest (the app's `ingestFieldsSchema` accepts it).
- Model files, the station's local config and its outputs are ignored by git and Docker. ESLint
  skips `cv/`. CI has a new `station` job (ruff, mypy, pytest, no torch).

## 2. Files touched

| File                                        | Change                                                       |
| ------------------------------------------- | ------------------------------------------------------------ |
| `cv/cpoint_cv/*.py`                         | New package: detector, mapper, payload, preview, config, CLI |
| `cv/tests/*.py`                             | New: 56 pytest tests                                         |
| `cv/pyproject.toml`, `cv/requirements*.txt` | New: tool settings and pinned dependencies                   |
| `cv/config.example.toml`                    | New: every station setting, commented                        |
| `cv/README.md`, `cv/MODEL_CARD.md`          | New: setup and the model card                                |
| `cv/models/.gitkeep`                        | New: model folder (the `.pt` is ignored)                     |
| `tests/fixtures/cv-payload.json`            | New: shared contract fixture                                 |
| `tests/unit/cv-contract.test.ts`            | New: Vitest contract test                                    |
| `.gitignore`, `.dockerignore`               | Ignore model files, `cv/config.toml`, `cv/out/`, caches      |
| `eslint.config.mjs`                         | Ignore `cv/**`                                               |
| `.github/workflows/ci.yml`                  | New `station` job                                            |
| `README.md`, `docs/*.md`                    | Docs (D-048, D-049, ROADMAP, STATUS, SESSION_LOG)            |

Database migration in this change: **no**

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # apply migrations
npm run dev            # app on http://localhost:3000 (use PORT=3001 if 3000 is taken)
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change (the camera station, Windows, from the repo root):

- The station venv already exists at `cv/.venv` on Dylan's laptop, with torch 2.6.0+cu124 and
  ultralytics 8.4.103. If it's missing, follow "Set up" in `cv/README.md`.
- The model must be at `cv/models/yolo-v1.pt`. Dylan's `cv/config.toml` sets `device = "cuda:0"`.
- Sample images: copy three scan images from `storage/uploads/scans/2026/10/` into a new folder
  `cv/out/qa/` (simulator images; any JPEGs will do). Don't commit them.

Existing automated tests that cover this area (run these too):

```bash
npm run test
cd cv && .venv/Scripts/python -m pytest && .venv/Scripts/ruff check . && .venv/Scripts/ruff format --check . && .venv/Scripts/mypy
npm run build && npx playwright test tests/e2e/cv.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`. Only needed for the e2e
regression (S8); the station scenarios don't sign in.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs: none beyond the sample images in `cv/out/qa/`.

## 5. Test scenarios

Run each command from `cv/` unless it says otherwise. "Exit code" is the process exit code.

| ID  | Role | Steps                                                                                                                                                                                                                                  | Expected result                                                                                                                                                                                                                 | Priority |
| --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | none | `.venv/Scripts/python -m cpoint_cv predict out/qa`                                                                                                                                                                                     | Header names `Model yolo-v1-1d729fb0 (segment)` and classes `crease, cut, hole, scratch`; one line per image with ms and `preview <VERDICT>`; a summary with `preview: PASS n, REWORK n, REJECT n, NEEDS_REVIEW n`; exit code 0 | High     |
| S2  | none | `.venv/Scripts/python -m cpoint_cv predict out/qa --save-overlay out/qa-overlay --summary-md out/qa-summary.md`                                                                                                                        | `out/qa-overlay/` has one `<name>.overlay.jpg` per image with the caption `yolo-v1-1d729fb0  preview …`; `out/qa-summary.md` has the "Detections per class" and "Preview verdicts" tables                                       | High     |
| S3  | none | `.venv/Scripts/python -m cpoint_cv predict out/qa --json`                                                                                                                                                                              | One JSON line per image with `image`, `modelVersion`, `inferenceMs`, `detections` (each box's `x + width` ≤ 1.0001) and `previewVerdict`                                                                                        | Medium   |
| S4  | none | `set CPOINT_CV_MODEL_DEVICE=cpu` (PowerShell: `$env:CPOINT_CV_MODEL_DEVICE="cpu"`), then S1                                                                                                                                            | The settings line says `device cpu`; same detections as S1 (confidences may differ in the 3rd–4th decimal); slower per image                                                                                                    | Medium   |
| S5  | none | Negative: `set CPOINT_CV_MODEL_PATH=models/missing.pt`, then S1                                                                                                                                                                        | `error: the model file …missing.pt wasn't found. Check [model] path in …config.toml: a relative path is read from that file's folder (…).`; exit code 2; nothing else printed                                                   | High     |
| S6  | none | Negative: copy `config.toml` to `out/bad.toml`; in the copy set `path = "../models/yolo-v1.pt"` (a relative path is read from the config file's own folder) and change `sha256` to 64 `0`s; run `predict out/qa --config out/bad.toml` | A `warning:` naming `expected 0000…` and `found 1d729fb0…`; predictions still print; exit code 0                                                                                                                                | Medium   |
| S7  | none | Negative: in `out/bad.toml` set `confidence_floor = 1.5`; run as S6                                                                                                                                                                    | `error: [mapper] confidence_floor must be from 0.0 to 1.0; got 1.5.`; exit code 2                                                                                                                                               | Medium   |
| S8  | none | From the repo root: `npm run build && npx playwright test tests/e2e/cv.spec.ts`                                                                                                                                                        | All tests pass (the simulator path and token revocation are unchanged)                                                                                                                                                          | High     |
| S9  | none | From the repo root: `npx vitest run tests/unit/cv-contract.test.ts`                                                                                                                                                                    | 2 passed                                                                                                                                                                                                                        | High     |
| S10 | none | From the repo root: `git status --short -uall cv` and `git check-ignore -v cv/models/yolo-v1.pt cv/config.toml cv/out`                                                                                                                 | The `.pt`, `config.toml`, `out/` and `.venv` never appear as untracked; `check-ignore` names a `.gitignore` rule for each                                                                                                       | High     |

### Access checks

| ID  | Role that must NOT have access | URL or action                                      | Expected                        |
| --- | ------------------------------ | -------------------------------------------------- | ------------------------------- |
| A1  | n/a                            | No page, route or permission changed in this phase | Nothing to check; covered by S8 |

## 6. Out of scope / known issues

- The station doesn't send scans yet (Phase 15), so nothing appears on the Camera page.
- Simulator images aren't real leather: the verdicts in S1 say nothing about the model's
  accuracy. The baseline on real photos is pending.
- `crease` and `scratch` are unknown to the app until Phase 15's data step, so a preview of
  `NEEDS_REVIEW` for them is expected.
- The first `predict` run takes 10–20 s to load the model and warm it up; that isn't a fault.
