# Prompt for Codex: Phase 30A QA, run 4 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. No reset is needed. Copy
from the line down.

---

You are the QA tester for CPoint-PMS. Run 3 of Phase 30A (`qa/reports/2026-10-26-phase-30a-run3.md`)
verified both run 2 fixes. Its one failure (F1) was `read ECONNRESET` on `GET /api/v1/attendance`
in `batches.spec.ts:369`, which passed when the file ran alone.

**Cause (Claude):** run 3 started the server by hand (`npm run start`, port 3001) and pointed the
tests at it with `E2E_BASE_URL`. That server closes idle connections after Node's default 5 s, so a
test that pauses between two API calls can reuse a connection the server just closed. When
`E2E_BASE_URL` is **not** set, `playwright.config.ts` (lines 33 to 43) starts its own server with
`--keepAliveTimeout 70000`, which is how CI runs. No code changed; this run uses that launch.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Never run `demo:reset` or `docker compose down -v` on the `cpoint-pms` project. Leave anything
  on port 3000 that isn't CPoint-PMS alone.
- Browser checks stay headless (no visible Chrome windows).

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and the run 3 report.
2. Save each output as UTF-8 text in `qa/reports/artifacts/2026-10-26-phase-30a-run4/`:

   ```powershell
   npm run db:up
   npx prisma migrate status        # must say "Database schema is up to date!"
   npm run build
   ```

   Then save run 1's ledger query (step 2 of `qa/CODEX_PROMPT_PHASE_30A.md`) as `ledger.txt`
   (`off_ledger` must be 0).

3. Make sure no CPoint-PMS server you started is still running, and that `E2E_BASE_URL` is not set
   in the shell or in `.env` (if `.env` sets it, say so in the report and stop; don't edit `.env`):

   ```powershell
   Remove-Item Env:E2E_BASE_URL -ErrorAction SilentlyContinue
   npm run test:e2e
   ```

   Playwright starts the app itself on port 3100. Save the output as `e2e.log`. Then run
   `batches` alone with `--workers=1` and save it as `e2e-files.log`.

4. Save the ledger check again as `ledger-after.txt` (`off_ledger` must be 0).

## Write the report

Save it as `qa/reports/2026-10-26-phase-30a-run4.md`, using `qa/templates/report.md`. The verdict
is **PASS** only if the migration is up to date, the build passes, the full e2e suite and the
`batches` run have **no failure**, and `off_ledger` is 0 before and after. For any FAIL: the steps,
the exact message, app or test, and the file and line you suspect. Don't fix it.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-26.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30A_RUN4]]` and the report.

Finish by replying with the verdict, the e2e counts and the report path.
