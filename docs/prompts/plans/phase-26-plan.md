# Phase 26 plan — Capture on the constructors' own phones; rolls start and finish there

> **Status: approved by Dylan ("go", 2026-10-24); built, waiting for Codex QA.** Brief:
> `docs/prompts/factory-visit-changes.md` → `<phase_26>` (C-8, C-18, C-23, C-24, C-33, DQ-1;
> A-1, A-15 to A-17, A-22, A-24). Branch: none. The work stays uncommitted in `C:\dev\CPoint-PMS`
> until Dylan branches from the latest `main`.

## 0. Starting point

- Laptop `main` is at `bf01c26` (#23, Phase 25 run 2 fixes and the run 3 PASS report), clean and
  level with `origin/main`. PR #23 is merged.
- Newest QA: `qa/reports/2026-10-24-phase-25-run3.md`, **PASS** (e2e 75 passed, 0 failed,
  1 skipped). **Nothing to fix first.**
- Last migration: `20261024090000_pass_or_reject`. Last decision: D-094, so this phase writes
  **D-095** (rolls at Capture, it's a Roll, only the Admin grants capture) and **D-096** (phone
  layout for Capture, later Batches).
- The visit notes (`docs/CPOINT_VISIT_10232026.md`) agree with the brief for this phase: no shoe
  types on a roll, the camera captures a roll shot by shot, the constructor's page is Capture.

## 1. What I reuse

| Need                         | Reused from                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| The camera, sending, retries | `capture-client.tsx`, `capture-rules.ts` (every camera problem's message stays), `SEND_ATTEMPTS`     |
| Model and verdict            | `capture.service.ts` → `ingestScan` (Phase 25 rule unchanged)                                        |
| Who may capture              | `User.canCapture` and `canCaptureFor` (D-075), read fresh each request                               |
| The "May capture" switch     | Users → More actions (already there for the Admin, D-075); `setCameraOperator` keeps its audit rows  |
| Codes and stale moves        | `batch_sequences` counter and the `409 STALE` conditional update (D-019)                             |
| Lists                        | `PAGE_SIZE` 15, the shared pager, the filter bar of the old Batches list                             |
| A roll's shots               | The old batch page's scan grid and the scan viewer (`/scans/[id]`)                                   |
| Claim sheet                  | `/reports/claims/[batchId]` → `/reports/claims/[rollId]`, content unchanged (no person named, D-072) |
| Floor view                   | Unchanged, now for an allowed constructor at the station                                             |

## 2. Step A — the rename (its own green checkpoint, no behaviour change)

`Batch` → `Roll` in code only (DQ-1, A-1): `model Roll { … @@map("batches") }`,
`BatchStatus` → `RollStatus` (`@@map`), `BatchSequence` → `RollSequence` (`@@map("batch_sequences")`),
`batchId` fields → `rollId` with `@map("batchId")` on `scans` and `inventory_movements`.
Files: `batch.{model,service,controller,validator}.ts` → `roll.*`, `stage-log.model.ts` stays until
Step B deletes it, `components/features/batches` → `rolls`, the tests renamed with them. No table
or column renamed, so no migration in this step. Checkpoint: typecheck + unit tests.

Audit rows already written keep `entity: "Batch"` and `batch.*` actions (history); new rows write
`Roll` / `roll.*`. The audit log reads both.

## 3. Step B — schema and the migration `rolls_at_capture`

| Change                                                                                                      | Existing rows (A-10)                                                                                                                        |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `RollStatus` = `OPEN`, `FINISHED`, `CANCELLED`                                                              | `PLANNED`, `IN_PROGRESS` → `OPEN`; `COMPLETED` → `FINISHED`                                                                                 |
| add `startedAt` (not null), `finishedAt?`, `finishedById?` (FK users)                                       | `startedAt` = first stage log's start, else `createdAt`; for FINISHED: last log's `endedAt` / `endedById`, else `updatedAt` / `createdById` |
| `rollCode` and `receivedAt` optional                                                                        | kept as they are                                                                                                                            |
| drop `currentStage`, enum `Stage`, `batch_stage_logs`, `targetQuotaPairs`, `shoeTypeId` (column, FK, index) | gone; shoe types themselves stay until Phase 27                                                                                             |
| drop `cv_settings.activeBatchId`                                                                            | gone                                                                                                                                        |
| new index `(status, createdById)` for "my open roll"                                                        | —                                                                                                                                           |

Old `OPEN` rolls from the demo data have no starter who is a constructor; they show in Reports →
Rolls and the FM can finish or cancel them. Dylan backs up, then `npm run db:deploy`,
`npm run db:generate`, and `npm.cmd run demo:reset -- --yes` for a fresh demo week.

New roll codes read `R-YYYY-NNNN` from the same counter (A-1); old `B-` codes stay.

## 4. Rules (`src/lib/roll-rules.ts`, pure, unit-tested; replaces `stage-machine.ts`)

Updated with Dylan's answers (24 Oct).

- **Several rolls can be open at once** (Dylan, Q1). Capture has a **Roll** dropdown listing every
  open roll (code · supplier · shots so far). Each shot goes to the roll chosen there, and the
  capture request carries that `rollId`. ASSUMPTION: the list holds every open roll, not only the
  ones this person started, because a roll is a physical roll on the table that anyone with camera
  access may continue. The dropdown starts on the roll this person last captured to in this browser,
  else the one they started most recently. The chosen roll is repeated in large text above the
  Capture button, so a shot doesn't go to the wrong roll by accident.
- No open roll → the Start a roll form; a capture with no roll chosen → "Choose the roll this shot
  belongs to." (`409 NO_OPEN_ROLL` when none is open).
- A device token (the simulator) still feeds the oldest open roll (D-020's fallback).
- Start needs an active supplier: "Choose the supplier this roll came from." (Q3: rolls have no
  other stages; scanning at Capture is the roll's whole life in the system.)
- **Finish is done at Capture, once the roll is fully scanned** (Dylan, Q2), by anyone with camera
  access. The system can't tell when a roll is fully in, so the confirmation asks: "Is all of
  R-2026-0012 scanned? 14 shots. Finished rolls can't take more shots." Finishing needs at least one
  shot: "A roll needs at least one shot to finish. Cancel it instead." The FM does **not** finish
  rolls.
- **Cancel** (Q2 and Q5, recommended approach):
  - at Capture, anyone with camera access may cancel a roll **with no shots** (started by mistake),
    no reason needed;
  - the **FM** may cancel any open roll from Reports → Rolls, with a **required reason** (for
    example, wrong supplier, or the roll was pulled from the line);
  - nothing is deleted: the roll reads **Cancelled** with its reason and its shots stay on its page
    and in the audit log. ASSUMPTION: a cancelled roll's shots leave the Quality, Operations and
    Supplier quality reports, since the roll never went on to cutting.
- A capture for a roll finished or cancelled meanwhile → `409 ROLL_CLOSED`: "R-2026-0012 was
  finished or cancelled. Choose another roll, or start one." (replaces `BATCH_MOVED`).
- Roll code: up to 40 characters: "Roll code can be up to 40 characters." Cancel reason: required, up
  to 200 characters: "Write why this roll is cancelled."
- Finish and Cancel keep D-019's `409 STALE` conditional update.

## 5. Access and the sidebar

| Permission                 | Before                          | After                                                                                                                         |
| -------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `batch:read`               | FM, QI, Admin                   | → `roll:read`: FM                                                                                                             |
| `batch:manage`             | FM                              | → `roll:manage`: FM (cancel any open roll, with a reason)                                                                     |
| `batch:finish`             | FM, QI                          | removed (folded into the two above)                                                                                           |
| `camera:capture`           | FM, QI (+ allowed constructors) | Shoe Constructors with `canCapture` only (via `canCaptureFor`); starting, finishing and cancelling an empty roll come with it |
| `camera:operators`         | FM, Admin                       | Admin only (Users → More actions → May capture)                                                                               |
| `camera:manage`            | FM, QI (batch picker)           | removed                                                                                                                       |
| `camera:view`, `scan:read` | unchanged                       | unchanged (Phase 28 narrows them)                                                                                             |

Sidebar: FM loses Batches and Capture, gains **Reports → Rolls**; QI loses Batches and Capture; the
Admin loses Batches; a constructor with access sees **Capture** only (see question 4).

## 6. Screens (DESIGN.md + ui-craft, tokens only)

**Capture `/camera/capture`, phone first** (intent brief: a constructor at a stand with their own
phone; worst case: a section sent to the wrong roll):

- Without access: one sentence, "Ask the System Admin for camera access.", nothing else.
- No open roll: **Start a roll** form: Supplier (required, active suppliers), Roll code (optional,
  "the number on the supplier's tag"), **Start roll**.
- Open roll: header "Roll R-2026-0012 · Marikina Leather Trading · 6 shots", live camera, a large
  **Capture** button fixed at the bottom above the safe area (Space still captures), the last result
  (Pass or Reject, shot number, each defect Usable or Not accepted), the guide "Move the roll edge
  to edge after each shot. Finish when all of it is in.", **Finish roll** (the confirmation names
  the roll and its shot count) and **Cancel roll** (only with no shots).
- A roll left open from an earlier day: "You still have R-2026-0012 open from Tue, 22 Oct. Finish
  it or keep capturing."
- Removed: "Next scan goes to …" polling of the shared camera batch, the "All 10 pieces scanned"
  hint (D-082), the shoe type. Floor view stays (same roll header, verdict colours unchanged).

**Phone shell (A-24)** in `app/(app)/layout.tsx` + `sidebar.tsx`: below 640 px the sidebar becomes a
top bar (logo, page title, account menu with Change password, theme, Sign out); a role with one page
gets no page menu; touch targets 44 px, inputs 16 px, no sideways scroll. Written into `DESIGN.md`
as "Phone layout" for Phase 27 to reuse. Desktop stays as it is.

**Reports → Rolls (FM)**: a new tab `/reports/rolls` (code, supplier, started, finished, shots,
passed, rejected for salvage, status; filters supplier, status, days; 15 a page) and
`/reports/rolls/[id]` (header, shots grid with photo, verdict, defects, link to each section page;
**Cancel roll** (with a reason) while open; **Claim sheet** link). No constructor's name on either
(D-008, D-072).

**Camera page**: loses the batch picker and the Camera operators panel; shows the status, the model
card and "Open rolls: N" (rolls being captured now).

**Section page `/scans/[id]`**: the roll link goes to `/reports/rolls/[id]`, shown only to `roll:read`.

**Removed**: `/batches/**` (list, new, edit, page; 404), `/constructor` (see question 4).

**Inventory**: the item page's "Use stock" loses "For batch" (A-22: starting a roll no longer takes a
roll item out of stock); old movements keep their reason text and link nothing.

**Operations report**: KPI "Rolls at Preparation" → **Rolls open** ("being captured now");
"Rolls finished" counts `finishedAt`. Reports → Quality's rolls started/finished per day read
`startedAt` / `finishedAt` instead of stage logs.

## 7. API (`docs/API.md` updated)

- `GET /api/v1/rolls` (FM, `roll:read`), `POST /api/v1/rolls` (start; constructor with access),
  `GET /api/v1/rolls/current` (the capturer's open roll; a device token gets the oldest open roll),
  `POST /api/v1/rolls/{id}/finish`, `POST /api/v1/rolls/{id}/cancel` (owner, or FM).
- `POST /api/v1/scans/capture` and `POST /api/v1/scans` take `rollId` (the device may leave it out:
  oldest open roll). `scripts/cv-simulate.ts` follows.
- Removed (404): `/api/v1/batches/**`. `PUT /api/v1/camera/operators/{userId}` stays, Admin
  only (the FM gets 403).

## 8. Files (by layer; the build lists every one in the handoff)

- **Delete:** `src/app/(app)/batches/**` (11 files), `src/app/api/v1/batches/**` (5 routes),
  `src/app/(app)/camera/{active-batch-form,operators-panel}.tsx`, `src/app/(app)/constructor/page.tsx`,
  `src/lib/stage-machine.ts`, `src/server/models/stage-log.model.ts`,
  `tests/unit/stage-machine.test.ts`, `tests/e2e/batches.spec.ts`.
- **Add:** `src/lib/roll-rules.ts`, `src/app/api/v1/rolls/{route,current/route,[id]/finish/route,[id]/cancel/route}.ts`,
  `src/app/(app)/reports/rolls/{page,[id]/page,roll-filters,roll-actions}.tsx`,
  `src/app/(app)/camera/capture/{start-roll-form,roll-bar}.tsx`, the phone top bar component,
  `prisma/migrations/2026102509…_rolls_at_capture/migration.sql`, `tests/unit/roll-rules.test.ts`,
  `tests/e2e/rolls.spec.ts`.
- **Change (main ones):** `prisma/schema.prisma`; `roll.{model,service,controller,validator}.ts`;
  `camera.service.ts`, `capture.service.ts`, `scan-ingest.service.ts`, `scan.controller.ts`,
  `scan.validator.ts`; `inventory.{service,validator}.ts` + `stock-actions.tsx`; `report.model.ts`,
  `ops-report.{model,service}.ts`, `operations-view.tsx`, `ops-sections.tsx`;
  `reports/claims/[rollId]/**`; `scans/[id]/page.tsx`, `scans/page.tsx`; `camera/page.tsx`,
  `camera/actions.ts`, `camera/capture/{page,capture-client,floor-view,last-scan}.tsx`;
  `permissions.ts`, `navigation.ts`, `lib/domain.ts` (`ROLE_HOME`), `sidebar.tsx`, `(app)/layout.tsx`;
  `admin/users/**` (wording: only the Admin grants); `audit-query.service.ts`; `bootstrap`,
  `demo-seed`, `demo-reset` (+ model); `scripts/cv-simulate.ts`.

## 9. Seeds

- Demo week: rolls started and finished by demo constructors with access (Noel Manalo and three of
  the twelve, who get `canCapture`), 10 shots each (D-090), none by the FM or QI; the absent-QI day's
  captures move to a constructor. One roll left open by Noel so Capture opens on a roll.
- Bootstrap: no stage or shoe type on rolls; `demo:reset` clears rolls as before.

## 10. Tests

- **Unit:** `roll-rules.test.ts` (each move and refusal, where a capture goes for a person and for a
  device token); `roll.service` (start, finish, cancel, the 409s, STALE, audit in the same tx);
  `capture.service` and `capture-route` (`ROLL_FINISHED`, no open roll, constructor without access
  refused, QI and FM refused); `camera-operators` (Admin only); `camera-status` (no picker);
  `permissions` (the new matrix); a D-008 test that the roll list payload has no person field;
  `demo-seed`, `demo-reset`, `scan-ingest`, `inventory`, `ops-report` updated. `stage-machine.test.ts`
  deleted.
- **E2E (written, not run; Codex runs them):** `capture.spec.ts` as a constructor with access at
  390 × 844 (start, capture, finish; one without access sees the sentence; the QI and the FM get no
  Capture); `rolls.spec.ts` replaces `batches.spec.ts` (Reports → Rolls, a roll page, Finish by the
  FM, a claim sheet); axe at phone width on Capture. `cv-helpers.ts`, `cv.spec.ts`,
  `supplier-quality.spec.ts`, `inventory.spec.ts`, `smoke.spec.ts`, `admin.spec.ts` follow the rename.

## 11. Docs (wrap-up, no commit)

CLAUDE.md "No touch or phone design" → "Desktop first; phone layouts only for Capture and Batches
(D-096)"; `DESIGN.md` "Phone layout"; `docs/STATION_SETUP.md` (a constructor's own phone on a stand
at a fixed position, the tunnel address, the constructor starts and finishes the roll); `docs/API.md`;
README demo script; STATUS, SESSION_LOG, DECISIONS (D-095, D-096), ROADMAP; the master spec's roles
table for Capture. Vault: Daily note and `Notes/Phases/Phase 26 - Phone capture.md`.

## 12. Checks, in checkpoints

1. After Step A (rename): `npm run typecheck`, `npm run test`.
2. After Step B (schema + migration): `db:migrate` on a scratch database with old-shaped rows to
   prove the conversion, `db:generate`, typecheck, unit tests.
3. After the screens: `npm run check` (lint, typecheck, unit tests, build). No e2e or browser runs
   (Codex). `cv/` doesn't change, so no Python checks.
4. Removal sweep: no `stage`, `currentStage`, `batch:`, `/batches`, `activeBatch`, `BATCH_MOVED`,
   `shoeType` on rolls left in `src`, `tests`, `scripts` (outside migrations and history docs).

## 13. Where the brief and the code differ

- **"Batch" still appears in Phase 23's Production code** (check-ins, slots) only as plain words;
  Phase 27 makes "Batch" the interval. This phase renames every leather-roll use so Phase 27 starts
  clean.
- **The brief keeps the roll's `createdById` as the starter.** The demo's old rolls were started by
  the FM; after the migration they have no constructor owner, so only the FM can finish them. Fine
  for a fresh `demo:reset`.
- **Section pages for the QI and Admin**: `scan:read` still lets them open `/scans` (Phase 28 removes
  it), but roll pages are FM only, so the roll link is hidden for them.
- **Inventory "For batch" on Use stock**: the brief only says D-023's roll option goes (A-22). I also
  drop the "For batch" picker on Use stock, since it lists rolls by the old meaning; the movement
  column stays for history. Phase 29 removes Use stock anyway.

## 14. Questions — Dylan's answers (24 Oct)

1. **Open rolls:** several may be open; Capture has a Roll dropdown to choose where each shot goes.
   Decided: it lists every open roll, starting on the one this person last used.
2. **Finishing:** only once the roll is fully scanned, at Capture; the FM doesn't finish rolls.
   The FM may cancel any open roll, with a reason.
3. **Supplier and stages:** rolls have no stages besides scanning. Supplier stays required at Start
   roll (a return to the supplier needs it) unless Dylan says otherwise.
4. **The constructor's home becomes Capture:** yes.
5. **Cancel:** the approach in section 4 (empty roll at Capture by anyone with access; any open roll
   by the FM with a reason; nothing deleted, shots kept, left out of reports).
