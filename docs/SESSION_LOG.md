# Session Log

Append-only, **newest on top**. One entry per Claude Code session.

Template:

```
## YYYY-MM-DD — Phase N: <short title>
**Who:** <teammate driving the session>
**Summary:** 1–3 sentences.
**Changed:** bullets by module/area.
**Gates:** lint ✅ · typecheck ✅ · test ✅ · build ✅ · e2e ✅/n/a · docker ✅/not run (why)
**Decisions:** D-0xx (if any)
**Follow-ups:** bullets
```

---

## 2026-10-02 — Phase 3: CV skeleton

**Who:** Team + Claude Code
**Summary:** Built the camera pipeline end to end: device tokens, the ingestion API, the decision
engine, image storage, automatic rework/salvage rows, and a simulator. Added overrides and the
review queue, the scan pages with bounding-box overlays, the Camera page, token admin, and the
live feed on the FM/QI homes.
**Changed:**

- DB: migration `camera_active_batch` (`cv_settings.activeBatchId`).
- Domain: `src/lib/decision-engine.ts`.
- Server:
  - lib: `device-token`, `storage`, `image-type`, `action-result`;
  - models: `api-token`, `scan`, `outcome`, `cv-settings`, plus preparation-batch helpers;
  - services: `api-token`, `camera`, `scan-ingest`, `scan-decision`, `scan-query`;
  - validators: `scan`, `token`; `controllers/scan.controller`; `requireDevice`; `camera:manage`.
- API: `POST/GET /api/v1/scans`, `/{id}`, `/{id}/image`, `/{id}/decision`, `GET /api/v1/batches/current`.
- Scripts: `npm run cv:token`, `npm run cv:simulate` (sharp-rendered leather images).
- UI:
  - pages: `/scans`, `/scans/[id]`, `/review`, `/camera`, `/admin/tokens`;
  - components: ScanImage overlay, VerdictFlow, LatestScansWidget (TanStack Query);
  - the QI home, batch scan counts, and nav (Camera, Scans, Review queue, API tokens are live).

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (193) · build ✅ · e2e ✅ (28 against
`next start`, twice; 28 against Docker, 5 of 6 runs; see below) · docker ✅ (fresh volume, 2 migrations,
simulator → images in the `uploads` volume, survive `restart app`) · audit rows checked in psql ✅
**Decisions:** D-020
**Follow-ups:**

- **Unreproduced e2e failure:** on the first run against a freshly started Docker stack, the
  deactivation test failed one `toBeVisible` assertion. It then passed 3× alone and in 5 more full
  runs. Likely cause: cold-start latency (the first server action and bcrypt on a cold container)
  exceeding Playwright's 5 s assertion timeout. Watch for it in CI; if it recurs, warm the app up in
  the CI e2e job rather than raising timeouts.
- Phase 4: rework and salvage boards and lifecycle; "usable" batch count.

## 2026-10-02 — Phase 2: Batches & stages

**Who:** Team + Claude Code
**Summary:** Built the batch module end to end:

- the stage machine, models and service, with an atomic code counter and STALE concurrency;
- the REST API;
- list, create/edit and detail pages with dialogs and toasts;
- the live "Batches by stage" card on the FM home.

Verified with 140 unit and 21 e2e tests, locally and against Docker.
**Changed:**

- Domain: `src/lib/stage-machine.ts`, `src/lib/format.ts`, batch status labels in `src/lib/domain.ts`.
- Server: `models/{batch,stage-log}`, reference-data list helpers, `services/batch.service`,
  `validators/batch.validator`, `controllers/batch.controller`, `Errors.stale`, `readJsonBody`.
- API: `/api/v1/batches`, `/[id]`, `/[id]/stages`, `/[id]/cancel` (`docs/API.md`).
- UI: Table, Badge, Select, Textarea, Dialog, Toaster (sonner); BatchStatusBadge, StageProgress,
  BatchesByStageCard; `/batches` (+ loading/error), `/batches/new`, `/batches/[id]`, `/batches/[id]/edit`.
- Nav: Batches is live.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (140) · build ✅ · e2e ✅ (21, `next start`
and Docker) · docker ✅ (fresh volume, health 200) · audit rows checked in psql ✅
**Decisions:** D-019
**Follow-ups:**

- Phase 3: decide how the camera picks "the current batch" when several are at Preparation.
- The cloud sandbox's Docker daemon stopped once mid-session. The app degraded and recovered on its
  own (health 503 → 200, no restart), which confirms the bootstrap/health design.

## 2026-10-02 — Phase 1: Data & auth

**Who:** Team + Claude Code
**Summary:** Migrated the full schema, added startup bootstrap/seeding, Auth.js sign-in with
lockout and audit, the permission matrix + guards, the role-based app shell, and role home pages.
Verified with 94 unit and 13 e2e tests, locally and against the Docker stack.
**Changed:**

- DB: `prisma/schema.prisma` + `migrations/…_init` (17 tables, 46 indexes).
- Server: `models/{db,user,audit-log,reference-data}`, `services/{audit,auth,bootstrap}`,
  `policies/{permissions,navigation,guard}`, `lib/{auth,auth.config,password,env}`,
  `controllers/auth.controller`, `instrumentation.ts`, `proxy.ts`.
- UI: login page (RHF + Zod), sidebar shell, role homes, `/forbidden`, `not-found`, primitives
  (Input, Label, Card, Alert, DropdownMenu), `src/lib/domain.ts` (enums + labels).
- Tooling: ESLint Prisma rule switched to a regex (allows the runtime-free enums file); route.ts
  files anywhere may import controllers. CI/compose pass the auth env; CI checks the bootstrap.
- Docs: README (Environment, demo accounts, sign-in rules), API.md (auth), CLAUDE.md rules,
  DESIGN.md components, D-016 to D-018.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (94) · build ✅ · e2e ✅ (13, `next start`
and Docker) · docker ✅ (fresh volume: migration applied, bootstrap seeded, health 200).
**Decisions:** D-016, D-017, D-018
**Follow-ups:**

- Confirm the shift length (session) and lockout policy with CPoint.
- Phase 2: batches & stages.

## 2026-10-02 — Phase 0: Foundation

**Who:** Team + Claude Code
**Summary:** Created `system-rebuild`, removed the Laravel app, and scaffolded Next.js 16 +
Prisma 7 + PostgreSQL 18 with the MVC layout, design tokens, Docker, tests and CI. The health
endpoint and status page work end to end, in dev and in Docker.
**Changed:**

- Removed: all Laravel/PHP code, Blade views, Composer/Vite config (the logo is kept).
- Design: `DESIGN.md`, `src/styles/tokens.css`, `globals.css`. Contrast was measured for every
  text/surface pair (lowest text pair is 4.72:1, rework on rework-soft in light mode). Input
  outlines were raised to ≥ 3:1.
- Server: `src/server/{lib,models,services,controllers}` (env, Prisma client, logger, error shape,
  health). `src/app/api/health/route.ts`.
- UI: `Button` (shadcn structure), `VerdictBadge`, `ThemeToggle`, the root layout with a
  no-flash theme script, and the temporary status home page.
- Tooling: ESLint layer rules, Prettier, husky + lint-staged, Vitest, Playwright, GitHub
  Actions (`check`, `e2e`, `docker` jobs).
- Docker: multi-stage `Dockerfile` (standalone, non-root, healthcheck, migrate-on-start),
  `docker-compose.yml` (`app` + `db`, volumes `pgdata`, `uploads`), `.dockerignore`.
- Docs: README rewritten, `docs/API.md`, CLAUDE.md commands + Next 16 agent notes, D-012 to D-015.

**Gates:** lint ✅ · format ✅ · typecheck ✅ · test ✅ (6) · build ✅ · e2e ✅ (3, local Chromium) ·
docker ✅ (`compose up --wait` → both healthy, `/api/health` 200, migrations ran, uid 1001).
GitHub Actions hasn't run yet; it runs on the first push.
**Decisions:** D-012, D-013, D-014, D-015
**Follow-ups:**

- Check the first CI run on GitHub, especially the `docker` job on a clean runner.
- Phase 1: Prisma schema, seed, Auth.js, policies, app shell.

## 2026-10-02 — Planning: confidence rule update

**Who:** Team + Claude Code
**Summary:** Replaced per-defect-type actions with one rule for all types: ≥90% REJECT,
60–89% REWORK, below 60% PASS (assumption).
**Changed:** `docs/prompts/system-rebuild.md` (decision engine, overrides, data model, tests),
`docs/DECISIONS.md` (D-011 supersedes D-006), `docs/STATUS.md`, `docs/ROADMAP.md`, `docs/AGENTIC_WORKFLOW.md`.
**Gates:** n/a (docs only)
**Decisions:** D-011
**Follow-ups:** Confirm the 90% / 60% thresholds and the below-60% PASS assumption with CPoint.

## 2026-10-02 — Planning: rebuild prompt and project docs

**Who:** Team + Claude Code
**Summary:** Agreed the rebuild scope and defaults. Wrote the master prompt, living docs, and
agentic workflow setup. No application code changed.
**Changed:** `docs/prompts/system-rebuild.md`, `CLAUDE.md`, `docs/STATUS.md`, `docs/ROADMAP.md`,
`docs/DECISIONS.md`, `docs/SESSION_LOG.md`, `docs/AGENTIC_WORKFLOW.md`, `docs/client-survey.md`,
`.claude/skills/{ui-craft,resume,wrap-up}`.
**Gates:** n/a (docs only)
**Decisions:** D-001 – D-010
**Follow-ups:** Run Phase 0. Confirm D-006 defect default actions with CPoint (superseded by D-011).
