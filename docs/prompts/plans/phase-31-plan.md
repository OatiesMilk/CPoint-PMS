# Phase 31 plan: the documentation and the paper's figures match the system

Brief: `docs/prompts/factory-visit-changes.md`, "Phase 31". Approved by Dylan on 2026-11-07 ("go",
both recommendations). Docs only: no code, schema, route or
test changes. Saved to `docs/prompts/plans/phase-31-plan.md` after Dylan's go.

## 0. Review of the latest changes (done, 7 Nov)

- The laptop's `main` is `c5b1848`, the same commit as GitHub (30F-1 #42, 30F-2 #43, 30F-3 #45,
  Plan days #44 all merged). Nothing is uncommitted except `qa/uat/` (two UAT case lists) and
  `.claude/settings.local.json`. An old stash from 30A (`stash@{0}`) is still there; I'll leave it.
- `npm run check` on `c5b1848` (cloud copy, same commit): lint clean, typecheck clean,
  **708 unit tests passed** (52 files), build OK (61 pages).
- Code read of the 30F diff (97 files): no page or API guard changed; no raw colours outside the
  `globals.css` tokens; the only arbitrary values are auto-fit grids and the phone safe area;
  the #44 change (`flex-1`, `min-h-32`) sits in a flex column, so it works as meant. No fault found.
- Still open from 30F:
  - **30F-3 Codex run 4** (Batches on a phone and desktop, the plan line, the full suite) never
    ran: it needs a weekday with today planned. Monday 9 Nov at the earliest, with the existing
    `qa/CODEX_PROMPT_PHASE_30F_3_RUN3.md`.
  - **#44** (Plan days equal cells) merged without a Codex check; run 4 can cover it (one line
    added to its prompt).
  - STATUS, ROADMAP and the 30F vault note still say 30F-3 is uncommitted and `main` is at
    `3b1db85`. D-119 is still "uncommitted" in STATUS. Phase 31 fixes all of this.

## 1. The master spec (`docs/prompts/system-rebuild.md`)

Rewrite `<context>`, `<domain_rules>`, `<roles_and_modules>`, `<data_model_outline>` and
`<cv_integration_contract>` to the system as built (Pass or Reject final; rolls from Inventory with
an area; the marker card once per roll; 3 in cut line; over 10% Returned to supplier; batches as
check-in intervals with lunch; the day-plan calendar; stock sheet with reminders; four roles and
their sidebars; two containers). Add a short "Changed since the rebuild" list linking D-entries.
Architecture, gates and protocols stay.

## 2. The other live docs

- `README.md`: features, setup, the demo script with the login-page demo tools, the new look.
- `docs/API.md`: exactly the 58 routes in `src/app/api` (check `defect-types/{id}`,
  `suppliers/{id}` and the Auth.js route, which my first pass didn't match by name).
- `DESIGN.md` (30F tokens already in; sweep its 2 hits), `docs/STATION_SETUP.md`, `cv/README.md`,
  `cv/MODEL_CARD.md` (Pass or Reject, final; stretch marks not a class until fine-tuned),
  `docs/UI_AUDIT.md` and `docs/AGENTIC_WORKFLOW.md` hits.
- `CLAUDE.md` and `AGENTS.md`: the wording from the new `<context>` and the non-negotiables.
- ROADMAP (removed phases marked, 30F ticked, D-119 merged), STATUS (rewritten short: current state
  and next step; history stays in SESSION_LOG), SESSION_LOG, DECISIONS (a D-123 only if something
  needs deciding).

## 3. Checks (the brief's "Done when")

- The sweep `rg -n -i "fixable|repair station|review queue|salvage module|procurement|material request|shoe type|needs review|stage monitoring|override" …`
  with its output pasted; every hit fixed or inside history. The four hits in `src` today are
  history comments and the old-scan note on a scan's page, which stay.
- `src/app/api/**/route.ts` against `docs/API.md`; the master spec's roles table against
  `permissions.ts`.
- `npm run check` again at the end.

## 4. The paper's figures (DQ-6)

The brief assumed no session could reach the figures. This one can: the project files hold
redrawn versions dated 7 Nov (`architecture/system-architecture-2026-11-07.png`,
`conceptual-framework/…-2026-11-07.png`) that already show the current system (no procurement,
review or stages; the marker card, Returned to supplier, two containers). I'll check every fact on
them against the code and write `docs/prompts/paper-figures.md` (modules per role, capture to
Returned to supplier, the two containers). I'll redraw a figure only if a fact is wrong. The old
14 Oct files in `paper/` stay as history.

## 5. Vault

Phase 31 summary in `Notes/Phases/` (listed in `Phases.md`), 30F and D-119 notes marked merged,
`Inbox/CPoint commands and where to look.md` checked, today's Daily note.

## 6. QA and git

Docs only, so a short Codex handoff: follow the README's setup and demo script on the laptop and
confirm each step works as written, and spot-check `docs/API.md` against the running app. Then
git commands for one branch, `docs/phase-31`.

## Questions (recommendation first)

1. Put the two `qa/uat/` case lists in the Phase 31 commit, with their Build line brought up to
   date? **Recommend yes.**
2. Phase 31 goes ahead now and 30F-3 run 4 runs on Monday on its own? **Recommend yes**, since
   Phase 31 changes no code.
