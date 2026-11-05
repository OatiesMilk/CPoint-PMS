# Prompt for Codex: the scale marker card, run 3 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 5104e29), Docker Desktop
running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS, scale marker card (D-120), run 3. Run 2
(`qa/reports/2026-11-04-scale-marker-run2.md`) failed on F1: the **Capture button** said "Show the
marker card to capture" while the preview showed the card. The fix: a press now tries up to 8
frames (about half a second) and sends the first with the card, and each frame is read at 960 and
then 640 px. Handoff: `qa/handoffs/2026-11-04-scale-marker.md`.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Use one roll in stock and finish it in S10; remove nothing.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md), with the **USB
  camera** and the printed card flat on leather. Restart `npm run dev` first so the new code loads.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-04-scale-marker-run3/`;
   `$env:E2E_BASE_URL="http://localhost:3000"`.
2. S3 and S4 with the **Capture button** (not Floor view): press it **5 times** with the card flat
   in view, and write how many presses saved a shot (all 5 should). Then S5, S7, S9 and S10.
   Screenshot S4 and S5. S6 only if Dylan gives a ruler reading of the width across the picture
   (not the camera height); otherwise BLOCKED with the app's number.
3. Targeted:
   `npx playwright test tests/e2e/capture.spec.ts tests/e2e/capture-no-card.spec.ts tests/e2e/returns.spec.ts tests/e2e/cv.spec.ts`,
   then the full suite `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun
   that spec alone once and report both results.
4. Ledger check (should be 0), as in run 1.

## Write the report

Save `qa/reports/2026-11-04-scale-marker-run3.md` from `qa/templates/report.md`. **PASS** if every
High scenario passes (S4: 5 of 5 presses saved), every other e2e failure is a timeout that passed
alone, and the ledger is 0. Add one line under "Agent sessions" in today's Daily note
(`C:\dev\capstone-obsidian\Daily\`) linking `[[CPoint-PMS/qa/CODEX_PROMPT_SCALE_MARKER_RUN3]]` and
the report. Reply with the verdict, the e2e counts (passed, failed, skipped) and the report path.
