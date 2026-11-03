# Prompt for Codex: Phase 30C run 3 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at 6966fcd), Docker
Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Phase 30C run 2 (`qa/reports/2026-11-03-phase-30c-run2.md`)
failed only on a test fault, now fixed. Read `qa/handoffs/2026-11-03-phase-30c-cuts-and-returns.md`
§8 and do T1 and T2.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/`. Don't run `npm run demo:reset`.
- Use the running `npm run dev` server (Dylan started it; note its port) and set
  `$env:E2E_BASE_URL` to that URL. Playwright stays headless.
- A spec that fails on a first-compile timeout, `ECONNRESET` or the 30 s limit under the full run:
  rerun it alone once and report both results. Put back any schedule, lunch or quota rows the full
  suite adds, as before.

## Write the report

Artifacts in `qa/reports/artifacts/2026-11-03-phase-30c-run3/`. Save the report as
`qa/reports/2026-11-03-phase-30c-run3.md` from `qa/templates/report.md`. **PASS** only if T1 and T2
pass (0 failures after any allowed rerun; skips with a reason are fine).

Then add one line under "Agent sessions" in the vault's Daily note for today
(`C:\dev\capstone-obsidian\Daily\`), linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30C_RUN3]]` and the
report.

Finish by replying with the verdict, the e2e counts and the report path.
