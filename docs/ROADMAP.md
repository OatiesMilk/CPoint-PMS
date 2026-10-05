# Roadmap: System Rebuild

Do one phase per Claude Code session. Each phase ends with the quality gates in
`docs/prompts/system-rebuild.md` passing, the docs updated, and a commit and push of the working
branch, which the team merges into `main` by pull request (D-032). Phases 0–8 were built on
`system-rebuild`, now merged. Tick the boxes as they're done.

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

- [x] Rework tickets created automatically from REWORK (**done in Phase 3**); board OPEN → IN_PROGRESS → DONE
- [x] Salvage items created automatically from REJECT (**done in Phase 3**); assign to a later batch or discard
- [x] Batch counts service (usable = passed + rework done) shown on batch detail
- [x] Unit tests for counts

## Phase 5 — Inventory

- [x] Items CRUD with category, unit, reorder level (no delete: deactivate keeps the history)
- [x] Movements (IN/OUT/ADJUST) are the only way quantity changes
- [x] Low-stock alerts on the FM overview
- [x] Optionally consume a leather roll when creating a batch

## Phase 6 — Admin

- [x] Users CRUD, deactivate, reset password (temporary password, forced change, sessions ended)
- [x] Defect types, CV thresholds, shoe types, suppliers management (+ unknown classes panel)
- [x] Audit log viewer with filters
- [x] Component types table + "Coming soon" page; Constructor placeholder home

## Phase 7 — Dashboards & reports

- [x] FM overview and QI overview (as specified in the master spec)
- [x] Daily summary (Manila day), defect analytics, AI agreement rate
- [x] Stage-duration / bottleneck chart
- [x] CSV export
- [x] No per-person metrics anywhere (checked: report payload unit test + UI review, D-025)

## Phase 8 — Hardening & demo

- [x] Playwright smoke test per role covering the main flows (+ axe on every page)
- [x] ui-craft audit across all screens, findings fixed (`docs/UI_AUDIT.md`)
- [x] Demo seed: realistic week of data (D-026)
- [x] Clean `docker compose up --build` on a fresh machine, following the README word for word
      (sandbox: one documented base-image build arg; the CI docker job is the clean-runner check)
- [x] Panel-ready README: architecture diagram, ERD, setup, demo script

## Phase 9 — Procurement & review access

- [x] Review access: only the Quality Inspector decides flagged scans, enforced in the service
      (403), Floor Manager read-only on the scan and in the queue (D-028)
- [x] Purchase requests: schema, lifecycle (approve / reject with reason / cancel / receive into
      inventory), timeline, remarks, conditional updates and audit on every change (D-029)
- [x] Designated requesters, chosen by the Floor Manager or the System Admin, effective on the
      person's next request without signing out (D-030)
- [x] Views: list with status tabs and filters, request form with a stock-aware picker, detail
      with stock then and now, FM home card, Inventory "Requested" badge, constructor home
- [x] API under `/api/v1/procurement/**`, documented in `docs/API.md`
- [x] Seeds: demo constructor designated; the demo week has one request in each state
- [x] Tests: unit (rules, permissions, service, designation, seed), e2e journeys and access,
      axe smoke on the new pages
- [x] Client follow-up (D-031): every Shoe Constructor requests materials; only those the FM or
      Admin allows request leather rolls (also when typed); D-028 confirmed by the team
