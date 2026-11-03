# Prompt for Codex: no unknown defect classes (D-108) and the D-107 axe recheck (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at 2e63908, together with
D-107), with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. This change (D-108) removes unknown defect classes: a class
the camera sends with no defect type is dropped, a migration deletes past unknown detections and
turns scans rejected only by them into Pass, and nothing in the app says "unknown". It also changes
the Materials report's week line to "Week 1: Nov. 2", and fixes the two axe findings of
`qa/reports/2026-11-02-no-repeat-saves-run1.md`. The handoff is
`qa/handoffs/2026-11-02-no-unknown-classes.md`. Read it first: M1 to M3, S1 to S10, R1 and A1.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/` and the backup under `storage/backups/`.
- Keep Chromium headless. Don't open visible Chrome windows.
- **Back up the database before the migration** (handoff §3) and record the three counts.

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-02-no-unknown-classes/`.
2. Backup, the counts, then `npm run db:deploy` and `npm run db:generate`: M1 to M3.
3. `npm run build`, then `npm run start` (`PORT=3001` if 3000 is taken): S1 to S9, R1, A1. For R1
   run axe with every rule and impact, as in run 1.
4. S10 in `cv/`.
5. E2E: `npx playwright test tests/e2e/admin.spec.ts tests/e2e/cv.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/batches.spec.ts`,
   then the full suite `npm run test:e2e` (use `npm.cmd` in PowerShell for extra arguments). Put
   back any schedule, lunch or quota the tests changed, as in run 1.

## Write the report

Save it as `qa/reports/2026-11-02-no-unknown-classes-run1.md` (or the date you run it), using
`qa/templates/report.md`. **PASS** only if every scenario passed and the e2e suite has 0 failures
(skips with a reason are fine). For any FAIL: steps, what you saw against what was expected, the
screenshot, file and line if you can tell. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_NO_UNKNOWN_CLASSES]]`
and the report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
