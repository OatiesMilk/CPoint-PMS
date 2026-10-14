# Prompt for Codex: Phase 13 QA (paste everything below the line)

Run Codex locally (Codex CLI or the IDE extension) in the CPoint-PMS project folder, with Docker
Desktop running, so it can reach `http://localhost:3000`. Copy from the line down.

---

You are the QA tester for CPoint-PMS, a Next.js 16 + PostgreSQL (Docker) + Prisma 7 web app for a
shoe factory. Another agent (Claude) built Phase 13 of the procurement module and wrote a handoff.
Claude ran lint, typecheck, unit tests and the build, but **never opened the app in a browser and
never ran the e2e tests**. You are the first to see these screens, so your report is the only
evidence that they work. Test in a real browser and write the report.

## Rules

- **Do not modify** application code, tests, migrations, `package.json` or `.env`. You may only
  create files under `qa/reports/`.
- Read passwords from `.env` (`DEMO_USER_PASSWORD`). Never print them in the report or the logs.
- Judge strictly. PASS only when what you observe matches the expected result. If you could not
  run a scenario, mark it BLOCKED with the reason. Never mark something PASS because it probably
  works.
- When a result differs from the handoff, decide which is wrong: the app, or the handoff's
  expectation. Say which you think it is and why. The last two reports each had one failure that
  turned out to be a wrong expectation.

## 1. Read first

1. `qa/README.md` (the loop and naming rules).
2. **The handoff: `qa/handoffs/2026-10-13-phase-13-material-requests.md`.** Use this exact file.
   Do not pick "the newest by date": the Phase 12 handoff has the same date.
3. `qa/templates/report.md` (the format you must fill in).
4. `qa/reports/2026-10-13-phase-12-material-requests.md` (the previous report). It found no app
   fault, so there is nothing to re-check from it.

Tell me which handoff you are using before you start testing.

## 2. Prepare

1. Create the four test files from section 4 of the handoff in a scratch folder **outside** the
   project: `photo.jpg` (a real image), `note.pdf` (a real PDF), `fake.pdf` (a text file renamed),
   and `big.jpg` (over 10 MB; in PowerShell: `fsutil file createnew big.jpg 11534336`).
2. Start the app as section 3 of the handoff says:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run db:generate
   npm run dev
   ```

   Run the dev server in the background and save its output to
   `qa/reports/artifacts/2026-10-13-phase-13-material-requests/server.log`. Wait until
   `http://localhost:3000/api/health` responds. `db:deploy` should say nothing is pending. If the
   app does not start, stop and write a report with verdict **BLOCKED**, the exact error and what
   you tried.

3. Do **not** run `npm run demo:seed`. The dev database already has data.
4. Create the test data from section 4: one supplier if none exists, the three `QA13` inventory
   items, and requests REQ-A to REQ-D. Record each request's code (`PR-2026-…`) in the report.

## 3. Manual scenarios (dev server on port 3000)

Use Playwright with Chromium at a 1440 × 900 viewport. If Chromium is missing, run
`npx playwright install chromium` and say in the report which browser you used.

- Run **S1 to S44, then A1 to A10, in order**. Later scenarios depend on the state earlier ones
  leave behind, so do not skip ahead or reorder. If one fails in a way that blocks the next, say
  so and mark the dependent ones BLOCKED.
- Sign in at `/login` as the role each scenario names.
- For each scenario, check the exact text the handoff quotes. Two differences are not failures and
  are stated in the handoff: curly apostrophes or quotation marks where the handoff has straight
  ones, and a label and its value in two columns where the handoff writes them with a colon.
- **Check the numbers, not only the labels.** After every delivery, open Inventory and confirm the
  stock on hand is exactly what the handoff says (S16, S23, S26). A wrong stock figure is a High
  severity failure.
- **Uploads:** attach files through the page's file picker (Playwright `setInputFiles`). For the
  refused files (S8, S9, S21), confirm three things: the message names the file, nothing was
  saved (reload and check the status), and no stock changed.
- **Proof files:** in S15, confirm the image and the PDF really open in a new tab and show
  content. In A7 and A8, confirm the file is not returned.
- **S44** needs one SQL statement, given under the scenario table. Use `POSTGRES_USER` and
  `POSTGRES_DB` from `.env`. This is the only database change you may make by hand. If you cannot
  run it, mark S44 BLOCKED.
- **S43** is at 960 px wide: check for sideways page scroll with
  `document.documentElement.scrollWidth <= window.innerWidth`.
- Take a screenshot at the end of every scenario and at every failure, saved as
  `qa/reports/artifacts/2026-10-13-phase-13-material-requests/<scenario-id>.png`.
- Watch the browser console and `server.log` during each scenario. Report any page exception or
  server error, even when the scenario passes. HTTP 401, 403, 409 and 422 responses in the access
  checks are expected.
- Throwaway scripts go under `qa/reports/artifacts/2026-10-13-phase-13-material-requests/scripts/`.
  Do not add anything to `tests/`.

## 4. Existing e2e specs (production build on port 3100)

**Stop the dev server first.** A build and `npm run dev` both write to `.next`.

```bash
npm run build
npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-13-phase-13-material-requests/e2e-results
```

Save the output to `build.log` and `e2e.log` in the artifacts folder.

`tests/e2e/procurement.spec.ts` has two changed tests and six new ones that **have never been
run**. For every failing test, report:

- the test title and the failing line;
- what the page actually showed (a screenshot or the trace);
- your judgement: **the app is wrong**, or **the test is wrong** (a bad selector, a wrong expected
  string, a timing problem), with one sentence of evidence. Compare against what you saw in the
  matching manual scenario.

Do not fix the tests. Also report any axe (accessibility) finding the specs print.

## 5. Also look for

Report these in "Other observations" even though no scenario asks:

- Any place that still says "Mark received", which was replaced by "Record delivery".
- Any count, ranking or score per person. The label "Raised by Floor Manager" on a request is
  fine; a number per person is not.
- A role seeing a button or a file it should not.
- A message that does not say which field is wrong or how to fix it.
- Text that is cut off, overlaps, or a page that scrolls sideways.
- The items listed under "Out of scope / known issues" in the handoff are **not** failures. Do not
  report them.

## 6. Write the report

Save it as `qa/reports/2026-10-13-phase-13-material-requests.md`, filling in every section of
`qa/templates/report.md`:

- The verdict, and counts of passed, failed and blocked out of 54 (44 scenarios and 10 access
  checks).
- One table row for every scenario and access check, with the evidence file name.
- For each failure: severity, role and page, steps to reproduce, expected against actual, evidence
  paths, and a suggested fix. Name the likely file if you can find it, or say "unsure". Say
  whether you think the app or the handoff is wrong.
- The e2e results: the command, passed and failed counts, and the judgement above for each
  failure.
- Suggested fixes in priority order.

## 7. Clean up

Stop the dev server and the Playwright server. Leave the database container running. Check the
saved logs for the demo password and remove it if it appears. Finish by replying with the verdict,
the pass, fail and blocked counts, the e2e counts, and the report path.
