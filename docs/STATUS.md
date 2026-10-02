# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-02
**Branch:** `system-rebuild`
**Current phase:** Phase 3 — CV skeleton (not started)
**Overall:** 3 / 9 phases complete

## Phase progress

- [x] 0. Foundation: branch, DESIGN.md, remove Laravel, scaffold, Docker, CI
- [x] 1. Data & auth
- [x] 2. Batches & stages
- [ ] 3. CV skeleton (ingestion API, decision engine, simulator, override + review queue, camera placeholder)
- [ ] 4. Rework & salvage
- [ ] 5. Inventory
- [ ] 6. Admin
- [ ] 7. Dashboards & reports
- [ ] 8. Hardening & demo

## What works right now

- **Database:** the full schema for every phase is migrated (`prisma/migrations/…_init`).
  UUIDv7 ids and indexed FKs (D-018).
- **Bootstrap on start** (D-017): reference data, the first System Admin from env, and demo users
  when `SEED_DEMO_USERS=true`. Idempotent; `npm run db:seed` runs the same thing.
- **Sign-in & access** (D-016): Auth.js credentials, 12-hour sessions, lockout, and deactivation
  enforced on the next request. A role × permission matrix with page/API guards; 403/404 pages.
- **Batches** (D-019):
  - **List:** filters (status, stage, shoe type, search) kept in the URL, time in stage,
    pagination, and empty/loading/error states.
  - **Create/edit:** batch codes `B-2026-0001`. The shoe type locks once production starts.
  - **Detail:** one primary action per state (Start production → Move to … → Complete batch).
    Moving back and cancelling need a reason; completing is confirmed. A stage stepper and a
    timeline show durations and rollback reasons.
  - **Concurrency:** two people moving the same batch get `409 STALE` with a Refresh button.
  - **FM home:** "Batches by stage" is live, flagging the stage with the longest wait.
  - **API:** `/api/v1/batches` (list, create, get, patch, stages, cancel), documented in `docs/API.md`.
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)` with
  before/after values. Verified in psql for every batch action.
- **Tests:** 140 unit tests and 21 e2e tests. The e2e tests pass against `next start` and the Docker stack.

## Next step (exact)

Start Phase 3. Paste into Claude Code:

> /resume, then run Phase 3 (CV skeleton) from `docs/ROADMAP.md`. Start in plan mode.

Phase 3 notes:

- "The batch at Preparation" = `status IN_PROGRESS` and `currentStage PREPARATION`. More than one
  can be at Preparation, so `GET /api/v1/batches/current` needs a rule: the oldest-started, or an
  explicitly selected batch on the Camera page. Decide this in the plan.
- `Scan`, `Detection`, `ApiToken`, `CvSettings` and `DefectType` already exist. The decision
  engine follows D-011.
- Remove `phase: 3` from Camera, Scans, Review queue and API tokens in `navigation.ts`.
- Replace the "Scans & counts" card on batch detail and "Latest scans" on the FM/QI homes.

## Blockers

- None.

## Open questions / assumptions awaiting client confirmation

- Decided (D-011, team-confirmed): for all defect types, ≥ 90% → REJECT, 60–89% → REWORK,
  below 60% → PASS, and an unknown class key → NEEDS_REVIEW. Still to confirm with CPoint.
- ASSUMPTION: one scan = one leather section of the roll; reworked sections aren't re-scanned.
- ASSUMPTION: the sign-in lockout (5 tries / 15 minutes) and the 12-hour session suit factory
  shifts. Confirm the shift length with CPoint.
- Unknown: number of components per shoe type (school shoe, topsider). Blocks component tracking only.
- Unknown: what the Shoe Constructor role should see. It's a "coming soon" page for now.
- Pending: the new YOLO training photos will change the defect classes. Classes are data, so no
  code change should be needed.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- Local `.env` needs `AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD` and `DEMO_USER_PASSWORD` (README → Environment).
- `ui.shadcn.com` is unreachable from the Claude cloud sandbox, so shadcn components are written
  by hand in its structure. On a normal machine `npx shadcn@latest add <component>` works.
- Cloud sandbox only: Docker Hub is rate-limited and the Alpine CDN blocked. Verify Docker builds
  there with `--build-arg NODE_IMAGE=<local base image>`. The committed Dockerfile needs no workaround.
- E2E without downloadable browsers: set `PLAYWRIGHT_CHROMIUM_PATH`. Against Docker: `E2E_BASE_URL=http://localhost:3000`.
