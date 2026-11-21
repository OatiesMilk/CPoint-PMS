# Prompt for Codex: Phase 35A, reports by period (sort, filter, print), run 1 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only,
`npm install` done. Any day works; the scenarios give deep links so no demo clock is needed.

---

You are the QA tester for CPoint-PMS: Phase 35A (D-132), the Floor Manager's Reports with a period
picker (Day, Week of the month, Month, Custom up to 366 days), sortable tables, filters and a print
layout. Read-only: no migration. Handoff: `qa/handoffs/2026-11-21-phase-35a-reports-by-period.md`.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` (the report and its artifacts) and
  your line in the vault's Daily note. Nothing in this phase writes data; if you reset the demo, say so.
- Use the in-app browser at http://localhost:3000 (the `npm run dev` port) for the scenarios that only
  need a page opened by URL, so Dylan sees them. **Where the in-app browser's fill or click doesn't reach
  the page** (the fault of the Overview clean-up runs 1 and 2), run the step with a headless Playwright
  script or the e2e spec instead and say so. Print and PDF checks are headless
  (`page.emulateMedia({ media: 'print' })`, `page.pdf`). Don't open or leave visible Chrome windows.
- E2E: `$env:E2E_BASE_URL="http://localhost:3000"` before Playwright, `--workers=2`. A first-compile
  timeout or `ECONNRESET`: rerun that spec alone once and report both results; never change a timeout.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note, the
   phase summary `Notes/Phases/Phase 35 - Reports by period and corrections.md`).
2. Setup, in a PowerShell terminal at `C:\dev\CPoint-PMS`:
   1. `docker compose stop app`, and stop any other project's server on port 3000 and any older
      `npm run dev` of this project (the new pages must come from a fresh dev server).
   2. `npm run db:up`, `npm run db:deploy` (no new migration; save the output).
   3. `npm run dev`, then check `http://localhost:3000/api/health`.
   4. `npm run demo:reset '--' --yes` (2 to 3 minutes).
3. Run P1 to P15, A1 and A2 from the handoff. Save the PDFs of P10 (all four reports, light; Operations
   again dark for P11) and a 1280 px screenshot of the picker on Operations, a sorted table and a
   filtered card into `qa/reports/artifacts/2026-11-21-phase-35a/`. Quote the exact on-screen text for
   every line the handoff quotes. For P10 look at each PDF page: header, repeated table header,
   nothing cut off, signatures last, and say what you saw. For P15 run the two new specs and the
   existing ones listed in the handoff, then the full suite with `--workers=2`.
4. Write `qa/reports/<today>-phase-35a-run1.md` from `qa/templates/report.md`, even on a full pass:
   PASS, PASS WITH ISSUES or FAIL, a table of every scenario, the e2e counts, and each failure with
   steps, expected, actual and a screenshot or log. Change no code: anything that fails goes in the
   report for Claude to fix. Say which tool ran each scenario.
5. Add one line under "Agent sessions" in the vault's `Daily/` note for today linking this prompt, the
   handoff and the report as `[[CPoint-PMS/qa/…]]`.
