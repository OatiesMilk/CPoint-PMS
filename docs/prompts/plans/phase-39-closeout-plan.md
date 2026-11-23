# Phase 39 plan: close-out after Phases 37 and 38 (planning thread, 2026-11-23)

Request (Dylan, 2026-11-23): "Whats next, latest PR is merged and CI checks pass" and "go ahead" on the
recommendation: no new feature is left, so Phase 39 is a docs-only close-out. One session, Sonnet (high).
No application code, no migration, no new decision (D-entry) and no new business rule.

## Why

- Phases 37 and 38 were merged together as #64 (commit 8de71d4, CI green), but `docs/STATUS.md` and
  `docs/ROADMAP.md` still say "built, uncommitted" and the "Committed and merged" boxes are open.
- The Phase 38 handoff left out a docker-job SQL check that no repair is at PREPARATION (the CI file is
  protected, so Claude gives the exact edit).
- The system is otherwise finished (phases 0 to 38). What is left is Dylan's hand rehearsal and the
  questions for CPoint. Nothing else in README, USER_MANUAL, API or the master spec is stale for Phase 38
  (planning thread spot-checked on 2026-11-23).

## What to do

### A. Docs say "merged" (repo)

1. `docs/STATUS.md`:
   - Header "Last updated": 2026-11-23, Phases 37 and 38 merged as #64, CI green; "Branch": `main` at 8de71d4.
   - Phase 37 and Phase 38 bullets: replace "uncommitted" with "merged in #64 (D-135, D-136)". Keep their
     QA lines; trim them to one short line each, with the report links (STATUS stays concise; history goes
     in SESSION_LOG).
   - "Phase progress": add `- [x] 37. ...` and `- [x] 38. ...` lines (what each does, QA result, merged #64).
   - "Next step (exact)": remove item -2 (the git commands are done). Keep Dylan's hand rehearsal as item 1.
     Add "Take the questions below to CPoint" as item 2.
   - "Last merged features" and "Overall": every planned phase is built and merged (0 to 38).
   - "Open questions": add one short block at the top, "To ask or tell CPoint", that only points to the
     existing assumptions (no new ones): their final-defect list (A-62), rack layout and batch-code format
     (A-53, A-57), whether the Quality Inspector may correct older batches (A-70), the rule for repairs that
     keep failing (A-88), and **tell** them that repairs never go back to Preparation (D-136).
   - "Main CI": #64 passed all four jobs (confirm the actual run on GitHub before writing "passed"; if it
     cannot be read, write "reported green by Dylan").
2. `docs/ROADMAP.md`: tick "Committed and merged" for Phases 37 and 38 (add "#64"); add a "Phase 39 close-out"
   section with its checklist.
3. `docs/SESSION_LOG.md`: prepend a Phase 39 entry (done, files, checks run, next step).
4. `docs/DECISIONS.md`: no change (state it in the SESSION_LOG entry).
5. Untracked files: do not touch `docs/DEMO_SCRIPT.md` (Dylan's file) or the `qa/*-files.txt` lists. Delete
   nothing. `qa/phase-36-ci-storage-checks.patch` is already applied to `.github/workflows/ci.yml` (lines
   178 to 205); say in the report that it is stale and Dylan may delete it.

### B. The CI check (exact edit for Dylan; Claude cannot write `.github/workflows/ci.yml`)

In the `docker` job's SQL block, after the `Final defects and repairs` lines (near
`test "$(q "select count(*) from stage_counts")" -ge 1`), add:

```
          # No repair goes back to Preparation (Phase 38, D-136): the camera already filtered the raw
          # leather, so no finding, repair job or root job names it.
          q "select count(*) from inspection_findings where \"returnStage\" = 'PREPARATION'" | grep -qx 0
          q "select count(*) from repair_jobs where stage = 'PREPARATION'" | grep -qx 0
```

Column names checked in `prisma/schema.prisma`: `inspection_findings."returnStage"` and `repair_jobs.stage`
(both `ProductionStage`). The coding thread must first run the two queries against the demo seed in the
cloud container (a real PostgreSQL seed) and report the counts (both must be 0), and write the patch to
`qa/phase-39-ci-no-preparation-repairs.patch` plus the `git apply` command. Codex reruns the docker job after
Dylan applies it: `qa/CODEX_PROMPT_CI_RECHECK_<branch>.md` from `qa/templates/ci-recheck-prompt.md`.

### C. The vault

Today's `Daily/2026-11-23.md`: Did, Next, Questions, and the Agent sessions line linking this plan, the
handoff and the report. `Notes/Phases/`: mark Phases 37 and 38 merged (#64) and add a short Phase 39 note.
Link repo docs as `[[CPoint-PMS/docs/...]]`; read and write the repo through `C:\dev\CPoint-PMS`.

### D. Left out on purpose

- The six-worker sign-in timeouts in Corrections and Reports (Codex run 3): they pass alone, CI is green,
  and `playwright.config.ts` already allows a 10 s expect timeout. Not changed. Reopen only if it fails in CI.
- No new QA run for the docs fixes. Codex only reruns the docker job if Dylan applies the CI edit.
- No new feature, no change to `DEMO_SCRIPT.md`, no screenshots, no PDF rebuild.

## Checks

- `npm run check` is not needed for docs only, but run lint and Prettier on the changed markdown through the
  pre-commit hook setup (`npx prettier --check docs/STATUS.md docs/ROADMAP.md docs/SESSION_LOG.md`). Say
  plainly which commands were run. Never write "passed" for anything not run.
- The two SQL counts for B on a real seed (above).

## After this phase

Dylan's git commands (one block, branch from the latest `main`, e.g. `docs/phase-39-closeout`, `git add` only
STATUS, ROADMAP and SESSION_LOG, plus the new patch and plan if wanted), then Dylan's rehearsal and the
CPoint questions. The next phase is whatever the rehearsal or CPoint raises.

## Assumptions

None new. Everything above points to existing A- and D-entries.
