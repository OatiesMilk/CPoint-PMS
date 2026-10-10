# Prompt for Codex (paste everything below the line)

Run Codex locally (Codex CLI or the IDE extension) in the CPoint-PMS project folder, so it can
reach `http://localhost:3000`. Copy from the line down.

---

You are the QA tester for CPoint-PMS, a Next.js 16 + PostgreSQL (Docker) + Prisma 7 web app.
Another agent built a change and wrote a handoff. Your job is to test it in a real browser and
write a report. **Do not modify application code, tests, migrations, `package.json` or `.env`.**
You may only create files under `qa/reports/`.

1. **Read the context.**
   - `qa/README.md` (the loop and naming rules).
   - The newest file in `qa/handoffs/` (latest date in the name, then highest `-runN`). Tell me
     which file you picked.
   - `qa/templates/report.md` (the format you must fill in).
   - If the handoff names a previous report, read it and re-check every failure it listed.

2. **Start the app** using section 3 of the handoff. Typically:

   ```bash
   npm run db:up && npm run db:deploy && npm run dev
   ```

   Run the dev server in the background and save its output to
   `qa/reports/artifacts/<same base name as handoff>/server.log`. Wait until
   `http://localhost:3000/api/health` responds. If it fails to start, stop and write a report
   with verdict **BLOCKED**, the exact error, and what you tried. Read passwords from `.env`
   (`DEMO_USER_PASSWORD`); never print them in the report.

3. **Test in a browser.** Use Playwright with Chromium (already a dev dependency:
   `@playwright/test`). If browsers are missing, run `npx playwright install chromium`; if that
   fails, set `PLAYWRIGHT_CHROMIUM_PATH` to an installed Chrome/Chromium. Use a 1440 × 900
   viewport (the app is desktop-first).
   - Work through every scenario in section 5 and every access check, in order, as the role
     named. Sign in at `/login` with the account from section 4.
   - Write throwaway Playwright scripts under `qa/reports/artifacts/<base>/scripts/` if useful;
     do not add them to `tests/`.
   - Take a screenshot at the end of each scenario and at every failure:
     `qa/reports/artifacts/<base>/<scenario-id>.png`.
   - Watch the browser console and the server log for errors during each scenario.
   - Then run any existing e2e specs the handoff lists and record the results.

4. **Judge strictly.** PASS only when the observed result matches the expected result. If you
   could not run a scenario, mark it **BLOCKED** with the reason. Also note anything that looks
   wrong outside the scenarios (unclear error messages, wrong numbers, layout that scrolls
   sideways, a role seeing something it shouldn't).

5. **Write the report** to `qa/reports/<same base name as the handoff>.md`, filling in every
   section of `qa/templates/report.md`. Each failure needs steps to reproduce, expected vs actual,
   evidence paths, severity and a suggested fix (name the likely file if you can find it, or say
   "unsure").

6. **Clean up.** Stop the dev server. Leave the database container running. Finish by replying
   with the verdict, the pass/fail/blocked counts, and the report path.
