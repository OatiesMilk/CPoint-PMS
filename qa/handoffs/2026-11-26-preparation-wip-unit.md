# QA handoff: Phase 40, work in progress at Preparation is counted in pieces

| Field           | Value                                                                                  |
| --------------- | -------------------------------------------------------------------------------------- |
| Date            | 2026-11-26                                                                             |
| Feature         | preparation-wip-unit                                                                   |
| Branch          | uncommitted (working tree on `main` fe5ca83; Phase 41 is also in this tree, see below) |
| Spec / prompt   | `docs/prompts/plans/phase-40-preparation-wip-unit-plan.md`, D-137, A-116, A-117        |
| Written by      | Claude                                                                                 |
| Previous report | none for Phase 40                                                                      |

## 1. What changed

Preparation's hand count is leather, not shoes, so it now says **pieces** (Dylan: a roll that passes the camera is cut into
pieces). Construction, Sole-ing and Finishing still say **pairs**. Nothing else about counting changed (who may count,
the latest count of the day stands, the 0 to 50,000 whole-number rule).

- **Batches → Work in progress** (Floor Manager, Quality Inspector): the intro says "At each stage now … pieces of leather at
  Preparation, pairs after it"; Preparation's number is captioned "pieces as of 14:05", the others "pairs as of …".
  The Preparation card's **Update count** form is labelled **Pieces at Preparation now** and saves "Preparation counted: 33 pieces."
- **Overview** (Floor Manager): the Work in progress card says "Pieces at Preparation, pairs after it, as last counted today."
- **Capture → My stage** (a constructor at Preparation): heading "Preparation · pieces here now", label "Pieces at Preparation now",
  toast "Preparation counted: 21 pieces."; a Sole-ing constructor still sees "Sole-ing · pairs here now".
- **Batches → Plan days → Who works where**: hint says "They count the work at their stage."
- **Reports → Operations → Work in progress** (Floor Manager): **Preparation is left out**. The table, the bar list and the
  day grid hold Construction, Sole-ing and Finishing only; the intro ends "Preparation is counted in pieces, so it is on the
  board and not here." A day on which only Preparation was counted isn't a counted day.
- Errors: a bad number at Preparation says "Enter the pieces here now as a whole number, like 12. Enter 0 if none." (and
  "…more than 50,000 pieces…"); other stages say pairs.
- API: `POST /api/v1/production/stage-counts` still takes `{ stage, pairs }` (the field name is unchanged; at `PREPARATION` the number
  is pieces). `GET /api/v1/production/wip` cards gain `unit`; `GET /api/v1/reports/operations` → `wip.stages` and
  `wip.perDay[].counts` no longer contain `PREPARATION`.

Unchanged on purpose: repairs ("In repair here: N pairs"), failed pairs, the quota and "Pairs finished" stay in pairs; the
demo's Preparation numbers (20 to 40) are as they were.

## 2. Files touched

| File                                                                                                                                                                 | Change                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/lib/repair-rules.ts`                                                                                                                                            | `STAGE_COUNT_UNIT`, `countUnit`, `countUnitName`, `PAIR_COUNT_STAGES`; `parseStageCount(raw, stage?)` |
| `src/server/services/stage.service.ts`                                                                                                                               | parser gets the stage; `unit` on board cards and `myStage`; `wipReport` keeps only pair stages        |
| `src/server/controllers/stage.controller.ts`                                                                                                                         | comment only                                                                                          |
| `src/components/features/production/stage-count-form.tsx`                                                                                                            | label, toast and error follow the unit                                                                |
| `src/app/(app)/camera/capture/my-stage.tsx`                                                                                                                          | heading uses the unit                                                                                 |
| `src/app/(app)/batches/wip-board.tsx`                                                                                                                                | intro and caption                                                                                     |
| `src/app/(app)/batches/plan/stage-assignments.tsx`                                                                                                                   | hint wording                                                                                          |
| `src/app/(app)/floor-manager/wip-card.tsx`                                                                                                                           | description                                                                                           |
| `src/app/(app)/reports/_components/repair-sections.tsx`                                                                                                              | intro, day grid and sort keys from the pair stages                                                    |
| `tests/unit/repair-rules.test.ts`, `tests/unit/stage.service.test.ts`                                                                                                | new unit tests                                                                                        |
| `tests/e2e/stage-wip.spec.ts`                                                                                                                                        | labels, toasts, captions, and no Preparation row in the report                                        |
| `README.md`, `docs/USER_MANUAL.md`, `docs/API.md`, `docs/prompts/system-rebuild.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/STATUS.md`, `docs/SESSION_LOG.md` | docs                                                                                                  |

Database migration in this change: **no**.

**Phase 41 shares this working tree** (Find roll in Inventory: `src/app/(app)/find`, `inventory`, the sidebar, `navigation.ts`,
`auth.spec.ts`, `inventory.spec.ts`, `permissions.test.ts`, DESIGN.md). Ignore those files for this run; the Phase 40 files are the table above.
README.md, USER_MANUAL.md and `system-rebuild.md` carry edits from both phases.

## 3. How to run the app locally

Prerequisites: Docker Desktop running (database only), `npm install` done, `.env` filled in (`AUTH_SECRET`,
`BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up
npm run db:deploy
npm run demo:reset '--' --yes     # a seeded week with Preparation counts (PowerShell spelling)
npm run dev                       # note the port
```

Existing automated tests that cover this area (run these too, with `E2E_BASE_URL` set to the dev server):

```bash
npx playwright test tests/e2e/stage-wip.spec.ts
npx playwright test tests/e2e/reports.spec.ts tests/e2e/batches.spec.ts
```

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD` from `.env`: Floor Manager `manager@cpoint.local`, Quality Inspector
`inspector@cpoint.local`, Shoe Constructor `constructor@cpoint.local`, System Admin `admin@cpoint.local`.
A constructor assigned to Sole-ing and one with Capture access (at Preparation) are needed for P4 and P5; `stage-wip.spec.ts` creates
its own, or assign one under Batches → Plan days → Who works where.

## 5. Test scenarios

| ID  | Role                                                   | Steps                                                                                                                                                                       | Expected result                                                                                                                                                                                                                                                                                                                                            | Priority |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| P1  | Floor Manager                                          | Open Batches → Work in progress. Read the intro and each card's number caption.                                                                                             | Intro: "At each stage now, as counted by the people there: pieces of leather at Preparation, pairs after it." Preparation caption "pieces as of hh:mm" (or "Not counted today"); Construction, Sole-ing, Finishing "pairs as of hh:mm". No "pairs" beside Preparation's number.                                                                            | High     |
| P2  | Floor Manager                                          | On the Preparation card click **Update count**, check the field label, enter 33, **Save count**.                                                                            | Label "Pieces at Preparation now"; toast "Preparation counted: 33 pieces."; the card shows 33 "pieces as of hh:mm". Enter 1: toast "Preparation counted: 1 piece."                                                                                                                                                                                         | High     |
| P3  | Floor Manager                                          | Same on Sole-ing (or Finishing): label, enter 14, save.                                                                                                                     | Label "Pairs at Sole-ing now"; toast "Sole-ing counted: 14 pairs."; caption "pairs as of hh:mm".                                                                                                                                                                                                                                                           | High     |
| P4  | Shoe Constructor with Capture access (phone width 390) | Capture → My stage. Read heading and label, enter 21, save.                                                                                                                 | Heading "Preparation · pieces here now"; label "Pieces at Preparation now"; toast "Preparation counted: 21 pieces."; "You have Capture access, so you work at Preparation." still shows.                                                                                                                                                                   | High     |
| P5  | Shoe Constructor assigned to Sole-ing                  | Capture → My stage.                                                                                                                                                         | Heading "Sole-ing · pairs here now"; label "Pairs at Sole-ing now".                                                                                                                                                                                                                                                                                        | Medium   |
| P6  | Floor Manager                                          | Overview. Read the Work in progress card description and the five figures.                                                                                                  | "Pieces at Preparation, pairs after it, as last counted today."; Preparation's figure is its pieces count.                                                                                                                                                                                                                                                 | Medium   |
| P7  | Floor Manager                                          | Reports → Operations, a period that includes counts at all four stages (e.g. the demo week). Open the Work in progress card.                                                | Stage table rows: Construction, Sole-ing, Finishing only (no Preparation row); the bar list ("Average pairs at each stage") has three bars; the day grid has three stage columns; the intro ends "Preparation is counted in pieces, so it is on the board and not here." Sole-ing's "Latest" equals the board's Sole-ing figure for today.                 | High     |
| P8  | Floor Manager                                          | Reports → Operations for a day on which only Preparation was counted (count Preparation on a day nothing else is counted, e.g. a fresh day, then pick that day).            | The card says "No stage was counted in this range."                                                                                                                                                                                                                                                                                                        | Medium   |
| P9  | Floor Manager                                          | Type `x` in a stage count field and tab away, at Preparation and at Finishing. Then type 50001 at each and save.                                                            | Preparation: "Enter the pieces here now as a whole number, like 12. Enter 0 if none." and "That is more than 50,000 pieces. Check the number."; Finishing: the same with "pairs". Nothing saved.                                                                                                                                                           | Medium   |
| P10 | Floor Manager                                          | Batches → Plan days → open a planned day → Who works where.                                                                                                                 | Hint reads "…They count the work at their stage. A constructor with Capture access always works at Preparation."                                                                                                                                                                                                                                           | Low      |
| P11 | Floor Manager (API, signed-in `request`)               | `GET /api/v1/production/wip`; `GET /api/v1/reports/operations?from=<day>&to=<day>`; `POST /api/v1/production/stage-counts` with `{ "stage": "PREPARATION", "pairs": "x" }`. | `cards[].unit` is "pieces" for PREPARATION and "pairs" for the rest; `wip.stages` stages are CONSTRUCTION, SOLE_ING, FINISHING; `wip.perDay[].counts` has no PREPARATION key; the POST is 422 with the pieces message under `pairs`. A valid POST `{ "stage": "PREPARATION", "pairs": 33 }` returns 201 (created, as before this change) with `pairs: 33`. | Medium   |
| P12 | Floor Manager                                          | Wording sweep: look for the word "pairs" next to a Preparation count on the Overview, Batches → Work in progress and Capture → My stage.                                    | None. (Repairs, failed pairs, quota, "Pairs finished" still say pairs: correct.)                                                                                                                                                                                                                                                                           | Low      |

### Access checks

| ID  | Role that must NOT have access  | URL or action                                                                                  | Expected               |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| A1  | Quality Inspector               | Batches → Work in progress: no **Update count** button; `POST /api/v1/production/stage-counts` | Button hidden; API 403 |
| A2  | Shoe Constructor at Preparation | `POST /api/v1/production/stage-counts` `{ stage: "SOLE_ING", pairs: 3 }`                       | 403                    |

## 6. Out of scope / known issues

- Manual screenshot 21 and `USER_MANUAL.pdf` still show "pairs" at Preparation until Claude retakes them after the pass.
- The demo's Preparation numbers (20 to 40 pieces) are Dylan's to judge; not a defect.
- Corrections and Reports specs have timed out at sign-in in the six-worker full run before (STATUS, Known test observations); rerun alone once and report both.
- The 00:00 to 01:00 Manila window: `batches.spec.ts` plans 5-minute batches there (#67); not part of this change.
- The unit is an assumption (A-116); don't report "CPoint hasn't confirmed pieces".
- `npm run check` is Claude's: lint, typecheck, 1020 unit tests and the build passed on 2026-11-26 (on a clean copy of `main`; Windows `node_modules` can't run in the cloud VM).
