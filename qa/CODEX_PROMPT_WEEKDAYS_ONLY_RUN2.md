# Prompt for Codex: Monday-to-Friday schedule QA, run 2 (paste everything below the line)

Run Codex on **Dylan's PC** in `D:\IMPORTANT SHIT HERE\12th Term - BSIT\CAP2\CPoint-PMS`, with
Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 (`qa/reports/2026-11-02-weekdays-only-run1.md`)
passed everything except S8. Claude's findings:

- **F1 was the handoff's query, not the app.** `batches."startedAt"` is UTC stored without a time
  zone; the query has to read it as UTC first. The corrected query (now in the handoff, §5 S8)
  gave 0 weekend rolls on the reset data.
- **Fixed in the app:** after `demo:reset`, Recent days showed Saturday 31 Oct as "0 of 2 · 2
  missed", because the reset kept the old Monday-to-Saturday default schedule. `demo:reset` now
  removes every schedule and puts back one default, 08:00 to 17:00, every 4 hours, Monday to
  Friday (`src/server/models/demo-reset.model.ts`, `src/server/services/demo-reset.service.ts`).
  `npm run check` passed (615 unit tests).

The handoff is `qa/handoffs/2026-11-02-weekdays-only-schedule.md`.

## Rules

- **Test and report only (D-092).** Don't modify application code, tests, migrations, config,
  `package.json` or `.env`, and never skip, disable or loosen a test. Create files only under
  `qa/reports/` (the report and its artifacts).
- Keep Chromium headless. Don't touch `cv/`.
- In PowerShell the separator must be quoted: `npm run demo:reset '--' --yes`.
- The Obsidian vault is not on this PC: skip the Daily note line and say so in the report.

## Steps

Artifacts go in `qa/reports/artifacts/2026-11-02-weekdays-only-run2/`.

1. `npm run build`, then `npm run start` (port 3001 if 3000 is taken).
2. **R1 (S8 again):** `npm run demo:reset '--' --yes`. Then, as the Floor Manager: Batches →
   Recent days lists no Saturday or Sunday and no "missed" on a weekend; Attendance on Sat 31 Oct
   and Sun 1 Nov is not taken. Run the three S8 queries from the handoff (read-only): all three
   return 0. Also `SELECT "shiftStart","shiftEnd","intervalMinutes","workingDays","effectiveFrom"
FROM production_schedules;` returns one row: 08:00, 17:00, 240, `{1,2,3,4,5}`, 2000-01-01.
3. **R2:** Batches → Plan batches and quota shows "08:00 to 17:00, every 4 hours, Mon to Fri" as
   the schedule in force, and today's batches (a weekday) are 08:00–13:00 with lunch and
   13:00–17:00.
4. **R3:** `npx playwright test tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts`, then the
   full `npm run test:e2e` (let Playwright start its own server). Between 00:00 and 01:00 Manila
   `batches.spec.ts` fails for a known reason: rerun after 01:00.

## Write the report

Save it as `qa/reports/2026-11-02-weekdays-only-run2.md` from `qa/templates/report.md`. The verdict
is **PASS** only if R1 to R3 passed and the e2e suite has 0 failures (skips with a reason are
fine). For any FAIL: the steps, what you saw against what was expected, the evidence, and the file
and line if you can tell. Don't fix it.

Finish by replying with the verdict, the e2e counts (passed, failed, skipped) and the report path.
