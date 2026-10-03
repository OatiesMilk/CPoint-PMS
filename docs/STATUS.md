# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-03
**Branch:** `system-rebuild`
**Current phase:** Phase 8 — Hardening & demo (not started)
**Overall:** 8 / 9 phases complete

## Phase progress

- [x] 0. Foundation
- [x] 1. Data & auth
- [x] 2. Batches & stages
- [x] 3. CV skeleton
- [x] 4. Rework & salvage
- [x] 5. Inventory
- [x] 6. Admin
- [x] 7. Dashboards & reports
- [ ] 8. Hardening & demo (smoke test per role, ui-craft audit, a realistic demo week, clean
      compose on a fresh machine, panel-ready README)

## What works right now

- **Database:** 4 migrations (`init`, `camera_active_batch`, `users_sessions_valid_from`,
  `session_revocations`). UUIDv7 ids (D-018).
- **Bootstrap on start** (D-017): reference data, the first System Admin, and demo users and
  inventory when `SEED_DEMO_USERS=true`.
- **Sign-in & access** (D-016, D-024, D-025):
  - 12-hour sessions, lockout, and a role × permission matrix;
  - a session ends on deactivation, a password reset/change, or **sign-out (revoked
    server-side)**;
  - temporary passwords force a change.
- **Batches** (D-019), **camera** (D-020, D-011), **rework & salvage** (D-021, D-022),
  **inventory** (D-023), **admin** (D-024).
- **Reports** (D-025):
  - **`/reports`:** range presets and a custom range; totals; scans per day by final verdict;
    defects by type (click-through to `/scans?defect=`); camera call vs final verdict with AI
    agreement; time in each stage with the bottleneck (FM); the daily summary table; and Daily,
    Defects and Stages CSVs (Excel-friendly).
  - **FM home:** today's split + daily summary. **QI home:** defects today + AI agreement.
  - No "Phase N" placeholders remain.
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`.
- **Tests:** 292 unit and 47 e2e tests.

## Next step (exact)

Start Phase 8. Paste into Claude Code:

> /resume, then run Phase 8 (Hardening & demo) from `docs/ROADMAP.md`. Start in plan mode.

Phase 8 notes:

- **Demo week:**
  - Seed through the real services and the ingestion API (the simulator can post with
    `capturedAt` in the past), so the audit, stage logs and ledger stay consistent;
  - spread over 7 Manila days, with Upper Making and Sole-ing slowest (survey);
  - make it opt-in (e.g. `npm run demo:seed`) and never part of a normal start.
- **Fresh-machine check:**
  - `docker compose up --build` exactly as the README says, on a clean volume;
  - Docker Hub/Alpine are blocked in the cloud sandbox, so verify the committed Dockerfile in CI
    or on a team laptop.
- **ui-craft audit:** every screen in light and dark at 1280px+. Check states (empty, loading,
  error, stale), focus order and copy.
- **Smoke test per role:** one Playwright journey each for the FM, QI, System Admin and Shoe
  Constructor.
- **README for the panel:** an architecture diagram (MVC layers, Docker services), an ERD (from
  Prisma), setup, and a demo script.
- **Housekeeping:** remove `ComingSoonCard` if unused; review the `npm audit` findings in the
  Prisma CLI's dependencies.

## Blockers

- None.

## Open questions / assumptions awaiting client confirmation

- Decided (D-011, team-confirmed): for all defect types, ≥ 90% → REJECT, 60–89% → REWORK,
  below 60% → PASS, and an unknown class key → NEEDS_REVIEW. Still to confirm with CPoint.
- ASSUMPTION: one scan = one leather section of the roll; reworked sections aren't re-scanned.
- ASSUMPTION: the sign-in lockout (5 tries / 15 minutes) and the 12-hour session suit factory
  shifts. Confirm the shift length with CPoint.
- Decided (D-021/D-022, team-confirmed 2026-10-03): salvage reused in a batch is shown separately,
  not added to its usable count; a batch can be completed with repairs open and is tagged
  "In repair". Still to confirm with CPoint.
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
