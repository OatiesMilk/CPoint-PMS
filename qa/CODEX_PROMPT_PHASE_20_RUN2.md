# Prompt for Codex: Phase 20 QA, run 2 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 of Phase 20
(`qa/reports/2026-10-20-phase-20-website-camera-and-reports.md`) failed on three app issues and
ten stale e2e tests. The builder (Claude) fixed them and has not opened the app in a browser. This
run re-tests those fixes and runs three checks run 1 had to block, in a separate throwaway Docker
stack.

## Rules

- **Do not modify** application code, tests, config, migrations, `package.json`, `.env` or
  `cv/config.toml`. You may only create files under `qa/reports/`.
- Read passwords and tokens from `.env` or the page that shows them. Never print them or put them
  in a report or log.
- **Never run `npm run demo:reset`** and never `docker compose down -v`. Stop stacks with
  `docker compose stop` (or `docker compose -p cpoint-qa stop` for the throwaway one).
- The throwaway stack is project `cpoint-qa` on ports 3005 and 5440. Never change, stop or remove
  the default project's stack or volumes for it.
- Leave anything on port 3000 that isn't CPoint-PMS alone (start this app with `PORT=3001` if
  needed).
- Scenarios that need Dylan's hands or devices are listed in the handoff's section 6. Don't
  attempt them; list them again under "Needs Dylan".

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and `qa/handoffs/2026-10-20-phase-20-qa-fixes.md`.
2. Set up, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-20-phase-20-qa-fixes/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

3. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. The ten tests listed
   in the handoff's section 3 must now pass.
4. Start the app (`npm run dev`) and run R1 to R10 and the access check, in order. Take a
   screenshot for each High scenario. For R9, attach the downloaded `supplier-rolls.csv`.
5. Start the throwaway stack as the handoff's section 3 describes, then run U1, U2 and U3 in that
   order against `http://localhost:3005`. Stop it with `docker compose -p cpoint-qa stop`
   afterwards.

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you actually saw.
- **For any FAIL:** the steps, the exact message or error, a screenshot, whether the app or the
  test is wrong, and the smallest fix naming the file and line.
- The e2e passed and failed counts, and for each failing test its title, the failing line and the
  error.
- Any place a user still reads "Rework", "repair station", "In repair", "camera station" or
  "Components", with its page and a screenshot.

## Write the report

Save it as `qa/reports/2026-10-20-phase-20-qa-fixes.md`, using `qa/templates/report.md`. The
verdict is **PASS** only if the build passes, the e2e suite has no failure, and every High
scenario you could run passed. BLOCKED scenarios don't fail the run, but list them in a closing
section headed **"Needs Dylan"** as a short checklist he can do by hand.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the
report path.
