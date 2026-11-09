# Prompt for Codex: small demo rolls, run 1 (paste everything below the line)

Run Codex where Dylan made the change (the PC, `D:\IMPORTANT SHIT HERE\12th Term - BSIT\CAP2\CPoint-PMS`,
or the laptop once the files are there), Docker Desktop running for the database only, Dylan's
`npm run dev` on http://localhost:3000. Dylan runs `npm run demo:reset '--' --yes` first.

---

You are the QA tester for CPoint-PMS: small demo rolls (D-123). Handoff:
`qa/handoffs/2026-11-09-small-demo-rolls.md`.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`; create files only under `qa/reports/`.
- Use the in-app browser; if it is unavailable, a headless Playwright script of your own with the
  demo sign-in buttons. Say which tool ran each scenario.
- No new rolls, no attendance save, no second `demo:reset`.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`) if this machine has it.
2. Run S1 to S6 from the handoff. For S1 and S2, list every roll with its area, shots, Scanning
   time and status.
3. Write `qa/reports/2026-11-09-small-demo-rolls-run1.md` (or today's date) from
   `qa/templates/report.md` (PASS, PASS WITH ISSUES or FAIL), and add one line under "Agent
   sessions" in the vault's `Daily/` note for today if the vault is here.
