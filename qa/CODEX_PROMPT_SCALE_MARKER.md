# Prompt for Codex: the scale marker card, run 1 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 5104e29), Docker Desktop
running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Capture's tap calibration is replaced by a printed marker
card (D-120): Capture reads an ArUco card (4x4_50 id 0, a 2.00 in square) on every shot, stays off
without it, and ignores defect boxes on the card. Handoff: `qa/handoffs/2026-11-04-scale-marker.md`.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Use one new roll for S1 to S10 and finish it; remove nothing.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md). Use the **USB
  camera** on Capture; close any other app holding it first. In PowerShell pass test paths as
  plain arguments.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-04-scale-marker-run1/`. Run `npm install` (new
   package `js-aruco2`), start the database container and `npm run dev`;
   `$env:E2E_BASE_URL="http://localhost:3000"`.
2. Walk S1 to S12 and A1 to A2 from the handoff with the printed card; screenshot S1, S3, S5, S9.
   Write both numbers for S6.
3. Targeted:
   `npx playwright test tests/e2e/capture.spec.ts tests/e2e/returns.spec.ts tests/e2e/cv.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun
   that spec alone once and report both results.
4. Ledger check (should be 0):
   `select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`

## Write the report

Save `qa/reports/2026-11-04-scale-marker-run1.md` from `qa/templates/report.md`. **PASS** if every
High scenario passes, every other e2e failure is a timeout that passed alone, and the ledger is 0.
Add one line under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`)
linking `[[CPoint-PMS/qa/CODEX_PROMPT_SCALE_MARKER]]` and the report. Reply with the verdict, the
e2e counts (passed, failed, skipped) and the report path.
