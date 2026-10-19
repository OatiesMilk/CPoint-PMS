# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-19
**Branch:** `main` @ `63138dc` (the follow-ups D-046 and D-047 merged as PR #7). Phase 14 is on the
`main` checkout, uncommitted (Dylan decides when to branch and commit; the team opens and merges
the PR, D-032).
**Current phase:** Phase 14, camera YOLO model intake and inference core (done; baseline on five
sample photos in `cv/MODEL_CARD.md`). Next: Phase 15, the camera station.
**Overall:** 15 / 17 phases built (Phases 15 and 16 of `camera-yolo-integration.md` remain)

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
- [x] 11. Material requests: naming, remarks, urgency, specific messages
- [x] 12. Item-level decisions guided by stock
- [x] 13. Ordering, delivery with proof, and the remaining gaps
- [x] 14. Camera YOLO model: intake and the inference core
- [ ] 15. Camera station: capture, send, recover
- [ ] 16. Camera page, evaluation and the demo

## What works right now

- **Database:** 11 migrations (the latest is `material_request_codes_legacy`, data only: PR- numbers become MR-, D-046). UUIDv7 ids (D-018).
- **Bootstrap on start** (D-017):
  - reference data and the first System Admin;
  - demo users and inventory when `SEED_DEMO_USERS=true`. The demo constructor is a designated
    leather-roll requester.
- **Demo week** (D-026): `SEED_DEMO_WEEK=true` or `npm run demo:seed`.
  - 14 batches and about 290 scans, two left for review;
  - nine purchase requests covering every state: received with proof, partly received (a photo
    and a PDF), ordered and late, ordered by the Floor Manager, approved in part and waiting to
    be ordered, pending (High), rejected, cancelled by the requester, and cancelled after
    ordering. Proof files are generated samples.
- **Sign-in & access** (D-016, D-024, D-025, D-031):
  - 12-hour sessions, lockout, a role × permission matrix, and server-side sign-out;
  - the leather-roll flag is read fresh on every request.
- **Modules:**
  - batches (D-019) and the camera with the decision engine (D-011, D-020);
  - **flagged scans are decided by the Quality Inspector only** (D-028, team-confirmed). The FM
    sees them read-only;
  - rework & salvage (D-021, D-022), the inventory ledger (D-023), admin (D-024), reports (D-025).
- **Material requests / Procurement** (D-029, D-031, D-035 to D-045):
  - constructors see "Material requests", the FM and Admin "Procurement" (one label map);
  - every Shoe Constructor sends requests (1–10 items, with the stock snapshot, a required
    needed-by date and an optional first remark); **leather rolls** only by constructors the FM
    or Admin allows, also when typed;
  - urgency (High / Medium / Low) is worked out from the needed-by date by working days, shown
    as a badge, sorted and filterable; closed requests have none;
  - the FM approves or rejects **each item** (a reason for every rejection), saved together; the
    request is approved if at least one item is, rejected if every item is (D-039);
  - each item shows the stock now and when requested; an item above 2× its reorder level is
    flagged "Still in stock" and starts on Reject, a low one on Approve; the FM confirms every
    item (D-040);
  - the requester sees "1 of 2 items approved" and the reason on each rejected item;
  - the FM marks an approved request **as ordered**: a supplier from Settings, an optional
    reference, a required expected date; one order per request; nothing is sent to the supplier
    (D-041);
  - an ordered or partly received request past its expected date shows **Delivery late** (badge,
    filter, home card);
  - **Record delivery** takes a quantity per approved item (never more than outstanding), the
    delivery date and at least one **proof file** (JPEG, PNG, WebP or PDF, checked by its bytes,
    10 MB each); what arrived is posted as stock IN through the ledger; a short delivery leaves
    the request **Partly received** (D-042);
  - **Close short** ends a partly received request with a reason and keeps what never arrived;
  - proof files are private (FM, Admin, the requester on their own request) and never deleted;
  - the FM cancels an approved or ordered request **with a reason** until something arrives
    (D-043);
  - **Copy to a new request** on your own rejected or cancelled request; rejected items start
    unticked with their reasons (D-044);
  - the FM raises a request themselves (Procurement → New, or **Request** on a low inventory
    item), marked "Raised by Floor Manager", and approves it (D-045);
  - every request has a timeline and remarks;
  - the FM home card (to decide, to order, late), an Inventory "Requested" badge and "My
    requests" on the constructor home;
  - who may request leather rolls is chosen by the FM (Procurement tab) or the Admin (Users).
- **Camera station (Phase 14, D-048, D-049):** the `cpoint_cv` Python package in `cv/` runs
  `yolo-v1.pt` (`cv/models/`, git-ignored, SHA-256 in `cv/MODEL_CARD.md`) and prints detections,
  `modelVersion` (`yolo-v1-1d729fb0`), time and a preview verdict: `python -m cpoint_cv predict
<folder>`. About 255 ms per image on Dylan's RTX 3060 and 780 ms on the CPU at `imgsz` 1536. It
  posts nothing yet; the app is unchanged.
- **Audit pattern:** every mutation runs `runInTransaction` + `recordAudit(tx, …)`.
- **Pagination** (D-047): every list that can grow pages at 15 rows with one pager; Settings
  and the leather-roll requesters have a Find box.
- **Form messages** (D-038): every message names the field and the fix; errors sit under their
  field, focus goes to the first invalid one, and a summary shows at 3 or more.
- **Quality:**
  - 502 unit tests pass (Vitest), plus 56 station tests (pytest, no torch needed). 75 e2e tests exist, with axe (WCAG 2.1 A/AA) on every page of every
    role and on the new procurement screens;
  - Phase 14 (Codex, 2026-10-19, runs 1–2): 9 of 10 scenarios passed, including the camera e2e
    spec 8/8 and the contract test. The one failure (S6) was a wrong step in the handoff, now fixed;
    S6 itself is not re-run. The missing-model message now names the config file and its folder;
  - Phase 13 in a browser (Codex, 2026-10-14): run 1 passed 47 of 54 manual checks, with one
    app fault (a chosen proof file could disappear) and six blocked. Run 2, after the fix, passed
    13 of 13, covering the fix and the six blocked scenarios. No known app fault remains;
  - Phase 13 e2e (Codex run 5, 2026-10-14): three parallel runs of 45: 44/1, 45/0, 45/0. The
    one failure was the full request-to-delivery test running past 30 s under load; it now has
    60 s (not re-run; CI runs it on the PR). The earlier colour-contrast and connection-reset
    findings were test and test-server issues and are fixed;
  - Docker demo-week check passed on 2026-10-14 (throwaway stack): 9 requests across every
    state, proof files on the uploads volume, stock equals the ledger, no second seed on restart;
  - ui-craft audit in `docs/UI_AUDIT.md`, now with a Phase 9 section;
  - CI checks the Docker stack with the demo week.

## Next step (exact)

1. Dylan: confirm whether the five photos in `Sample Photos (CAP2)` were left out of training, and
   collect a larger held-out set (with the expected verdict per photo) for Phase 16's evaluation.
2. Dylan: create a branch, commit and push Phase 14 and open the PR (D-032). Delete the untracked
   `phase-14-plan.md` in the root when done with it.
3. Codex: optional re-run of S5 and S6 only (`qa/handoffs/2026-10-19-phase-14-cv-core.md`).
4. Next session: Phase 15 of `camera-yolo-integration.md` (the camera station).

Later:

- Apply CPoint's answers to the open questions below.
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
- Decided (D-041, D-042, D-045; Dylan 2026-10-13): one order per request; a proof file is
  required for every delivery; the Floor Manager may approve their own request. Tell CPoint, and
  confirm a receipt or delivery note is always on hand when goods arrive.
- ASSUMPTION (D-029, D-044): requests aren't edited after they're sent (cancel, then copy to a new
  one); an order isn't edited after it's marked.
- ASSUMPTION (D-041): an expected delivery date can be up to 365 days ahead, and "late" starts the
  day after it, counting calendar days (not working days).
- ASSUMPTION (D-037, team 2026-10-10): urgency bands are High 0–3 working days or overdue,
  Medium 4–7, Low 8 or more; working days are Monday to Friday; holidays aren't skipped. Confirm
  all three with CPoint (does the factory work Saturdays?).
- ASSUMPTION (D-040, team 2026-10-13): an item is "still well stocked" above 2× its reorder
  level, and an item with no reorder level gets no stock guidance. Confirm the factor with CPoint.
- Decided (D-039, team 2026-10-13): the FM decides every item of a request in one save; a request
  can't be left half decided.
- Open (survey Q14): who orders leather rolls. Today only the Floor Manager can mark a request
  as ordered and record deliveries.
- ASSUMPTION (D-026): the demo week's stage times match the survey.
- Unknown: components per shoe type. Blocks component tracking only.
- Open (Phase 15): the model emits `crease`, `cut`, `hole`, `scratch`; the app knows `cut`, `hole`,
  `abrasion`, `dirt`. Until `crease` and `scratch` are added under Settings → Defect types, any scan
  with one goes to review. Decide `abrasion` and `dirt` (keep or deactivate).
- Open (Phase 16): confidence is not severity. D-011 reads the model's confidence as how bad a
  defect is; for yolo-v1 it means how sure it is a defect exists. In the five-photo baseline a
  clear cut scored 0.51 (it would pass alone). Choose the approach in Phase 16, on a larger set.
- Observed (Phase 14): the model sometimes reports one scratch twice with nearly the same box. It
  doesn't change verdicts but inflates per-class counts; consider an overlap filter in Phase 15.
- Decided (D-049, Dylan 2026-10-19): model files stay out of git (`cv/models/`), not Git LFS.
- Pending: the new YOLO training photos will change the defect classes. They arrive as
  "unknown", go to the QI's review queue, and are added under Settings → Defect types.

## Known test observations

- Fixed: full e2e runs crashed Chromium late in the run, because helper pages were never closed.
  They're closed now; three local and two Docker full runs since passed 64/64.
- The single admin sign-in timeout seen once earlier was probably the same resource exhaustion. It
  hasn't recurred since the fix. Watch CI.

## Environment notes

- Timezone: `Asia/Manila` for display; UTC for storage.
- On Dylan's PC another project's Vite server often holds port 3000. Start this app with
  `PORT=3001` then (`npm run dev -- --port` doesn't work here).
- Proof-of-delivery files are stored under `UPLOADS_DIR` (`./storage/uploads/pod/` locally, the
  `uploads` volume in Docker), beside the scan images. Back them up with the database.
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
