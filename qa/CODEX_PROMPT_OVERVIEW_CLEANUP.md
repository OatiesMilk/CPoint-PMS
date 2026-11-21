# Prompt for Codex: Overview clean-up (the Floor Manager's home), run 1 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only,
`npm install` done. Any day works; the scenarios say when they need the demo clock.

---

You are the QA tester for CPoint-PMS: the Overview clean-up (D-131), a layout change to the Floor
Manager's home page and the plan banner. Handoff: `qa/handoffs/2026-11-21-overview-cleanup.md`.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` (the report and its artifacts) and your
  line in the vault's Daily note. The demo clock and Attendance may be changed for a scenario and must be
  put back (Back to real time; the Quality Inspector present again).
- Use the in-app browser at http://localhost:3000 for the manual scenarios so Dylan sees them;
  headless Playwright only for the e2e runs. Say which tool ran each scenario. Don't open or leave visible
  Chrome windows.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"` before Playwright, `--workers=2`. A first-compile
  timeout or `ECONNRESET`: rerun that spec alone once and report both results; never change a timeout.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note).
2. Setup, in a PowerShell terminal at `C:\dev\CPoint-PMS`:
   1. `docker compose stop app`, and stop any other project's server on port 3000 and any older
      `npm run dev` of this project (the new layout must be served by a fresh dev server).
   2. `npm run db:up`, `npm run db:deploy` (no new migration; save the output).
   3. `npm run dev`, then check `http://localhost:3000/api/health`.
   4. `npm run demo:reset '--' --yes` (2 to 3 minutes).
3. Run O1 to O9 and A1 from the handoff. For O1, O3 and O5 use the demo clock (Demo mode band → Change
   time) as the handoff says. Take screenshots of O1, O2 and O4 (1280 px, light) into
   `qa/reports/artifacts/2026-11-21-overview-cleanup/`. Quote the exact on-screen text for every line the
   handoff quotes. For O9 run the six specs listed in the handoff, then the full suite with `--workers=2`.
4. Write `qa/reports/2026-11-21-overview-cleanup-run1.md` (or today's date) from `qa/templates/report.md`,
   even on a full pass: PASS, PASS WITH ISSUES or FAIL, a table of every scenario, the e2e counts, and
   each failure with steps, expected, actual and a screenshot or log. Change no code: anything that
   fails goes in the report for Claude to fix. Leave the demo clock on Real time.
5. Add one line under "Agent sessions" in the vault's `Daily/` note for today linking this prompt, the
   handoff and the report as `[[CPoint-PMS/qa/…]]`.
