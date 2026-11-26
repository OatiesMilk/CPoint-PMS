# Prompt for Codex: Phase 41, Find roll is a button on Inventory (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only, `npm install` done.
**Nothing opens on Dylan's screen:** no in-app browser, no preview pane, no visible Chrome windows; every browser step is a
headless Playwright script. Phase 40 (Preparation counted in pieces) is in the same working tree; test it only from its own
prompt (`qa/CODEX_PROMPT_PHASE_40.md`), and ignore its files here.

---

You are the QA tester for CPoint-PMS: Phase 41 (Find roll leaves the Floor Manager's menu and is a button on Inventory;
constructors with camera access keep it in their menu).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config, `package.json` or `.env`. Create
  files only under `qa/reports/` (the report and its artifacts) and your line in the vault's Daily note. Anything that fails
  goes in the report for Claude to fix.
- Headless only: `require('playwright')` with `chromium.launch()` and `page.screenshot({ path })`; sign in with the demo accounts
  (`DEMO_USER_PASSWORD` from `.env`; `manager@cpoint.local`, `inspector@cpoint.local`, `admin@cpoint.local`,
  `constructor@cpoint.local`).
- `npm run check` is Claude's. Run only the e2e specs named below.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note, and a Phase 41 summary in
   `Notes/Phases/` if there is one; Claude wrote the docs on Dylan's PC, where the vault isn't, so there may be none), then
   `qa/handoffs/2026-11-26-find-roll-in-inventory.md` (scenarios F1 to F9 and A1 to A4 are there).
2. Setup in PowerShell at `C:\dev\CPoint-PMS`: `docker compose stop app`, stop any older `npm run dev`; `npm run db:up`;
   `npm run db:deploy`; `npm run dev` (note the port); `npm run demo:reset '--' --yes`.
3. Run F1 to F3, F8 and F9 at 1366 × 768 as the Floor Manager (screenshots into `qa/reports/artifacts/<today>-phase-41/`):
   quote the sidebar's labels, the Inventory header buttons in order, the `aria-current` item on `/find`, and the back link.
4. Run F4 and F5 at 390 × 844 as the Floor Manager: the button's position (`boundingBox`, first action, on the first screen),
   its height (at least 44 px), `document.documentElement.scrollWidth` on `/inventory` and `/find` (at most 390), and the
   phone bar's title on `/find` ("Inventory").
5. Run F6 and A1 at 390 × 844 as `constructor@cpoint.local` (camera access from the demo week): the Pages menu lists Capture,
   Find roll; `/find` has no Inventory back link; `/inventory` lands on `/forbidden`.
6. Run F7 and A2 with a constructor without camera access (create one under Admin → Users with camera access off, or use a
   seeded one): no Find roll in the menu; `/find` lands on `/forbidden`; `GET /api/v1/rolls/find?q=LR` with that signed-in
   context's `request` is 403 (quote the status and message).
7. Run A3 and A4 as the Quality Inspector and the System Admin: no Find roll in the menu; `/find` lands on `/forbidden`.
8. Rerun these e2e specs against the dev server (`$env:E2E_BASE_URL="http://localhost:<port>"`): `tests/e2e/auth.spec.ts`,
   `tests/e2e/inventory.spec.ts` (the new block is "Find roll from Inventory (Phase 41, D-138)"; the file also holds the
   storage locations and Find roll tests from Phase 32), `tests/e2e/capture.spec.ts`. On a first-compile timeout or
   `ECONNRESET` rerun that spec once and report both results.
9. Write `qa/reports/<today>-phase-41-run1.md` (for example `qa/reports/2026-11-26-phase-41-run1.md`) from
   `qa/templates/report.md` (PASS, PASS WITH ISSUES or FAIL, a table of F1 to F9, A1 to A4 and the e2e results, and for each
   failure the steps, expected, actual and evidence). Always write the report, even when everything passes. Stop the dev server.
10. End with `npm run demo:reset '--' --yes` and say so. Add one line under "Agent sessions" in today's `Daily/` note linking
    this prompt and the report as `[[CPoint-PMS/qa/…]]`.

Not part of this run: `USER_MANUAL.pdf` (Claude rebuilds it after the pass), Phase 40's scenarios, and the phone rehearsal
(Dylan's).
