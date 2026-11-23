# Prompt for Codex: Phase 37, work in progress demo data (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only, `npm install` done.
**Nothing opens on Dylan's screen:** no in-app browser, no preview pane, no visible Chrome windows; every
browser step is a headless Playwright script. Best on a weekday after 15:30 Manila (see W4).

---

You are the QA tester for CPoint-PMS: Phase 37 (the demo data's live Work in progress board).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config, `package.json` or
  `.env`. Create files only under `qa/reports/` (the report and its artifacts) and your line in the vault's
  Daily note.
- Headless only: `require('playwright')` with `chromium.launch()` and `page.screenshot({ path })`; sign in with
  the demo accounts (`DEMO_USER_PASSWORD` from `.env`; `manager@cpoint.local`, `inspector@cpoint.local`).
- Don't run the whole e2e suite. `npm run check` is Claude's.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note, the
   phase summary `Notes/Phases/Phase 37 - Work in progress demo data.md`), then
   `qa/handoffs/2026-11-23-phase-37-wip-demo-data.md` (the scenarios W1 to W8 are there).
2. Setup in PowerShell at `C:\dev\CPoint-PMS`: `docker compose stop app`, stop any older `npm run dev`;
   `npm run db:up`; `npm run db:deploy`; `npm run dev` (note the port); `npm run demo:reset '--' --yes`.
3. Run W1, W2 and W4's SQL part with `docker compose exec -T db psql -U cpoint -d cpoint_pms -tA -c "…"`. Quote
   every count you get.
4. Run W3, W4, W5, W6 and W7 in a headless script (screenshots into
   `qa/reports/artifacts/<today>-phase-37/`), quoting the on-screen text: each stage card's repairs and its
   "as of" time, the Queue's repair rows with their waits, the Repairs section's numbers, the Overview card.
   In W5 save one inspection (Passed = all pairs) as the Quality Inspector; in W4 save one count on Finishing.
5. Run W8 (a second reset) and compare the counts with W1.
6. Write `qa/reports/<today>-phase-37-run1.md` from `qa/templates/report.md` (PASS, PASS WITH ISSUES or FAIL, a
   table of W1 to W8, and for each failure the steps, expected, actual and evidence). Stop the dev server.
7. End with `npm run demo:reset '--' --yes` and say so. Add one line under "Agent sessions" in today's
   `Daily/` note linking this prompt and the report as `[[CPoint-PMS/qa/…]]`.

Not part of this run: screenshot 21 and the PDF (retaken by Claude), the Preparation card's camera defects (Phase 38), and
the phone rehearsal (Dylan's).
