# Prompt for Codex: Phase 30F baseline screenshots, before the redesign (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (main, clean apart from the 30F brief), Docker
Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Phase 30F (`docs/prompts/premium-ui.md`) will polish the look
of every page without changing what it does or says. Before anything changes, Claude needs **before
screenshots** of every page to audit from. This run takes them. There is no pass or fail: it's a
record.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/`.
- No `demo:reset`, and change no data: open pages and dialogs only, and close every dialog with
  Cancel or Escape. If you must save something to reach a state, don't; note it as not captured.
- Take the screenshots with a **headless Playwright script** of your own (Playwright's Chromium,
  AGENTS.md), saved with its output under
  `qa/reports/artifacts/2026-11-06-phase-30f-baseline/`. Don't open visible Chrome windows.
- Run against `npm run dev` (http://localhost:3000, or the port it printed). Sign in with the demo
  accounts and `DEMO_USER_PASSWORD` from `.env`; don't write the password into any file.

## What to capture

For each page: **full-page** PNG, `deviceScaleFactor: 1`, at **1440 × 900** and **1280 × 800**, in
**light** and **dark** (set `localStorage["cpoint-theme"]` to `light` or `dark` before the page
loads). Name each file `<role>-<page>-<width>-<theme>.png`, e.g. `fm-reports-operations-1280-dark.png`.
Wait for the page to settle (no skeletons) before each shot.

1. **Signed out:** `/login` (and the Demo sign-in panel if it shows), a 404 (`/no-such-page`).
2. **Floor Manager** (`manager@cpoint.local`): `/floor-manager`, `/batches`, `/batches/plan` (and
   the day dialog opened on a future weekday), `/attendance`, `/reports` (each report tab),
   `/reports/rolls`, the first roll's page, its claim sheet, `/reports/materials`, `/inventory`,
   the first leather item's page, `/inventory/new`, `/inventory/update`, the first scan's page
   (from a roll's page), `/account/password`, and `/admin` (the 403 page).
3. **Quality Inspector** (`inspector@cpoint.local`): `/batches`, and the Finish batch dialog if a
   batch can be finished now (Cancel it).
4. **System Admin** (`admin@cpoint.local`): `/admin`, `/admin/users` (and its More actions menu
   open), `/admin/settings` on every tab (`?tab=…`), `/admin/tokens`, `/admin/audit` (one row
   expanded).
5. **Phone pages, also at 390 × 844** (`isMobile: true`, `hasTouch: true`), light and dark:
   - QI `/batches` (and the Finish batch sheet if available).
   - Shoe Constructor (`constructor@cpoint.local`) `/camera/capture`, with a fake camera: launch
     Chromium with `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream` and
     `--use-file-for-fake-video-capture=tests/e2e/fixtures/marker-card.y4m`, and grant `camera`.
     Capture the page before a roll is started and with the Start a roll form showing (don't
     start one). Also at 1440: the same page and **Floor view** turned on (turn it off again).
6. A toast and an empty state if you meet them on the way (a filter with no match, e.g. Reports →
   Rolls with a status that has no rows). Clear the filter afterwards.

## Write the report

Save `qa/reports/2026-11-06-phase-30f-baseline.md` from `qa/templates/report.md` (verdict
**BASELINE**): the environment, the commit, the screenshot count, and a table of every page, role,
widths and themes taken, plus anything you couldn't capture and why. Put the script beside the
screenshots. Add one line under "Agent sessions" in today's Daily note
(`C:\dev\capstone-obsidian\Daily\`) linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_BASELINE]]` and
the report. Reply with the screenshot count, what wasn't captured, and the report path.
