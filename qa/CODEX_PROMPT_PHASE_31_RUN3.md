# Prompt for Codex: Phase 31, run 3 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted Phase 31 docs), Docker Desktop
running for the database only, Dylan's `npm run dev` on http://localhost:3000. Any day; D4 needs a
weekday with today planned (mark it blocked otherwise). Then copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 31, run 3. Handoff:
`qa/handoffs/2026-11-07-phase-31-docs.md`. Run 2 (`qa/reports/2026-11-07-phase-31-run2.md`)
passed D1, D3, D7, D8 and D9, failed D2, D5 and D6 on wording, and blocked D4 (Saturday).

What Claude changed since run 2 (docs only):

- **F1 (D2), README "1. Floor Manager":** the Attendance card quotes "Not taken yet today."; the
  roll statuses are Not yet scanned, Being scanned, Scanning passed, Returned to supplier,
  Removed; the attendance summary reads "N of M Shoe Constructors present" (the demo roster has
  13); **High** shows on a supplier with at least 5 rolls whose returned share is at least 10
  points above the whole line's (the demo suppliers have fewer, so none shows it); the Recent days
  sentence is marked as an example.
- **F2 (D5), README "4. System Admin":** the cut's row reads "OK under 3 in, rejected from 3 in"
  and "1% each, from 3 in".
- **F3 (D6), STATION_SETUP steps 3 and 4:** "N in across", where N depends on the phone's height
  (the e2e fake camera gives 16.0 in).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`; create files only under `qa/reports/` (artifacts in
  `qa/reports/artifacts/2026-11-07-phase-31-run3/`).
- If the in-app browser is unavailable, use a headless Playwright script of your own (Playwright's
  own Chromium, headless; don't open Chrome windows) with the demo sign-in buttons. Say which tool
  ran each scenario.
- No `demo:reset`, no new rolls. Don't save attendance again: read today's saved summary on
  Attendance (run 2 saved 11 of 13). For D6 use a waiting roll with no shots (for example
  LR-MT-006), then **Put roll back**. Leave LR-MLT-004 alone.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the Phase 31 note).
2. Rerun D2, D5 and D6 against the new README and STATION_SETUP lines; D4 only on a weekday with
   today planned. D1, D3, D7, D8 and D9 passed in run 2: no rerun. For each wording difference,
   quote the doc line (file and line) and the app's text side by side.
3. Write `qa/reports/2026-11-07-phase-31-run3.md` from `qa/templates/report.md` (PASS, PASS WITH
   ISSUES or FAIL), and add one line under "Agent sessions" in the vault's `Daily/` note for today.
