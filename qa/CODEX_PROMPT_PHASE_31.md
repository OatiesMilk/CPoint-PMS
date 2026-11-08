# Prompt for Codex: Phase 31, run 1 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted Phase 31 docs), Docker Desktop
running for the database only, Dylan's `npm run dev` on http://localhost:3000. Any day; D4 needs a
weekday with today planned (mark it blocked otherwise). Then copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 31, run 1: the documentation now describes the system
as built. Handoff: `qa/handoffs/2026-11-07-phase-31-docs.md`. Only docs changed (plus one Python
docstring), so check that each doc says what the app does.

Claude ran `npm run check` (708 unit tests, build OK) and the `cv/` checks (ruff, mypy, pytest
102). Claude ran no browser or e2e test.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`; create files only under `qa/reports/`.
- No `demo:reset`. Finish or put back any roll you start, and say which.
- Manual checks in your in-app browser at http://localhost:3000; the fake camera through a headless
  Playwright script of your own with `tests/e2e/fixtures/marker-card.y4m` if the in-app browser has
  no camera. Don't open Chrome windows.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the Phase 31 note).
2. Run D1 to D9 from the handoff. For each wording difference, quote the doc line and the app's
   text side by side.
3. Write `qa/reports/2026-11-07-phase-31-run1.md` from `qa/templates/report.md` (PASS, PASS WITH
   ISSUES or FAIL; each finding with the file and line to fix), and add one line under "Agent
   sessions" in the vault's `Daily/` note for today.
