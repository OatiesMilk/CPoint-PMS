# Mini prompt for Codex: Phase 36 manual screenshots (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`, Docker Desktop on for the database only, `npm install` done). Any day works: the clock is set by the script. This run changes nothing in the app: it only photographs the screens Phases 32 to 35B added, for the user manual (`docs/USER_MANUAL.md`). The build thread copies the files into `docs/screenshots/manual/`.

---

You are the QA tester for CPoint-PMS. Plan: `docs/prompts/plans/phase-36-docs-plan.md` (part B, step 8).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config, `package.json` or `.env`. Create files only under `qa/reports/` and your line in the vault's Daily note.
- Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note).
- Setup: stop the Docker `app` container and any old dev server, `npm run db:up`, `npm run db:deploy`, fresh `npm run dev` (use the port it prints), then `npm run demo:reset '--' --yes` (about 2 to 3 minutes).
- Use a **headless Playwright script of your own** (`page.screenshot({ path })`), not the in-app browser, which could not save files in earlier runs. Don't open visible Chrome windows. No e2e suite needed.
- Sign in with the demo accounts from the login page (`DEMO_USER_PASSWORD` from `.env`): `manager@cpoint.local` (Floor Manager), `inspector@cpoint.local` (Quality Inspector), `constructor@cpoint.local` (Shoe Constructor), `admin@cpoint.local` (System Admin). If an account name differs, read it from the login page's Demo sign-in buttons and say so in the report.
- Clock: set it as in `qa/CODEX_PROMPT_OVERVIEW_CLEANUP_RUN2.md` (Change time in the Demo mode band, or `POST /api/v1/demo/clock` with `{"date":"YYYY-MM-DD","time":"HH:mm"}` as the signed-in Floor Manager; check the band shows the new day). Use **a planned weekday of the demo week at 09:00** unless a shot says otherwise. Put the clock back on **Real time** when done.
- Images: PNG, light theme, `deviceScaleFactor: 1`. Desktop shots 1280 px wide; phone shots 390 x 844 (only the two marked "phone"). Crop nothing; each file shows the whole viewport (full page for long lists). No real personal data appears (the demo data is fake).

## Screenshots to take

Save them in `qa/reports/artifacts/2026-11-22-phase-36-screenshots/` with these names (they continue the manual's 01 to 14):

| File                       | Account                   | Screen                                                                                                                                     |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `15-storage-locations.png` | Floor Manager             | Inventory → Storage locations, the list of bins with their rolls                                                                           |
| `16-roll-labels.png`       | Floor Manager             | the roll label sheet (`/inventory/labels`, a leather item's rolls; reach it from the item page's print button)                             |
| `17-find-roll.png`         | Constructor (phone)       | Find roll (`/find`) after typing a roll code: where it is in large text, plus its location history                                         |
| `18-roll-location.png`     | Floor Manager             | one roll's page showing Kept in, Location history and Move                                                                                 |
| `19-inspection-queue.png`  | Quality Inspector         | Batches → Queue with at least one Urgent and one waiting batch from an earlier day                                                         |
| `20-finish-failed.png`     | Quality Inspector (phone) | Finish batch with failed pairs entered and "What was wrong" lines open (one Fixable with its stage, one Not fixable). Don't save the batch |
| `21-work-in-progress.png`  | Floor Manager             | Batches → Work in progress, each stage with its count and repairs                                                                          |
| `22-repair-inspection.png` | Quality Inspector         | Queue showing a repair Back for inspection (open its Inspect dialog, don't save)                                                           |
| `23-report-period.png`     | Floor Manager             | Reports → Operations with the Week or Month period picked and a table sorted by a header                                                   |
| `24-report-print.png`      | Floor Manager             | the same report with `page.emulateMedia({ media: 'print' })`, to show the print layout (header, Prepared by, signatures)                   |
| `25-correction.png`        | Floor Manager             | Queue → Inspected and void, the **Batch date** picker on an earlier day and the **Correct** dialog with its Reason box open (don't save)   |
| `26-edit-roll-details.png` | Floor Manager             | a roll's **Edit details** dialog (don't save)                                                                                              |

If a screen can't be reached or looks wrong, don't fake it: take the nearest honest shot, name it with a `-problem` suffix and describe the fault (steps, expected, actual) in the report. If a screen differs from what the manual or `docs/API.md` says, list that too; it helps the build thread.

## Do

1. Take the twelve screenshots above, then run a scripted check that each file exists and is larger than 20 KB.
2. Write `qa/reports/2026-11-22-phase-36-screenshots.md` from `qa/templates/report.md`, even on a full pass: PASS, PASS WITH ISSUES or FAIL, a row for each file (taken or not, the clock used, notes), and any screen that differs from the docs.
3. Leave the clock on **Real time** and run `npm run demo:reset '--' --yes` last.
4. Add one line under "Agent sessions" in the vault's `Daily/` note linking this prompt and the report.
