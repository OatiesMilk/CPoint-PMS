# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-10
**Branch:** `main` checkout with Phase 11 **uncommitted** (Dylan decides when to branch and
commit; the team opens and merges the PR, D-032).
**Current phase:** Phase 11 — Material requests (built; waiting for Codex's QA run)
**Overall:** 12 / 14 phases built (Phases 12 and 13 are in `material-requests.md`)

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
- [x] 10. Operations reports
- [x] 11. Material requests: naming, remarks, urgency, specific messages (QA pending)
- [ ] 12. Item-level decisions guided by stock
- [ ] 13. Ordering, delivery with proof, and the remaining gaps

## What works right now

- **Database:** 7 migrations (the latest is `material_requests_remarks_urgency`). UUIDv7 ids
  (D-018).
- **Bootstrap on start** (D-017):
  - reference data and the first System Admin;
  - demo users and inventory when `SEED_DEMO_USERS=true`. The demo constructor is a designated
    leather-roll requester.
- **Demo week** (D-026): `SEED_DEMO_WEEK=true` or `npm run demo:seed`.
  - 14 batches and about 290 scans, two left for review;
  - five purchase requests, one in each state.
- **Sign-in & access** (D-016, D-024, D-025, D-031):
  - 12-hour sessions, lockout, a role × permission matrix, and server-side sign-out;
  - the leather-roll flag is read fresh on every request.
- **Modules:**
  - batches (D-019) and the camera with the decision engine (D-011, D-020);
  - **flagged scans are decided by the Quality Inspector only** (D-028, team-confirmed). The FM
    sees them read-only;
  - rework & salvage (D-021, D-022), the inventory ledger (D-023), admin (D-024), reports (D-025).
- **Material requests / Procurement** (D-029, D-031, D-035 to D-037):
  - constructors see "Material requests", the FM and Admin "Procurement" (one label map);
  - every Shoe Constructor sends requests (1–10 items, with the stock snapshot, a required
    needed-by date and an optional first remark); **leather rolls** only by constructors the FM
    or Admin allows, also when typed;
  - urgency (High / Medium / Low) is worked out from the needed-by date by working days, shown
    as a badge, sorted and filterable; closed requests have none;
  - the FM approves, rejects with a reason, or marks them received, which posts stock IN through
    the ledger;
  - every request has a timeline and remarks;
  - the FM home card, an Inventory "Requested" badge and "My requests" on the constructor home;
  - who may request leather rolls is chosen by the FM (Procurement tab) or the Admin (Users).
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`.
- **Form messages** (D-038): every message names the field and the fix; errors sit under their
  field, focus goes to the first invalid one, and a summary shows at 3 or more.
- **Quality:**
  - 435 unit tests pass. 67 e2e tests exist, with axe (WCAG 2.1 A/AA) on every page of every
    role; the e2e run for Phase 11 is Codex's (`qa/handoffs/`), not yet reported;
  - ui-craft audit in `docs/UI_AUDIT.md`, now with a Phase 9 section;
  - CI checks the Docker stack with the demo week.

## Next step (exact)

1. Codex tests Phase 11: paste `qa/CODEX_PROMPT.md` into Codex (VS Code, this folder). It reads
   `qa/handoffs/2026-10-11-phase-11-material-requests.md` and writes its report in `qa/reports/`.
2. Claude reads the newest report and fixes what failed, after Dylan approves.
3. When the report says PASS, Dylan decides on the branch and commit. Run the Docker demo-week
   check before the PR, because the seed changed.
4. Then Phase 12. Paste into Claude Code:

> Read `material-requests.md` and run Phase 12. Check `qa/reports/` first. Start in plan mode and
> stop for my approval before writing code.

Later:

- Apply CPoint's answers to the open questions below.
- Plug in the real YOLO service. Its classes are data (Settings → Defect types).
- Component tracking, once CPoint gives the component counts per shoe type.
- Optional for procurement: CSV export and monthly counts by status and category (never per
  person).

## Blockers

- None for the demo.

## Open questions / assumptions awaiting client confirmation

- Decided (D-028, team-confirmed 2026-10-05): only the QI resolves flagged (NEEDS_REVIEW) scans;
  the FM can't. This differs from survey Q5 ("whoever is available"), so tell CPoint. If no QI is
  on shift, flagged scans wait.
- Decided (D-031, team, 2026-10-05; survey Q14): every constructor can request materials, and only
  the allowed one(s), usually whoever orders leather, can request leather rolls. The FM approves
  all requests.
- Decided (D-011, team-confirmed): for all defect types, ≥ 90% → REJECT, 60–89% → REWORK, below
  60% → PASS, and an unknown class key → NEEDS_REVIEW. Still to confirm with CPoint.
- ASSUMPTION: one scan = one leather section of the roll; reworked sections aren't re-scanned.
- ASSUMPTION: the sign-in lockout (5 tries / 15 minutes) and the 12-hour session suit factory
  shifts. Confirm the shift length.
- Decided (D-021/D-022, team-confirmed): salvage reused in a batch is shown separately, and a
  batch can be completed with repairs open ("In repair"). Still to confirm with CPoint.
- ASSUMPTION (D-029): a request is received as a whole (no partial deliveries), and requests
  aren't edited after they're sent (cancel and resend). Phase 13 adds partial deliveries.
- ASSUMPTION (D-037, team 2026-10-10): urgency bands are High 0–3 working days or overdue,
  Medium 4–7, Low 8 or more; working days are Monday to Friday; holidays aren't skipped. Confirm
  all three with CPoint (does the factory work Saturdays?).
- Open (survey Q14): who orders leather rolls. Matters for Phase 13's ordering step.
- ASSUMPTION (D-026): the demo week's stage times match the survey.
- Unknown: components per shoe type. Blocks component tracking only.
- Pending: the new YOLO training photos will change the defect classes. They arrive as
  "unknown", go to the QI's review queue, and are added under Settings → Defect types.

## Known test observations

- Fixed: full e2e runs crashed Chromium late in the run, because helper pages were never closed.
  They're closed now; three local and two Docker full runs since passed 64/64.
- The single admin sign-in timeout seen once earlier was probably the same resource exhaustion. It
  hasn't recurred since the fix. Watch CI.

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
