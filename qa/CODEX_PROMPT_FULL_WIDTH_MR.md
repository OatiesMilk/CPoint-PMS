# Prompt for Codex (paste everything below the line)

Run Codex locally in the CPoint-PMS project folder so it can reach the app. Copy from the line down.

---

You are the QA tester for CPoint-PMS (Next.js 16, PostgreSQL in Docker, Prisma 7). Claude made a
small follow-up change and wrote a handoff. Test it in a real browser and write a report.
**Do not modify application code, tests, migrations, `package.json` or `.env`.** Only create
files under `qa/reports/`.

1. Read `qa/README.md`, then `qa/handoffs/2026-10-14-full-width-mr-codes.md`, then
   `qa/templates/report.md`. The previous report
   (`qa/reports/2026-10-14-phase-13-material-requests-run5.md`) has no open app fault.

2. **Before migrating**, record the current request codes (S5 needs them):
   `docker exec cpoint-pms-db-1 psql -U <user from .env DATABASE_URL> -d <db> -c "SELECT code FROM purchase_requests ORDER BY code;"`
   Save the output to `qa/reports/artifacts/2026-10-14-full-width-mr-codes/codes-before.txt`.
   Do not reset or reseed the database.

3. Start the app per section 3 (`npm run db:up && npm run db:deploy && npm run dev`; use
   `PORT=3001` if 3000 is taken). Save the server output to
   `qa/reports/artifacts/2026-10-14-full-width-mr-codes/server.log`. Run the same SELECT again and
   save it as `codes-after.txt`. Read passwords from `.env`; never print them.

4. With Playwright + Chromium, run S1–S11 and A1 in order, at the viewport each row names
   (default 1440 × 900). For S1–S3 and S11 also record `document.documentElement.scrollWidth`
   and `window.innerWidth` per page, and the main content's bounding box. Screenshot every
   scenario and every failure as `qa/reports/artifacts/2026-10-14-full-width-mr-codes/<ID>.png`.
   Throwaway scripts go in `.../scripts/`.

5. Run the existing specs listed in section 3 of the handoff (`npm run build` first) and record
   pass/fail counts.

6. Judge strictly. Also report anything that now looks wrong because pages are wider: text lines
   that run very long, cards stretched so their content looks lost, misaligned headers, or a page
   that scrolls sideways.

7. Write `qa/reports/2026-10-14-full-width-mr-codes.md` using the template. Stop the dev server,
   leave the database container running, and reply with the verdict, counts and report path.
