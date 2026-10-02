# Project Status

> Living snapshot. **Overwrite** it to stay current; history goes in `SESSION_LOG.md`.
> Updated at the end of every Claude Code session via `/wrap-up`.

**Last updated:** 2026-10-02
**Branch:** `system-rebuild` (not created yet; Phase 0 creates it)
**Current phase:** Phase 0 — Foundation (not started)
**Overall:** 0 / 9 phases complete

## Phase progress
- [ ] 0. Foundation: branch, DESIGN.md, remove Laravel, scaffold, Docker, CI
- [ ] 1. Data & auth
- [ ] 2. Batches & stages
- [ ] 3. CV skeleton (ingestion API, decision engine, simulator, review queue, camera placeholder)
- [ ] 4. Rework & salvage
- [ ] 5. Inventory
- [ ] 6. Admin
- [ ] 7. Dashboards & reports
- [ ] 8. Hardening & demo

## What works right now
- Legacy Laravel 12 + MySQL system (on `main`). It's still the reference for features. It will be
  removed from `system-rebuild` in Phase 0.

## Next step (exact)
Start Phase 0. Paste into Claude Code:
> Read `docs/prompts/system-rebuild.md` and run Phase 0 from `docs/ROADMAP.md`.

## Blockers
- None.

## Open questions / assumptions awaiting client confirmation
- ASSUMPTION: one scan = one leather section of the roll; reworked sections aren't re-scanned.
- Decided (D-011): for all defect types, ≥90% → REJECT and 60–89% → REWORK. Confirm with the client.
- ASSUMPTION: below 60% → PASS; an unknown class key → NEEDS_REVIEW.
- Unknown: number of components per shoe type (school shoe, topsider). Blocks component tracking only.
- Unknown: what the Shoe Constructor role should see. It's a placeholder for now.
- Pending: the new YOLO training photos will change the defect classes. The system treats classes
  as data, so no code change should be needed.

## Environment notes
- Timezone: `Asia/Manila` (stored in UTC).
- Demo camera: phone/webcam (not built yet; the simulator stands in).
