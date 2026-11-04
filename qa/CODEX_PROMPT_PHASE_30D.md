# Prompt for Codex: Phase 30D, roll counts, run 1 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main a97d949), Docker Desktop
running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Phase 30D (D-118) adds a counter on Capture ("Leather rolls
scanned 3/15" for today and the next planned days), counts leather on Reports → Materials by the
camera's result (Rolls used = checked − returned, Removed (other), working days per week) and adds
returned rolls to the planning calendar. Handoff: `qa/handoffs/2026-11-04-phase-30d-roll-counts.md`.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Write down today's plan before S1 to S3 and put it back at the end; remove
  nothing but the one roll S10 asks for.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md). In PowerShell pass
  test paths as plain arguments.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-04-phase-30d-run1/`. Start the database container
   and `npm run dev`; `$env:E2E_BASE_URL="http://localhost:3000"`.
2. Walk S1 to S13 and A1 to A3 from the handoff; screenshot S1, S6, S8.
3. Targeted:
   `npx playwright test tests/e2e/capture.spec.ts tests/e2e/inventory.spec.ts tests/e2e/batches.spec.ts tests/e2e/smoke.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun
   that spec alone once and report both results.
4. Ledger check (should be 0):
   `select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`

## Write the report

Save `qa/reports/2026-11-04-phase-30d-run1.md` from `qa/templates/report.md`. **PASS** if every
High scenario passes, every other e2e failure is a timeout that passed alone, and the ledger is 0.
Add one line under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`)
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30D]]` and the report. Reply with the verdict, the
e2e counts (passed, failed, skipped) and the report path.
