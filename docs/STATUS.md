# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-03
**Branch:** `system-rebuild`
**Current phase:** Roadmap complete. Waiting on CPoint confirmations and the real YOLO model.
**Overall:** 9 / 9 phases complete

## Phase progress

- [x] 0. Foundation
- [x] 1. Data & auth
- [x] 2. Batches & stages
- [x] 3. CV skeleton
- [x] 4. Rework & salvage
- [x] 5. Inventory
- [x] 6. Admin
- [x] 7. Dashboards & reports
- [x] 8. Hardening & demo

## What works right now

- **Database:** 4 migrations. UUIDv7 ids (D-018).
- **Bootstrap on start** (D-017): reference data, the first System Admin, and demo users and
  inventory when `SEED_DEMO_USERS=true`.
- **Demo week** (D-026): `SEED_DEMO_WEEK=true` (in the background on start) or
  `npm run demo:seed`.
  - It replays six working days through the real services: 14 batches, about 290 scans with
    images, overrides, repairs, salvage and stock movements, and two scans left for review.
  - It runs only on a database with no batches.
- **Sign-in & access** (D-016, D-024, D-025):
  - 12-hour sessions, lockout, and a role × permission matrix;
  - sessions end on deactivation, a password change or reset, or a server-side sign-out.
- **Modules:**
  - batches (D-019) and the camera with the decision engine (D-020, D-011);
  - rework & salvage (D-021, D-022), inventory ledger (D-023);
  - admin (D-024), reports with CSV (D-025).
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`.
- **Quality:**
  - 299 unit and 57 e2e tests, including a smoke test per role with axe (WCAG 2.1 A/AA) on
    every page.
  - The ui-craft audit is in `docs/UI_AUDIT.md`, with no open Critical, High or Medium findings.
  - CI checks the Docker stack with the demo week: stock equals the ledger, and a restart doesn't
    re-seed.
- **README:** purpose, a demo quick start (checked on a fresh clone with fresh volumes), a
  10-minute demo script per role, a Mermaid architecture diagram and ERD, and screenshots.

## Next step (exact)

The roadmap is done. Before the panel, rehearse on a team laptop. Paste into Claude Code:

> /resume, then help us rehearse the panel demo: walk the README "Demo script" against a fresh
> `docker compose up --build -d` with `SEED_DEMO_WEEK=true`, list anything that doesn't match,
> and fix it. Start in plan mode.

After the panel, the follow-ups are:

- apply CPoint's answers to the open questions below (each is a data or setting change, or a
  new decision entry);
- plug in the real YOLO service: it posts to `POST /api/v1/scans` with a device token
  (`docs/API.md`), and its new classes are added under Settings → Defect types;
- component tracking, once CPoint gives the component counts per shoe type.

## Blockers

- None for the demo. Component tracking and the Constructor's features wait on CPoint.

## Open questions / assumptions awaiting client confirmation

- Decided (D-011, team-confirmed): for all defect types, ≥ 90% → REJECT, 60–89% → REWORK,
  below 60% → PASS, and an unknown class key → NEEDS_REVIEW. Still to confirm with CPoint.
- ASSUMPTION: one scan = one leather section of the roll; reworked sections aren't re-scanned.
- ASSUMPTION: the sign-in lockout (5 tries / 15 minutes) and the 12-hour session suit factory
  shifts. Confirm the shift length with CPoint.
- Decided (D-021/D-022, team-confirmed): salvage reused in a batch is shown separately, not added
  to its usable count. A batch can be completed with repairs open and is tagged "In repair".
  Still to confirm with CPoint.
- ASSUMPTION (D-026): the demo week's stage times (Upper Making 6–9 h as the bottleneck) match
  the survey. Real figures will replace them as soon as the line uses the system.
- Unknown: the number of components per shoe type (school shoe, topsider). Blocks component
  tracking only.
- Unknown: what the Shoe Constructor role should see. It's a "coming soon" page for now.
- Pending: the new YOLO training photos will change the defect classes. Classes are data: new
  ones arrive as "unknown", go to the review queue, and are added under Settings → Defect types.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- Local `.env` needs `AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD` and `DEMO_USER_PASSWORD` (README →
  Environment). With demo users on, `admin@cpoint.local` uses `DEMO_USER_PASSWORD`.
- `npm audit` reports 4 highs in the Prisma CLI's dependencies. They aren't reachable, and the
  exposure is accepted (D-027). Re-check when upgrading Prisma.
- `ui.shadcn.com` is unreachable from the Claude cloud sandbox, so shadcn components are written
  by hand in its structure.
- Cloud sandbox only:
  - Docker Hub is rate-limited and the Alpine CDN blocked. Build with
    `docker compose build --build-arg NODE_IMAGE=<local base image>`, then `up -d`.
  - Use `-p <name>` for a throwaway stack so the dev volumes aren't reused.
- After `npm run db:migrate`, run `npm run db:generate` (Prisma 7 doesn't regenerate the client
  on migrate).
- E2E:
  - Without downloadable browsers, set `PLAYWRIGHT_CHROMIUM_PATH`.
  - Against Docker, set `E2E_BASE_URL=http://localhost:3000`, plus that stack's
    `DEMO_USER_PASSWORD` if it differs.
