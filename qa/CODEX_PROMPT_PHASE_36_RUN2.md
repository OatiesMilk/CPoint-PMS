# Prompt for Codex: Phase 36, docs, figures and demo rehearsal, run 2 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only, `npm install` done.
This run is short: it rechecks what run 1 left open. Any day works. **Nothing opens on Dylan's screen:** no
in-app browser, no preview pane, no visible Chrome windows; every browser step is a headless Playwright script.

---

You are the QA tester for CPoint-PMS: Phase 36 run 2. Run 1 (`qa/reports/2026-11-22-phase-36-run1.md`) passed
except D8, D9 and D10. Claude fixed D8 in the demo seed (`src/server/services/demo-seed.service.ts`: the two
rolls moved to another bin now come from the item with the most rolls left), rendered D10 himself (both README
Mermaid blocks render; the picture is in the project files), and put the three figures on this laptop.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config, `package.json` or
  `.env`. Create files only under `qa/reports/` (the report and its artifacts) and your line in the vault's
  Daily note.
- Headless only: use `require('playwright')` with `chromium.launch()` (headless) and `page.screenshot({ path })`;
  sign in with the demo accounts (`DEMO_USER_PASSWORD` from `.env`, `manager@cpoint.local`). Don't use the in-app
  browser, don't open a preview, don't launch `chrome.exe`. To look at a figure, open the PNG file with your
  image viewer tool (no window needed) or read it from a script.
- No e2e run.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note).
2. Setup in PowerShell at `C:\dev\CPoint-PMS`: `docker compose stop app`, stop any older `npm run dev`;
   `npm run db:up`; `npm run db:deploy`; `npm run dev` (note the port it prints); `npm run demo:reset '--' --yes`
   (2 to 3 minutes; the reset runs the seed from the current code).
3. **D8 again (no browser).** Run every storage check of the `Storage locations and roll moves (Phase 32, D-128)`
   block of `.github/workflows/ci.yml` against the freshly reset database (`docker compose exec -T db psql -U
cpoint -d cpoint_pms -tA -c "…"`), and `select reason, count(*) from roll_moves group by 1 order by 1`.
   Expected: every check passes and `MOVED` is 2; quote all the counts you get. Save the output.
4. **D8, the history on screen (headless script).** Find a moved roll with `select b.code from batches b join
roll_moves m on m.\"rollId\" = b.id where m.reason='MOVED' limit 1`. Sign in as the Floor Manager, open
   that roll's page (Inventory → the item → the roll, or its URL) and save a screenshot of its Location history
   to `qa/reports/artifacts/<today>-phase-36-run2/`. Expected: a "Moved" row with the note "The first bin was
   full." Quote the on-screen text.
5. **D9, the figures.** Open the three files in `C:\dev\capstone-obsidian\Inbox\figures-2026-11-22\`
   (`system-architecture-2026-11-22.png` and the two `conceptual-framework-…-2026-11-22.png`). Check: legible, no
   clipped or overlapping text, the five module titles of the conceptual framework unchanged, NEW chips on
   storage locations, the Inspection queue and batch codes, final defects and repairs, stages and counts,
   corrections and labels; "92 handlers" and "31 tables" on the architecture figure match
   `docs/prompts/paper-figures.md`. Describe what you see for each; no copies are needed.
6. **D10.** Skip it: Claude rendered both README Mermaid blocks. Write "Not run, rendered by Claude" in the report.
7. Write `qa/reports/<today>-phase-36-run2.md` from `qa/templates/report.md` (PASS, PASS WITH ISSUES or FAIL, a
   table of D8, D9, D10, and any failure with steps, expected, actual and evidence). Stop the dev server you
   started.
8. End with `npm run demo:reset '--' --yes` and say so. Add one line under "Agent sessions" in the vault's
   `Daily/` note for today linking this prompt and the report as `[[CPoint-PMS/qa/…]]`.

Not part of this run: the 12 manual screenshots (`qa/CODEX_PROMPT_PHASE_36_SCREENSHOTS.md`, already headless),
the camera, print preview and act timings. Dylan does those by hand.
