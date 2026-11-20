# Prompt for Codex: Phase 34 final defects, repairs and work in progress, run 4 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`) on a **weekday after 01:00 Manila**, Docker Desktop
running for the database only, `npm install` done.

---

You are the QA tester for CPoint-PMS: Phase 34 (D-130), run 4. Handoff:
`qa/handoffs/2026-11-20-phase-34-defects-and-repairs.md`. Run 3 report:
`qa/reports/2026-11-20-phase-34-run3.md` (FAIL, on two test faults). A full pass here closes Phase 34 QA.

## Rules

Same as `qa/CODEX_PROMPT_PHASE_34.md`: test and report only (change no application code, tests, docs,
migrations, config, `package.json` or `.env`; write only under `qa/reports/` and your line in the
vault's Daily note); in-app browser for manual scenarios, headless Playwright for e2e and API calls;
`$env:E2E_BASE_URL="http://localhost:3000"` and `--workers=2`; a first-compile timeout or
`ECONNRESET`: rerun that spec alone once and report both results, never change a timeout.

## What changed since run 3 (specs only, no application code)

- **F2:** `final-defects.spec.ts` no longer expects today's whole-line `passed` to rise by exactly 1 (another
  worker's spec finishes and deletes batches today). It keeps `repairedPassed` + 1 and checks
  `passed = max(0, finished − failed) + repairedPassed` inside one response. A new unit test covers the
  five-argument `quotaProgress`. This unblocks the serial tail of that file (A3, A-93, reports, suggestion,
  final defect types, no names), which has never yet run to the end.
- **F1:** the D-088 test in `batches.spec.ts` now reads the attendance roster and version just before each
  save and once more after a 409 (other specs remove E2E constructors while it runs), and restores from the
  first read.
- **C6:** closed as passed from run 3 (a tooling artefact: a tool that writes the field's value without real
  input events leaves the form's prefill; typing `1705` with the keyboard moved the clock). Run 4 only
  confirms it with a headless script, below.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the phase summary
   `Notes/Phases/Defense revisions (32 to 36).md`).
2. Setup, in a PowerShell terminal at `C:\dev\CPoint-PMS`, in this order:
   1. **`docker compose stop app`** first (the Docker app holds port 3000). Also stop any other server on
      port 3000 and any older `npm run dev` of this project.
   2. `npm run db:up`
   3. Back up: `docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/backup.dump`, then
      `docker cp cpoint-pms-db-1:/tmp/backup.dump storage\backups\before-phase-34-run4.dump`.
   4. `npm run db:deploy`
   5. A **fresh** `npm run dev`, then check `http://localhost:3000/api/health`.
   6. **`npm run demo:reset '--' --yes`**, then check the demo clock reads **Real time**.
3. Manual: only the **C6 confirmation** (it doesn't gate the pass). A headless Playwright script, run from the
   repo root and saved as `qa/reports/artifacts/2026-11-20-phase-34-run4/c6-clock.mjs` (a report artifact, not
   a test), with the sign-in adapted to the login page if the labels differ:

   ```js
   import { chromium } from "playwright";
   const browser = await chromium.launch();
   const page = await (await browser.newContext({ locale: "en-GB" })).newPage(); // a 24-hour time field
   await page.goto("http://localhost:3000/login");
   await page.getByLabel("Email").fill("manager@cpoint.local");
   await page.getByLabel("Password").fill(process.env.DEMO_USER_PASSWORD);
   await page.getByRole("button", { name: "Sign in" }).click();
   await page.waitForURL((u) => u.pathname !== "/login");
   await page.getByRole("button", { name: "Change time" }).click();
   await page.getByLabel("Time").click();
   await page.keyboard.type("1705");
   const [res] = await Promise.all([
     page.waitForResponse((r) => r.url().endsWith("/api/v1/demo/clock")),
     page.getByRole("button", { name: "Set clock" }).click(),
   ]);
   console.log(res.request().postData(), res.status(), await res.text());
   await page.reload();
   console.log(await page.getByTestId("demo-clock").innerText()); // expect "… · 17:05"
   await page.getByRole("button", { name: "Back to real time" }).click();
   console.log(await page.getByTestId("demo-clock").innerText()); // expect "Real time: …"
   await browser.close();
   ```

   Pass when the request body is `{"date":"<today Manila>","time":"17:05"}`, the status is 200, the reloaded
   band reads 17:05 and Back to real time returns "Real time". Then the second witness:
   `SELECT "createdAt", after FROM audit_logs WHERE action = 'demo_clock.set' ORDER BY "createdAt" DESC LIMIT 2;`
   (the newest row's `after.at` is `real time`, the one before it `<today>T09:05:00.000Z`). If the script
   itself can't run, say so and keep C6 closed on run 3's in-app keyboard result. Only a non-200, or a band that
   doesn't move **with keyboard typing**, is a product fault.

4. E1, each with `--workers=2`, in this order:
   1. Targeted: `npx playwright test tests/e2e/final-defects.spec.ts tests/e2e/stage-wip.spec.ts tests/e2e/batches.spec.ts tests/e2e/inspection-queue.spec.ts tests/e2e/reports.spec.ts --workers=2`.
      Expect 28 tests, all passing. The two Phase 34 specs are serial: for any failure say which tests did not
      run, and why.
   2. **Right after it, before the full suite**, the same two queries as run 3 (both expected 0), with the SQL
      in single quotes in PowerShell:
      `SELECT count(*) FROM production_check_ins WHERE day = ANY(ARRAY[<the five days of final-defects.spec.ts and inspection-queue.spec.ts, as in run 3>]::date[])` and
      `SELECT count(*) FROM inspection_findings f WHERE NOT EXISTS (SELECT 1 FROM production_check_ins c WHERE c.id = f."checkInId")`.
   3. The full suite: `npx playwright test --workers=2` (about 120 tests, 2 skipped).
   4. **`npm run demo:reset '--' --yes` at the end**, and the demo clock back on **Real time**.
5. Write `qa/reports/2026-11-20-phase-34-run4.md` (or today's date and the next run number) from
   `qa/templates/report.md`, even on a full pass: PASS, PASS WITH ISSUES or FAIL, every scenario, the e2e
   counts (and any test that did not run), and each failure with steps, expected, actual and a screenshot or
   log. A full pass is the targeted run 28 of 28 and the full suite with no failure and no test that did not
   run. Change no code: anything that fails comes back to the planning thread.
6. Add one line under "Agent sessions" in the vault's `Daily/` note linking this prompt, the handoff and the
   report as `[[CPoint-PMS/qa/…]]`.
