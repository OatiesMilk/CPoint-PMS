# CLAUDE.md — CPoint Product Monitoring System

Capstone project (BS-IT) for CPoint Shoe Store Corporation: a Product Monitoring System for a
leather-shoe production line (Preparation → Upper Making → Sole-ing → Finishing) with one
computer-vision checkpoint at Preparation, before cutting.

**The project is mid-rebuild** from Laravel/MySQL to Next.js/PostgreSQL/Docker on the
`system-rebuild` branch. Phase 0 (foundation) is done: the Laravel code is gone, and `main` still
holds it for reference.

Next.js 16 and Prisma 7 have breaking changes from older versions. Read the bundled docs before
writing framework code:
@AGENTS.md
Prisma 7 specifics: the client is generated to `src/generated/prisma` (import from
`@/generated/prisma/client`), it needs the `@prisma/adapter-pg` driver adapter, and the CLI is
configured in `prisma.config.ts`, which doesn't auto-load `.env`.

## Read at the start of every session

- Current state (auto-loaded below): @docs/STATUS.md
- Master spec: `docs/prompts/system-rebuild.md`. Read it before any feature work.
- Settled decisions: `docs/DECISIONS.md`. Don't re-litigate them; add a new entry to change one.
- Phases + acceptance criteria: `docs/ROADMAP.md`
- Client research: `docs/client-survey.md`
- Before any UI work, read `DESIGN.md` and `.claude/skills/ui-craft/SKILL.md`,
  and follow them. Use tokens only, with no raw color or spacing values in components.

## Non-negotiables

- Work on `system-rebuild`. Never push to `main`.
- **One roadmap phase per session**, then stop and report (format in the master spec).
- MVC layering: `app/api/v1/**/route.ts` (one-liner) → `server/controllers` → `server/services`
  → `server/models` (the only place that imports Prisma). Pages call services, never Prisma.
- Desktop web only. No mobile/responsive work yet.
- No per-person workforce rankings or scores anywhere (client sensitivity, see the survey).
- Defect types, CV thresholds and class keys are **data**, never hardcoded.
- Docker: one compose file, two services (`app`, `db`). Don't add containers.
- Every page calls `requireRole`/`requirePermission` (`src/server/policies/guard.ts`); every API
  route calls `requireApiPermission`. The proxy is only an optimistic cookie check.
- Every mutation runs in `runInTransaction` and writes `recordAudit` with the same `tx`.
- When a module ships, remove its `phase` in `src/server/policies/navigation.ts` so the nav links it.
- Never claim a check passed without running it. If you couldn't run it, say so.

## End of every session

Run `/wrap-up` (or follow the documentation protocol in the master spec): update
`docs/STATUS.md`, prepend to `docs/SESSION_LOG.md`, log decisions in `docs/DECISIONS.md`, tick
`docs/ROADMAP.md`, commit and push.

## Commands

- Dev: `npm run db:up && npm run db:deploy && npm run dev` (DB in Docker, app on host)
- Demo: `docker compose up --build -d`, then http://localhost:3000
- All checks: `npm run check` (lint + typecheck + unit tests + build)
- E2E: `npm run build && npm run test:e2e`. Needs the DB up. Set `PLAYWRIGHT_CHROMIUM_PATH` if
  browsers can't be downloaded.
- After editing `prisma/schema.prisma`: `npm run db:migrate -- --name <change>`, then `npm run db:generate`
- Camera simulator: `npm run cv:token` once (put the token in `.env` as `CV_DEVICE_TOKEN`), start a
  batch, then `npm run cv:simulate -- --count 20 --interval 3`
- Demo week (empty DB only): `npm run demo:seed`, or `SEED_DEMO_WEEK=true` in `.env` for Docker
- A pre-commit hook (husky + lint-staged) runs ESLint and Prettier on staged files.
