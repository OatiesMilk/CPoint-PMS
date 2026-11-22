# Phase 36 plan: the documentation and the paper's figures match the system

**Status:** APPROVED by Dylan 2026-11-22 (figures redrawn, Codex screenshots and the PDF rebuilt, D-134 yes), with one addition: **D. the demo script updated** below. No code, schema or route changes; no git.
**Written:** 2026-11-22, planning thread. Part of `docs/prompts/plans/defense-revisions-plan.md`
(Phase 36, project goal 2: "the documentation must match our system"). Same shape as
`phase-31-plan.md`.

## 0. Where things stand (checked 2026-11-22)

- `main` is at `dec06e7`: Phase 35B merged (#61), after 35A (#59, #60). Nothing of the work is
  uncommitted. Untracked and staying out: `docs/DEMO_SCRIPT.md` (Dylan, 2026-11-17),
  `.claude/settings.local.json` and four `qa/*-files.txt` lists.
- Newest Codex report: `qa/reports/2026-11-22-phase-35b-run5.md`, PASS WITH ISSUES (one full-suite
  sign-in stall that passed alone). Nothing unresolved that touches the docs.
- `docs/STATUS.md` is out of date: it says 35B is uncommitted and Phase 31 "waits for QA", but
  Phase 31 merged as #46 and 35B as #61. ROADMAP still shows 31 unticked and 35B "Committed and
  merged" unticked, and has no Phase 36 section.
- I have not run `npm run check` in this thread (planning only); the build thread runs it at the end.

## 1. What the audit found

Phases 33 to 35 updated their own docs as they went (API.md, DESIGN.md, the manual's Queue,
repairs and corrections parts, the CI docker checks for batch codes, findings and repairs).
**Phase 32 and the reports changes of 35A did not reach the user-facing docs, and nothing was ever
checked as a whole.** Gaps, by file:

| File                                                     | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                              | Feature list has no storage locations, QR labels, Find roll, Inspection queue / batch codes, report periods, sort, filter, print, or corrections. The ER diagram stops at Phase 31 (no `StorageLocation`, `RollMove`, `ProductionBatch`, `InspectionFinding`, `RepairJob`, `StageAssignment`, `StageCount`, `FinalDefectType`). The demo script's QI step quotes "Batch 2 ends at 17:00" (the app says `B-YYMMDD-N ends at …`); no demo steps for locations, Find roll, the queue's Urgent / Void, periods and print, or a correction. |
| `docs/USER_MANUAL.md`                                    | No storage locations, roll labels or Find roll (0 mentions); the Floor Manager's Reports part has no period picker, sort, filter or Print; the Batch row in "Words to know" still says "check-in period"; Inventory part needs the location steps. 14 screenshots from before Phases 32 to 35; PDF dated 17 Nov.                                                                                                                                                                                                                       |
| `docs/prompts/system-rebuild.md`                         | "Changed since the rebuild" stops at D-122. Missing: D-123 to D-133 (small demo rolls, demo clock, claim sheet, locations and labels, Inspection queue, final defects and repairs, Overview zones, report periods and print, corrections). Rules and data model: no locations, `ProductionBatch`, periods or print.                                                                                                                                                                                                                    |
| `docs/API.md`                                            | Mostly current (phases updated it). Re-verify every route in `src/app/api` (78 route files) against it, as in Phase 31; my quick diff was too crude to trust.                                                                                                                                                                                                                                                                                                                                                                          |
| `DESIGN.md`, `docs/STATION_SETUP.md`                     | DESIGN covers 32 to 35; STATION_SETUP says nothing about printing roll and location labels (A4 sticker paper, A-54).                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `CLAUDE.md`, `AGENTS.md`                                 | CLAUDE.md says the follow-ups run "through Phase 31" and lists Capture, Batches and Find roll as phone pages: update to 35 and name Phase 36.                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/STATUS.md`                                         | ~790 lines, mostly per-run history that belongs in SESSION_LOG. Needs the Phase 31 rewrite treatment: short current state, open questions, exact next step.                                                                                                                                                                                                                                                                                                                                                                            |
| `docs/ROADMAP.md`, `docs/DECISIONS.md`                   | Tick 31 and 35B, add a Phase 36 section. A D-134 only if something needs deciding (see questions).                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `docs/UI_AUDIT.md`, `docs/AGENTIC_WORKFLOW.md`           | Sweep for stale terms; UI_AUDIT is already marked history.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `docs/prompts/paper-figures.md` + the three PNGs (11-07) | The facts list has no locations and labels, Find roll, the Inspection queue, repairs and Work in progress, Floor Manager's Reports periods and corrections. The figures predate all of it, so at least the modules figure is wrong.                                                                                                                                                                                                                                                                                                    |
| `.github/workflows/ci.yml`                               | Docker job checks batch codes, findings and repairs, but has no check for storage locations and moves.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Sweep                                                    | "Batch 1" / "Batch 2" in README line 198, `production-rules.ts` comment (lines 517 to 518), DESIGN (Phase 27 line, history), `DEMO_SCRIPT` (out of scope). "Upper making" is already history only. "Closes at midnight" survives only in the manual and API as "no longer".                                                                                                                                                                                                                                                            |

## 2. What I will do (one phase, three parts)

**A. Docs (Claude, in the repo)**

1. Master spec: extend "Changed since the rebuild" to D-133; update `<domain_rules>`,
   `<roles_and_modules>` and `<data_model_outline>` with locations and moves, batch codes and the
   queue, final defects, repairs, stages, periods and print, corrections. Architecture, gates and
   protocols stay.
2. README: features, the ER diagram (add the eight tables above, grouped so it stays readable),
   the demo script by role with the new steps (replace the "Batch 2" quote with the code form),
   reports bullet, structure and counts.
3. USER_MANUAL: add Inventory locations and labels (print a sheet, put a roll in a place, move),
   Find roll (the constructor's and the Floor Manager's use), Reports periods, sort, filter and
   print, fix the Batch definition, then a read-through of the Queue, repair and correction parts
   against the screens.
4. API.md route check against `src/app/api` (78 files), with the diff pasted in the wrap-up.
   STATION_SETUP: a short labels section. DESIGN, CLAUDE.md, AGENTS.md, UI_AUDIT and
   AGENTIC_WORKFLOW: the sweep.
5. ROADMAP (tick 31 and 35B, add Phase 36), DECISIONS (D-134 only if Q3 says so), SESSION_LOG,
   STATUS rewritten short (history stays in SESSION_LOG and git at the current commit).
6. Vault: Phase 36 summary in `Notes/Phases/`, `Phases.md` rows for 31 and 35 brought up to date,
   today's Daily note, and the "where to look" note checked.

**B. Figures and screenshots**

7. Re-check the three figure facts against the code, update `paper-figures.md`, and redraw the
   architecture and the modules figure as new files dated with the day I make them (the 11-07
   files stay as history). Details in Q1.
8. New manual screenshots for the new screens, taken by Codex with a headless script (the in-app
   browser could not save screenshots in earlier runs), then the PDF rebuilt. Details in Q2.

**C. Small non-docs edits (no behaviour change)**

9. CI docker job: SQL checks for storage locations and roll moves (every placed roll's location
   is active, each move has a reason and a roll, returned rolls are in a place, the oldest was
   picked up). The demo seed already makes the data (Phase 32), so no seed change; I will confirm
   by reading `demo-seed.service.ts` before writing the checks.
10. One code comment fix: `production-rules.ts` lines 517 to 518 quote the old notice text.

**D. The demo script (Dylan's addition, 2026-11-22)**

11. **Update `docs/DEMO_SCRIPT.md`** (the existing full four-role script, Dylan's call 2026-11-22: "the demo script, it is to be updated also"; no new demo file). Bring every act up to date with Phases 32 to 35B and add a short **"What changed since the defense"** block with one act per panel revision: **4** locations, labels and Find roll; **2** the Inspection queue (batch codes, Urgent, Void, an earlier day's batch); **1** failed pairs with final defects, a repair at a stage, Back for inspection, the QI's recheck, Work in progress; **3** report periods, sort, filter, print, then a correction (a past batch, a roll's details, a repair's inspection) with its reason and audit row. Fix the stale lines (the "Batch 1" banner quote becomes the code form `B-YYMMDD-N`; Overview zones; the Construction name). Keep its format: who speaks, "Say" lines, screen wording quoted from the app, the weekday rule, the clock times, "If something goes wrong". Timing: the full run plus the revisions block, with the revisions block runnable alone in 10 to 12 minutes.
12. The acts reuse the demo week's data (waiting and Urgent batches, repairs in each state, locations); the build thread checks each act against `demo-seed.service.ts` and notes any act that needs a few clicks of set-up rather than changing the seed. README's demo script gets a link to DEMO_SCRIPT.
13. `DEMO_SCRIPT.md` stays untracked, as Dylan decided on 2026-11-17, unless he says to commit it; the build thread lists it as "left out on purpose" in the git commands and says so.
14. Codex rehearses every act on the laptop in the QA pass (clock set, each step done and timed),
    and reports steps that don't read as written.

## 3. Checks

- The sweep, with its output pasted: `rg -n -i "batch 1|batch 2|upper making|closes at midnight|fixable|repair station|review queue|salvage module|procurement|material request|shoe type|needs review|stage monitoring|override"` over README, DESIGN, `docs/` (not history files), `cv/` and `src`; every hit fixed or inside history.
- API.md against `find src/app/api -name route.ts`; the master spec's roles table against `permissions.ts` and `navigation.ts`; manual steps against the running app by Codex.
- `npm run check` at the end (lint, typecheck, unit tests, build). `cv/` checks only if a `cv/` file changes (not planned). I do not run e2e or browser tests.
- CI: the new SQL checks run in the `docker` job; if it fails I fix it and write a CI re-check prompt.

## 4. QA and git

Like Phase 31: a handoff `qa/handoffs/2026-11-2x-phase-36-docs.md` and `qa/CODEX_PROMPT_PHASE_36.md`.
Codex does every manual step, every demo-script step and each act of the revised demo in the app, spot-checks API.md against
the running app, takes the screenshots (Q2), and runs the docker SQL checks locally (as the CI
re-check does). Fixes loop back through a planning thread. After a full pass I give Dylan the
git commands for one branch, `docs/phase-36`, with the file list in `qa/phase-36-files.txt`;
`docs/DEMO_SCRIPT.md` stays out.

## 5. Assumptions and open items for CPoint

No new business rule. The pending question stays logged in STATUS: A-70 (may the Quality Inspector
correct an older batch? today only the Floor Manager does). The docs say what the system does
today and call A-70 an open question, not a rule. Other assumptions (A-52 to A-110) stay as they
are; Phase 36 only carries them into STATUS's open questions list unchanged.

## Decided (Dylan, 2026-11-22)

1. Redraw the architecture and modules figures: yes.
2. Codex takes about 10 new manual screenshots and the PDF is rebuilt: yes.
3. D-134, short: yes.
4. The demo script is updated, with a block for the changes since the defense (part D): yes. No separate DEMO_REVISIONS.md.
