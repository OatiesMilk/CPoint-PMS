# Prompt for Codex: the scale marker card, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 5104e29), Docker Desktop
running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS, scale marker card (D-120), run 2. Run 1
(`qa/reports/2026-11-04-scale-marker-run1.md`) failed on F1 (Capture enabled but the press said
"Show the marker card to capture" and saved no shot) and F2 (Playwright stopped collecting
`capture.spec.ts`). Both are fixed: the press now reads the card at the same 960 px size as the
live check, and the no-card test is in its own file `tests/e2e/capture-no-card.spec.ts`.
Handoff: `qa/handoffs/2026-11-04-scale-marker.md` (S8's expected result was corrected).

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Use one roll in stock for the scenarios and finish it in S10; remove nothing.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md), with the **USB
  camera** and the printed card on leather. Restart `npm run dev` first so the new code loads.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-04-scale-marker-run2/`;
   `$env:E2E_BASE_URL="http://localhost:3000"`.
2. Walk S3, S4, S5, S7, S8, S9 and S10 from the handoff; screenshot S4, S5 and S9. S6: if no ruler
   reading is possible, mark it BLOCKED and give the app's number.
3. Targeted:
   `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/returns.spec.ts tests/e2e/cv.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun
   that spec alone once and report both results.
4. Ledger check (should be 0), as in run 1.

## Write the report

Save `qa/reports/2026-11-04-scale-marker-run2.md` from `qa/templates/report.md`. **PASS** if every
High scenario passes, every other e2e failure is a timeout that passed alone, and the ledger is 0.
Add one line under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`)
linking `[[CPoint-PMS/qa/CODEX_PROMPT_SCALE_MARKER_RUN2]]` and the report. Reply with the verdict,
the e2e counts (passed, failed, skipped) and the report path.
