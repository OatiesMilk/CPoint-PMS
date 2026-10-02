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
