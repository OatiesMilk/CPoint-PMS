# Prompt for Codex: the scale marker card, run 4 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 5104e29), Docker Desktop
running for the database only, **after 01:00 Manila time**. Copy from the line down.

---

You are the QA tester for CPoint-PMS, scale marker card (D-120), run 4. Run 3
(`qa/reports/2026-11-04-scale-marker-run3.md`) passed every marker scenario (5 of 5 button
presses saved, S6 within 4.0%). Its FAIL came from `batches.spec.ts`, run before 01:00 Manila,
when no batch is due yet (STATUS → Known test observations), and S9's Floor view wording wasn't
read. This run covers only those two. Handoff: `qa/handoffs/2026-11-04-scale-marker.md`.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Use one roll in stock and finish it at the end; remove nothing.
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md), USB camera, the
  printed card flat on leather, with no tape measure in the picture.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-05-scale-marker-run4/`;
   `$env:E2E_BASE_URL="http://localhost:3000"`. Check the Manila time is after 01:00.
2. S9: card in view, **Floor view**, press Space (a shot saves, the band shows its verdict). Take
   the card away and press Space: write the band's exact words (expected "Show the marker card to
   capture.") and that the shot count didn't change. Screenshot it. Leave with Esc, Finish roll.
3. `npx playwright test tests/e2e/batches.spec.ts --workers=1`, then the full suite
   `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun that spec alone once
   and report both results.
4. Ledger check (should be 0), as in run 1.

## Write the report

Save `qa/reports/2026-11-05-scale-marker-run4.md` from `qa/templates/report.md`. **PASS** if S9
shows the message with the count unchanged, `batches.spec.ts` passes, every other e2e failure is a
timeout that passed alone, and the ledger is 0. Add one line under "Agent sessions" in today's
Daily note (`C:\dev\capstone-obsidian\Daily\`) linking
`[[CPoint-PMS/qa/CODEX_PROMPT_SCALE_MARKER_RUN4]]` and the report. Reply with the verdict, the e2e
counts (passed, failed, skipped) and the report path.
