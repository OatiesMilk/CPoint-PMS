# Prompt for Codex: Phase 13 QA, run 3, e2e only (paste everything below the line)

Run Codex locally in the CPoint-PMS project folder, with Docker Desktop running. Copy from the
line down.

---

You are the QA tester for CPoint-PMS. Your run 2 report
(`qa/reports/2026-10-14-phase-13-material-requests-run2.md`) passed every manual scenario and
found three faults in the e2e tests (E1, E2, E3). The builder (Claude) corrected them in
`tests/e2e/procurement.spec.ts` without running them. This run only reruns the e2e specs. There
are **no manual scenarios**.

## Rules

- **Do not modify** application code, tests, migrations, `package.json` or `.env`. You may only
  create files under `qa/reports/`. Do not fix a failing test; report it.
- Read passwords from `.env`. Never print them.

## Steps

1. Read `qa/handoffs/2026-10-14-phase-13-material-requests-run3.md` and
   `qa/templates/report.md`.
2. Make sure no CPoint-PMS dev server is running. Leave the other project's Vite server on port
   3000 alone; the e2e server uses port 3100.
3. Run, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-14-phase-13-material-requests-run3/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run3/e2e-results
   npx playwright test tests/e2e/procurement.spec.ts --workers=1 --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run3/e2e-results-serial
   ```

   Logs: `build.log`, `e2e.log`, `e2e-serial.log`.

4. If any test fails, rerun **that test alone** once (`--grep "<title>"`) to see whether it fails
   every time or only sometimes, and say which.

## What to report for each failing test

- The title, the failing line and the exact error.
- What the page showed (the error context or screenshot).
- **App wrong** or **test wrong**, with one sentence of evidence. Two tests have never run past
  the lines that failed in run 2 (the short-delivery test and the cancel-and-copy test), so read
  what the page showed carefully before deciding.
- The smallest fix, naming the line.
- An axe failure (a soft assertion starting "axe on …") is an **app** finding. List the rule id,
  the impact and the element.

## Write the report

Save it as `qa/reports/2026-10-14-phase-13-material-requests-run3.md`, using
`qa/templates/report.md`:

- The verdict: **PASS** only if T1, T2 and T3 in the handoff all meet their expected result.
- A line each for E1, E2 and E3: fixed, or still failing.
- The three commands with their passed and failed counts.
- The detail above for each failure, then suggested fixes in priority order.
- Whether the "destination stream closed early" count or wording changed.

Finish by replying with the verdict, the three counts and the report path.
