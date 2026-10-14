# Prompt for Codex: Phase 13 QA, run 5 (paste everything below the line)

Run Codex locally in the CPoint-PMS project folder, with Docker Desktop running. Copy from the
line down.

---

You are the QA tester for CPoint-PMS. Your run 4 report
(`qa/reports/2026-10-14-phase-13-material-requests-run4.md`) had one failure: an intermittent
`apiRequestContext.post: read ECONNRESET` in the D-031 leather-roll test, in the parallel run only.
You judged it an app or server fault. The builder (Claude) reads it differently: a connection the
server closed after 5 idle seconds being reused by the test's API client. Claude changed only
`playwright.config.ts`, so the e2e server keeps idle connections open for 70 seconds. Neither
reading has been reproduced. **Your job is to find out whether the failure is gone.** There are no
manual scenarios.

## Rules

- **Do not modify** application code, tests, config, migrations, `package.json` or `.env`. You may
  only create files under `qa/reports/`.
- Read passwords from `.env`. Never print them.
- Report each of the three runs separately. Do not report only the best one.

## Steps

1. Read `qa/handoffs/2026-10-14-phase-13-material-requests-run5.md` and
   `qa/templates/report.md`.
2. Make sure no CPoint-PMS dev server is running and **nothing is listening on port 3100** (an old
   e2e server there would be reused without the new option). Leave the other project's server on
   port 3000 alone.
3. Run, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-14-phase-13-material-requests-run5/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

   Then this command **three separate times** (`e2e-1.log`, `e2e-2.log`, `e2e-3.log`, each with
   its own `--output` folder):

   ```bash
   npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run5/e2e-results-1
   ```

4. Confirm the e2e server ran with `--keepAliveTimeout 70000` (check the process's command line
   while a run is in progress) and say how you confirmed it.

## What to report

- For each of the three runs: passed and failed counts, and the count of "destination stream
  closed early" lines.
- **If `ECONNRESET` appears in any run:** the test title, the failing line, the full call log, the
  `[WebServer]` lines near it, and how long the test paused before the failing call if you can
  tell. Say plainly that the keep-alive change did not fix it.
- **For any other failing test:** the title, the failing line, the exact error, what the page
  showed, app wrong or test wrong, and the smallest fix naming the line.

## Write the report

Save it as `qa/reports/2026-10-14-phase-13-material-requests-run5.md`, using
`qa/templates/report.md`. The verdict is **PASS** only if the build passes, the option is
confirmed, and all three runs are 45 passed, 0 failed. Add one line on run 4's F1: did not recur in
three runs, or recurred in run N.

Finish by replying with the verdict, the three counts and the report path.
