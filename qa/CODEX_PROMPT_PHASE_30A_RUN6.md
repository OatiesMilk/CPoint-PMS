# Prompt for Codex: Phase 30A QA, run 6 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS` on `feature/phase-30a-rolls-from-inventory`, with Docker
Desktop running, **after 01:00 Manila time**. No reset is needed. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 5 of Phase 30A (`qa/reports/2026-10-26-phase-30a-run5.md`)
passed U1, U2 and A1 (the Day label, the View links, axe 0). Its one failure was
`batches.spec.ts:244`, the batch notice, because the suite ran at 00:09 Manila: the test makes an
hourly schedule from 00:00, so no batch is due before 01:00 (`batches.spec.ts` lines 18 to 22 say
to run it after 01:00). No code changed since run 5. This run repeats only the e2e gate.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them. Never run `demo:reset` or
  `docker compose down -v`. Browser checks stay headless.

## Steps

1. Check the Manila time first (`[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date),
'Singapore Standard Time')`). If it's before 01:00, wait until it's past 01:00; don't run early.
2. Save each output as UTF-8 text in `qa/reports/artifacts/2026-10-26-phase-30a-run6/`:
   `npm run db:up`, `npx prisma migrate status` (up to date), `npm run build`, and run 1's ledger
   query (step 2 of `qa/CODEX_PROMPT_PHASE_30A.md`) as `ledger.txt`.
3. With no server of your own running and `E2E_BASE_URL` unset
   (`Remove-Item Env:E2E_BASE_URL -ErrorAction SilentlyContinue`), run `npm run test:e2e` and save
   it as `e2e.log`. Then run `batches` alone with `--workers=1` as `e2e-files.log`.
4. Save the ledger check again as `ledger-after.txt`.

## Write the report

Save it as `qa/reports/2026-10-26-phase-30a-run6.md` (use the Manila date if it's past midnight
there, and say so), using `qa/templates/report.md`, with the Manila time each run started. The
verdict is **PASS** only if the migration is up to date, the build passes, the full suite and the
`batches` run have **no failure** and `off_ledger` is 0 before and after. For any FAIL: the exact
message, app or test, and the file and line. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note, linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30A_RUN6]]` and the report.

Finish by replying with the verdict, the e2e counts and the report path.
