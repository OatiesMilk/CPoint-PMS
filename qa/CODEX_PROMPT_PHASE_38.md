# Prompt for Codex: Phase 38, Preparation shows the camera's defects (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only, `npm install` done.
**Nothing opens on Dylan's screen:** no in-app browser, no preview pane, no visible Chrome windows; every
browser step is a headless Playwright script. Phase 37 (the demo data) is in the same working tree, so run
`qa/CODEX_PROMPT_PHASE_37.md` first or after, as Dylan says; its W3 reads differently now (see the handoff).

---

You are the QA tester for CPoint-PMS: Phase 38 (the Preparation card's camera defects, and no repair going back
to Preparation).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config, `package.json` or
  `.env`. Create files only under `qa/reports/` (the report and its artifacts) and your line in the vault's
  Daily note.
- Headless only: `require('playwright')` with `chromium.launch()` and `page.screenshot({ path })`; sign in with
  the demo accounts (`DEMO_USER_PASSWORD` from `.env`; `manager@cpoint.local`, `inspector@cpoint.local`).
- `npm run check` is Claude's. Run only the e2e specs named below.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note, the
   phase summary `Notes/Phases/Phase 38 - Preparation camera defects.md`), then
   `qa/handoffs/2026-11-23-phase-38-preparation-camera-defects.md` (scenarios L1 to L10 are there).
2. Setup in PowerShell at `C:\dev\CPoint-PMS`: `docker compose stop app`, stop any older `npm run dev`;
   `npm run db:up`; `npm run db:deploy`. **Run L1's two SQL counts on the database as it is, before any
   reset**, and quote them. Then `npm run dev` (note the port) and `npm run demo:reset '--' --yes`.
3. Run L1 (after the reset), L2 and L3 with SQL (`docker compose exec -T db psql -U cpoint -d cpoint_pms -tA -c "…"`)
   and a headless script (screenshots into `qa/reports/artifacts/<today>-phase-38/`); quote the Preparation
   card's text and the SQL counts side by side.
4. Run L4 with the simulator (`npm run cv:token` once, put the token in `.env` as `CV_DEVICE_TOKEN`; start
   scanning a roll as a Capture constructor, then `npm run cv:simulate -- --count 6 --interval 3`, then Finish roll).
5. Run L5, L6 and L8 to L10 in a headless script, quoting the option lists and table headings. Run L7 with the
   signed-in context's `request` (quote each status and message).
6. Rerun these e2e specs against the dev server (`$env:E2E_BASE_URL="http://localhost:<port>"`):
   `tests/e2e/stage-wip.spec.ts`, `final-defects.spec.ts`, `corrections.spec.ts`, `reports.spec.ts`,
   `batches.spec.ts`. On a first-compile timeout or `ECONNRESET` rerun that spec once and report both results.
7. Write `qa/reports/<today>-phase-38-run1.md` from `qa/templates/report.md` (PASS, PASS WITH ISSUES or FAIL, a
   table of L1 to L10 and the e2e results, and for each failure the steps, expected, actual and evidence).
   Stop the dev server.
8. End with `npm run demo:reset '--' --yes` and say so. Add one line under "Agent sessions" in today's
   `Daily/` note linking this prompt and the report as `[[CPoint-PMS/qa/…]]`.

Not part of this run: screenshot 21 and the PDF (retaken by Claude), and the phone rehearsal (Dylan's).
