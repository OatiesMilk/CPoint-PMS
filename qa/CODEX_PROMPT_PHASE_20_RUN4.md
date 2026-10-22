# Prompt for Codex: Phase 20 QA, run 4 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 3 (`qa/reports/2026-10-20-phase-20-qa-run3.md`) had one
e2e failure, a wrong row locator in the Settings → Defect types test. The builder (Claude) fixed
that test. This run is e2e only.

## Rules

- **Do not modify** application code, tests, config, migrations, `package.json`, `.env` or
  `cv/config.toml`. You may only create files under `qa/reports/`.
- Never print passwords or tokens, or put them in a report or log.
- **Never run `npm run demo:reset`** and never `docker compose down -v`. Don't clean up test data;
  that is done after this run.
- Leave anything on port 3000 that isn't CPoint-PMS alone.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and `qa/handoffs/2026-10-20-phase-20-qa-run4.md`.
2. Save each output as UTF-8 text in `qa/reports/artifacts/2026-10-20-phase-20-qa-run4/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

3. E1: `npx playwright test tests/e2e/cut-around-or-clean.spec.ts -g "Settings sets"`, saved as
   `e1-alone.log`.
4. E2: `npm run test:e2e`, saved as `e2e.log`.

## What to report

- E1 and E2 with their passed, failed and skipped counts.
- For each failing test: its title, the failing line, the exact error, and whether the app or the
  test is wrong, with the smallest fix naming the file and line.

## Write the report

Save it as `qa/reports/2026-10-20-phase-20-qa-run4.md`, using `qa/templates/report.md`. The
verdict is **PASS** only if the build passes, E1 passes and E2 has no failure. End with the
**"Needs Dylan"** checklist from the handoff's section 6.

Finish by replying with the verdict, the counts and the report path.
