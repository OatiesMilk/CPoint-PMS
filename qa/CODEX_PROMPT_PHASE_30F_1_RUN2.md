# Prompt for Codex: Phase 30F-1, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 120205b), Docker Desktop
running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 30F-1, run 2. Run 1
(`qa/reports/2026-11-06-phase-30f-1-run1.md`) passed 9 of 11. Handoff:
`qa/handoffs/2026-11-06-phase-30f-1.md`.

- **F2 (fixed):** the card link's arrow moved on hover with reduced motion on. It now moves only
  when the browser allows motion (`motion-safe`).
- **F1 (moved to 30F-3, not a 30F-1 fault):** at 390 px the fixed Capture bar covers a different
  slice of the live picture because the page above it is 14 px shorter (the title rule is gone).
  On load the picture is below the bar in both the baseline and run 1. Phase 30F-3 puts the live
  picture above the Capture bar on a phone. Don't re-test it here.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Put back any setting you change (Windows Animation effects included).
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md). Restart
  `npm run dev` first.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-06-phase-30f-1-run2/`.
2. R1 (F2): Windows Animation effects Off (`prefers-reduced-motion: reduce`), FM `/floor-manager`,
   hover Open: the arrow's computed transform stays `none`. Then Animation effects On: hovering
   moves it 2 px. Restore the setting.
3. R2: S3 again (the five card links on `/floor-manager` are muted, darken on hover, open their
   pages).
4. `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --workers=1`. A full suite
   is not needed: run 1 ran it on the same code apart from one class name.

## Write the report

Save `qa/reports/2026-11-06-phase-30f-1-run2.md` from `qa/templates/report.md`. **PASS** if R1, R2
and the two specs pass. Add one line under "Agent sessions" in today's Daily note
(`C:\dev\capstone-obsidian\Daily\`) linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_1_RUN2]]` and
the report. Reply with the verdict, the e2e counts (passed, failed, skipped) and the report path.
