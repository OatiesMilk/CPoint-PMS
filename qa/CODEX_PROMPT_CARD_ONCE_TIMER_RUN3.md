# Prompt for Codex: the card once per roll and the scanning timer, run 3 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 1793138), Docker Desktop
running for the database only, **after 01:00 Manila time**. Copy from the line down.

---

You are the QA tester for CPoint-PMS, D-121, run 3. Run 2
(`qa/reports/2026-11-05-card-once-timer-run2.md`) passed R1 to R4 by hand. Its one failure was
the e2e test "after the roll's first shot with the card, Capture works without it (D-121)": it
sent card corners made for a 64 × 48 photo on the fake camera's wider picture, so the card read
as tilted (422). The test now draws a square card for the picture's own size. No app code changed,
so no manual checks this run.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-05-card-once-timer-run3/`; `npm run dev` running;
   `$env:E2E_BASE_URL="http://localhost:3000"`.
2. `npx playwright test tests/e2e/capture-no-card.spec.ts --workers=1`, then the targeted
   `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/rolls.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun
   that spec alone once and report both results.
3. Ledger check (should be 0), as in run 1.

## Write the report

Save `qa/reports/2026-11-05-card-once-timer-run3.md` from `qa/templates/report.md`. **PASS** if
`capture-no-card.spec.ts` passes, every other e2e failure is a timeout that passed alone, and the
ledger is 0. Add one line under "Agent sessions" in today's Daily note
(`C:\dev\capstone-obsidian\Daily\`) linking `[[CPoint-PMS/qa/CODEX_PROMPT_CARD_ONCE_TIMER_RUN3]]`
and the report. Reply with the verdict, the e2e counts (passed, failed, skipped) and the report path.
