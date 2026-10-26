# Prompt for Codex: Phase 30A QA, run 3 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. No reset is needed for this
run. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 2 of Phase 30A (`qa/reports/2026-10-26-phase-30a-run2.md`)
passed R1, R2 and R4 and the Capture part of R3, with two e2e test faults. Claude fixed both:

- **F1:** the admin test matched the supplier code against the whole row's text, where the name and
  the code run together ("…f9ae3fESF"). It now reads the Code cell (`tests/e2e/admin.spec.ts`).
- **F2:** the camera fallback test still expected an `R-` or `B-` code; Phase 30A codes read
  `LR-JLS-002`. It now takes either (`tests/e2e/cv.spec.ts`).
- **B1 (R3 Finish and Correct):** no batch was left to finish after the reset. The same steps
  passed in run 1 (S10, S11) and that code hasn't changed since; `batches.spec.ts` covers them too
  and passed in run 2. Run R1 below only if a batch is due and unfinished when you start.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Never run `demo:reset` or `docker compose down -v` on the `cpoint-pms` project. Leave anything
  on port 3000 that isn't CPoint-PMS alone (`PORT=3001`).
- Tick only rolls on your own item `QA30R2-1` (LR-MT-010 is Scanned). Don't change finished demo
  batches.
- Browser checks stay headless (no visible Chrome windows).

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and the run 2 report.
2. Save each output as UTF-8 text in `qa/reports/artifacts/2026-10-26-phase-30a-run3/`:

   ```powershell
   npm run db:up
   npx prisma migrate status        # must say "Database schema is up to date!"
   npm run build
   ```

   Then save run 1's ledger query (step 2 of `qa/CODEX_PROMPT_PHASE_30A.md`) as `ledger.txt`
   (`off_ledger` must be 0).

3. Start the app with `npm run start` (`PORT=3001`).
   - **R1 (only if a batch is due and unfinished):** the handoff's S10 and S11 at 390 × 844 on
     LR-MT-010, with the ledger check after each. If every batch today is finished, mark R1
     **NOT NEEDED** (covered by run 1 S10 and S11 and `batches.spec.ts`), not BLOCKED.
4. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. Then run `admin` and
   `cv` alone with `--workers=1` and save them as `e2e-files.log`.
5. Save the ledger check again as `ledger-after.txt` (`off_ledger` must be 0).

## Write the report

Save it as `qa/reports/2026-10-26-phase-30a-run3.md`, using `qa/templates/report.md`. The verdict
is **PASS** only if the migration is up to date, the build passes, the full e2e suite and both file
runs have **no failure**, R1 passed or was not needed, and `off_ledger` is 0 before and after. For
any FAIL: the steps, the exact message, a screenshot, app or test, and the file and line you
suspect. Don't fix it.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-26.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30A_RUN3]]` and the report.

Finish by replying with the verdict, the e2e counts and the report path.
