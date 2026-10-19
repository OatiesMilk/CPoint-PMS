# Prompt: Phase 19 — Project cleanup and optimization

> **How to use this file.** It holds **one phase** for one Claude Code session (CLAUDE.md: one
> phase per session). Open Claude Code at the repo root, switch to **plan mode**, and say:
> _"Read `docs/prompts/project-cleanup.md` and run Phase 19. Stop for my approval before
> changing anything."_ If the session ends mid-phase, say _"Resume the cleanup"_.

---

<role>
You are the senior engineer who built Phases 0–18. The system works and the panel demo is close,
so this phase changes **no behaviour**: it makes the project folder small, tidy and quick to set
up, and trims what the app and its Docker image carry, without breaking a single test or flow.

Dylan asked (2026-10-19) for "a general cleanup of the project or optimization" after seeing the
folder at **8.48 GB, 89,524 files, 8,965 folders** in Windows' Properties (it lives in OneDrive).
</role>

<session_setup>
Do these **in order, before planning**. They are the project's standing rules.

1. **Read first.** `CLAUDE.md`, `AGENTS.md`, `docs/STATUS.md`, this file, `README.md` (both quick
   starts and "Capture from the website"), `cv/README.md` ("Set up"), `.gitignore`,
   `.dockerignore`, `Dockerfile`, `docker-compose.yml`, `package.json`, `next.config.ts`,
   `.github/workflows/ci.yml`.
2. **Check QA.** List `qa/reports/` and read the newest report. If Phase 17's or Phase 18's report
   has failures, fix them first and say so in the plan.
3. **Plan first.** Measure, then present the plan (format in `<workflow>`), then **stop and wait
   for Dylan's approval**. Change nothing before that.
4. **Resume, don't restart.** Work out where things stand from `docs/STATUS.md`, `git status`
   and recent changes. Phase 18 should be committed or merged; if not, say so and ask.
5. **No browser or e2e tests.** Run only lint, typecheck, unit tests and build (and the
   station's ruff, mypy and pytest if `cv/` changes). E2E specs you touch are "not run (Codex)".
6. **Git.** Never create branches, commits, pushes or PRs without Dylan's explicit permission.
7. **QA handoff.** Write `qa/handoffs/YYYY-MM-DD-phase-19-cleanup.md` from
   `qa/templates/handoff.md` so Codex can confirm nothing broke.
   </session_setup>

<context>
**Measured on 2026-10-19 (Dylan's laptop, after Phase 18):**

| What                | Size   | In Git? | What it is                                                                      |
| ------------------- | ------ | ------- | ------------------------------------------------------------------------------- |
| `cv/.venv`          | 5.2 GB | no      | The camera station's Python. **torch alone is 4.4 GB** (the CUDA build)         |
| `.next`             | 2.2 GB | no      | Next.js build output; `.next/dev` (1.7 GB) is the dev server's cache            |
| `node_modules`      | 1.3 GB | no      | npm packages; `onnxruntime-node` is 288 MB (binaries for every platform)        |
| `cv/models`         | 63 MB  | no      | `yolo-v1.pt`, `.onnx`, `.json` (D-049)                                          |
| `qa/`               | 57 MB  | partly  | handoffs and reports, plus git-ignored screenshots in `qa/reports/artifacts`    |
| `.git`              | 25 MB  | —       | history                                                                         |
| source, docs, tests | ~12 MB | yes     | `src`, `docs`, `tests`, `prisma`, `scripts`, `cv/cpoint_cv` (536 tracked files) |

So **about 99% of the folder is installed tools and build caches**, all git-ignored and all
re-creatable. A collaborator who clones the repo gets about 25 MB. Outside the folder, Docker
Desktop holds **8.5 GB of unused images and 13 GB of build cache** (`docker system df`).

The real pain is likely **OneDrive syncing ~89,000 generated files** (`.venv`, `node_modules`,
`.next`): slow `npm ci`, slow builds, slow folder scans, and cloud storage used for nothing.

**Also untidy (tracked or untracked in the root):** finished prompt and plan files
(`camera-yolo-integration.md`, `camera-station-window.md`, `camera-capture-page.md`,
`material-requests.md`, `phase-16-plan.md`, `phase-17-plan.md`, `phase-18-plan.md`) sit beside
`README.md`; `docs/prompts/` already exists for prompts. `tsconfig.tsbuildinfo` and `.agents/`
are git-ignored leftovers.
</context>

<scope>
Each item needs a line in the plan: do it, skip it, or ask Dylan. **Measure before and after.**

**A. Disk and workspace (Dylan's machine; nothing here changes the app)**

1. **OneDrive.** Recommend the best fix and its steps, e.g. moving the repo to a folder OneDrive
   doesn't sync (`C:\dev\CPoint-PMS`), or keeping it and excluding the heavy folders. Say what
   moving means for Claude Code's project folder and memory, Docker bind mounts
   (`cv/models`, `certs`), the `CPoint Camera` desktop shortcut (Phase 17) and `cv/.venv`'s paths
   (a venv can't be moved; it's re-created).
2. **`cv/.venv` (5.2 GB).** Options: keep the CUDA torch (fast station, D-048), switch to the CPU
   build (measure how much it saves), or put the venv outside the repo. The website's
   Capture page no longer needs torch at all (D-064); only the station, `predict`, `evaluate` and
   `export-onnx` do. Recommend one; never delete it without Dylan's word.
3. **`.next` (2.2 GB).** A `npm run clean` script (removes `.next` and `tsconfig.tsbuildinfo`,
   cross-platform, no new dependency), and when to run it.
4. **Docker (21 GB outside the folder).** The exact `docker image prune` / `docker builder prune`
   commands and what each removes; never `docker volume prune` (the database lives in `pgdata`).
   Run nothing destructive yourself without Dylan's word.
5. **`node_modules`.** Whether anything can go (unused dependencies, below). `onnxruntime-node`'s
   other-platform binaries can't be skipped by npm; say so rather than hacking the install.

**B. Repository tidiness (tracked files)**

6. Move finished prompts and plans from the root into `docs/prompts/` (and `docs/prompts/plans/`),
   and update every reference (`CLAUDE.md`, `docs/STATUS.md`, `docs/ROADMAP.md`,
   `docs/SESSION_LOG.md` keeps its history as is). Ask before deleting any.
7. Find dead code and unused dependencies with a tool run once through `npx` (e.g. `knip`), not
   added to the project. List each finding; remove only what is clearly unused and covered by the
   gates. Watch for things only used by scripts, e2e tests, Docker or dynamic imports
   (`onnxruntime-node`, `sharp`).
8. Leftovers: `.agents/`, `tsconfig.tsbuildinfo`, `storage/` test files, `cv/out/` logs, old
   `qa/reports/artifacts`. Say which are safe to remove and how the docs tell a teammate to clean.

**C. Optimization (behaviour stays the same)**

9. **Docker image (854 MB).** Look for safe wins: what the standalone bundle carries, the
   migrator stage, `@img` / sharp variants, the ONNX binaries. Measure the image before and after.
10. **App bundle.** Check the build's route sizes for anything heavy shipped to the browser
    (e.g. Recharts or lucide imports on pages that don't need them). Only fix clear wins.
11. **CI time.** `npm ci` now downloads `onnxruntime-node` (with `ONNXRUNTIME_NODE_INSTALL=skip`);
    check the cache setup and whether any job installs more than it needs.

**Out of scope:** new features, UI changes, schema changes, changing a settled decision without a
new DECISIONS entry, and anything that changes a verdict, a permission or a flow.
</scope>

<workflow>
**Step 1: Plan (plan mode; stop for approval).**

- Setup results (QA, git state).
- A size table before (measure it again; don't trust the numbers above) and the expected after.
- Each scope item: the recommendation, the exact commands or files, and whether it's on Dylan's
  machine only or in the repository.
- Every destructive step (deleting a venv, pruning Docker, removing files) listed separately for
  Dylan to approve one by one.
- Questions in one batch, each with a recommended option.

**Step 2: Do it** in small steps, each left green. Prefer moving and documenting over deleting.

**Step 3: Gates** (paste the real output summaries): lint, typecheck, unit tests, build; the
station's ruff, mypy and pytest if `cv/` changed; a Docker image build if the Dockerfile changed.
E2E: not run (Codex).

**Step 4: Docs** (`/wrap-up`, without its git step): README (a short "Keeping the folder small"
section for teammates), `docs/STATUS.md`, `docs/SESSION_LOG.md`, `docs/ROADMAP.md` (Phase 19 with
ticked criteria), `docs/DECISIONS.md` for any new rule, the QA handoff.

**Step 5: Report.** The before/after size table, what changed, what Dylan still has to run on his
machine, and that the changes are ready to commit. Then stop.
</workflow>

<acceptance>
- The folder's size and file count are measured before and after, and the report says where the
  space went.
- Every gate passes, and no flow, verdict, permission or API contract changes.
- Prompts and plans no longer clutter the root; every reference to a moved file still works.
- The README tells a teammate how to keep their copy small and how to clean it.
- Nothing is deleted from Dylan's machine, Docker or the repository without his explicit word.
</acceptance>

<constraints>
- The CLAUDE.md non-negotiables all apply (MVC layering, guards, `runInTransaction` +
  `recordAudit`, two containers, tokens only).
- Never commit model files, photos, certificates or keys, `.env` files or `cv/config.toml`.
- Never run browser or e2e tests, and never branch, commit, push or open a PR without Dylan's
  explicit permission.
- Never run `docker volume prune` or `docker compose down -v`: they delete the database.
  </constraints>
