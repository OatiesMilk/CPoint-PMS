# Prompt for Codex: Phase 42, Roll tags (paste everything below the line)

Run Codex on the **PC**, in `D:\IMPORTANT SHIT HERE\12th Term - BSIT\CAP2\CPoint-PMS` (read and write repo files there, not through any
vault junction). Docker Desktop running for the database only, `npm install` done. **Skip every vault step** (the vault is on
the laptop, not on this PC): don't read it and don't write a Daily line; the report in `qa/reports/` is the record, and Claude
adds the vault lines later. **Nothing opens on Dylan's screen:** no in-app browser, no preview pane, no visible Chrome windows;
every browser step is a headless Playwright script.

---

You are the QA tester for CPoint-PMS: Phase 42 (roll tags: every roll code is `LR-<tag>-<digits>`; Add rolls picks a tag per
roll and takes optional digits; the Floor Manager keeps the tag list under Inventory → Roll tags).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config, `package.json` or `.env`. Create
  files only under `qa/reports/` (the report and its artifacts). Anything that fails goes in the report for Claude to fix.
- Headless only: `require('playwright')` with `chromium.launch()` and `page.screenshot({ path })`; sign in with the demo accounts
  (`DEMO_USER_PASSWORD` from `.env`; `manager@cpoint.local`, `inspector@cpoint.local`, `admin@cpoint.local`,
  `constructor@cpoint.local`).
- `npm run check` is Claude's (it passed in a clean copy of the repository). Run only what is named below.
- This change **adds a database migration** (`20261126090000_roll_tags`) and a Prisma model: run `npm run db:generate` after
  `npm run db:deploy`, and restart any dev server started before that.

## Do

1. Read `qa/handoffs/2026-11-26-roll-tags.md` (scenarios T1 to T19 and A1 to A5, the SQL for T1, and what is out of scope) and
   `docs/prompts/plans/phase-42-roll-tags-plan.md` (the design). Ignore Phases 40 and 41's files.
2. **T1 first, on the dev database as it is** (it holds rolls from before this migration; don't reset it yet): in PowerShell at
   the repo folder, `docker compose stop app`, stop any older `npm run dev`, `npm run db:up`, then `npm run db:deploy`
   (**quote the exact output; a SQL error here is the most important finding**), `npm run db:generate`, then run the SQL in
   the handoff with `docker compose exec db psql -U <user> -d <database>` (use the values in `.env`). Record the counts.
3. `npm run dev` (note the port), then `npm run demo:reset '--' --yes`. If `demo:reset` fails with a foreign-key error (as in
   the Phase 41 report), stop the dev server, rerun it, and report both outcomes.
4. Run T2 to T17 and T19 at 1366 × 768 as the Floor Manager, and T18 at 1024 × 768 (screenshots into
   `qa/reports/artifacts/<today>-phase-42/`): quote each box's text, the code lines under the Add rolls rows, the toasts and the
   error lines word for word.
5. Run A1 to A5 (pages with `page.goto` and the status or final URL; the API with the signed-in context's `request`, quoting
   status and message).
6. Run these e2e specs against the dev server (`$env:E2E_BASE_URL="http://localhost:<port>"`; the helpers write to the database, so
   `DATABASE_URL` from `.env` must be set): `tests/e2e/inventory.spec.ts` (the new block is "Roll tags (Phase 42, D-139)";
   the Add rolls test "leather rolls are added on the item with their areas…" changed; the Forbidden test gained `/inventory/tags` and
   `/api/v1/roll-tags`), then `tests/e2e/admin.spec.ts`, `tests/e2e/rolls.spec.ts`, `tests/e2e/supplier-quality.spec.ts`,
   `tests/e2e/corrections.spec.ts`, `tests/e2e/capture.spec.ts`, `tests/e2e/auth.spec.ts`. The new tests were written but **never
   run**: if one fails, read the test first and say in the report whether the test or the app is wrong (selectors, wording, order),
   with the evidence. On a first-compile timeout or `ECONNRESET` rerun that spec alone once and report both results.
7. Write `qa/reports/<today>-phase-42-run1.md` (for example `qa/reports/2026-11-26-phase-42-run1.md`) from
   `qa/templates/report.md`: PASS, PASS WITH ISSUES or FAIL, a table of T1 to T19, A1 to A5 and the e2e results, and for each
   failure the steps, expected, actual and evidence. Always write the report, even when everything passes. Stop the dev server.
8. End with `npm run demo:reset '--' --yes` and say so in the report.

Not part of this run: `USER_MANUAL.pdf` and its screenshots (Claude retakes them after the pass), `docs/DEMO_SCRIPT.md` (Dylan's),
and the unique-index race on two simultaneous "Default" ticks (see the handoff, section 6).
