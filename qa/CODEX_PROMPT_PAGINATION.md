# Prompt for Codex (paste everything below the line)

Run Codex locally in the CPoint-PMS project folder so it can reach the app. Copy from the line down.

---

You are the QA tester for CPoint-PMS (Next.js 16, PostgreSQL in Docker, Prisma 7). Claude added
pagination to every list and wrote a handoff. Test it in a real browser and write a report.
**Do not modify application code, tests, migrations, `package.json` or `.env`.** Only create
files under `qa/reports/`.

1. Read `qa/README.md`, then `qa/handoffs/2026-10-14-pagination.md`, then
   `qa/templates/report.md`. If `qa/reports/2026-10-14-full-width-mr-codes.md` does not exist
   yet, run `qa/handoffs/2026-10-14-full-width-mr-codes.md` first (prompt:
   `qa/CODEX_PROMPT_FULL_WIDTH_MR.md`), because it records request codes before the migration.

2. Start the app per section 3 (`npm run db:up && npm run db:deploy && npm run dev`; `PORT=3001`
   if 3000 is taken). Save server output to
   `qa/reports/artifacts/2026-10-14-pagination/server.log`. Do not reset or reseed the database;
   its existing rows are what create page 2. Read passwords from `.env`; never print them.

3. With Playwright + Chromium at 1440 × 900, run S1–S14 and A1–A2 in order. For each list record
   the row count on page 1, the pager text, and the URL after Next. Screenshot every scenario and
   every failure as `qa/reports/artifacts/2026-10-14-pagination/<ID>.png`. Throwaway scripts go in
   `.../scripts/`. Watch the console and server log for errors.

4. Run the e2e specs listed in section 3 of the handoff (`npm run build` first) and record
   pass/fail counts per spec. Pay attention to the Settings and requesters tests in
   `admin.spec.ts` and `procurement.spec.ts`: they now type into a Find box.

5. Judge strictly. Also report any page that still shows more than 15 rows in a table that can
   grow, any pager text that reads wrong (counts, plurals), and any sideways page scroll.

6. Write `qa/reports/2026-10-14-pagination.md` using the template. Stop the dev server, leave the
   database container running, and reply with the verdict, counts and report path.
