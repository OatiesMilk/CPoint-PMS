# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-03
**Branch:** `system-rebuild`
**Current phase:** Phase 6 — Admin (not started)
**Overall:** 6 / 9 phases complete

## Phase progress

- [x] 0. Foundation: branch, DESIGN.md, remove Laravel, scaffold, Docker, CI
- [x] 1. Data & auth
- [x] 2. Batches & stages
- [x] 3. CV skeleton
- [x] 4. Rework & salvage
- [x] 5. Inventory
- [ ] 6. Admin (users, defect types/thresholds/shoe types/suppliers, audit log viewer, component types)
- [ ] 7. Dashboards & reports
- [ ] 8. Hardening & demo

## What works right now

- **Database:** the full schema for every phase is migrated. UUIDv7 ids and indexed FKs (D-018).
- **Bootstrap on start** (D-017): reference data, the first System Admin from env, and demo users
  and demo inventory when `SEED_DEMO_USERS=true`.
- **Sign-in & access** (D-016): Auth.js credentials, 12-hour sessions, lockout, deactivation on the
  next request. A role × permission matrix with page/API guards.
- **Batches** (D-019): list/create/edit/detail, a stage machine with reasons, STALE concurrency,
  and `/api/v1/batches`.
- **Camera** (D-020): device tokens, `POST /api/v1/scans`, the decision engine (D-011), image
  storage, the simulator, overrides, the review queue, scan pages with box overlays, the Camera
  page, and live feeds on the FM/QI homes.
- **Rework & salvage** (D-021, D-022):
  - the `/rework` board and `/salvage` tabs;
  - the batch Yield card (usable = passed + repaired);
  - a batch can be completed with repairs open and is tagged "In repair · N".
- **Inventory** (D-023):
  - **`/inventory`:** filters for category, stock level, search and deactivated items. Add and
    edit items, with suggested codes and opening stock.
  - **Item page:** Receive / Use / Stock count dialogs. Undo on receipts and usage. A history with
    the balance after each entry.
  - **Rules:** stock never goes negative; a count is refused if stock moved meanwhile.
  - **FM home:** a live Low-stock alerts card.
  - **Batch form:** optional "Take a roll from inventory". Cancelling a planned batch returns it.
  - **Access:** the System Admin reads; the QI has no access.
  - **API:** `/api/v1/inventory` (`docs/API.md`).
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`. Checked in psql.
- **Tests:** 248 unit and 38 e2e tests. The e2e tests pass against `next start` and the Docker stack.

## Next step (exact)

Start Phase 6. Paste into Claude Code:

> /resume, then run Phase 6 (Admin) from `docs/ROADMAP.md`. Start in plan mode.

Phase 6 notes:

- Nav items with `phase: 6` in `navigation.ts`: Users, the settings entries and the Audit log.
  Remove them as each ships.
- The schema already has `User`, `DefectType`, `CvSettings`, `ShoeType`, `Supplier`,
  `ComponentType` and `AuditLog`. Defect types, thresholds and class keys stay **data** (D-011).
  Changing a threshold must not alter past scans: they keep their snapshot.
- Users:
  - deactivation is already enforced on the next request (D-016);
  - a password reset should end the user's sessions (bump a `sessionVersion`, or rely on
    `updatedAt` the way deactivation does; decide in the plan);
  - never allow deactivating or demoting the last active System Admin.
- The audit log viewer should filter by actor, action, entity and date, with before/after diffs.
  It's read-only.

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
