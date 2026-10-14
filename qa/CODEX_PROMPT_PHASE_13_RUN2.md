# Prompt for Codex: Phase 13 QA, run 2 (paste everything below the line)

Run Codex locally in the CPoint-PMS project folder, with Docker Desktop running. Copy from the
line down.

---

You are the QA tester for CPoint-PMS, a Next.js 16 + PostgreSQL (Docker) + Prisma 7 web app. You
tested Phase 13 yesterday and wrote `qa/reports/2026-10-13-phase-13-material-requests.md`. The
builder (Claude) fixed the one app fault you found and corrected the e2e tests. This is a short
second run: re-check the fix, run the six scenarios that were blocked, and rerun the e2e specs.
Claude did not open the app in a browser and did not run the e2e tests.

## Rules

- **Do not modify** application code, tests, migrations, `package.json` or `.env`. You may only
  create files under `qa/reports/`.
- Read passwords from `.env` (`DEMO_USER_PASSWORD`). Never print them.
- PASS only when what you observe matches the expected result. Otherwise FAIL or BLOCKED, with
  the reason. For every failure, say whether you think the app or the expectation is wrong.
- **A greyed-out (disabled) field must be left alone.** Never try to type into one. Yesterday's
  run was blocked by doing that.
- **If a scenario does not end as expected, stop the sequence.** Mark it, mark the scenarios that
  depend on it BLOCKED, and do not go on to Close short. Before each scenario, confirm the request
  is in the state the previous one should have left.

## 1. Read first

1. **The handoff: `qa/handoffs/2026-10-14-phase-13-material-requests-run2.md`.** Use this exact
   file.
2. Your previous report, `qa/reports/2026-10-13-phase-13-material-requests.md`, for F1, F3, F4
   and F5.
3. `qa/templates/report.md`.

## 2. Prepare

1. Have the four test files ready outside the project: `photo.jpg`, `note.pdf`, `fake.pdf`,
   `big.jpg` (over 10 MB).
2. Start the app:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run dev
   ```

   Save the server output to
   `qa/reports/artifacts/2026-10-14-phase-13-material-requests-run2/server.log`.

3. **Check the port.** Yesterday another project's Vite server was already on port 3000. Confirm
   `http://localhost:3000/api/health` is answered by CPoint-PMS. If Next.js chose another port,
   use it for every URL and say so in the report.
4. Create the data in section 4 of the handoff: the two `QA13B` items, request REQ-F, then approve
   and order it. Confirm REQ-F shows **Ordered** before R1.

## 3. Manual scenarios

Playwright with Chromium, 1440 × 900.

- Run **R1 to R13 in order**.
- R1 to R4 re-check yesterday's F1. The point is that a file stays attached after an error, after
  removing another file, and when files are picked one at a time. After each step, read the
  "Files to upload" list on the page and record exactly which file names it shows.
- R5, R7 and R11 check stock numbers in Inventory. A wrong number is a High severity failure.
- R7: fill only QA13B Tacks and QA13B eyelets. QA13B Glue is disabled; do not touch it. After
  clicking **Record delivery**, wait for the dialog to close and confirm two deliveries exist
  before going on.
- R11 cannot be undone. Only run it if R7 to R10 ended as expected.
- Screenshot every scenario to
  `qa/reports/artifacts/2026-10-14-phase-13-material-requests-run2/<id>.png`.
- Watch the browser console and `server.log`. Yesterday you saw a React hydration warning about
  `caret-color` on two pages. Say whether it appears again, on which pages, and whether it also
  appears in a headed browser.

## 4. E2E specs

**Stop the dev server first.**

```bash
npm run build
npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-14-phase-13-material-requests-run2/e2e-results
```

Save the output as UTF-8 text to `e2e.log` in the artifacts folder (in PowerShell, pipe through
`Out-File -Encoding utf8`).

Yesterday: 36 passed, 9 failed of 45. The nine were all in `procurement.spec.ts`. They have been
corrected but have never passed, so a test may now fail further down than before. For **each**
failing test report:

- the title, the failing line, and the exact error;
- what the page showed (screenshot or error context);
- your judgement, **app wrong** or **test wrong**, with one sentence of evidence;
- the smallest change that would fix it, naming the line.

If a test fails only in the parallel run, rerun `procurement.spec.ts` alone with `--workers=1`
and report both results. Do not fix the tests.

## 5. Write the report

Save it as `qa/reports/2026-10-14-phase-13-material-requests-run2.md`, using
`qa/templates/report.md`:

- The verdict and counts out of 13.
- A line each for F1, F3, F4 and F5 from the previous report: fixed, or still failing.
- One row per scenario with its evidence file.
- The e2e counts and the per-failure detail above.
- Suggested fixes in priority order.

## 6. Clean up

Stop the dev server and the Playwright server. Leave the database container and the other
project's Vite server running. Reply with the verdict, the counts, the e2e counts and the report
path.
