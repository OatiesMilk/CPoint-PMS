# Prompt for Codex: demo clock, run 1 (paste everything below the line)

Run Codex on the machine with the change (Dylan's PC or laptop), Docker Desktop running for the
database only, `npm run db:deploy` done (the `demo_clock` migration), Dylan's `npm run dev` on
http://localhost:3000 with `DEMO_LOGIN_TOOLS=true`.

---

You are the QA tester for CPoint-PMS: the demo clock (D-125). Handoff:
`qa/handoffs/2026-11-09-demo-clock.md`.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env` (C11 only: say what the 404 check showed; ask Dylan before touching
  `.env`, or skip C11 and report it skipped). Create files only under `qa/reports/`.
- Use the in-app browser; if it is unavailable, a headless Playwright script of your own with the
  demo sign-in buttons. Say which tool ran each scenario.
- Leave the clock on **Back to real time** when you finish, then Reset demo data once.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`) if this machine has it.
2. Run C1 to C12 from the handoff. Quote the band's exact text for C1, C4 and C10.
3. Write `qa/reports/2026-11-09-demo-clock-run1.md` (or today's date) from
   `qa/templates/report.md` (PASS, PASS WITH ISSUES or FAIL), and add one line under "Agent
   sessions" in the vault's `Daily/` note for today if the vault is here.
