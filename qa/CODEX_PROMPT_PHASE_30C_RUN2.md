# Prompt for Codex: Phase 30C run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at 6966fcd), Docker
Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Phase 30C run 1 failed (`qa/reports/2026-11-03-phase-30c-run1.md`).
Claude fixed the Keep dialog's Esc (F1) and two e2e test faults (F2), and changed every 30C screen
to plain words. Read `qa/handoffs/2026-11-03-phase-30c-cuts-and-returns.md` §7 and do R1 to R7.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/`. Don't run `npm run demo:reset` and leave the Settings values as they are.
- Browser checks in **your in-app browser** at the `npm run dev` URL. Playwright stays headless.
- **Restart `npm run dev` before you start** (stop the old one): the code changed, and run 1 showed
  a stale server gives wrong failures. Then set `$env:E2E_BASE_URL="http://localhost:3000"` (the dev
  port).

## Steps

1. Artifacts go in `qa/reports/artifacts/2026-11-03-phase-30c-run2/`.
2. R1 first, then R2 to R7 in order. Put back any schedule, lunch or quota rows the full suite adds,
   as in run 1.
3. A test that fails on a first-compile timeout, `ECONNRESET` or the 30 s limit under the full run:
   rerun that spec alone once and report both results.

## Write the report

Save it as `qa/reports/2026-11-03-phase-30c-run2.md` from `qa/templates/report.md`. **PASS** only if
R1 to R7 pass and e2e has 0 failures (skips with a reason are fine). For any FAIL: steps, what you
saw against what was expected, a screenshot, file and line if you can tell. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30C_RUN2]]` and the
report.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
