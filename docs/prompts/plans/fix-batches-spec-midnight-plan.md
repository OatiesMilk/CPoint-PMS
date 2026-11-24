# Fix: `batches.spec.ts` fails between 00:00 and 01:00 Manila

Planner: Claude (Opus), 2026-11-24. Coder: Claude (Sonnet). QA: Codex. Test-only fix, no app code,
no migration, no D-entry (no rule changes).

## Goal

`tests/e2e/batches.spec.ts:346` ("the Quality Inspector on a phone gets the notice and finishes the
batch with failed pairs") passes at any time of the Manila day, so CI on `main` stops failing when
it runs between 16:00 and 17:00 UTC (it failed on #66, run 45216042352, at 00:23 Manila; the
rerun passed).

## Root cause

`beforeAll` puts an hourly plan for today in `day_plans` (`intervalMinutes` 60, `00:00` to
`23:59`). The test waits for a banner `B-…-N is due. Finish it now.`, which `noticesFor`
(`src/lib/production-rules.ts:521`) shows only once a batch's **end** has passed (`t >= b.at`). The
first hourly batch ends at 01:00, so before 01:00 no batch is due and the banner never shows. The
app is right; the test's fixture plan doesn't fit that first hour.

## Approach (the smallest one that works)

In `beforeAll`, pick the fixture plan from the Manila time now:

- **From 01:00 Manila:** unchanged (`intervalMinutes` 60, `00:00` to `23:59`).
- **Before 01:00 Manila:** `intervalMinutes` 5, `00:00` to `02:00` (24 batches; `batchesFor`
  takes any interval and cuts the last batch at the shift end, `production-rules.ts:195`). If it
  is before 00:05, `beforeAll` waits until 00:05:05 Manila so the first batch has ended (up to
  about 5 minutes; raise that hook's timeout with `test.setTimeout` inside it to cover the wait).

Why not the others:

- The demo clock (`/api/v1/demo/clock`) is server-wide and would shift every spec running
  beside this one.
- `test.skip` in that hour hides the test, and a 60-minute wait is too long.
- A 5-minute plan all day would make 288 batches in the queue at every hour, not only in the
  first hour.

## Files to touch

- `tests/e2e/batches.spec.ts` only:
  - In `beforeAll`, work out Manila minutes since midnight (use `Intl.DateTimeFormat` with
    `timeZone: "Asia/Manila"` and `hourCycle: "h23"`, like `manilaDay`). Choose `[interval,
shiftEnd]` and bind them as parameters in the existing `INSERT INTO day_plans` (replacing the
    hard-coded `60` and `'23:59'`), and wait if needed. Keep one comment line saying why.
  - Rewrite the file's header comment: drop "so a batch is always due after 01:00 Manila … Run it
    after 01:00 Manila time" and say what it does now (hourly, or 5-minute batches to 02:00 in the
    first hour).
- Check the other tests in the file still hold with a 5-minute plan: the `later` UPCOMING check
  (line ~467) is already behind `if (later)`; the FM test (line ~502) posts `slotAt` now and
  expects 403, which doesn't depend on the plan. The Coder confirms by reading, not by changing
  them.

## Steps

1. Branch from the latest `main` (Dylan has uncommitted STATUS and ROADMAP edits there, so this goes
   on the same branch Dylan opens for them, e.g. `docs/status-phase-39-merged`; ask Dylan if unsure).
2. Make the `beforeAll` change and the header comment.
3. `npm run lint` and `npm run typecheck` (the spec is type-checked); `npm run check` for the full
   gate.
4. Docs (D-134): in `docs/STATUS.md`, remove the "`batches.spec.ts` needs a batch due today, so it
   fails between 00:00 and 01:00 Manila" bullet under Known test observations and the "`batches.spec.ts`
   00:00 to 01:00 Manila window are known" part of the **Main CI** line; add a line saying it was fixed
   (date, this plan). `docs/SESSION_LOG.md` prepend a short entry. No README, manual, API or spec
   change (test only). ROADMAP: no phase, it's a fix.
5. Vault: today's Daily (`C:\dev\capstone-obsidian\Daily\2026-11-24.md`, from the template if
   missing): Did, and one "Agent sessions" line linking this plan and the handoff.
6. Write `qa/CODEX_PROMPT_FIX_BATCHES_MIDNIGHT.md` from the handoff for Dylan to paste.
7. Stop and report; Dylan commits and pushes.

## Acceptance criteria

- Run from 01:00 Manila: the plan row and the spec behave exactly as before; `batches.spec.ts` passes.
- Run between 00:05 and 01:00 Manila: the plan row is 5-minute, 00:00 to 02:00, and test :346 sees a
  `B-YYMMDD-N is due` banner and passes.
- Run between 00:00 and 00:05 Manila: `beforeAll` waits until just after 00:05, then the same.
- `afterAll` still deletes the fixture plan, today's batches, and restores the saved plan (unchanged).
- No app code, no other spec, no timeout of another test changed; nothing skipped.
- `npm run check` passes (run, not assumed).

## Tests

No new test file: the change is the fixture in the failing spec. The check is running the spec,
ideally once inside the 00:00 to 01:00 Manila window (16:00 to 17:00 UTC).

## Docs to update

`docs/STATUS.md` (Known test observations, Main CI line), `docs/SESSION_LOG.md`, the vault Daily note.
Left out on purpose: README, `docs/USER_MANUAL.md`, `docs/API.md`, the master spec, DEMO_SCRIPT
(no user-facing change).

## QA run 1 decision (Planner, 2026-11-24): DONE, no Fix round

Report: `qa/reports/2026-11-24-fix-batches-midnight-run1.md` (FAIL on B7 only).

- The fix passed what it can be checked on: `batches.spec.ts` 7 of 7 alone and again in the full run,
  B3 (hourly row) and B6 (clean-up) passed, B1 found no change outside the spec. B4 and B5 were not
  run (outside the 00:00 to 01:00 Manila window), as the handoff allows.
- B7's 15 failures are not from this change. The run started at 13:48 Manila, when the new
  `beforeAll` takes exactly the old path (60, `00:00`, `23:59`, no wait), so the spec does to the
  database what it did before. The failures are in other specs and look like the dev server under six
  workers: `/login` and `page.goto` timeouts, `net::ERR_ABORTED`, "session closed", plus UI
  assertions that never settled. Phase 38 run 3 (`qa/reports/2026-11-23-phase-38-run3.md`) had the same
  pattern (Corrections and Reports time out only in the six-worker run and pass alone), and CI's `e2e`
  job, run against a production build, passed on `main` (run 45216042352, rerun 2026-11-24).
- The gate for the full suite is CI on the PR. If its `e2e` job fails in any spec but the known
  window, the Planner plans that as its own fix (not part of this one). The midnight path gets its
  live check when a CI run lands in 16:00 to 17:00 UTC.
