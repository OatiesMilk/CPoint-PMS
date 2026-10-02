# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-02
**Branch:** `system-rebuild`
**Current phase:** Phase 1 — Data & auth (not started)
**Overall:** 1 / 9 phases complete

## Phase progress

- [x] 0. Foundation: branch, DESIGN.md, remove Laravel, scaffold, Docker, CI
- [ ] 1. Data & auth
- [ ] 2. Batches & stages
- [ ] 3. CV skeleton (ingestion API, decision engine, simulator, override + review queue, camera placeholder)
- [ ] 4. Rework & salvage
- [ ] 5. Inventory
- [ ] 6. Admin
- [ ] 7. Dashboards & reports
- [ ] 8. Hardening & demo

## What works right now

- Next.js 16 app with the MVC folder layout. ESLint enforces the layer rules.
- `GET /api/health` (route → controller → service → model) checks PostgreSQL and returns 200/503.
- Home page `/`: live app/DB status, the four production stages, and the four verdict badges.
  Light/dark theme with no flash on load. It's a temporary page that Phase 1 replaces with sign-in.
- Design system: `DESIGN.md` + `src/styles/tokens.css` (CPoint yellow/ink, Figtree; contrast checked).
- Docker: `docker compose up --build -d` runs `app` + `db`. The app applies migrations on start,
  runs as non-root, and reports healthy.
- Tooling: Prettier, husky pre-commit (lint-staged), Vitest (6 tests), Playwright (3 e2e), and
  GitHub Actions CI (check, e2e, docker jobs).

## Next step (exact)

Start Phase 1. Paste into Claude Code:

> /resume, then run Phase 1 (Data & auth) from `docs/ROADMAP.md`. Start in plan mode and show me
> the Prisma schema before migrating.

## Blockers

- None.

## Open questions / assumptions awaiting client confirmation

- Decided (D-011, team-confirmed): for all defect types, ≥ 90% → REJECT, 60–89% → REWORK,
  below 60% → PASS, and an unknown class key → NEEDS_REVIEW. Still to confirm with CPoint.
- ASSUMPTION: one scan = one leather section of the roll; reworked sections aren't re-scanned.
- Unknown: number of components per shoe type (school shoe, topsider). Blocks component tracking only.
- Unknown: what the Shoe Constructor role should see. It's a placeholder for now.
- Pending: the new YOLO training photos will change the defect classes. Classes are data, so no
  code change should be needed.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- Demo camera: phone/webcam (not built yet; the simulator stands in from Phase 3).
- `ui.shadcn.com` was unreachable from the Claude cloud sandbox, so shadcn components are written
  by hand following its structure (`components.json` is set up). On a normal machine,
  `npx shadcn@latest add <component>` works. Re-skin anything it adds with DESIGN.md tokens.
- Cloud sandbox only: Docker Hub was rate-limited and the Alpine package CDN was blocked, so the
  image was verified with a locally built base passed via `--build-arg NODE_IMAGE=...`. The
  committed Dockerfile needs no workaround on a normal machine.
