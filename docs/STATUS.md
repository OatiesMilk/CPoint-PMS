# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-03
**Branch:** `system-rebuild`
**Current phase:** Phase 7 — Dashboards & reports (not started)
**Overall:** 7 / 9 phases complete

## Phase progress

- [x] 0. Foundation: branch, DESIGN.md, remove Laravel, scaffold, Docker, CI
- [x] 1. Data & auth
- [x] 2. Batches & stages
- [x] 3. CV skeleton
- [x] 4. Rework & salvage
- [x] 5. Inventory
- [x] 6. Admin
- [ ] 7. Dashboards & reports (FM/QI overviews, daily summary, defect analytics, AI agreement, bottleneck chart, CSV)
- [ ] 8. Hardening & demo

## What works right now

- **Database:** the full schema, 3 migrations (`init`, `camera_active_batch`,
  `users_sessions_valid_from`). UUIDv7 ids (D-018).
- **Bootstrap on start** (D-017): reference data, the first System Admin, and demo users and
  inventory when `SEED_DEMO_USERS=true`.
- **Sign-in & access** (D-016, D-024): 12-hour sessions, lockout, a role × permission matrix.
  - Deactivation, password resets and password changes end sessions on the next request.
  - Temporary passwords force a change at `/account/password`.
- **Batches** (D-019) with stages, STALE concurrency and the `/api/v1/batches` API.
- **Camera** (D-020): ingestion API, the decision engine (D-011), the simulator, overrides, the
  review queue, scan pages and live feeds.
- **Rework & salvage** (D-021, D-022): the board, salvage tabs and the Yield card. A batch can be
  completed with repairs open (tagged "In repair").
- **Inventory** (D-023): a ledger of receive/use/count entries with undo, low-stock alerts, and an
  optional roll taken on batch create.
- **Admin** (D-024):
  - **`/admin/users`:** add (temporary password shown once), edit, reset (ends their sessions),
    unlock, and deactivate/reactivate. Self and last-admin protection.
  - **`/admin/settings`:**
    - thresholds (live bands; past scans keep theirs);
    - defect types (fixed keys, an Unknown classes panel with "Add as defect type");
    - shoe types, suppliers and components (no deletes).
  - **`/admin/audit`:** filters and field-level before/after diffs.
  - **`/components`:** a Coming soon page.
  - **Admin home:** users by role, thresholds, unknown classes, and 24 h audit activity.
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`. Checked in psql.
- **Tests:** 276 unit and 44 e2e tests. The e2e tests pass against `next start` and the Docker stack.

## Next step (exact)

Start Phase 7. Paste into Claude Code:

> /resume, then run Phase 7 (Dashboards & reports) from `docs/ROADMAP.md`. Start in plan mode.

Phase 7 notes:

- Placeholders to replace:
  - **FM home:** "Today's inspection split" and "Daily summary";
  - **QI home:** "Defects by type" and "AI agreement rate";
  - **Nav:** Reports (`phase: 7`, `report:quality` FM+QI; `report:production` is FM only).
- **Day buckets:** Manila calendar day (UTC+8, no DST). Bucket in SQL with
  `AT TIME ZONE 'Asia/Manila'`.
- **AI agreement** = scans where `finalVerdict = aiVerdict` / decided scans. NEEDS_REVIEW resolutions
  count separately (the AI made no call).
- **Bottleneck:** stage durations from `batch_stage_logs` (open logs up to now).
- **Yield:** after D-022, a completed batch's usable count can still rise while it's tagged
  In repair. Show yield "as of now".
- **Charts:** read the `dataviz` skill and DESIGN.md first. Verdict colors are fixed (pass, rework,
  reject, review tokens).
- **CSV export:** server-generated, UTF-8 with BOM for Excel, Manila timestamps.
- **No per-person metrics** anywhere (D-008). The audit log names people, but reports must
  aggregate per stage, batch or day only.

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
