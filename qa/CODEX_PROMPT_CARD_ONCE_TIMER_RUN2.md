# Prompt for Codex: the card once per roll and the scanning timer, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 1793138), Docker Desktop
running for the database only, **after 01:00 Manila time**. Copy from the line down.

---

You are the QA tester for CPoint-PMS, D-121, run 2. Run 1
(`qa/reports/2026-11-05-card-once-timer-run1.md`) passed the card once per roll. Fixed since (see
the handoff's "Run 1 fixes", `qa/handoffs/2026-11-05-card-once-per-roll-timer.md`):

- **F1** was a wrong expectation: the timer counts the same day's time after 17:00 too; only the
  night of a roll left open overnight is left out. An evening run's time should match the clock.
- **F2:** the CSV's "Scanning time (min)" always has two decimals.
- E2E: the two no-card tests wait for the sign-in; the capture API role test has 60 s.
- The timer shows "--:--" (not 00:00) until its clock starts.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Add one roll in stock and finish it at the end; remove nothing.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md), USB camera, the
  printed card flat on leather.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-05-card-once-timer-run2/`; restart `npm run dev`
   so it picks up the changes; `$env:E2E_BASE_URL="http://localhost:3000"`.
2. R1 (S1, S3, S5): start the roll and note the clock; first shot with the card, one without.
   Reload: the timer reads "--:--" or the right time, never 00:00, then carries on.
3. R2 (S15): with that roll open and its scale set, at 390 × 844: the scale line, Read the card
   again and the timer fit; no sideways scroll; axe 0 on Capture. Back to the desktop size.
4. R3 (S9): Finish roll and note the clock. The message's "Scanning time" is within about 30 s of
   the clock difference (write both).
5. R4 (S10 to S12): Reports → Rolls shows that time; Download CSV: its "Scanning time (min)" has
   two decimals and matches (mm:ss ÷ 60).
6. Targeted:
   `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/rolls.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun
   that spec alone once and report both results.
7. Ledger check (should be 0), as in run 1.

## Write the report

Save `qa/reports/2026-11-05-card-once-timer-run2.md` from `qa/templates/report.md`. **PASS** if R1
to R4 pass, every other e2e failure is a timeout that passed alone, and the ledger is 0. Add one
line under "Agent sessions" in today's Daily note (`C:\dev\capstone-obsidian\Daily\`) linking
`[[CPoint-PMS/qa/CODEX_PROMPT_CARD_ONCE_TIMER_RUN2]]` and the report. Reply with the verdict, the
e2e counts (passed, failed, skipped) and the report path.
