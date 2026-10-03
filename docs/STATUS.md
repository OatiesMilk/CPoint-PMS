# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-03
**Branch:** `system-rebuild`
**Current phase:** Phase 5 — Inventory (not started)
**Overall:** 5 / 9 phases complete

## Phase progress

- [x] 0. Foundation: branch, DESIGN.md, remove Laravel, scaffold, Docker, CI
- [x] 1. Data & auth
- [x] 2. Batches & stages
- [x] 3. CV skeleton
- [x] 4. Rework & salvage
- [ ] 5. Inventory (items, movements, low-stock alerts, optional roll consumption)
- [ ] 6. Admin
- [ ] 7. Dashboards & reports
- [ ] 8. Hardening & demo

## What works right now

- **Database:** the full schema for every phase is migrated. UUIDv7 ids and indexed FKs (D-018).
- **Bootstrap on start** (D-017): reference data, the first System Admin from env, and demo users
  when `SEED_DEMO_USERS=true`.
- **Sign-in & access** (D-016): Auth.js credentials, 12-hour sessions, lockout, deactivation on the
  next request. A role × permission matrix with page/API guards.
- **Batches** (D-019): list/create/edit/detail, a stage machine with reasons, STALE concurrency,
  and `/api/v1/batches`.
- **Camera** (D-020): device tokens, `POST /api/v1/scans`, the decision engine (D-011), image
  storage, the simulator (`npm run cv:simulate`), overrides, the review queue, scan pages with box
  overlays, the Camera page, and live feeds on the FM/QI homes.
- **Rework & salvage** (D-021, D-022):
  - **`/rework` board** (FM + QI): Waiting → Being repaired → Repaired (7 days), with an undo toast
    and Reopen.
  - **`/salvage`** (FM acts, QI reads): Available / Reused / Discarded. Reuse rejected leather in
    another open batch, unassign it, or discard it with a reason.
  - **Batch detail Yield card:** usable = passed + repaired, plus at repair station, rejected,
    needs review, and salvage reused here.
  - **Batch rules** (D-022): a batch can be completed with repairs still open. It's tagged
    "In repair · N" on the list and detail until they're done, and its usable count rises as they
    finish. Cancelling a batch cancels its open repairs.
  - **API:** `/api/v1/rework` and `/api/v1/salvage` (`docs/API.md`).
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`. Checked in psql.
- **Tests:** 220 unit and 33 e2e tests. The e2e tests pass against `next start` and the Docker stack.

## Next step (exact)

Start Phase 5. Paste into Claude Code:

> /resume, then run Phase 5 (Inventory) from `docs/ROADMAP.md`. Start in plan mode.

Phase 5 notes:

- `InventoryItem` and `InventoryMovement` already exist. `quantityOnHand` changes only via
  movements (IN/OUT/ADJUST), in the same transaction, with a row lock or a conditional update.
  Never allow negative stock silently.
- Permissions exist: `inventory:read` (FM, System Admin) and `inventory:manage` (FM).
- Replace the `phase={5}` low-stock placeholder on the FM home. Remove `phase: 5` from Inventory in
  `navigation.ts`.
- "Consume a leather roll when creating a batch" is optional. Decide it in the plan. A batch
  already stores `rollCode`, and a movement can carry `batchId`.

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
