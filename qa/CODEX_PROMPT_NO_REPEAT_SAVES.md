# Prompt for Codex: no repeat schedule or lunch saves (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (the change is uncommitted there, on `main` at
2e63908), with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. This change (D-107, from the team's QA notes) stops the Floor
Manager's schedule and the System Admin's lunch break from saving again when nothing changed: the
toast says "Nothing changed: … already applies from …, so nothing was saved." and the history gets
no new row. The handoff is `qa/handoffs/2026-11-02-no-repeat-schedule-saves.md`. Read it first; it
lists every scenario (S1 to S10, A1, A2, axe) with steps and expected results.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/` (the report and its artifacts).
- Keep Chromium headless. Don't open visible Chrome windows.
- Note the schedule and lunch break before you start and put them back afterwards.

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-02-no-repeat-saves/`.
2. `npx prisma migrate status` (up to date; this change has no migration).
3. `npm run build`, then `npm run start` (`PORT=3001` if 3000 is taken). Run S1 to S10, A1, A2 and
   axe in the browser and with API calls.
4. E2E: `npx playwright test tests/e2e/batches.spec.ts`, then the full suite `npm run test:e2e`
   (let Playwright start its own server). Between 00:00 and 01:00 Manila `batches.spec.ts` fails
   for a known reason: rerun after 01:00.

## Write the report

Save it as `qa/reports/2026-11-02-no-repeat-saves-run1.md` (or the date you run it), using
`qa/templates/report.md`. **PASS** only if every scenario passed and the e2e suite has 0 failures
(skips with a reason are fine). For any FAIL: steps, what you saw against what was expected, the
screenshot, file and line if you can tell. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_NO_REPEAT_SAVES]]` and
the report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
