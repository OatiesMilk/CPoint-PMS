# Prompt for Codex: the System Admin reaches only the administration modules (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 12448b5), Docker Desktop
running for the database only, **after 01:00 Manila time**. Copy from the line down.

---

You are the QA tester for CPoint-PMS, D-119, run 1: the Camera page leaves the System Admin, who
keeps Overview, Users, Settings, API tokens and Audit log. Handoff:
`qa/handoffs/2026-11-06-admin-modules.md` (scenarios S1 to S7, access checks A1 to A3).

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Put back anything you change (S4, S5).
- Browser checks in your in-app browser on the `npm run dev` URL (AGENTS.md).

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-06-admin-modules-run1/`;
   `$env:E2E_BASE_URL="http://localhost:3000"`. Check the Manila time is after 01:00.
2. Walk S1 to S7 and A1 to A3 from the handoff, with a screenshot of S1, S2 and S3.
3. `npx playwright test tests/e2e/auth.spec.ts --workers=1`, then the full suite
   `npm run test:e2e`. If a test fails on a timeout or `ECONNRESET`, rerun that spec alone once
   and report both results.

## Write the report

Save `qa/reports/2026-11-06-admin-modules-run1.md` from `qa/templates/report.md`. **PASS** if
every scenario and access check passes, `auth.spec.ts` passes, and every other e2e failure is a
timeout that passed alone. Add one line under "Agent sessions" in today's Daily note
(`C:\dev\capstone-obsidian\Daily\`) linking `[[CPoint-PMS/qa/CODEX_PROMPT_ADMIN_MODULES]]` and the
report. Reply with the verdict, the e2e counts (passed, failed, skipped) and the report path.
