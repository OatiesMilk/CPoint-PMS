# CLAUDE.md — CPoint Product Monitoring System

Capstone project (BS-IT) for CPoint Shoe Store Corporation: a Product Monitoring System for a
leather-shoe production line (Preparation → Upper Making → Sole-ing → Finishing) with one
computer-vision checkpoint at Preparation, before cutting.

**The project is mid-rebuild** from Laravel/MySQL to Next.js/PostgreSQL/Docker on the
`system-rebuild` branch. If Laravel files (`artisan`, `composer.json`, `app/Http`) still exist,
Phase 0 has not run yet.

## Read at the start of every session
- Current state (auto-loaded below): @docs/STATUS.md
- Master spec: `docs/prompts/system-rebuild.md`. Read it before any feature work.
- Settled decisions: `docs/DECISIONS.md`. Don't re-litigate them; add a new entry to change one.
- Phases + acceptance criteria: `docs/ROADMAP.md`
- Client research: `docs/client-survey.md`
- Before any UI work, read `DESIGN.md` (once it exists) and `.claude/skills/ui-craft/SKILL.md`,
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
- Never claim a check passed without running it. If you couldn't run it, say so.

## End of every session
Run `/wrap-up` (or follow the documentation protocol in the master spec): update
`docs/STATUS.md`, prepend to `docs/SESSION_LOG.md`, log decisions in `docs/DECISIONS.md`, tick
`docs/ROADMAP.md`, commit and push.

## Commands
_Filled in during Phase 0. Keep this section accurate._
- Dev: `docker compose up -d db` then `npm run dev`
- Demo: `docker compose up --build`
- Checks: `npm run lint && npm run typecheck && npm run test && npm run build`
- Simulate CV scans: `npm run cv:simulate -- --count 20 --interval 3`
