# Roadmap: System Rebuild

Do one phase per Claude Code session. Each phase ends with the quality gates in
`docs/prompts/system-rebuild.md` passing, the docs updated, and a commit and push to `system-rebuild`.
Tick the boxes as they're done.

## Phase 0 — Foundation

- [x] `system-rebuild` branch created from the branch containing these docs, and pushed
- [x] ui-craft §9 run: legacy identity (logo, Figtree, sidebar, light/dark) captured in `DESIGN.md` + `src/styles/tokens.css`
- [x] Laravel/PHP code removed (keep `public/images/cpoint-logo.jpg`, `docs/`, `.claude/`, `CLAUDE.md`); `.gitignore` and `.claude/launch.json` updated for Next.js
- [x] Next.js (App Router, TS strict) + Tailwind + shadcn/ui scaffolded with the folder structure from the master spec
- [x] ESLint (with layer import restrictions), Prettier, Husky + lint-staged, Vitest, Playwright configured
- [x] Multi-stage `Dockerfile` (standalone, non-root, healthcheck), `.dockerignore`, `docker-compose.yml` (`app` + `db`)
- [x] `/api/health` checks DB connectivity
- [x] GitHub Actions CI: lint → typecheck → test → build
- [x] `.env.example`, README (dev + demo workflows), `CLAUDE.md` Commands section filled in

## Phase 1 — Data & auth

- [x] Full Prisma schema + first migration + indexes
- [x] Seed: 4 role accounts, shoe types, defect types, CV settings, sample supplier
- [x] Auth.js credentials login, hashed passwords, inactive users blocked
- [x] Policies (`can(user, permission)`) + middleware; 401/403/404 pages
- [x] App shell: sidebar with role-based nav, theme toggle (no flash), logged-in user menu
- [x] AuditLog helper used by every mutation
- [x] e2e: each role logs in and sees only its nav

## Phase 2 — Batches & stages

- [x] Batch list (filter by status/stage/shoe type), create, edit, cancel
- [x] Advance stage (no skipping; going backwards needs a reason) with `BatchStageLog`
- [x] Batch detail: stage timeline with durations
- [x] Unit tests for stage transitions

## Phase 3 — CV skeleton

- [x] Device API tokens (hashed, scoped, revocable)
- [x] `POST /api/v1/scans` + `GET /api/v1/batches/current` documented in `docs/API.md`
- [x] Decision engine (pure, unit-tested): ≥0.90 REJECT, 0.60–0.89 REWORK, <0.60 PASS, unknown class → NEEDS_REVIEW; thresholds configurable
- [x] Unknown class keys stored and flagged
- [x] Image storage via `StorageService` on the `uploads` volume
- [x] `npm run cv:simulate` generates realistic scans
- [x] Override any decision (QI + FM) with a reason; review queue for NEEDS_REVIEW scans
- [x] Scan detail with bounding-box overlay
- [x] "Latest scans" widget on the FM and QI overviews (5s polling)
- [x] Camera placeholder page

## Phase 4 — Rework & salvage

- [ ] Rework tickets created automatically from REWORK (**done in Phase 3**); board OPEN → IN_PROGRESS → DONE
- [ ] Salvage items created automatically from REJECT (**done in Phase 3**); assign to a later batch or discard
- [ ] Batch counts service (usable = passed + rework done) shown on batch detail
- [ ] Unit tests for counts

## Phase 5 — Inventory

- [ ] Items CRUD with category, unit, reorder level
- [ ] Movements (IN/OUT/ADJUST) are the only way quantity changes
- [ ] Low-stock alerts on the FM overview
- [ ] Optionally consume a leather roll when creating a batch

## Phase 6 — Admin

- [ ] Users CRUD, deactivate, reset password
- [ ] Defect types, CV thresholds, shoe types, suppliers management
- [ ] Audit log viewer with filters
- [ ] Component types table + "Coming soon" page; Constructor placeholder home

## Phase 7 — Dashboards & reports

- [ ] FM overview and QI overview (as specified in the master spec)
- [ ] Daily summary (Manila day), defect analytics, AI agreement rate
- [ ] Stage-duration / bottleneck chart
- [ ] CSV export
- [ ] No per-person metrics anywhere (check this)

## Phase 8 — Hardening & demo

- [ ] Playwright smoke test per role covering the main flows
- [ ] ui-craft audit across all screens, findings fixed
- [ ] Demo seed: realistic week of data
- [ ] Clean `docker compose up --build` on a fresh machine, following the README word for word
- [ ] Panel-ready README: architecture diagram, ERD, setup, demo script
