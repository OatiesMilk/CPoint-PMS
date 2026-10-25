# Prompt for Codex: Phase 27 QA, run 3 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running, on the checkout with
Claude's run 2 fixes. No database reset is needed. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 2 of Phase 27 (batches) is
`qa/reports/2026-10-24-phase-27-run2.md`: FAIL, R1, R3 and R4 passed; e2e 67 passed, 5 failed,
1 skipped, 4 did not run. All five failures were test faults. Claude fixed the tests; the app is
unchanged. Re-check only the e2e suite.

| ID  | Run 2 finding                                                        | What Claude changed                                                                                                                                                    |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | `admin.spec.ts`: the supplier row wasn't found to deactivate         | The test went to the Thresholds tab to check that Shoe types is gone, then looked for the row there. It now goes back to `?tab=suppliers` and finds the supplier first |
| F2  | `auth.spec.ts`: 3 nav tests expected "Production"                    | The expected nav says "Batches" for the FM, QI and Admin                                                                                                               |
| F3  | `batches.spec.ts`: Lunch starts was disabled in the lunch-break test | The suite's own "no lunch" row for today starts the form on "No lunch break" (which disables both fields). The test unticks it first                                   |

## Rules

- **Test and report only (D-092).** Create files only under `qa/reports/`, plus your line in the
  vault's Daily note. Don't change code, tests, config, migrations, `package.json` or `.env`.
- Never print passwords or tokens. Never `demo:reset` the dev database. Leave port 3000 alone.
- Put back what the e2e suite leaves behind, as in run 2 (attendance, future schedules and
  quotas, test suppliers); save the run 2 baseline queries before and after.

## Steps

1. Read `qa/README.md` and the run 2 report.
2. `npm run db:up`, `npx prisma migrate status` (must be up to date), `npm run build`. Save
   outputs in `qa/reports/artifacts/2026-10-24-phase-27-run3/`.
3. **R1 (F1 to F3):** the three specs alone (after 01:00 Manila). No failure.

   ```bash
   npm run test:e2e -- tests/e2e/admin.spec.ts tests/e2e/auth.spec.ts tests/e2e/batches.spec.ts --workers=1
   ```

4. **R2:** the full suite once, `npm run test:e2e`. No failure; a failure that passes alone with
   `--workers=1` is a test-isolation note.
5. Clean up and rerun the baseline queries.

## Write the report

Save `qa/reports/2026-10-24-phase-27-run3.md` from `qa/templates/report.md`: R1 and R2 with
PASS, FAIL or BLOCKED, the e2e counts, and each failure's test title, error and line. **PASS**
only if R1 and R2 pass. Add one line under "Agent sessions" in the vault's `Daily/2026-10-25.md`
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_27_RUN3]]` and the report. Reply with the verdict,
the e2e counts and the report path.
