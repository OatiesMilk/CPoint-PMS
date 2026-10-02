# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-02
**Branch:** `system-rebuild`
**Current phase:** Phase 2 — Batches & stages (not started)
**Overall:** 2 / 9 phases complete

## Phase progress

- [x] 0. Foundation: branch, DESIGN.md, remove Laravel, scaffold, Docker, CI
- [x] 1. Data & auth
- [ ] 2. Batches & stages
- [ ] 3. CV skeleton (ingestion API, decision engine, simulator, override + review queue, camera placeholder)
- [ ] 4. Rework & salvage
- [ ] 5. Inventory
- [ ] 6. Admin
- [ ] 7. Dashboards & reports
- [ ] 8. Hardening & demo

## What works right now

- **Database:** the full schema for every phase is migrated (`prisma/migrations/…_init`): users,
  API tokens, audit log, reference data, batches + stage logs, scans + detections, rework,
  salvage, inventory. UUIDv7 ids and indexed FKs (D-018).
- **Bootstrap on start** (D-017): reference data (2 shoe types, 4 defect types, CV thresholds
  0.90/0.60, sample supplier), the first System Admin from env, and demo users when
  `SEED_DEMO_USERS=true`. Idempotent; `npm run db:seed` runs the same thing.
- **Sign-in** (D-016): Auth.js credentials with bcrypt and 12-hour JWT sessions.
  - 5 wrong passwords lock the account for 15 minutes.
  - Deactivated users are signed out on their next request.
  - No account enumeration.
  - Every sign-in, failure, lock and sign-out is audited.
- **Access control:** `can(role, permission)` matrix; `requireRole`/`requirePermission` in pages,
  `requireApiPermission` for APIs; `proxy.ts` does an optimistic cookie check. 403 and 404 pages.
- **App shell:** the sidebar comes from the permission matrix; modules not built yet show as
  "Phase N". It has a user menu (sign out) and the theme toggle. Role homes are placeholders,
  except the admin home, which shows live system health.
- **Audit pattern:** `runInTransaction` + `recordAudit(tx, …)`. Secrets are redacted.
- **Tests:** 94 unit tests (incl. the full role × permission matrix and lockout rules) and 13 e2e
  tests. The e2e tests pass against both `next start` and the Docker stack.

## Next step (exact)

Start Phase 2. Paste into Claude Code:

> /resume, then run Phase 2 (Batches & stages) from `docs/ROADMAP.md`. Start in plan mode.

Phase 2 notes:

- The `Batch`, `BatchStageLog` and `BatchSequence` tables already exist. Use the
  `runInTransaction` + `recordAudit` pattern.
- Remove `phase: 2` from Batches in `src/server/policies/navigation.ts`.
- Replace the "Batches by stage" placeholder card on the FM home.

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
