# Prompt for Codex: demo seed refresh QA (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Claude refreshed the demo week (D-090): website-camera scans,
10 sections a roll, named demo accounts, constructors and suppliers, and one day where the QI is
absent and the Floor Manager covers. No app screen or rule changed.

## Rules

Don't modify app code, tests, config, migrations, `package.json` or `.env`; only create files
under `qa/reports/`; never print passwords; never run `npm run demo:reset` on the dev database or
`docker compose down -v` on `cpoint-pms`. If the e2e suite adds rows to the dev database, remove
only the rows it added, as in earlier runs.

## Steps

1. Read `qa/handoffs/2026-10-22-demo-seed-refresh.md`.
2. `npm run db:up`, `npm run db:deploy`, `npm run build`, saving each output in
   `qa/reports/artifacts/2026-10-22-demo-seed-refresh/`.
3. Start a throwaway stack: `docker compose -p cpoint-qa up --build -d` with `DB_PORT=5434`,
   `APP_PORT=3002`, `SEED_DEMO_USERS=true`, `SEED_DEMO_WEEK=true`. Wait for "Demo week seeded" in
   its logs; save that line. In its database, check that stock equals the ledger (the CI query in
   `.github/workflows/ci.yml`) and count scans (expect about 120, at least 40).
4. Run D1 to D10 from the handoff on http://localhost:3002, with a screenshot each.
5. Run the full e2e suite (`npm run test:e2e`) against the dev database as `e2e.log`.
6. Remove the `cpoint-qa` stack (`docker compose -p cpoint-qa down -v`) and clear the variables.

## Write the report

Save it as `qa/reports/2026-10-22-demo-seed-refresh.md` using `qa/templates/report.md`: each
scenario with PASS, FAIL or BLOCKED and what you saw; for any FAIL the steps, exact error,
screenshot, whether the app or the test is wrong, and the smallest fix by file and line; the e2e
counts with each failing test's title, line and error. The verdict is **PASS** only if the build
passes, the e2e suite has no failure and D1 to D9 pass.

Finish by replying with the verdict, the e2e counts and the report path.
