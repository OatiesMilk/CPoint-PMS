# QA handoff: Phase 38, Preparation shows the camera's defects; no repair goes back to Preparation

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Date            | 2026-11-23                                                                                              |
| Feature         | Phase 38: the camera's leather defects on the Preparation card; repairs never go to Preparation (D-136) |
| Branch          | uncommitted on the laptop, on top of Phase 37 (Dylan makes the branch, list `qa/phase-38-files.txt`)    |
| Spec / prompt   | `docs/prompts/plans/phase-38-preparation-camera-defects-plan.md`, `docs/ROADMAP.md` Phase 38            |
| Written by      | Claude                                                                                                  |
| Previous report | `qa/reports/2026-11-22-phase-36-run2.md` (Phase 37's run is still to come)                              |

## 1. What changed

- **The Preparation card lists the camera's defects** (Batches → Work in progress). Under "Rolls: N being
  scanned, N scanned today" it shows **Leather defects found by the camera, rolls finished today** and a line
  such as "Scratch 9, Crease 7": one count of rolls per defect type, the same count as Reports → Rolls
  (`defectBreakdown`, today's Manila day, the "A defect counts as found at" setting). With none: "The camera
  found no defects on today's rolls." When a roll finished today was returned: "Returned to supplier: N rolls."
  The old "No repairs here." is gone from Preparation. The Overview's Work in progress card is unchanged.
- **No repair goes back to Preparation.** New `REPAIR_STAGES` (Construction, Sole-ing, Finishing) is used by:
  the finding form's **Goes back to**, a repair's **Change → Move to**, **Inspect repair → Send some back
  again**, the API validators (a Preparation stage is refused, naming the field), the Operations stage filter
  and the **Where defects come from** columns. Preparation stays for who works where, stage counts and the
  board. No migration (the enum keeps `PREPARATION`).
- **Legacy rows:** a finding or repair from before this phase that names Preparation is still reported (a
  Preparation column in Where defects come from, and the Preparation card's repair block, appear only when
  such pairs exist), so no pairs are hidden. Claude couldn't query the laptop's dev database (see L1).
- A pre-Phase 38 `?stage=PREPARATION` link on Reports → Operations is ignored (all stages), not an error.

## 2. Files touched

See `qa/phase-38-files.txt`. Code: `src/lib/repair-rules.ts`, `src/server/services/stage.service.ts`,
`src/server/services/repair.service.ts`, `src/server/validators/repair.validator.ts`,
`src/server/validators/report.validator.ts`, `src/app/(app)/batches/wip-board.tsx`, `findings-editor.tsx`,
`repair-actions.tsx`, `repair-inspect-dialog.tsx`, `src/app/(app)/reports/_components/operations-view.tsx`.
Tests: unit (`repair-rules`, `stage.service`, `repair.service`, `repair.validator`) and two e2e assertions
(`final-defects.spec.ts`, `stage-wip.spec.ts`). Docs: README, USER_MANUAL, API, master spec, STATUS,
SESSION_LOG, DECISIONS, ROADMAP. `docs/DEMO_SCRIPT.md` (Dylan's file) needs no change.
Database migration in this change: **no**.

## 3. How to run the app locally

```bash
npm run db:up
npm run db:deploy
npm run dev                      # note the port it prints
npm run demo:reset '--' --yes    # PowerShell; reseeds the demo week
```

## 4. Test accounts and data

Demo accounts use `DEMO_USER_PASSWORD`: Floor Manager `manager@cpoint.local`, Quality Inspector
`inspector@cpoint.local`, a constructor with Capture access for My stage.

## 5. Test scenarios

| ID  | Role                                           | Steps                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Expected result                                                                                                                                                                                                                                                                                                          | Priority |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| L1  | none (SQL)                                     | Before the reset, on the dev database as it is: `select count(*) from inspection_findings where "returnStage"='PREPARATION'` and `select count(*) from repair_jobs where stage='PREPARATION'`. Report both numbers. Repeat after the reset.                                                                                                                                                                                                                                     | After the reset both are 0. Before it, any non-zero number goes in the report (legacy rows; the app must still show them, see L8).                                                                                                                                                                                       | High     |
| L2  | Floor Manager                                  | Batches → Work in progress, Preparation card. Then Reports → Rolls for today and `select t.label, count(distinct b.id) from batches b join scans s on s."batchId"=b.id join detections d on d."scanId"=s.id join defect_types t on t.id=d."defectTypeId" and t."isActive" where b.status in ('FINISHED','USED','RETURNED') and (b."finishedAt" at time zone 'UTC' at time zone 'Asia/Manila')::date = <today Manila> and d.confidence >= <found-at> group by 1 order by 2 desc` | The card's "Leather defects found by the camera, rolls finished today" line lists the same types and counts, most rolls first, labels as in Settings → Defect types. No "No repairs here." on Preparation; Construction, Sole-ing and Finishing keep their repair blocks.                                                | High     |
| L3  | Floor Manager                                  | With the demo clock on a day with no roll finished yet (for example a Monday 08:50 after a reset, or a weekend), open the same card.                                                                                                                                                                                                                                                                                                                                            | "The camera found no defects on today's rolls." in muted text; no "Returned to supplier" line.                                                                                                                                                                                                                           | High     |
| L4  | Floor Manager, Capture phone                   | Finish a roll at Capture with a defect found (the simulator: `npm run cv:simulate -- --count 6 --interval 3`), mark it Returned if it is over the limit, reload the board.                                                                                                                                                                                                                                                                                                      | The roll's defect types appear on the card, each counted once for the roll however many shots show it; if the roll was returned, "Returned to supplier: 1 roll."                                                                                                                                                         | Medium   |
| L5  | Quality Inspector                              | Finish a batch with failed pairs; on a line choose **Fixable**.                                                                                                                                                                                                                                                                                                                                                                                                                 | **Goes back to** offers Choose the stage, Construction, Sole-ing, Finishing. No Preparation. A line with no stage still reads "Choose the stage line N goes back to."                                                                                                                                                    | High     |
| L6  | Floor Manager                                  | A repair At stage → **Change**, choose Move. Then as the Quality Inspector, **Inspect repair** → **Send some back again**.                                                                                                                                                                                                                                                                                                                                                      | **Move to** lists the other two repair stages only (never Preparation, never the current one). The resend stage list is Construction, Sole-ing, Finishing.                                                                                                                                                               | High     |
| L7  | none (API, signed in)                          | `POST /api/v1/production/check-ins` with a fixable finding `returnStage: "PREPARATION"`; `PATCH /api/v1/production/repairs/{id}` with `{ action: "move", stage: "PREPARATION", reason: "Needs a press" }`; `POST …/repairs/{id}/inspect` with `resend: [{ stage: "PREPARATION", pairs: 1 }]`                                                                                                                                                                                    | Each is refused with `422` and a message naming the field/line ("Line 1 can't go back to Preparation, because the camera already checked the leather. Choose Construction, Sole-ing or Finishing."; the move says "Choose a stage a repair can go to: Construction, Sole-ing or Finishing. …"). Nothing is saved.        | High     |
| L8  | Floor Manager                                  | Reports → Operations: the **Stage** filter, and the **Where defects come from** table. Open `?stage=PREPARATION` by hand. If L1 found legacy PREPARATION rows, check them here and on the board.                                                                                                                                                                                                                                                                                | Stage filter: All stages, Construction, Sole-ing, Finishing. Where defects come from has three stage columns (a Preparation column only when the period has pairs sent there). `?stage=PREPARATION` shows all stages, no error. Legacy PREPARATION repairs, if any, still show on the Preparation card with their codes. | Medium   |
| L9  | Floor Manager, constructor with Capture access | Plan days → the Plan dialog; Capture → My stage; Update count on Preparation.                                                                                                                                                                                                                                                                                                                                                                                                   | Preparation is still a stage there (Capture-access constructors ticked and locked, count saved, "Pairs at Preparation now"). My stage shows no defect list (decided: the Capture page already shows each shot's defects).                                                                                                | Medium   |
| L10 | Floor Manager                                  | Overview, the Work in progress card; axe on Batches → Work in progress.                                                                                                                                                                                                                                                                                                                                                                                                         | The card is unchanged (four counts, repairs, waiting). No axe violations on the board.                                                                                                                                                                                                                                   | Low      |

### Access checks

None new: no page or permission changed.

## 6. e2e to rerun (Claude runs no browser tests)

`tests/e2e/stage-wip.spec.ts` (new assertions on the Preparation card), `tests/e2e/final-defects.spec.ts` (new
assertion that Preparation isn't an option), `tests/e2e/corrections.spec.ts`, `tests/e2e/reports.spec.ts` and
`tests/e2e/batches.spec.ts` (they pick stages, findings or the Work in progress tab). Phase 37's scenario
W3 ("Preparation: No repairs here") now reads: the Preparation card shows the camera's defects instead.

## 7. Out of scope / known issues

- Manual screenshot 21 and `docs/USER_MANUAL.pdf` are retaken by Claude; no check needed.
- The CI `docker` job's SQL block is a protected file; one more check ("no repair job or finding at
  PREPARATION") can be offered as a patch.
- The Capture page's My stage card shows no camera defect list (Dylan's answer, 2026-11-23).
- Known: `admin.spec.ts:136` flake and the 00:00 to 01:00 Manila window of `batches.spec.ts` (STATUS).
