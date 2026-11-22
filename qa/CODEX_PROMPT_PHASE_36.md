# Prompt for Codex: Phase 36, docs, figures and demo rehearsal, run 1 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only,
`npm install` done. Run the demo rehearsal (D5, D6) on a weekday before 13:30 Manila; on another day say so.
Dylan applies `qa/phase-36-ci-storage-checks.patch` first (`git apply qa/phase-36-ci-storage-checks.patch`;
the remote tools can't write `.github/workflows/ci.yml`); D8 reads those checks from that file. Run
`qa/CODEX_PROMPT_PHASE_36_SCREENSHOTS.md` first or after: it is separate and writes only the 12 manual
screenshots.

---

You are the QA tester for CPoint-PMS: Phase 36 (D-134), docs only: the master spec, README, user manual,
STATION_SETUP, API doc, the demo script, three figures and new CI SQL checks. Handoff:
`qa/handoffs/2026-11-22-phase-36-docs.md` (scenarios D1 to D10, A1).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` (the report and its artifacts) and
  your line in the vault's Daily note. Anything that reads wrong goes in the report with the file, line
  and the screen text for Claude to fix.
- **Headless only (Dylan, 2026-11-22):** don't use the in-app browser, a preview pane or any visible Chrome
  window; run every browser step as a headless Playwright script (`chromium.launch()`, `page.screenshot`) at
  the `npm run dev` URL and say so in the report. No e2e run is needed (nothing in the app changed).
- The rehearsal writes data (a plan, batches, a moved clock); `demo:reset` at the start and the end puts it
  back. Finish on **Back to real time**, then reset.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note,
   `Notes/Phases/Phase 36 - Docs match the system.md`).
2. Setup in PowerShell at `C:\dev\CPoint-PMS`: `docker compose stop app`, stop any other server on port
   3000 and older `npm run dev`; `npm run db:up`; `npm run db:deploy`; `npm run dev` and check
   `http://localhost:3000/api/health`; `npm run demo:reset '--' --yes` (2 to 3 minutes).
3. D1 first (`git status`, `git diff --stat`, `git diff -U0 src`).
4. D2 to D4: read each document section and do what it says in the app as the named role. Record every
   mismatch as `file:line, the document's text, what the screen shows`. Quote exact on-screen text.
5. D5 and D6: follow `docs/DEMO_SCRIPT.md` as written, with a stopwatch per act. For the phone steps use
   a 390 px wide window. If a step can't be done as written, stop that act, note the step, and go on.
6. D7: call the routes (headless script with the demo sessions) and compare with `docs/API.md`.
7. D8: with the database up, run each new SQL check from the `docker` job's "Storage locations" block
   (read it in `.github/workflows/ci.yml`; `docker compose exec db psql -U cpoint cpoint_pms -tA -c "…"`)
   and save the output.
8. D9 and D10: open the three figures and the README's Mermaid blocks and check as the handoff says;
   save a screenshot of each figure and diagram into `qa/reports/artifacts/<today>-phase-36/`.
9. A1: check the listed numbers against `src`.
10. Write `qa/reports/<today>-phase-36-run1.md` from `qa/templates/report.md`, even on a full pass: PASS,
    PASS WITH ISSUES or FAIL, a table of every scenario, the act timings for D5, and each failure with
    steps, expected, actual and a screenshot or log. Say which tool ran each scenario.
11. Finish with Back to real time and `npm run demo:reset '--' --yes`, and say so. Add one line under
    "Agent sessions" in the vault's `Daily/` note for today linking this prompt, the handoff and the report
    as `[[CPoint-PMS/qa/…]]`.
