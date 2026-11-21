# Prompt for Codex: Phase 35A, reports by period, run 2 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only. No demo
reset is needed (run 1 reset it; the e2e fixtures since added are fine).

---

You are the QA tester for CPoint-PMS: Phase 35A (D-132), run 2. Handoff:
`qa/handoffs/2026-11-21-phase-35a-reports-by-period.md` (P6 and P9 now match what run 1 found). Run 1:
`qa/reports/2026-11-21-phase-35a-run1.md` (FAIL: P6, P9, P10, P15). Same rules as run 1
(`qa/CODEX_PROMPT_PHASE_35A.md`): test and report only, change nothing outside `qa/reports/`, headless
Playwright for print and controls, say which tool ran each step.

## What changed since run 1

- **F1** The print CSS now scales a chart to the page (`.recharts-wrapper` 100% wide in print).
- **F2** The inline actions (card links such as Open, Today's batches, Inventory, the CSV links in
  cards, every View, the Claim sheet button) and the Next/Previous buttons are hidden in print. The
  Materials count line "Showing 1–15 of 24 materials · page 1 of 2" stays on purpose (that print has
  only the page on screen).
- **F3, F7** Handoff wording only (an impossible legacy `from=` shows the default 14 days; the worst-rolls
  card shows 5, its CSV up to 100).
- **F4** The print spec's Remarks locator is `getByRole("textbox", { name: "Remarks" })`.
- **F5** The sort header's hidden text no longer contains "by" ("Select to sort"), so Rolls' no-person check
  passes.
- F6, F8 and F9 passed alone or are dev-server load (sign-ins stalling, as in Phase 32 and 33): no code
  change.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, newest `Daily/`). Stop any older
   dev server and start a fresh `npm run dev` (the print CSS and components changed); check
   `/api/health`.
2. **P10 again**, the four light PDFs and the dark Operations PDF, after the page is idle and the chart
   SVG is present. Look at every page: the Quality and Operations charts fit inside the page width (all
   days of the period visible), no Open / View / Claim sheet / card link / CSV link / Next button prints,
   table headers still repeat, no row splits, header and signatures as before. Say what you saw per PDF
   and attach the pages that show the charts and a table page. Also confirm on screen (1280 px) that the
   charts, View links and card links look as before.
3. **P6** (the four `period=` cases and the legacy `from=2026-02-30` as the handoff now words it) and
   **P9** (supplier card and CSVs as the handoff now words it).
4. **P15**: run `reports-print.spec.ts`, `reports-period.spec.ts`, `rolls.spec.ts` and `reports.spec.ts`
   alone, each with `--workers=2`; then the full suite with `--workers=2`. A first-compile time-out or
   a sign-in stall: rerun that spec alone once and report both results; never change a timeout. Report
   the counts and name any failure that also fails alone.
5. Write `qa/reports/<today>-phase-35a-run2.md` from `qa/templates/report.md` (PASS, PASS WITH ISSUES or
   FAIL, only the scenarios above plus "P1 to P5, P7, P8, P11 to P14, A1, A2 passed in run 1, unchanged").
   Add one line under "Agent sessions" in today's vault `Daily/` note linking this prompt and the report.
