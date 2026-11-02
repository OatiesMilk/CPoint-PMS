# Prompt for Codex: Monday-to-Friday schedule QA (paste everything below the line)

Run Codex on **Dylan's PC** in `D:\IMPORTANT SHIT HERE\12th Term - BSIT\CAP2\CPoint-PMS` (the
change is uncommitted there, on `main` with Phase 30B merged), with Docker Desktop running. S8
resets the demo data. Copy from the line down.

---

You are the QA tester for CPoint-PMS. This change (D-105) makes production work Monday to Friday,
08:00 to 17:00: the Floor Manager's schedule and the stock reminder days refuse weekends and hours
outside that window, the demo week skips weekends, and a data migration (`weekdays_only`) fixed
the saved schedule from tomorrow on. The handoff is
`qa/handoffs/2026-11-02-weekdays-only-schedule.md`. Read it first; it lists every scenario (S1 to
S11, A11y, A1, A2) with steps and expected results.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/` (the report and its artifacts).
- Keep Chromium headless. Don't open visible Chrome windows.
- Don't touch `cv/`; Phase 30B is merged and is not part of this run.
- Run `npm run demo:reset` only for S8. In PowerShell the separator must be quoted:
  `npm run demo:reset '--' --yes` (a bare `--` is dropped and it only dry-runs).
- Put any setting you change back afterwards (the schedule in S3, the reminder days in S6).

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-02-weekdays-only/` (screenshots, API bodies,
   query output, axe results).
2. Check the database first: `npx prisma migrate status` (up to date) and the S10 queries, before
   any reset.
3. Build and start the app (`npm run build`, then `npm run start`; use `PORT=3001` if 3000 is
   taken). Run S1 to S7, S9, S11, A11y, A1 and A2 in the browser and with API calls.
4. Run the e2e specs: `npx playwright test tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts`,
   then the full suite `npm run test:e2e` (let Playwright start its own server). Between 00:00
   and 01:00 Manila `batches.spec.ts` fails for a known reason: rerun after 01:00.
5. Last, S8: `npm run demo:reset '--' --yes`, then the S8 checks and query.

## Write the report

Save it as `qa/reports/2026-11-02-weekdays-only.md` (or the date you run it), using
`qa/templates/report.md`. The verdict is **PASS** only if every scenario passed and the e2e suite
has 0 failures (skips with a reason are fine). For any FAIL: the steps, what you saw against what
was expected, the screenshot, and the file and line if you can tell. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today, linking
`[[CPoint-PMS/qa/CODEX_PROMPT_WEEKDAYS_ONLY]]` and the report (the vault is on the laptop: if you
can't reach it, say so in the report instead).

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
