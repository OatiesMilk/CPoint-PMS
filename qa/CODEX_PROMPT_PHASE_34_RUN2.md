# Prompt for Codex: Phase 34 final defects, repairs and work in progress, run 2 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`) on a **weekday after 01:00 Manila**, Docker Desktop
running for the database only, `npm install` done.

---

You are the QA tester for CPoint-PMS: Phase 34 (D-130), run 2. Handoff:
`qa/handoffs/2026-11-20-phase-34-defects-and-repairs.md`. Run 1 report:
`qa/reports/2026-11-20-phase-34-run1.md` (PASS WITH ISSUES). Since run 1 the code changed
(Addendum 1: constructors with Capture access are at Preparation; fixes for run 1).

## Rules

Same as `qa/CODEX_PROMPT_PHASE_34.md` (test and report only: change no application code, tests, docs,
migrations, config, `package.json` or `.env`; write only under `qa/reports/` and your line in the
vault's Daily note; in-app browser for manual scenarios, headless Playwright for e2e and API calls;
`$env:E2E_BASE_URL="http://localhost:3000"` and `--workers=2`; a first-compile timeout or
`ECONNRESET`: rerun that spec alone once and report both results, never change a timeout).

## What changed since run 1 (so you know what to expect)

- **E1.1, E1.3** (finish dialogs that stayed open): `batches.spec.ts` and `inspection-queue.spec.ts`
  finished batches with failed pairs and no reason. Since Phase 34 failed pairs need "What was wrong",
  so both specs now fill a line (Scuffs, Not fixable). Not an app fault.
- **E1.2:** the Fixable / Not fixable radio's hidden input now covers its label, so a click or tap lands
  on it (the label intercepted the click).
- **E1.4:** the production CSV's new column is `Passed after repair` (no comma), and `reports.spec.ts`
  expects it.
- **E1.5:** the QI board assertions are scoped to the board (the Demo mode band's "Change time" matched).
- **Addendum 1:** a Shoe Constructor with Capture access is always at Preparation (derived from the
  flag, locked in the Plan dialog, refused at other stages, never stored). New scenarios P6 to P8 and C7
  in the handoff; `stage-wip.spec.ts` has a new test for it.
- **Run 1 triage fixes:** the error summary's links for a finding line (3 or more errors in Finish batch)
  now point at that line's field (`#finding-2-note`); before, the pattern in the dialog had lost its
  backslashes and they pointed at a missing id. Messages under the fields were always right.
- **Not changed, no fault found:** C6 (the demo clock didn't move). Nothing in Phase 34 touches the
  demo clock, and Phase 33 run 6 moved it to 17:05, so retry it as follows:
  1. As the **Floor Manager** (or the Quality Inspector), Demo mode band → **Change time**.
  2. **Before pressing Set clock, read the date and time fields back** (screenshot) and confirm they
     show Fri 20 Nov and **17:05**. A typed value that doesn't register in the field leaves the form's
     prefilled time (now), and Set clock then submits that, which looks like a clock that doesn't move.
  3. If the fields don't take typed values, send the same request from the page console instead:
     `fetch("/api/v1/demo/clock", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ date: "<today, YYYY-MM-DD>", time: "17:05" }) })`,
     reload, read the band, and say that the form route was not verified (the server route is the same
     either way).
  4. If the band **still doesn't move after the request**, that is a real fault: attach the request,
     the response (`POST /api/v1/demo/clock`) and the band's text before and after, and report it.
     Go back to **Real time** afterwards.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the phase summary
   `Notes/Phases/Defense revisions (32 to 36).md`).
2. Setup, in a PowerShell terminal at `C:\dev\CPoint-PMS`: **`docker compose stop app`**; `npm run db:up`;
   back up (`docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/backup.dump`, then
   `docker cp cpoint-pms-db-1:/tmp/backup.dump storage\backups\before-phase-34-run2.dump`);
   `npm run db:deploy`; stop any old `npm run dev`, then start a fresh `npm run dev` (the code changed);
   `npm run demo:reset '--' --yes`.
3. Run these scenarios from the handoff by hand: **P1 to P8** (P6 to P8 are Addendum 1: a locked
   Preparation row with "Has Capture access", not offered at other stages, 422 with the exact message),
   **C1 to C7** (C7 is My stage = Preparation), **A1, A2, A4 to A7**, **R7** (including the part after
   midnight, once the clock moves) and **C6**. Rerun **D1** after the last `demo:reset` (the seed changed
   for Addendum 1). **Report C3, C4 (camera off) and A3 from the e2e spec, not by hand**:
   `tests/e2e/stage-wip.spec.ts` creates its own constructors (assigned without camera access, with
   Capture access, unassigned) and covers the camera-off cases and the wrong-stage 403, and say so. There
   is no manual A3: the twelve demo constructors never sign in (their password is never set up for
   sign-in), and a Users-created account needs a first-login password change, which is what blocked run 1.
   Not rerun (all passed in run 1 on unchanged code): M1 to M3, F1 to F10, R1 to R6, R8, W1 to W5, S1, A5.
4. E1: `npx playwright test tests/e2e/final-defects.spec.ts tests/e2e/stage-wip.spec.ts tests/e2e/batches.spec.ts tests/e2e/inspection-queue.spec.ts tests/e2e/reports.spec.ts --workers=2`, then the full suite with `--workers=2`. The two Phase 34
   specs are serial: a failure stops the rest of that file, so report each failure and which tests
   didn't run.
5. Write `qa/reports/2026-11-20-phase-34-run2.md` (or today's date) from `qa/templates/report.md`,
   even on a full pass: PASS, PASS WITH ISSUES or FAIL, a table of every scenario run, the e2e counts and each
   failure with steps, expected, actual and a screenshot or log. Change no code.
6. Add one line under "Agent sessions" in the vault's `Daily/` note linking this prompt, the handoff and
   the report as `[[CPoint-PMS/qa/…]]`.
