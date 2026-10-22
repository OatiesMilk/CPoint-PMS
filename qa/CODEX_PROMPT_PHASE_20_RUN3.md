# Prompt for Codex: Phase 20 QA, run 3 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 2 (`qa/reports/2026-10-20-phase-20-qa-fixes.md`) passed
every browser scenario, but 4 e2e tests failed. The builder (Claude) fixed those four tests. This
run is the e2e suite only.

## Rules

- **Do not modify** application code, tests, config, migrations, `package.json`, `.env` or
  `cv/config.toml`. You may only create files under `qa/reports/`.
- Never print passwords or tokens, or put them in a report or log.
- **Never run `npm run demo:reset`** and never `docker compose down -v`.
- Leave anything on port 3000 that isn't CPoint-PMS alone.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and `qa/handoffs/2026-10-20-phase-20-qa-run3.md`.
2. Save each output as UTF-8 text in `qa/reports/artifacts/2026-10-20-phase-20-qa-run3/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

3. E1: run `npm run test:e2e` and save it as `e2e-run1.log`.
4. E2: run it again without changing anything, and save it as `e2e-run2.log`.
5. E3 and E4: only if those tests failed, run them alone with `--trace on` as the handoff says, and
   attach the trace zip.

## What to report

- For each run, the passed, failed and skipped counts.
- For each failing test, its title, the failing line, the exact error, and whether it passed when
  run alone.
- Whether the app or the test is wrong, with the smallest fix naming the file and line.

## Write the report

Save it as `qa/reports/2026-10-20-phase-20-qa-run3.md`, using `qa/templates/report.md`. The
verdict is **PASS** only if the build passes and both e2e runs have no failure. End with the
**"Needs Dylan"** checklist from the handoff's section 6.

Finish by replying with the verdict, both runs' counts and the report path.
