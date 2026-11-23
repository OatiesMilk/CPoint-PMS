# QA handoff: Phase 37, work in progress demo data

| Field           | Value                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| Date            | 2026-11-23                                                                       |
| Feature         | Phase 37: a live Work in progress board in the demo data (D-135)                 |
| Branch          | uncommitted on the laptop (Dylan makes the branch, list `qa/phase-37-files.txt`) |
| Spec / prompt   | `docs/prompts/plans/phase-37-wip-demo-data-plan.md`, `docs/ROADMAP.md` Phase 37  |
| Written by      | Claude                                                                           |
| Previous report | `qa/reports/2026-11-22-phase-36-run2.md`                                         |

## 1. What changed

Demo data only. No schema, rule, page or service change; the rest of the demo week is unchanged.

- **Old repairs are finished.** Repairs sent before the last four working days go Back 3 to 4 hours after
  they were sent and are inspected the next working day, by a fixed rotation: passed, passed, one pair
  scrapped, passed, sent back again (to its own stage, then passed the working day after). No repair sits
  At stage for ten days any more.
- **A live board.** The failed batches of the last four working days follow a fixed pattern (Lifted sole,
  Glue marks, Scuffs (Not fixable), Lifted sole, Loose stitching, Glue marks, Lifted sole). The oldest three
  Fixable jobs go **Back for inspection**, waiting about 2 days, 1 day and 2 hours; the newest three stay
  **At stage**, one each at **Construction**, **Sole-ing** and **Finishing**.
- **Finishing's count is older.** On today only, Finishing's second count (15:30) is left out, so its card
  reads "as of 10:30" beside the others "as of 15:30" (a weekday, after 15:30 Manila; the demo clock at
  17:05 is such a time only if the data is reset at that time).
- **No repair at Preparation, on purpose** (Dylan, 2026-11-23): its defects are the camera's, on raw leather
  (Capture, Reports → Rolls). The board's Preparation card shows no camera defects; that would be a small
  UI change and is not in this phase (planned as Phase 38).
- Plan deviation: the plan said the last three working days and a pattern of five. Three Back and three At
  stage cannot both come from five batches, so the window is four working days and the pattern has seven.

## 2. Files touched

See `qa/phase-37-files.txt`. Code: `src/server/services/demo-seed.service.ts`, `tests/unit/demo-seed.test.ts`.
Docs: `docs/DEMO_SCRIPT.md` (untracked), `docs/USER_MANUAL.md`, `README.md`, `docs/prompts/system-rebuild.md`,
`docs/STATUS.md`, `docs/SESSION_LOG.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`.
Database migration in this change: **no**.

## 3. How to run the app locally

Prerequisites: Docker Desktop running (database only), `npm install` done, `.env` filled in.

```bash
npm run db:up
npm run db:deploy
npm run dev                      # note the port it prints
npm run demo:reset '--' --yes    # PowerShell; reseeds from the current code (2 to 3 minutes)
```

Run it on a **weekday after 15:30 Manila** if you can. Other times still seed the repairs (W1, W2, W5), but
W4 can't show the older Finishing count.

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD`. Floor Manager `manager@cpoint.local`, Quality Inspector
`inspector@cpoint.local`.

## 5. Test scenarios

| ID  | Role                             | Steps                                                                                                                                                                                                                                                 | Expected result                                                                                                                                                                                                                                     | Priority |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| W1  | none (SQL)                       | After the reset: `select status, stage, count(*) from repair_jobs group by 1, 2 order by 1, 2`                                                                                                                                                        | `AT_STAGE` rows for CONSTRUCTION, SOLE_ING and FINISHING (1 each); no PREPARATION row anywhere; `BACK_FOR_INSPECTION` 3 (2 when today is a Monday morning, fewer jobs are recent); `DONE` at least 8.                                               | High     |
| W2  | none (SQL)                       | `select count(*) from repair_jobs where status='DONE' and "passedPairs"+"scrappedPairs"+"resentPairs" <> pairs`; and `select count(*) from repair_jobs where status in ('AT_STAGE','BACK_FOR_INSPECTION') and "sentAt" < (now() - interval '8 days')` | 0 and 0.                                                                                                                                                                                                                                            | High     |
| W3  | Floor Manager                    | Batches → Work in progress                                                                                                                                                                                                                            | Preparation: no repairs and, since Phase 38, the camera's leather defects instead of "No repairs here". Construction, Sole-ing and Finishing each list one repair At stage with a code `RP-…`. No list longer than two cards.                       | High     |
| W4  | Floor Manager                    | Same page; then `select stage, to_char(("enteredAt" at time zone 'UTC') at time zone 'Asia/Manila','HH24:MI') from stage_counts where day = current_date order by 1, 2` (use today's date in Manila)                                                  | Finishing's card reads "as of 10:30"; the other three read "as of 15:30". SQL: Finishing has one count today (10:30), the other stages two. Tap **Update count** on Finishing, enter a number: the card's time changes.                             | High     |
| W5  | Quality Inspector (phone window) | Batches → Queue                                                                                                                                                                                                                                       | **Repairs back for inspection** lists three repairs with different waits (about 2 days, 1 day and a few hours). **Inspect repair** on the oldest, Passed = all its pairs: it leaves the list and the Floor Manager's board shows one fewer waiting. | High     |
| W6  | Floor Manager                    | Reports → Operations, month to date, section **Repairs**                                                                                                                                                                                              | Passed, Scrapped and Sent back again are all above 0 and add up to the repairs' pairs.                                                                                                                                                              | Medium   |
| W7  | Floor Manager                    | Overview, the Work in progress card                                                                                                                                                                                                                   | Its counts agree with the board (repairs At stage and waiting for inspection).                                                                                                                                                                      | Medium   |
| W8  | none                             | `npm run demo:reset '--' --yes` a second time                                                                                                                                                                                                         | Same counts as W1 (the seed is fixed; only the clock moves them).                                                                                                                                                                                   | Low      |

### Access checks

None new: no page or permission changed.

## 6. Out of scope / known issues

- Screenshot 21 and `docs/USER_MANUAL.pdf` were retaken by Claude (2026-11-23); no check needed.
- The Preparation card doesn't list the camera's defects (Phase 38, not part of Phase 37).
- "Not fixable after all" and "moved to another stage" repairs aren't seeded (a live step of the demo).
- Known: `admin.spec.ts:136` flake and the 00:00 to 01:00 Manila window of `batches.spec.ts` (STATUS).
