# Prompt for Codex: Phase 23 QA, run 2 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 of Phase 23 (`qa/reports/2026-10-22-phase-23-production-progression.md`)
failed on one app fault, F1: wide tables were scroll boxes a keyboard couldn't reach (axe
`scrollable-region-focusable`), which also caused all five e2e failures. Claude fixed the shared
table wrapper. Check the fix and re-run the suite.

## Rules

The same as run 1 (`qa/CODEX_PROMPT_PHASE_23.md`, "Rules"): don't modify app code, tests, config,
migrations, `package.json` or `.env`; only create files under `qa/reports/`; never print
passwords; never run `npm run demo:reset` on the dev database or `docker compose down -v` on
`cpoint-pms`; save the id lists of `production_check_ins`, `daily_quotas`,
`production_schedules` and the days in `attendance_days` first, and at the end delete only the
rows that weren't there, **except the default schedule** (the one with no `createdById`): keep
it, or start the app once to recreate it. Run after 01:00 Manila time.

## Steps

1. Read `qa/handoffs/2026-10-22-phase-23-qa-run2.md`.
2. `npm run db:up`, `npm run db:deploy`, `npm run build`, saving each output in
   `qa/reports/artifacts/2026-10-22-phase-23-qa-run2/`.
3. Save the id lists.
4. Run the full e2e suite (`npm run test:e2e`) as `e2e.log`. If `production.spec.ts` or
   `attendance.spec.ts` fails, re-run those two alone with `--workers=1` as `e2e-rerun.log`.
5. Run R1 to R4 from the handoff. R1, R2 and R4 in a throwaway demo stack (as in run 1, step 6:
   `docker compose -p cpoint-qa up --build -d` with `DB_PORT=5434`, `APP_PORT=3002`,
   `SEED_DEMO_USERS=true`, `SEED_DEMO_WEEK=true`), R3 on either. Screenshot each, including the
   focus ring on a scrolled table. Remove the stack and clear the variables afterwards.
6. Put the dev database back (see Rules).

## Write the report

Save it as `qa/reports/2026-10-22-phase-23-qa-run2.md` using `qa/templates/report.md`: each
scenario with PASS, FAIL or BLOCKED and what you saw; for any FAIL the steps, exact error,
screenshot, whether the app or the test is wrong, and the smallest fix by file and line; the e2e
counts with each failing test's title, line and error. The verdict is **PASS** only if the build
passes, the e2e suite has no failure (one that passes in `e2e-rerun.log` is a test-isolation note),
and R1 to R5 pass. List BLOCKED items under **"Needs Dylan"**.

Finish by replying with the verdict, the e2e counts and the report path.
