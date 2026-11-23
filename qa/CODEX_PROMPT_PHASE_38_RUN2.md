# Prompt for Codex: Phase 38, run 2 (paste everything below the line)

Run on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only. Headless only, nothing
visible on Dylan's screen.

---

You are the QA tester for CPoint-PMS: Phase 38 run 2. Run 1 (`qa/reports/2026-11-23-phase-38-run1.md`) passed all
ten manual scenarios (L1 to L10); its FAIL came only from the e2e specs, which ran with the **demo clock on Tue
24 Nov while the laptop date was Mon 23 Nov**.

## Why a rerun

Claude read the six failures against the code. Phase 38 touches none of the failing paths. F3 (a constructor's
Back returned 403) and F6 (no `My stage` for an assigned constructor) come from `tests/e2e/stage-wip.spec.ts` and
`final-defects.spec.ts` assigning the stage for `TODAY`, taken from the laptop's `Date.now()`, while the app's
today (`appNow()`) was a day ahead; F1 (`today-batches`) needs a batch due today and fits the same cause. F4 is a
30-second timeout on the first scan after a reset (the model loads on the first scan). F2 and F5 are link and URL
expectations in code Phase 38 doesn't touch; they may also come from the clock. Nothing is confirmed until the
clock is real.

## Rules

Same as run 1: test and report only (D-092); write only under `qa/reports/` and your line in the vault's Daily
note; never change code, tests, config or `.env`.

## Do

1. Read the vault's newest `Daily/` note and `qa/reports/2026-11-23-phase-38-run1.md`.
2. `docker compose stop app`; stop any old `npm run dev`; `npm run db:up`; `npm run db:deploy`; `npm run dev`
   (note the port). **Put the demo clock back to real time** before anything else: in a headless script as the Floor
   Manager press **Back to real time** in the demo band, or `docker compose exec -T db psql -U cpoint -d cpoint_pms -c
"update demo_clock set \"offsetMs\" = 0"`. Check the band is gone or reads today's real date, and that the page's
   "Today" is the laptop's Manila date. Quote both dates in the report. Then `npm run demo:reset '--' --yes`.
3. Warm the model once (the e2e `reports.spec.ts` posts a scan): run `npm run test:e2e -- tests/e2e/reports.spec.ts`
   alone first if you like; a first-scan timeout that passes on its rerun is not a failure.
4. Run the five specs against the dev server (`$env:E2E_BASE_URL="http://localhost:<port>"`):
   `tests/e2e/stage-wip.spec.ts`, `final-defects.spec.ts`, `corrections.spec.ts`, `reports.spec.ts`, `batches.spec.ts`.
   On a first-compile timeout or `ECONNRESET`, rerun that spec alone once and report both results. Do not change
   any timeout. Note the time of day (the `batches.spec.ts` 00:00 to 01:00 Manila window is known).
5. For every spec that still fails, quote the assertion, the on-screen state (a headless screenshot into
   `qa/reports/artifacts/<today>-phase-38-run2/`) and, for F2 and F5, the link's `href` and the page URL before the
   click. Say whether the failure repeats on a second run of that spec alone.
6. Write `qa/reports/<today>-phase-38-run2.md` (PASS, PASS WITH ISSUES or FAIL; the spec table: passed, failed,
   not run; failures with steps, expected, actual, evidence). Don't repeat L1 to L10 (they passed). Stop the dev
   server and end with `npm run demo:reset '--' --yes`. Add your line under "Agent sessions" in today's Daily note.
