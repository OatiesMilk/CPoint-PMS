# Prompt for Codex: Phase 40, work in progress at Preparation is counted in pieces (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only, `npm install` done.
**Nothing opens on Dylan's screen:** no in-app browser, no preview pane, no visible Chrome windows; every browser step is a
headless Playwright script. Phase 41 (Find roll in Inventory) is in the same working tree; test it only if Dylan gives you its
own prompt, and ignore its files here.

---

You are the QA tester for CPoint-PMS: Phase 40 (Preparation's work in progress is counted in pieces, and Reports → Work in
progress leaves Preparation out).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config, `package.json` or `.env`. Create
  files only under `qa/reports/` (the report and its artifacts) and your line in the vault's Daily note.
- Headless only: `require('playwright')` with `chromium.launch()` and `page.screenshot({ path })`; sign in with the demo accounts
  (`DEMO_USER_PASSWORD` from `.env`; `manager@cpoint.local`, `inspector@cpoint.local`, `constructor@cpoint.local`).
- `npm run check` is Claude's. Run only the e2e specs named below.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note, the phase summary
   `Notes/Phases/Phase 40 - Preparation pieces.md`), then `qa/handoffs/2026-11-26-preparation-wip-unit.md` (scenarios P1 to P12 and
   A1, A2 are there).
2. Setup in PowerShell at `C:\dev\CPoint-PMS`: `docker compose stop app`, stop any older `npm run dev`; `npm run db:up`;
   `npm run db:deploy`; `npm run dev` (note the port); `npm run demo:reset '--' --yes`.
3. Run P1 to P3, P6, P7, P9, P10 and P12 in a headless script as the Floor Manager (screenshots into
   `qa/reports/artifacts/<today>-phase-40/`); quote the captions, labels, toasts and the report card's text.
4. Run P4 and P5 at 390 px wide with a constructor who has Capture access and one assigned to Sole-ing (assign them under
   Batches → Plan days → Who works where, or create them as `stage-wip.spec.ts` does).
5. Run P8, P11, A1 and A2 with the signed-in contexts' `request` (quote each status and message).
6. Rerun these e2e specs against the dev server (`$env:E2E_BASE_URL="http://localhost:<port>"`): `tests/e2e/stage-wip.spec.ts`,
   `reports.spec.ts`, `batches.spec.ts`. On a first-compile timeout or `ECONNRESET` rerun that spec once and report both results.
7. Write `qa/reports/<today>-phase-40-run1.md` from `qa/templates/report.md` (PASS, PASS WITH ISSUES or FAIL, a table of P1 to P12,
   A1, A2 and the e2e results, and for each failure the steps, expected, actual and evidence). Stop the dev server.
8. End with `npm run demo:reset '--' --yes` and say so. Add one line under "Agent sessions" in today's `Daily/` note linking this
   prompt and the report as `[[CPoint-PMS/qa/…]]`.

Not part of this run: screenshot 21 and the PDF (retaken by Claude after the pass), and the phone rehearsal (Dylan's).
