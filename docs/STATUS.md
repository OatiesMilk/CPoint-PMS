# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-02
**Branch:** `system-rebuild`
**Current phase:** Phase 4 — Rework & salvage (not started)
**Overall:** 4 / 9 phases complete

## Phase progress

- [x] 0. Foundation: branch, DESIGN.md, remove Laravel, scaffold, Docker, CI
- [x] 1. Data & auth
- [x] 2. Batches & stages
- [x] 3. CV skeleton (ingestion API, decision engine, simulator, override + review queue, camera placeholder)
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
- **Computer vision skeleton** (D-020):
  - **Ingestion:** `POST /api/v1/scans` with a device token. It checks images by their content
    (≤ 10 MB) and validates detections. The decision engine applies D-011, with the thresholds
    snapshotted on each scan.
  - **Unknown classes** are stored and flagged, and the scan goes to NEEDS_REVIEW.
  - **Outcome rows:** a REWORK opens a repair ticket and a REJECT creates a salvage item, both automatically.
  - **Images** live on the `uploads` volume behind `StorageService`.
  - **Which batch:** the one picked on the Camera page, else the batch longest at Preparation.
    `GET /api/v1/batches/current` reports it.
  - **Device tokens** are hashed, scoped and revocable: Admin → API tokens, or `npm run cv:token`.
  - **Simulator:** `npm run cv:simulate` posts realistic leather images through the real API.
  - **Pages:**
    - `/scans` (filters) and `/scans/[id]` (bounding-box overlay, override with a reason; the
      ticket/salvage rows are swapped).
    - `/review` (one-click decisions for unknown classes, plus today's automatic Rework/Reject calls).
    - `/camera` (connection state, target batch, last capture) and `/admin/tokens`.
  - **Live feed:** the Latest scans widget (5 s polling) is on the FM and QI homes; the QI home has
    live counts; batch detail shows live scan counts.
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)` with
  before/after values. Verified in psql for every batch action.
- **Tests:** 193 unit tests and 28 e2e tests, run against `next start` and the Docker stack (see the Phase 3 log entry for one unreproduced cold-start failure).

## Next step (exact)

Start Phase 4. Paste into Claude Code:

> /resume, then run Phase 4 (Rework & salvage) from `docs/ROADMAP.md`. Start in plan mode.

Phase 4 notes:

- Rework tickets and salvage items are **already created** at ingestion and on overrides (D-020).
  Phase 4 builds:
  - the boards: Rework `OPEN → IN_PROGRESS → DONE`; Salvage `AVAILABLE → ASSIGNED | DISCARDED`;
  - the batch "usable = passed + rework done" count.
- The override rules already refuse changes once a repair has started or salvage has moved on
  (`scan-decision.service.ts`).
- Remove `phase: 4` from Rework and Salvage in `navigation.ts`, and replace the "Open reworks"
  placeholder on the FM home.

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
- Pending: the new YOLO training photos will change the defect classes. Classes are data; until
  Phase 6 adds the Settings page, new classes arrive as "unknown" and go to the review queue.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- Local `.env` needs `AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD` and `DEMO_USER_PASSWORD` (README → Environment).
- `ui.shadcn.com` is unreachable from the Claude cloud sandbox, so shadcn components are written
  by hand in its structure. On a normal machine `npx shadcn@latest add <component>` works.
- Cloud sandbox only: Docker Hub is rate-limited and the Alpine CDN blocked. Verify Docker builds
  there with `--build-arg NODE_IMAGE=<local base image>`. The committed Dockerfile needs no workaround.
- Simulator: `npm run cv:token`, put the token in `.env` as `CV_DEVICE_TOKEN`, start a batch, then `npm run cv:simulate`.
- After `npm run db:migrate`, run `npm run db:generate` (Prisma 7 doesn't regenerate the client on migrate).
- E2E without downloadable browsers: set `PLAYWRIGHT_CHROMIUM_PATH`. Against Docker: `E2E_BASE_URL=http://localhost:3000`.
