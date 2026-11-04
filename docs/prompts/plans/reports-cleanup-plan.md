# Plan: simpler Floor Manager reports (rolls returned to supplier)

Status: **approved 4 Nov (Dylan: the system flags a roll over 10% of its area as Returned to supplier); built, Codex run 1 next**. Asked 4 Nov 2026 (five changes to Reports). One feature, one
session. Decision to change: **D-112** ("Too many defects is information only") → new **D-116**.

## My reading of the five asks

1. **Reports → Rolls, Status filter:** three choices plus "All statuses":
   - **Not yet scanned**: a roll in stock (`IN_STOCK`).
   - **Scanning passed**: scanned at Capture and at or under the defect limit (`FINISHED`/old
     `USED`, not over the limit, or an old Keep).
   - **Returned to supplier**: scanned and over the defect limit (the "Too many defects" mark set
     at Finish roll), plus old Phase 30C rolls already `RETURNED`.
   - Rolls being scanned or removed show only under All statuses. The Status badge in each row
     uses the same words (plus Being scanned and Removed), and the "Too many defects" badge goes,
     since the status now says it.
2. **"for salvage" goes**: every report reads just **Rejected** / **Reject** (Rolls table and roll
   page, Quality tiles, chart legend and table, Operations tiles and Supplier quality, the
   Operations "For salvage" card renamed **Rejected sections**, the FM home's Rolls today card,
   the item's roll list in Inventory, and the CSV headers). Outside Reports, the same wording on
   Capture ("Set aside for salvage" → "Set aside to return to the supplier"), a scan's page and
   the Settings hint, so the app says one thing.
3. **Reports → Materials:** remove the **8 weeks to selected** column (the small trend bars).
4. **Reports → Materials → Leather rolls:** add a **Returned to supplier** column per week (rolls
   finished at Capture that week that went over the limit), between "Rolls checked by the
   camera" and "Pairs finished".
5. **Reports → Materials:** remove **Per 100 pairs** from the table and **Used per 100 pairs**
   from `materials-used.csv`; the card's note keeps only how Days left is worked out.
   Supplier quality's "Too many defects" column is renamed **Returned to supplier**.

## Files (Reports only where possible)

- Rolls: `reports/rolls/page.tsx`, `roll-filters.tsx`, `reports/rolls/[id]/page.tsx`,
  `components/features/rolls/{roll-status-badge,defect-share,roll-findings}.tsx`,
  `lib/domain.ts` (report status labels), `lib/roll-rules.ts`, `server/validators/roll.validator.ts`
  (the three filter values), and the `where` of `listRolls` in `server/models/roll.model.ts`.
- Wording: `reports/page.tsx`, `_components/{quality-view,operations-view,ops-sections}.tsx`,
  `components/features/charts/{verdict-legend,verdict-trend-chart}.tsx`,
  `components/features/reports/home-cards.tsx`, `inventory/[id]/page.tsx`, `lib/ops-rules.ts`,
  `lib/capture-rules.ts`, `camera/capture/last-scan.tsx`, `scans/[id]/page.tsx`,
  `admin/settings/page.tsx`, `server/services/{ops-report,report}.service.ts` (CSV headers).
- Materials: `reports/materials/page.tsx`, `server/services/materials.service.ts`,
  `server/models/materials.model.ts` (returned-by-day query), `lib/stock-rules.ts`
  (`perHundredPairs` removed if nothing else uses it).
- Tests: unit (`capture-rules`, `ops-report.service`, `report.service`, `materials.service`,
  `stock-rules`, roll rules/validator) and e2e (`rolls`, `reports`, `smoke`, `inventory`).
- Docs: `docs/API.md` (CSV columns, `?status=` values), STATUS, SESSION_LOG, DECISIONS (D-116),
  ROADMAP; QA handoff + Codex prompt; vault Daily note and a short summary note.

**Overlap with 30E-2 (uncommitted in the same folder):** only `roll.model.ts` (one `where` clause)
and possibly `demo-seed`/docs. I'll make small in-place edits to the current files, not rewrites,
and list the shared files separately when the git commands come.

## Old links and API

`?status=FINISHED` style links stop matching; the filter takes `NOT_SCANNED`, `PASSED` and
`RETURNED` (anything else shows all). No migration, no schema change: "Returned to supplier" is
worked out from the existing mark, so nothing is stored differently.

## New decision (D-116, replaces part of D-112)

A roll over the defect limit at Finish roll is reported as **Returned to supplier**, and a
rejected section means the leather goes back to the supplier (no salvage). Still no Send back or
Keep button: the system records it, the FM sends it back.

## Checks

`npm run check` only (lint, typecheck, unit tests, build). E2E and browser checks by Codex.
