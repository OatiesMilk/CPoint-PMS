# Prompt for Codex: Phase 31, run 4 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS`, Docker Desktop running for the database only,
Dylan's `npm run dev` on http://localhost:3000. **A weekday with today planned** (Monday or later),
so D4 can run. Then copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 31, run 4. Handoff:
`qa/handoffs/2026-11-07-phase-31-docs.md`. Run 3 (`qa/reports/2026-11-07-phase-31-run3.md`)
passed D5 and D6, failed D2 on one example count, and blocked D4 (Sunday). D1, D3, D7, D8 and D9
passed in run 2.

What Claude changed since run 3 (docs only): README "1. Floor Manager" step 2 now says a past day
shows "a count such as "2 of 3 rolls scanned · 1 returned"" (an example; the counts differ per
day).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`; create files only under `qa/reports/` (artifacts in
  `qa/reports/artifacts/2026-11-09-phase-31-run4/`, or today's date).
- If the in-app browser is unavailable, use a headless Playwright script of your own (Playwright's
  own Chromium, headless; don't open Chrome windows) with the demo sign-in buttons. Say which tool
  ran each scenario.
- No `demo:reset`, no new rolls, no attendance save. If today isn't planned, the Floor Manager
  plans it first on Batches → Plan days (every 4 hours, 08:00 to 17:00) and you say so.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the Phase 31 note).
2. **D2 step 2 only:** README.md's Plan days line against the calendar.
3. **D4:** README "3. Quality Inspector" on a weekday with today planned: the banner 10 minutes
   before a batch ends and at its end, the bell, Finish batch with pairs finished and failed. Quote
   any wording difference (file and line) beside the app's text.
4. Write `qa/reports/<today>-phase-31-run4.md` from `qa/templates/report.md` (PASS, PASS WITH
   ISSUES or FAIL), and add one line under "Agent sessions" in the vault's `Daily/` note for today.
