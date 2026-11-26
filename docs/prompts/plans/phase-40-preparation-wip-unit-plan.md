# Phase 40 plan: Preparation's work in progress is not counted in pairs (planning thread, 2026-11-26)

Request (Dylan, 2026-11-26): "Shouldn't WIP for Preparation not say 'pairs', since at this stage it's not yet formed
into a shoe, it's still leather? It's only at Construction that it comes out as pairs." One session, Sonnet (high),
Dylan answered the three open points on 2026-11-26 (below), which is his go. No code or git has been touched by this planning thread.

## What I found

**Where the label comes from.** Every stage's hand count is one shared table, `stage_counts(day, stage, pairs, ...)`
(`prisma/schema.prisma:900`), saved by `saveStageCount` (`stage.service.ts:180`) and checked by `parseStageCount`
(`repair-rules.ts:631`). The column and the code call the number `pairs` for all four stages, and the UI hard-codes the
word. Preparation is just one of `STAGES`, so it inherits "pairs". Nothing says Preparation is different.

The Phase 38 work (D-136) already made Preparation's card different (rolls and the camera's leather defects) but left
the count line as "pairs". Dylan is right: it is a leftover from Phase 34 (D-130, A-72), which wrote one rule for all
stages.

**Every place that says "pairs" for a stage count (all must change for Preparation):**

| File                                                                       | Text                                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/batches/wip-board.tsx:41`                                   | intro "Pairs at each stage now"                                                                                         |
| `wip-board.tsx:66`                                                         | the number's caption `pairs as of 14:05`                                                                                |
| `src/app/(app)/camera/capture/my-stage.tsx:30`                             | heading "Preparation · pairs here now"                                                                                  |
| `src/components/features/production/stage-count-form.tsx:71`               | label "Pairs at Preparation now"                                                                                        |
| `stage-count-form.tsx:53`                                                  | toast "Preparation counted: 33 pairs."                                                                                  |
| `src/lib/repair-rules.ts:640, 647`                                         | errors "Enter the pairs here now ..." and "more than 50,000 pairs"                                                      |
| `src/app/(app)/floor-manager/wip-card.tsx:23`                              | Overview card "Pairs at each stage, as last counted today."                                                             |
| `src/app/(app)/batches/plan/stage-assignments.tsx:129`                     | "They count the pairs at their stage."                                                                                  |
| `src/app/(app)/reports/_components/repair-sections.tsx:256, 301, 303, 308` | Reports → Work in progress: intro, "Average pairs at each stage", bar labels "N pairs"                                  |
| Docs                                                                       | master spec (`system-rebuild.md:307`), README (34, 226), USER_MANUAL (4.4a, 352, caption 21), API.md (stage-counts row) |

**What stays "pairs" (correct, leave alone):** repairs (`In repair here: N pairs`, queue, repair jobs, the footer line;
a repair never goes to Preparation, D-136), failed pairs, the quota and "Pairs finished", and the API/DB field name
`pairs`. Construction, Sole-ing and Finishing counts stay in pairs, as Dylan says.

## What unit does Preparation track? Not confirmed by CPoint.

Checked the code, the docs and the survey; no document names a unit for the hand count at Preparation.

- The only unit the system tracks at Preparation is **rolls**: the master spec says "it tracks rolls at Preparation and
  pairs at each batch's end" (`system-rebuild.md:200`), and the card already shows "Rolls: N being scanned, N scanned
  today" from Capture. But that is counted by the camera flow, not typed in, and it would duplicate the hand count.
- The survey (Ms Ivy, Floor Manager) says only "Ilan ang natatapos nila per batch and defects", "how many they finish
  per batch", with no unit. The CV checkpoint is "before cutting" (CLAUDE.md), so Preparation includes cutting: what
  comes out of it is cut leather, not shoes.
- The demo seed's Preparation counts (20 to 40) were written as "pairs" like every other stage; they are demo data and
  don't prove a unit.

**Decided (Dylan, 2026-11-26): "pieces".** His reason: a leather roll that passes the camera module is then cut into
pieces, so what is at Preparation after that is leather pieces, not shoes. It is still logged as an ASSUMPTION (A-116)
because CPoint hasn't named the unit; the reasoning above is the basis. If CPoint says their real count is something
else (rolls, cut sets, bundles), only the one unit entry below changes.

## The fix

One source for the unit, so the next change is one line:

1. `src/lib/repair-rules.ts`, next to `STAGE_LABEL`: `STAGE_COUNT_UNIT: Record<Stage, { one: string; many: string }>`
   (Preparation: piece/pieces; the other three: pair/pairs) and a helper `countUnit(stage, n)` returning `"1 piece"`,
   `"33 pieces"`, `"14 pairs"`. `parseStageCount(raw, stage)` takes the stage and builds both messages from the unit
   ("Enter the pieces here now as a whole number, like 12. Enter 0 if none."; "more than 50,000 pieces"). The stage is
   optional and defaults to pairs, so no caller breaks.
2. `stage.service.ts`: `parseCount(input.pairs, input.stage)`; the board cards (`wipBoard`) and `myStage` carry a
   `unit` string (`"pieces"` or `"pairs"`) so the components don't decide. The service's other fields are unchanged.
3. Components use the unit: `stage-count-form.tsx` (label "Pieces at Preparation now", toast, error), `my-stage.tsx`
   heading, `wip-board.tsx` caption and intro ("At each stage now, as counted by the people there: pieces of leather at
   Preparation, pairs after it."), `wip-card.tsx` description, `stage-assignments.tsx` hint ("They count the work at
   their stage").
4. Reports → Work in progress (`repair-sections.tsx`, `wipReport` in `stage.service.ts`) **leaves Preparation out**
   (Dylan: compare only the stages that work in pairs). `wipReport` drops PREPARATION rows before totalling, so
   `stages` and `perDay.counts` hold Construction, Sole-ing and Finishing only, `counted` (days counted) comes from
   those rows, and `barShare` is against the busiest of those three. The intro stays true and says so: "Pairs at each
   stage after Preparation, from the counts the people there enter. Each day's last count stands for that day. The
   stage with the highest average is where pairs wait most. Preparation is counted in pieces and is on the board."
   The table, bar list and day grid then need no unit logic (all pairs). Preparation's count still shows on the
   Batches → Work in progress board, the Overview card and My stage, and is still stored and in the audit log.

5. No migration, no API field rename, no change to quota or repair rules. `POST /api/v1/production/stage-counts` still
   takes `{ stage, pairs }`; API.md notes that for PREPARATION the number is pieces. (A rename would be a migration and
   a breaking API change for no user benefit.)
6. Demo seed: leave the numbers; flag in the handoff that 20 to 40 pieces is small for cut leather and that Dylan can
   say if he wants other demo numbers (it is demo data, not a rule). Phase 37's checks don't read these labels.

## Tests

- Unit: `repair-rules.test.ts` (`countUnit`, `parseStageCount(raw, "PREPARATION")` messages in pieces, other stages
  unchanged; the current "pairs" test at `:517` keeps passing for a non-Preparation stage), `stage.service.test.ts`
  (board card and `myStage` carry the unit, Preparation → pieces, Sole-ing → pairs; update `:105`).
  and `wipReport` (`:551`): a PREPARATION row is ignored (stages hold three entries, `perDay.counts` has no
  PREPARATION key, a day with only a Preparation count isn't counted); the existing Sole-ing and Finishing assertions
  stay, minus `PREPARATION: null` in `:581`.
- E2E assertions that name the old Preparation text or read it from the report must change (Claude does not run them,
  Codex does): `tests/e2e/stage-wip.spec.ts:249-251` ("Pairs at Preparation now", "Preparation counted: 33 pairs.")
  and `:364-370` ("Preparation · pairs here now"); `:264-268` compares each board card with the report's row, so it
  must skip PREPARATION; `:272-275` expects a Preparation row with 33 in the report's stage table, so it becomes a
  check that the table has no Preparation row (and Sole-ing's 14 still shows). The Sole-ing assertions (`:179-204`)
  stay.
- `npm run check`. Handoff `qa/handoffs/2026-11-26-preparation-wip-unit.md` and `qa/CODEX_PROMPT_PHASE_40.md`.

## Docs (D-134: the feature's own session updates them)

README (34, 226), USER_MANUAL (4.4a, line 352, caption of screenshot 21 and the Reports → Work in progress section, which says Preparation isn't in the comparison),
API.md (stage-counts row), master spec (`:200`, `:307`; also say the unit is an assumption), DECISIONS (**D-137**),
STATUS (A-116 under Open questions, and add it to "To ask CPoint"), ROADMAP (Phase 40), SESSION_LOG, and the vault
(Daily note, phase summary). `docs/DEMO_SCRIPT.md` is Dylan's untracked file: only say if a line needs changing (its
current "pairs" lines are about batches, not stages, so none does). Screenshot 21 (the board) and any My stage shot show
"pairs" at Preparation: retake them from a fresh seed and rebuild `USER_MANUAL.pdf`, or list them as left out and why.

## Decisions and assumptions to log

- **D-137** (Dylan, 2026-11-26): work in progress at Preparation is not counted in pairs; the unit is shown per stage,
  pieces at Preparation and pairs from Construction on. Reports → Work in progress compares only the stages counted in
  pairs (Construction, Sole-ing, Finishing) and leaves Preparation out.
- **A-116** (ASSUMPTION, D-137): the Preparation count is "pieces" (leather pieces), because a roll that passes the
  camera is cut into pieces (Dylan); CPoint hasn't named the unit. **To ask CPoint:** what do you count at Preparation
  (cut pieces, rolls, cut sets, something else)?
- **A-117** (D-137): the board and Overview show every stage's count in its own unit and nothing adds or compares
  counts across units; the field stays `pairs` in the database and API.

## Answers from Dylan (2026-11-26)

1. Unit: "pieces". 2. Leave Preparation out of the pairs reporting; compare only the pair stages. 3. Keep the demo
   numbers at Preparation (20 to 40) for now.
