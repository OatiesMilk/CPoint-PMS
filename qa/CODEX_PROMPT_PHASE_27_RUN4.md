# Prompt for Codex: Phase 27 QA, run 4 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running, on the checkout with
Claude's run 3 fixes. No database reset is needed. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 3 of Phase 27 (batches) is
`qa/reports/2026-10-24-phase-27-run3.md`: FAIL, e2e 71 passed, 2 failed, 1 skipped, 3 did not
run. Run 2's three fixes passed. Claude fixed the two new failures in the tests; the app is
unchanged. Re-check only the e2e suite.

| ID  | Run 3 finding                                                      | What Claude changed                                                                                                                                                       |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | `batches.spec.ts` QI phone test: 2 toasts never left before axe    | On a phone the toasts show where the last button pressed was, and a pointer resting on a toast pauses it. The axe helper moves the pointer to the corner first            |
| F2  | `rolls.spec.ts`: the roll's page stayed on Reports after the click | The Find box updates the URL 300 ms after typing; under load that navigation landed after the click on the roll. The test now waits for `?q=` in the URL before it clicks |

The page context naming the Floor Manager in run 3's F1 is another open page in the same browser
(each test opens its own sign-in context), not the QI's page.

## Rules

- **Test and report only (D-092).** Create files only under `qa/reports/`, plus your line in the
  vault's Daily note. Don't change code, tests, config, migrations, `package.json` or `.env`.
- Never print passwords or tokens. Never `demo:reset` the dev database. Leave port 3000 alone.
- Put back what the e2e suite leaves behind, as in run 2 (attendance, future schedules and
  quotas, test suppliers); save the run 3 baseline queries before and after.

## Steps

1. Read `qa/README.md` and the run 3 report.
2. `npm run db:up`, `npx prisma migrate status` (must be up to date), `npm run build`. Save
   outputs in `qa/reports/artifacts/2026-10-24-phase-27-run4/`.
3. **R1 (F1, F2):** the two specs alone (after 01:00 Manila). No failure.

   ```bash
   npm run test:e2e -- tests/e2e/batches.spec.ts tests/e2e/rolls.spec.ts --workers=1
   ```

4. **R2:** the full suite once, `npm run test:e2e`. No failure; a failure that passes alone with
   `--workers=1` is a test-isolation note.
5. Clean up and rerun the baseline queries.

## Write the report

Save `qa/reports/2026-10-24-phase-27-run4.md` from `qa/templates/report.md`: R1 and R2 with
PASS, FAIL or BLOCKED, the e2e counts, and each failure's test title, error and line. **PASS**
only if R1 and R2 pass. Add one line under "Agent sessions" in the vault's `Daily/2026-10-25.md`
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_27_RUN4]]` and the report. Reply with the verdict,
the e2e counts and the report path.
