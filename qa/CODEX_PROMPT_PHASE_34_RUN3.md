# Prompt for Codex: Phase 34 final defects, repairs and work in progress, run 3 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`) on a **weekday after 01:00 Manila**, Docker Desktop
running for the database only, `npm install` done.

---

You are the QA tester for CPoint-PMS: Phase 34 (D-130), run 3. Handoff:
`qa/handoffs/2026-11-20-phase-34-defects-and-repairs.md`. Run 2 report:
`qa/reports/2026-11-20-phase-34-run2.md` (FAIL). Since run 2 the code and the specs changed (below).

## Rules

Same as `qa/CODEX_PROMPT_PHASE_34.md`: test and report only (change no application code, tests, docs,
migrations, config, `package.json` or `.env`; write only under `qa/reports/` and your line in the
vault's Daily note); in-app browser for manual scenarios, headless Playwright for e2e and API calls;
`$env:E2E_BASE_URL="http://localhost:3000"` and `--workers=2`; a first-compile timeout or
`ECONNRESET`: rerun that spec alone once and report both results, never change a timeout.

## What changed since run 2

- **Test faults fixed (E1.1 to E1.4):** the clean-ups of `batches.spec.ts` and `inspection-queue.spec.ts`
  now delete repair jobs and findings before check-ins and only their own rows
  (`tests/e2e/db-cleanup.ts`); `final-defects.spec.ts` reads the report for its own Saturday only; and
  `stage-wip.spec.ts` finds the constructor by name. The schema keeps its `RESTRICT` on purpose.
- **A3 gap:** a new test in `final-defects.spec.ts` ("who may do what with a repair") checks a
  constructor's `PATCH` on a repair and `GET /production/wip` (403), the QI (board 200, repair 403), the
  System Admin (board 403), the Floor Manager (board 200), and the stage's own constructor's Back (200,
  then 409). A3 is reported from it, not by hand.
- **C2 fixed (a small real gap):** the count form now checks the number before any round trip. A wrong
  entry (not plain digits, so `x`, empty, `1.5`, `-1`, `1e3` and `0x10` are refused) shows
  "Enter the pairs here now as a whole number, like 12. Enter 0 if none." as soon as the field is left,
  and again on Save, and Save stays enabled except while saving.
- **C6 (demo clock) is not a Phase 34 change** and isn't fixed. Run 3 only runs a decisive check (below).

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the phase summary
   `Notes/Phases/Defense revisions (32 to 36).md`).
2. Setup, in a PowerShell terminal at `C:\dev\CPoint-PMS`, in this order:
   1. **`docker compose stop app`** first (the old Docker app holds port 3000). Also stop any other
      server on port 3000 and any older `npm run dev` of this project.
   2. `npm run db:up`
   3. Back up: `docker exec cpoint-pms-db-1 pg_dump -U cpoint -d cpoint_pms -Fc -f /tmp/backup.dump`,
      then `docker cp cpoint-pms-db-1:/tmp/backup.dump storage\backups\before-phase-34-run3.dump`.
   4. `npm run db:deploy`
   5. A fresh `npm run dev`, then check `http://localhost:3000/api/health`.
   6. **`npm run demo:reset '--' --yes`** (run 2's failed clean-ups left findings and queue rows in
      the demo database). Then check the demo clock reads **Real time**.
3. Manual (by hand, in the in-app browser):
   - **C2**, at 390 × 844 as a constructor with a stage today (Noel Manalo is at Preparation): type `x`
     in "Pairs at … now", tab away: the message shows and **Save count is enabled**. Press Save: the
     message is still there and no count is saved. Clear the field and press Save: the same message.
     Type `1e3`: the same message. Type `14`: the message goes and Save saves ("… counted: 14 pairs.").
     If Save ever shows disabled, say whether a toast was showing and for how long.
   - **C6, the decisive check** (Floor Manager; the Demo mode band; **Change time**):
     1. Before pressing **Set clock**, open the browser console and run
        `window.__b = []; const f = window.fetch; window.fetch = (u, o) => { __b.push([String(u), o && o.body]); return f(u, o); }`
     2. Set Fri 20 Nov (today) to **17:05** in the fields, read the fields back (screenshot), press
        **Set clock**, then read `window.__b` and the band.
     3. If `__b` holds `{"date":"<today>","time":"17:05"}` and the band **does not move**, that is a
        **real fault**: report the request body, the response status and body, and the band text before
        and after.
     4. If `__b` holds the form's _prefill_ (the current time) instead, typing didn't reach the form's
        state (a tooling limit): retype with the keyboard (click the field, type `1705`), press Set
        clock again, and say which method worked.
     5. Return to **Real time** afterwards. If it worked, the batch-end reminder (`B-… just ended.
Update the count.` on My stage) is optional.
   - Not rerun (passed in run 2 on code that doesn't change): P1 to P8, C1, C3 to C5, C7, A1, A4, A6,
     A7, R7, D1 (the seed is unchanged).
4. E1, in this order, each with `--workers=2`:
   1. Targeted: `npx playwright test tests/e2e/final-defects.spec.ts tests/e2e/stage-wip.spec.ts tests/e2e/batches.spec.ts tests/e2e/inspection-queue.spec.ts tests/e2e/reports.spec.ts --workers=2`.
      Expect 28 tests (27 plus the A3 test), all passing. The two Phase 34 specs are serial: for any
      failure also say which tests did not run.
   2. **Right after it, before the full suite**, run these two queries and report the results (both
      expected to be 0), using the same `psql` as the CI checks
      (`docker compose exec -T db psql -U cpoint -d cpoint_pms -tAc "<query>"`):
      - `SELECT count(*) FROM production_check_ins c JOIN production_batches b ON b.id = c."batchId" WHERE b.code IN (<the weekend and Saturday batch codes the specs plan, B-YYMMDD-1 for the 2 days of inspection-queue.spec.ts and the 3 days of final-defects.spec.ts>)`; or simply
        `SELECT count(*) FROM production_check_ins WHERE day = ANY(ARRAY[<those five days>]::date[])`
      - `SELECT count(*) FROM inspection_findings f WHERE NOT EXISTS (SELECT 1 FROM production_check_ins c WHERE c.id = f."checkInId")` (0 by the foreign key; it shows the clean-up ran in order).
   3. The full suite: `npx playwright test --workers=2` (about 120 tests, 2 skipped).
   4. `npm run demo:reset '--' --yes` at the end, and the demo clock back on **Real time**.
5. Write `qa/reports/2026-11-20-phase-34-run3.md` (or today's date and the next run number) from
   `qa/templates/report.md`, even on a full pass: PASS, PASS WITH ISSUES or FAIL, every scenario you ran,
   the e2e counts (and any test that did not run), and each failure with steps, expected, actual and a
   screenshot or log. Change no code: anything that fails comes back to the planning thread.
6. Add one line under "Agent sessions" in the vault's `Daily/` note linking this prompt, the handoff and
   the report as `[[CPoint-PMS/qa/…]]`.
