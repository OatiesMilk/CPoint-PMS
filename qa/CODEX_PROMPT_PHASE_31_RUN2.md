# Prompt for Codex: Phase 31, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted Phase 31 docs), Docker Desktop
running for the database only, Dylan's `npm run dev` on http://localhost:3000. Any day; D4 needs a
weekday with today planned (mark it blocked otherwise). Then copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 31, run 2. Handoff:
`qa/handoffs/2026-11-07-phase-31-docs.md`. Run 1 (`qa/reports/2026-11-07-phase-31-run1.md`)
blocked eight scenarios because the in-app browser was unavailable, and failed D3 on one number.

What Claude changed since run 1:

- **F1 (D3):** "19.2 in across" was an example, not a fixed value: the width depends on the
  camera's height. README now reads "(N in across)", where N is the width the camera sees, and
  notes that the e2e fake camera gives 16.0 in. STATION_SETUP says the same.

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`; create files only under `qa/reports/` (artifacts in
  `qa/reports/artifacts/2026-11-07-phase-31-run2/`).
- **If the in-app browser is unavailable, use a headless Playwright script of your own for every
  scenario** (Playwright's own Chromium, headless; don't open Chrome windows). Use the demo sign-in
  buttons on the login page. Say in the report which tool ran each scenario.
- No `demo:reset`. For D3 you may add **one** roll as the Floor Manager (Inventory → a leather
  item → Add rolls, area 20) so a roll is waiting, then scan it with the fake camera
  (`tests/e2e/fixtures/marker-card.y4m`) and finish it. Leave LR-MLT-004 alone. Report the roll
  code you added.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the Phase 31 note).
2. Run D1 to D8 from the handoff (D4 only on a weekday). For each wording difference, quote the
   doc line and the app's text side by side.
3. **D9:** write a small HTML page under the artifacts folder that loads Mermaid
   (`https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js`) and renders the two
   ` ```mermaid ` blocks copied from README; screenshot it headless. Both must render with no
   error. Check the README tables by eye in the raw file (each row has the same number of `|`).
4. Write `qa/reports/2026-11-07-phase-31-run2.md` from `qa/templates/report.md` (PASS, PASS WITH
   ISSUES or FAIL; each finding with the file and line to fix), and add one line under "Agent
   sessions" in the vault's `Daily/` note for today.
