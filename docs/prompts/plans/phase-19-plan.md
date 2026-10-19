# Phase 19 plan: project cleanup and optimization

> Plan only. Nothing has been changed, moved or deleted yet. Waiting for Dylan's approval
> (prompt: `project-cleanup.md`). Measured 2026-10-19 on Dylan's laptop.

## 1. Setup results

- **QA:** the newest reports in `qa/reports/` are Phase 16 run 1 and run 2 (no app fault left).
  **There is no Phase 17 or Phase 18 report yet**; Codex hasn't run those handoffs. Nothing to
  fix first.
- **Git:** `main` @ `95d80a8` (Phase 17 merged). **Phase 18 is still uncommitted** on `main`: 33
  modified files and about 25 new ones. This phase would touch some of the same files
  (`docs/STATUS.md`, `docs/ROADMAP.md`, `docs/SESSION_LOG.md`, `README.md`, `package.json`,
  `.github/workflows/ci.yml`), so the two changes would mix in one diff. See question Q1.

## 2. Size, before (measured now) and expected after

| What                        | Now                                | Files  | In Git? | Expected after                                            |
| --------------------------- | ---------------------------------- | ------ | ------- | --------------------------------------------------------- |
| **Whole folder**            | **8.49 GB**                        | 89,533 |         | 0 in OneDrive if moved (Q2); about 6.4 GB on `C:\dev`     |
| `cv/.venv`                  | 5.17 GB                            | 30,375 | no      | same with CUDA torch (Q3); about 1–1.5 GB with CPU torch* |
| of which `torch` (cu124)    | 4.46 GB                            | 12,694 | no      |                                                           |
| `.next`                     | 2.18 GB                            | 6,741  | no      | 0 after `npm run clean`, about 450 MB after one build     |
| of which `.next/dev`        | 1.72 GB                            | 2,276  | no      | regrows while `npm run dev` runs; clean it now and then   |
| `node_modules`              | 1.15 GB                            | 50,326 | no      | same (nothing worth removing, see item 7)                 |
| of which `onnxruntime-node` | 287 MB                             | 43     | no      | same (npm can't skip other platforms' binaries)           |
| `cv/models`                 | 63 MB                              | 4      | no      | same (D-049)                                              |
| `qa/reports/artifacts`      | 54 MB                              | 897    | no      | about 22 MB if the Phase 12–13 screenshots go (Q6)        |
| `.git`                      | 23 MB                              | 453    |         | same                                                      |
| `tsconfig.tsbuildinfo`      | 318 KB                             | 1      | no      | 0 (removed by `clean`, rebuilt by `tsc`)                  |
| source, docs, tests         | about 12 MB                        |        | yes     | same                                                      |
| **Docker (outside folder)** | 9.3 GB images, 13.0 GB build cache |        |         | build cache 0 (Q4); images depend on Q4                   |

\* The CPU figure is an estimate; I'd measure it in a throwaway venv before you decide, if you
pick that option.

**Where the space goes:** about 99% is installed tools and build caches, all git-ignored and all
re-creatable. A clone is about 35 MB. The real cost is OneDrive syncing ~87,000 generated files.

**Docker detail:** the 8.45 GB of unused images are **not this project's**: they are 12 Supabase
images (studio, postgres 17, storage-api, edge-runtime, logflare and more) plus `postgres:15-alpine`
used by the running `mg_portal_db` container. This project only has `postgres:18-alpine` (433 MB)
in use; there's no `cpoint-pms:latest` app image right now. Volumes: `cpoint-pms_pgdata` (this
database) and `supply-chain_postgres_data` (another project). Neither is touched.

## 3. Scope items

### A. Disk and workspace (your machine only; nothing here changes the app)

**1. OneDrive: move the repo to `C:\dev\CPoint-PMS`** (recommended). OneDrive can't exclude a
folder by name inside a synced folder (only "Choose folders" at the top level, or file types by
policy), so excluding `node_modules`, `.next` and `.venv` in place isn't reliable. Moving is the
clean fix. Steps for you, in order, with nothing running:

1. Stop the dev server and the station window. `docker compose stop` (never `down -v`).
2. Copy the folder to `C:\dev\CPoint-PMS` **without** `cv/.venv`, `node_modules` and `.next`
   (I'll put the exact `robocopy` line in the README), check `git status` there matches, then
   delete the OneDrive copy yourself.
3. In the new folder: `npm ci`, then re-create the venv (`cv/README.md`, "Set up"); a venv
   can't be moved because its scripts hold the old path.
4. `python -m cpoint_cv shortcut` again: the **CPoint Camera** desktop shortcut points at the old
   path.
5. `docker compose up -d db`. The project name is fixed (`name: cpoint-pms`), so it reuses the
   same `cpoint-pms_pgdata` volume and your data. The `./cv/models` and `./certs` mounts are
   relative, so they follow the folder.
6. **Claude Code:** project memory is stored per folder path
   (`~/.claude/projects/C--Users-micro-OneDrive-Desktop-CPoint-PMS/memory/`). Copy that `memory`
   folder to `~/.claude/projects/C--dev-CPoint-PMS/memory/` so the new folder keeps it. This
   Remote Control folder is also approved for this project by path, so the new folder needs
   approving once when you start a thread there.
7. `certs/` and `.env`, `cv/config.toml`, `cv/station-window.json` move with the copy (they're
   git-ignored, so don't re-clone instead of copying).

**2. `cv/.venv`: keep the CUDA torch, re-create it in the new folder** (recommended). D-048
measured 255 ms per image on the RTX 3060 against 780 ms on the CPU, and this laptop is the camera
station. The Capture page doesn't need torch at all (D-064); only the station, `predict`,
`evaluate` and `export-onnx` do. Once the folder is off OneDrive the 5.2 GB no longer syncs, which
is the real cost. Nothing is deleted without your word (destructive step D1).

**3. `npm run clean`** (repository). Adds one script, no new dependency:
`node -e "for (const p of ['.next','tsconfig.tsbuildinfo']) require('fs').rmSync(p,{recursive:true,force:true})"`.
Run it when `.next` grows past a gigabyte or a build acts stale; `npm run dev` and `npm run build`
re-create everything. Running it on your folder now is destructive step D2 (re-creatable).

**4. Docker** (your machine; run nothing myself without your word):

- `docker builder prune -f` removes only the **build cache** (13.0 GB). Safe; the next
  `docker compose up --build` is slower once. Step D3.
- `docker image prune -a -f` removes **every image no container uses**: here, the 12 Supabase
  images (about 8.4 GB). Only if that other project is finished, since you'd have to pull them
  again. Step D4. `postgres:15-alpine` and `postgres:18-alpine` stay because containers use them.
- Never `docker volume prune` or `docker compose down -v`: they delete this database (and the
  supply-chain one).

**5. `node_modules`:** nothing to remove (item 7). `onnxruntime-node` carries Windows, macOS and
Linux binaries (287 MB); npm has no way to skip them, and the Docker image already leaves the
other platforms out (`next.config.ts`). I'll say so in the README instead of hacking the install.

### B. Repository tidiness

**6. Move the prompts and plans out of the root** (repository; prefer moving over deleting):

| File                                | Tracked? | Goes to                                        |
| ----------------------------------- | -------- | ---------------------------------------------- |
| `material-requests.md`              | yes      | `docs/prompts/material-requests.md` (`git mv`) |
| `camera-yolo-integration.md`        | yes      | `docs/prompts/camera-yolo-integration.md`      |
| `camera-station-window.md`          | yes      | `docs/prompts/camera-station-window.md`        |
| `camera-capture-page.md`            | no       | `docs/prompts/camera-capture-page.md`          |
| `project-cleanup.md`                | no       | `docs/prompts/project-cleanup.md` (at the end) |
| `phase-16/17/18-plan.md`, this plan | no       | `docs/prompts/plans/` (Q5)                     |

References I'd update: `CLAUDE.md` (adds a line that prompts live in `docs/prompts/`),
`docs/STATUS.md`, `docs/ROADMAP.md` (9 mentions), `qa/README.md` and `qa/templates/handoff.md`
(the example path), `cv/MODEL_CARD.md` (one line), and `docs/prompts/system-rebuild.md` if it
names them. `docs/SESSION_LOG.md`, `docs/DECISIONS.md` and the dated QA handoffs and reports keep
their wording as history. `git mv` keeps the history of the tracked three.

**7. Dead code and unused dependencies** (knip 5, run once through `npx`, not added):

- _Unused files:_ `docker/https.mjs`. **False positive**: the Dockerfile copies it and the
  entrypoint runs it (D-065). Keep.
- _Unused dependency:_ `@prisma/client`. **False positive**: the generated client in
  `src/generated/prisma` needs its runtime. Keep.
- _Unlisted:_ `postcss` in `postcss.config.mjs`. It comes with `@tailwindcss/postcss`, as in the
  Next.js template. Keep.
- _33 unused exports and 48 unused exported types_ (page sizes, constants, `buttonVariants`,
  `DialogTrigger`, `countAllBatches`, `ensureReferenceData`, …). These are constants and types a
  file exports for its own module or the shadcn pattern; removing the `export` word saves nothing
  in size and adds churn. **Recommend leaving them**, and I'll list them in the session log. The
  one real candidate is `countAllBatches` in `batch.model.ts` if nothing calls it, which I'd check
  and remove only if the gates stay green.
- So no dependency is removed.

**8. Leftovers:**

- `.agents/` (3 old copies of the skills, git-ignored; the curated ones are in `.claude/skills`):
  safe to remove (D5).
- `tsconfig.tsbuildinfo`: removed by `npm run clean`.
- `test-results/.last-run.json`: Playwright's, safe (D5).
- `storage/uploads/scans/` (6 images, 1.5 MB): **not safe** to delete by hand; they belong to
  scan rows in the database. `npm run demo:reset -- --yes` removes them properly. Keep.
- `cv/out/` (5.2 MB: baseline overlays, smoke tests, a station log, QA photos): the station's own
  outputs, git-ignored. Safe except `cv/out/spool/` and `failed/`, which don't exist now. I'd leave
  it; it's small (D6 if you want it gone).
- `qa/reports/artifacts/` (54 MB): Codex's screenshots. Phases 12, 13 and the 2026-10-14
  follow-ups (about 32 MB) are long passed (Q6).
- The README section will tell a teammate: `npm run clean`, keep the folder off OneDrive or
  Dropbox, and which folders are safe to delete.

### C. Optimization (no behaviour change)

**9. Docker image (854 MB per STATUS; no image exists right now).** I'd build it first to
measure (`docker compose build app`, not destructive), then look at: what the standalone bundle
carries (`@img`/sharp variants, the ONNX Linux x64 build only), the migrator stage's Prisma CLI,
and duplicate `node_modules` between `standalone` and `migrate`. Only clear, safe wins, built and
measured again; the stack is checked by `docker compose up` and `/api/health`.

**10. App bundle.** Run `npm run build` and check which client chunks carry Recharts and
lucide on pages that don't chart anything. Fix only a clear win (for example a chart imported by a
page that doesn't show it).

**11. CI time.** `npm ci` is cached by `setup-node`, and `ONNXRUNTIME_NODE_INSTALL=skip` already
stops the CUDA download. The one clear win: the e2e job runs `npx playwright install --with-deps
chromium` from scratch on every run; caching `~/.cache/ms-playwright` by the Playwright version
saves the browser download. The station job installs only the dev tools (no torch). Nothing else
installs more than it needs.

## 4. Destructive steps, each for your approval

| #   | Step                                                          | Where        | Undo                                |
| --- | ------------------------------------------------------------- | ------------ | ----------------------------------- |
| D1  | Delete `cv/.venv` (only after the move, in the old folder)    | your machine | re-create it (`cv/README.md`)       |
| D2  | Run `npm run clean` (deletes `.next`, `tsconfig.tsbuildinfo`) | your machine | `npm run build` / `npm run dev`     |
| D3  | `docker builder prune -f` (13.0 GB build cache)               | your machine | the next build re-creates it        |
| D4  | `docker image prune -a -f` (12 Supabase images, ~8.4 GB)      | your machine | `docker pull` again in that project |
| D5  | Delete `.agents/` and `test-results/`                         | your machine | none needed (leftovers)             |
| D6  | Delete `cv/out/` (except any `spool/` or `failed/`)           | your machine | none (old outputs)                  |
| D7  | Delete the Phase 12–13 and 10-14 follow-up QA screenshots     | your machine | none (the reports stay)             |
| D8  | Delete the OneDrive copy after the move (you do this)         | your machine | OneDrive recycle bin                |

The repository changes (moves, `clean` script, README section, CI cache, any Docker or bundle
fix) aren't destructive: they're in the working tree for you to review and commit.

## 5. Questions (one batch, recommendation first)

- **Q1. Phase 18 is uncommitted.** (a) **You commit Phase 18 first, then I start** (recommended,
  keeps the two diffs apart); (b) I work on top and both go in one commit.
- **Q2. OneDrive.** (a) **Move to `C:\dev\CPoint-PMS`** (recommended; you do the copy, I write the
  steps); (b) keep it in OneDrive and live with the sync.
- **Q3. The venv.** (a) **Keep CUDA torch**, re-create it in the new folder (recommended);
  (b) switch to CPU torch (I measure first; the station gets about 3× slower).
- **Q4. Docker.** (a) **D3 only, the build cache** (recommended); (b) D3 and D4, if the Supabase
  project is finished.
- **Q5. Old plans.** (a) **Move `phase-16/17/18-plan.md` to `docs/prompts/plans/`** (recommended);
  (b) delete `phase-16-plan.md` and `phase-17-plan.md` as STATUS suggests.
- **Q6. Old QA screenshots (D7).** (a) **Keep them** (recommended; git-ignored, 32 MB, Codex's
  evidence); (b) delete them.

## 6. After approval

Small steps, each left green: moves and references, `clean` script, README "Keeping the folder
small", CI cache, then the Docker and bundle measurements and any fix. Gates: lint, typecheck,
unit tests, build (and a Docker build if the Dockerfile changes; ruff, mypy and pytest only if
`cv/` changes). E2E: not run (Codex). Then docs (`STATUS`, `SESSION_LOG`, `ROADMAP` Phase 19,
`DECISIONS` if a rule is new) and `qa/handoffs/2026-10-19-phase-19-cleanup.md`. No git.
