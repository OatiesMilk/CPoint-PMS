# QA handoff: Phase 19 project cleanup

| Field           | Value                                                                         |
| --------------- | ----------------------------------------------------------------------------- |
| Date            | 2026-10-20                                                                    |
| Feature         | phase-19-cleanup                                                              |
| Branch          | `main` checkout at `c29c871`, uncommitted                                     |
| Spec / prompt   | `docs/prompts/project-cleanup.md`, `docs/ROADMAP.md` Phase 19                 |
| Written by      | Claude                                                                        |
| Previous report | `qa/reports/2026-10-19-phase-16-camera-page-run2.md` (no 17 or 18 report yet) |

## 1. What changed

Nothing a user sees should change. This phase tidied the repository and trimmed the Docker image:

- Prompt and plan files moved from the repo root to `docs/prompts/` and `docs/prompts/plans/`.
- A new `npm run clean` script deletes `.next` and `tsconfig.tsbuildinfo`.
- The README has a "Keeping the folder small" section and says to clone outside OneDrive.
- The Docker image leaves out sharp's Alpine (musl) build: 854 → 826 MB. sharp (images) and ONNX
  Runtime (the Capture page's model) must still work in Docker.
- CI caches Playwright's Chromium download.

The point of this run is to confirm **nothing broke**.

## 2. Files touched

| File                                                                            | Change                                             |
| ------------------------------------------------------------------------------- | -------------------------------------------------- |
| `docs/prompts/*.md` (4 briefs + `project-cleanup.md`)                           | moved from the root; "How to use" line updated     |
| `docs/prompts/plans/phase-16..19-plan.md`                                       | moved from the root (new to git)                   |
| `Dockerfile`                                                                    | build stage removes `@img/*linuxmusl*` after build |
| `package.json`                                                                  | `clean` script                                     |
| `.github/workflows/ci.yml`                                                      | e2e job caches `~/.cache/ms-playwright`            |
| `README.md`, `CLAUDE.md`, `cv/MODEL_CARD.md`, `qa/templates/handoff.md`         | new paths, "Keeping the folder small"              |
| `docs/STATUS.md`, `docs/ROADMAP.md`, `docs/SESSION_LOG.md`, `docs/DECISIONS.md` | Phase 19, D-068                                    |

Database migration in this change: **no**

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm ci` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up
npm run db:deploy
npm run dev
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change:

- For S3 to S5, the Docker stack: `docker compose up --build -d`, then `http://localhost:3000`.
  The model files `cv/models/yolo-v1.onnx` and `yolo-v1.json` must exist (README, "Capture from
  the website"). Stop it with `docker compose stop` (never `down -v`: it deletes the database).

Existing automated tests that cover this area (run these too):

```bash
npm run build && npm run test:e2e
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs:

- A batch at Preparation for S4 (Floor Manager: Batches → New batch → Start production).

## 5. Test scenarios

| ID  | Role | Steps                                                                                         | Expected result                                                                                    | Priority |
| --- | ---- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| S1  | any  | Run the full e2e suite (`npm run build && npm run test:e2e`) on the dev server                | Same pass count as before Phase 19; no new failure                                                 | High     |
| S2  | none | Run `npm run clean`, then `npm run build`                                                     | `.next` and `tsconfig.tsbuildinfo` are gone after `clean`; the build then succeeds                 | Medium   |
| S3  | none | `docker compose up --build -d`; open `/api/health`                                            | `{"status":"ok", … "database":"up"}`; `docker images cpoint-pms` shows about 826 MB                | High     |
| S4  | QI   | In the Docker stack: Quality → Capture, allow the camera, press Capture                       | Last scan shows a verdict and section; the scan opens with its image (ONNX Runtime runs in Docker) | High     |
| S5  | FM   | In the Docker stack: open a scan's page and Procurement → a received request's proof photo    | Both images load (sharp and the image routes still work)                                           | Medium   |
| S6  | none | Open `README.md`, `CLAUDE.md`, `docs/ROADMAP.md`; follow each link or path to a brief or plan | Every named file exists under `docs/prompts/` or `docs/prompts/plans/`; none left in the root      | Low      |

### Access checks

| ID  | Role that must NOT have access | URL or action     | Expected                   |
| --- | ------------------------------ | ----------------- | -------------------------- |
| A1  | Shoe Constructor               | `/camera/capture` | Forbidden page (unchanged) |
| A2  | System Admin                   | `/camera/capture` | Forbidden page (unchanged) |

## 6. Out of scope / known issues

- Moving the folder off OneDrive is Dylan's own step; nothing to test in the app.
- The CI Playwright cache only shows on GitHub (a "Cache restored" line on the second run).
- ONNX Runtime's telemetry warning at start in Docker is known (Phase 18).
- knip's unused-export list is intentionally left (SESSION_LOG, Phase 19).
