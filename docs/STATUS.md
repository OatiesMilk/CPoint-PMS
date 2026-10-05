# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-05
**Branch:** `claude/compassionate-darwin-uys0sv` (started from `main`, which now holds all of
`system-rebuild`). No PR opened yet.
**Current phase:** Phase 9 — Procurement & review access (done)
**Overall:** 10 / 10 phases complete

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
- [x] 9. Procurement & review access

## What works right now

- **Database:** 5 migrations (the latest is `procurement`). UUIDv7 ids (D-018).
- **Bootstrap on start** (D-017):
  - reference data and the first System Admin;
  - demo users and inventory when `SEED_DEMO_USERS=true`. The demo constructor is a designated
    requester.
- **Demo week** (D-026): `SEED_DEMO_WEEK=true` or `npm run demo:seed`.
  - 14 batches and about 290 scans, two left for review;
  - five purchase requests, one in each state.
- **Sign-in & access** (D-016, D-024, D-025, D-030):
  - 12-hour sessions, lockout, a role × permission matrix, and server-side sign-out;
  - the requester flag is read fresh on every request.
- **Modules:**
  - batches (D-019) and the camera with the decision engine (D-011, D-020);
  - **flagged scans are decided by the Quality Inspector only** (D-028). The FM sees them
    read-only;
  - rework & salvage (D-021, D-022), the inventory ledger (D-023), admin (D-024), reports (D-025).
- **Procurement** (D-029, D-030):
  - designated Shoe Constructors send purchase requests (1–10 items, with the stock snapshot);
  - the FM approves, rejects with a reason, or marks them received, which posts stock IN through
    the ledger;
  - every request has a timeline and remarks;
  - the FM home card, an Inventory "Requested" badge and "My requests" on the constructor home;
  - who may request is chosen by the FM (Requesters tab) or the Admin (Users).
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`.
- **Quality:**
  - 362 unit and 63 e2e tests, with axe (WCAG 2.1 A/AA) on every page of every role;
  - ui-craft audit in `docs/UI_AUDIT.md`, now with a Phase 9 section;
  - CI checks the Docker stack with the demo week.

## Next step (exact)

Push is done. Ask the team whether to open a PR from `claude/compassionate-darwin-uys0sv` into
`main`. Then rehearse the panel demo. Paste into Claude Code:

> /resume, then help us rehearse the panel demo: walk the README "Demo script" (all four roles,
> including the procurement walkthrough) against a fresh `docker compose up --build -d` with
> `SEED_DEMO_WEEK=true`, list anything that doesn't match, and fix it. Start in plan mode.

After the panel:

- Apply CPoint's answers to the open questions below.
- Plug in the real YOLO service. Its classes are data (Settings → Defect types).
- Component tracking, once CPoint gives the component counts per shoe type.
- Optional for procurement: CSV export and monthly counts by status and category (never per
  person).

## Blockers

- None for the demo.

## Open questions / assumptions awaiting client confirmation

- **CHANGE TO CONFIRM (D-028):** the FM no longer resolves flagged (NEEDS_REVIEW) scans; only the
  QI does. This differs from survey Q5 ("whoever is available"). If no QI is on shift, flagged
  scans wait.
- **Q14, open:** who approves **leather roll** requests: the Floor Manager, or the staff member
  who orders leather? Today the FM approves every request (D-029).
- Decided (D-011, team-confirmed): for all defect types, ≥ 90% → REJECT, 60–89% → REWORK, below
  60% → PASS, and an unknown class key → NEEDS_REVIEW. Still to confirm with CPoint.
- ASSUMPTION: one scan = one leather section of the roll; reworked sections aren't re-scanned.
- ASSUMPTION: the sign-in lockout (5 tries / 15 minutes) and the 12-hour session suit factory
  shifts. Confirm the shift length.
- Decided (D-021/D-022, team-confirmed): salvage reused in a batch is shown separately, and a
  batch can be completed with repairs open ("In repair"). Still to confirm with CPoint.
- ASSUMPTION (D-029): a request is received as a whole (no partial deliveries), and requests
  aren't edited after they're sent (cancel and resend).
- ASSUMPTION (D-026): the demo week's stage times match the survey.
- Unknown: components per shoe type. Blocks component tracking only.
- Pending: the new YOLO training photos will change the defect classes. They arrive as
  "unknown", go to the QI's review queue, and are added under Settings → Defect types.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- Local `.env` needs `AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD` and `DEMO_USER_PASSWORD`. With demo
  users on, `admin@cpoint.local` uses `DEMO_USER_PASSWORD`.
- `npm audit`: 4 unreachable highs in the Prisma CLI's dependencies (D-027).
- Cloud sandbox only:
  - Build Docker with `--build-arg NODE_IMAGE=<local base image>`, then `up -d`.
  - Use `-p <name>` (and other `DB_PORT`/`APP_PORT` values) for a throwaway stack beside the dev
    DB.
- After `npm run db:migrate`, run `npm run db:generate`.
- E2E:
  - `PLAYWRIGHT_CHROMIUM_PATH` without downloadable browsers.
  - Against Docker: `E2E_BASE_URL`, plus that stack's `DEMO_USER_PASSWORD` and `DATABASE_URL`
    (the helpers write to the DB).
  - The e2e tests create their own Shoe Constructor accounts, so the demo constructor's flag is
    never toggled by tests.
