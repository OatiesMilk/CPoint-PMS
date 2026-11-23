# Phase 37 plan: work in progress demo data (planning thread, 2026-11-23)

Request (Dylan, 2026-11-23): "update the demo data, give a little bit more emphasis on the work in
progress, add demo data there so that it can be presented easier."

Scope: the demo seed only (`src/server/services/demo-seed.service.ts` and
`tests/unit/demo-seed.test.ts`), plus the docs that describe what the demo shows. No schema, UI,
service or rule change. Phase 37 on the roadmap, one session for the coding thread.

## What the board shows today (from the Phase 36 manual screenshot 21, demo clock Fri 15:00)

- Repairs At stage: 12 or more, **dated 10 days back to today** (RP-261110 to RP-261120). A repair
  that old would have been dealt with on a real floor, and the long list buries the story: Sole-ing
  alone has 5 cards and Finishing 5 more.
- Only **one** repair Back for inspection, so the Queue's "Repairs back for inspection" list is a
  single row.
- Preparation has no repair (it has rolls being scanned instead, which is right: a repair goes back
  to the stage a fixable pair is sent to).
- Every stage's count is "as of 15:30" (all four equal), so there is nothing to point at to say
  "update this one".
- Cause: `seedRepairs()` takes the oldest 3 repair jobs through Back and Inspect and leaves every
  other job At stage whatever its age; only one job is ever Back.

## Plan: change `seedRepairs()` and `seedStages()`, nothing else in the seed

The rest of the week stays byte-identical (the Phase 34 data already has its own random stream;
every new choice below is a fixed rotation, not chance, so a run is always the same).

1. **Old repairs are finished, recent ones are live.** Define the cutoff as the start of the third
   last working day (`workingDays.at(-3)`). A job sent before it goes Back 3 to 4 hours after it was
   sent and is inspected the next working day at 10:00 to 14:00, with the outcome by rotation:
   all passed, all passed, one passed and one scrapped, all passed, sent back again (to the
   stage of its finding, as now). A job sent back again creates a child job; a second pass over
   the jobs still At stage and older than the cutoff passes the child. Result: Reports → Repairs
   and the inspected list have a believable mix (Passed, Scrapped, Sent back again) and no repair
   sits At stage for ten days.
2. **A live board across the stages.** The failed batches of the last three working days use a
   fixed "recent" pattern, in order: Loose stitching (Fixable, Construction), Lifted sole (Fixable,
   Sole-ing), Glue marks (Fixable, Finishing), Lifted sole (Fixable, Sole-ing), Scuffs (Not
   fixable), then the old rotation. The single Loose stitching moves here from the ninth failed
   batch (it was the only one, and was usually old); older failed batches keep the old rotation,
   so Lifted sole and Glue marks still reach 5 findings inside 4 weeks and the form's suggestion
   still shows. Expected on the board at 17:05: Construction 1 repair, Sole-ing 2, Finishing 1 to 2
   At stage (the exact numbers are checked on a real seed, see Checks).
3. **Three repairs Back for inspection**, not one, so the Queue lists three rows with different
   waits: the newest at stage-sent + 2 h, one 1 day old and one 2 days old (each at least a minute
   before now, as `back()` does). The Queue's line and the board's banner then read "1 batch and 3
   repairs waiting for inspection" (the missed Urgent batch is the one batch).
4. **One stage with an older count (demo data only).** Each working day is counted twice, as now.
   On today only, Finishing's second count is left out, so its card reads "as of 10:30" beside the
   other three "as of 15:30". It gives the presenter an obvious card to **Update count** on, and
   Capture's My stage reminder ("B-… just ended. Update the count.") for a Finishing constructor.
5. **Preparation and rolls unchanged.** No repair is invented for Preparation and no extra open
   roll is added: rolls open and scanned feed Capture, Reports and the roll counts the whole demo
   depends on.

Not changed on purpose: the quota, attendance, rolls, scans, stock, storage moves, the Inspection
queue's Urgent batch, the demo clock (17:05), the final defect types, the schema.

## Files for the coding thread

- `src/server/services/demo-seed.service.ts`: `DEMO_FINDINGS` and the finding choice in
  `seedProduction()` (recent pattern, drop `DEMO_STITCHING_AT`), `seedRepairs()`, the second count in
  `seedStages()`. Keep the existing helpers.
- `tests/unit/demo-seed.test.ts`: the repair mock must be status-aware (`listRepairsByStatus`
  returns the jobs of that status) and its jobs dated relative to `now`; update "lists what was wrong"
  (Loose stitching is one line, in the last three working days, Fixable, Construction),
  "puts repairs in every state" (old jobs inspected with the rotation, three Back, recent ones At stage),
  and add one for "Finishing's count today is the older one".
- Docs with the feature (D-134): `docs/DEMO_SCRIPT.md` (Act 6: what is on the board at 17:05 and what
  to point at; it is Dylan's file and stays out of git), README demo notes, `docs/USER_MANUAL.md`
  §6.3a text and a retaken screenshot 21 (`docs/screenshots/manual/21-work-in-progress.png`, same
  method as Phase 36: headless Chromium on the seeded demo data, 1366 px at 2x), the master spec's demo
  section, STATUS, SESSION_LOG, DECISIONS (D-135), ROADMAP (Phase 37). List any doc left out and why.
- QA: handoff `qa/handoffs/2026-11-23-phase-37-wip-demo-data.md` and `qa/CODEX_PROMPT_PHASE_37.md`.
  Codex: reset the demo data, check Batches → Work in progress (every card, the banner), the Queue's
  repairs, the Overview card, Reports → Repairs reconcile (passed + scrapped + sent back again = pairs),
  and the CI docker SQL block's repair and stage checks on that seed.

## Checks

`npm run check` (lint, typecheck, unit tests, build). The coding thread also seeds a throwaway
database and reads the repair counts by status and stage and the stage counts with SQL, so the
numbers it writes into the manual and the demo script come from the data, not from this plan. No
browser or e2e runs by Claude (project rule); Codex runs them.

## Decisions and assumptions to log

- D-135: the demo's work in progress is a live board: repairs older than two working days are
  finished, the recent ones sit At stage and Back for inspection (demo data only, not a rule).
- A-111 (demo only): Finishing's count today is the older one on purpose, so there is a card to update.
- A-112 (demo only): the repair outcomes by rotation (passed, one scrapped, sent back again) are
  placeholders; CPoint hasn't given a real pass rate for repairs. Nothing is read from them as a figure.

## Open points for Dylan (defaults chosen, change on request)

1. Preparation gets no repair (a Fixable pair returning to Preparation isn't a case CPoint has
   described). Say if you want one card there for the demo; it would be one placeholder finding.
2. A second open roll at Capture would show "2 being scanned" on Preparation; left out because it
   moves roll counts and the Phase 26 to 30 docs and screenshots.
3. "Not fixable after all" and "moved to another stage" repairs aren't seeded (`changeRepair` takes no
   demo clock). They stay a live step of the demo. Say if you want a small `now` argument added so
   the seed can show one of each.

## Amendment (Dylan, 2026-11-23): Preparation's defects are the camera's

Dylan: at Preparation the defects are the ones the camera detects on the raw leather roll
(crease, cut, hole, scratch: the Settings defect types read by Capture); at the other stages it is a
finished shoe, with the final defects (Lifted sole, Glue marks, Loose stitching, Scuffs, Other). The two
lists stay separate (A-62, A-66).

- Confirms open point 1: **no repair is seeded at Preparation**, and none is ever sent there. A
  roll's defects are never a repair job; they lead to the roll's Pass or Returned to supplier.
- The seed's own scans already carry camera defects on today's rolls, so nothing is added to the seed for
  this.
- Not part of Phase 37 unless Dylan says so: the Preparation card on the board does not list the
  camera's defects today (it shows the count, "Rolls: N being scanned, M scanned today" and "No repairs
  here"). Showing "Leather defects found today by the camera: Cut x4, Scratch x7" there would be a small
  UI and service change (`wipBoard()` and `wip-board.tsx`), read from today's scans. Asked of Dylan; to be
  planned as its own small phase if wanted. The demo script should say "at Preparation the camera checks the
  raw leather, so there are no repairs there" and point at Capture and Reports → Rolls for those defects.
