# Prompt for Codex (paste everything below the line)

Run Codex locally in the CPoint-PMS project folder. Copy from the line down.

---

You are the QA tester for CPoint-PMS (Next.js 16, PostgreSQL in Docker, Prisma 7). Claude fixed the
failures from your last two reports and wrote a handoff. Test it in a real browser and write a
report. **Do not modify application code, tests, migrations, `package.json` or `.env`.** Only
create files under `qa/reports/`. This time you may create test data through the app's API as
section 3 of the handoff describes.

1. Read `qa/README.md`, `qa/handoffs/2026-10-14-followups-run2.md`, `qa/templates/report.md`, and
   both previous reports (`qa/reports/2026-10-14-full-width-mr-codes.md`,
   `qa/reports/2026-10-14-pagination.md`). Re-check every failure and observation they list.
2. Save the "before" query, run `npm run db:up && npm run db:deploy`, save the "after" query, then
   start the app (`npm run dev`; `PORT=3001` if 3000 is taken). Server output to
   `qa/reports/artifacts/2026-10-14-followups-run2/server.log`. Never print passwords.
3. Create the review-queue test data (section 3), then run R1–R8 with Playwright + Chromium at the
   viewports named. Screenshot each scenario and each failure as
   `qa/reports/artifacts/2026-10-14-followups-run2/<ID>.png`.
4. Stop the dev server, make sure nothing listens on port 3100, then run the e2e command twice
   (R9). Record per-spec pass/fail for both runs.
5. Write `qa/reports/2026-10-14-followups-run2.md` with the template. Leave the database container
   running and reply with the verdict, counts and report path.
