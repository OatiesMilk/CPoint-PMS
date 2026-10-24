# Prompt for Codex: Phase 25 QA, run 3 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running, on the branch with Claude's
run 2 fixes. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 2 of Phase 25 is `qa/reports/2026-10-24-phase-25-run2.md`:
FAIL, both failures in `tests/e2e/production.spec.ts`. Claude fixed them. Re-check only those.

| ID  | Run 2 finding                                                        | What Claude changed                                                                                                                      |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | The D-088 test matched earlier runs' rows by the note "E2E FM cover" | The note is its own per run (`E2E FM cover <time>`), as the QI test already does                                                         |
| F2  | axe `color-contrast` on `li[data-index="0"] … div[data-title]`       | That element is a save toast caught mid-fade (half transparent). The test's axe check now waits for toasts to leave first. No app change |

## Rules

- **Test and report only (D-092).** Create files only under `qa/reports/`, plus your line in the
  vault's Daily note. Don't change code, tests, config, migrations, `package.json` or `.env`.
- Never print passwords or tokens. Never `demo:reset` the dev database. Leave port 3000 alone.

## Steps

1. `npm run db:up`, `npx prisma migrate status` (up to date), `npm run build`. Save outputs in
   `qa/reports/artifacts/2026-10-24-phase-25-run3/`.
2. **R1:** `npx playwright test tests/e2e/production.spec.ts --workers=1` **three times** in a row
   against the same dev database. All pass, with no strict-mode or color-contrast error.
3. **R2:** the full suite once, `npm run test:e2e`. No failure (one that passes alone with
   `--workers=1` is a test-isolation note).
4. **R3:** if the contrast error appears again, open `/production/plan` as the FM, save a quota and
   screenshot the toast once it has fully appeared; say whether its text is readable at rest.

## Write the report

Save `qa/reports/2026-10-24-phase-25-run3.md` from `qa/templates/report.md`: R1 to R3 with PASS,
FAIL or BLOCKED and the e2e counts. **PASS** only if the build passes and the three R1 runs and R2
have no failure. Add one line under "Agent sessions" in the vault's `Daily/2026-10-24.md` linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_25_RUN3]]` and the report. Reply with the verdict, the e2e
counts and the report path.
