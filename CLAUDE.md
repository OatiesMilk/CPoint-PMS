# CLAUDE.md — CPoint Product Monitoring System

Capstone project (BS-IT) for CPoint Shoe Store Corporation: a Product Monitoring System for a
leather-shoe production line (Preparation → Upper Making → Sole-ing → Finishing) with one
computer-vision checkpoint at Preparation, before cutting.

The rebuild from Laravel/MySQL to Next.js/PostgreSQL/Docker is complete (roadmap Phases 0–9) and
lives on `main`. New work is client follow-ups and new features, each added as a roadmap phase.

Next.js 16 and Prisma 7 have breaking changes from older versions. Read the bundled docs before
writing framework code:
@AGENTS.md
Prisma 7 specifics: the client is generated to `src/generated/prisma` (import from
`@/generated/prisma/client`), it needs the `@prisma/adapter-pg` driver adapter, and the CLI is
configured in `prisma.config.ts`, which doesn't auto-load `.env`.

## Read at the start of every session

- Current state (auto-loaded below): @docs/STATUS.md
- Master spec: `docs/prompts/system-rebuild.md`. Read it before any feature work.
- Phase briefs live in `docs/prompts/` and approved plans in `docs/prompts/plans/`, never in the
  repo root.
- Settled decisions: `docs/DECISIONS.md`. Don't re-litigate them; add a new entry to change one.
- Phases + acceptance criteria: `docs/ROADMAP.md`
- Client research: `docs/client-survey.md`
- Before any UI work, read `DESIGN.md` and `.claude/skills/ui-craft/SKILL.md`,
  and follow them. Use tokens only, with no raw color or spacing values in components.

## Non-negotiables

- Branch from the latest `main` (or use the branch the session gives you), push that branch, and
  let the team open and merge the PR. Never push to `main` (D-032). `system-rebuild` is history.
- **One roadmap phase or feature per session**, then stop and report (format in the master spec).
- MVC layering: `app/api/v1/**/route.ts` (one-liner) → `server/controllers` → `server/services`
  → `server/models` (the only place that imports Prisma). Pages call services, never Prisma.
- Desktop web first. The layout adapts to narrower windows (D-034): no fixed column counts,
  use auto-fit grids and `xl:`/`sm:` stacking, and never let the page scroll sideways. No
  touch or phone design.
- No per-person workforce rankings or scores anywhere (client sensitivity, see the survey).
- Defect types, CV thresholds and class keys are **data**, never hardcoded.
- Docker: one compose file, two services (`app`, `db`). Don't add containers.
- Every page calls `requireRole`/`requirePermission` (`src/server/policies/guard.ts`); every API
  route calls `requireApiPermission`. The proxy is only an optimistic cookie check.
- Every mutation runs in `runInTransaction` and writes `recordAudit` with the same `tx`.
- When a module ships, remove its `phase` in `src/server/policies/navigation.ts` so the nav links it.
- Never claim a check passed without running it. If you couldn't run it, say so.

## Roles, CI fixes and the vault (D-089, D-092)

- Claude is the main developer and **fixes every failure, failing GitHub CI checks included**.
  Codex only tests and reports (the QA you write up); it never applies a fix (D-092). When CI
  fails, read the failing check, fix it and rerun `npm run check` (and the `cv/` checks for
  `station`). For an `e2e` or `docker` failure, which you don't run, also write
  `qa/CODEX_PROMPT_CI_RECHECK_<branch>.md` from `qa/templates/ci-recheck-prompt.md` (failing jobs,
  error lines, what you changed, the jobs to rerun) and give Dylan that prompt. Full loop:
  `qa/README.md` → "CI fix loop".
- **Vault first:** Dylan's Obsidian vault `C:\dev\capstone-obsidian` is the first lookup. Read its
  `CLAUDE.md`, `Rules.md`, `Home.md`, `Inbox/CPoint commands and where to look.md` and the
  phase's summary in `Notes/Phases/` before exploring the repo; open only the repo files they
  point to or the task needs. Never guess what the vault or repo doesn't state.
- **Record every change in the vault too:** at each milestone (plan, build, QA report, CI fix,
  fix) add to today's `Daily/YYYY-MM-DD.md` (Did, Next, Questions, and one "Agent sessions" line
  linking the brief, plan, handoff, prompt and report), and keep the phase's summary note in
  `Notes/Phases/` current. Link repo docs as `[[CPoint-PMS/docs/…]]`; don't copy them.

## End of every session

Run `/wrap-up` (or follow the documentation protocol in the master spec): update
`docs/STATUS.md`, prepend to `docs/SESSION_LOG.md`, log decisions in `docs/DECISIONS.md`, tick
`docs/ROADMAP.md`, and update the vault (Daily note and phase summary). Don't commit or push
without Dylan's go: give him the exact git commands instead. CI runs once the PR is open; if it
fails, fix it (above).

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
