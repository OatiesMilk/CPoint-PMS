# Prompt for Codex: the card once per roll and the scanning timer, run 1 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 1793138), Docker Desktop
running for the database only, **after 01:00 Manila time**. Copy from the line down.

---

You are the QA tester for CPoint-PMS, D-121: the marker card is needed only on a roll's first shot
(the factory cameras are fixed), and each roll gets a scanning timer from Start scanning to Finish
roll with lunch left out, shown on Capture, Finish roll, Reports → Rolls (with the average), the
roll's page and a Rolls CSV. Handoff: `qa/handoffs/2026-11-05-card-once-per-roll-timer.md`.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Add two rolls in stock for S1 to S13; finish the first, put the second back.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md), USB camera, the
  printed card flat on leather.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-05-card-once-timer-run1/`. Start the database
   container and `npm run dev`; `$env:E2E_BASE_URL="http://localhost:3000"`.
2. Walk S1 to S15 and A1 to A2 from the handoff; screenshot S3, S4, S7, S9, S10 and S11. For S9
   write the app's time and the clock difference.
3. Targeted:
   `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/rolls.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun
   that spec alone once and report both results.
4. Ledger check (should be 0):
   `select count(*) from inventory_items i where i."quantityOnHand" <> (select coalesce(sum(m."quantityDelta"),0) from inventory_movements m where m."itemId"=i.id)`

## Write the report

Save `qa/reports/2026-11-05-card-once-timer-run1.md` from `qa/templates/report.md`. **PASS** if
every High scenario passes, every other e2e failure is a timeout that passed alone, and the ledger
is 0. Add one line under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`)
linking `[[CPoint-PMS/qa/CODEX_PROMPT_CARD_ONCE_TIMER]]` and the report. Reply with the verdict,
the e2e counts (passed, failed, skipped) and the report path.
