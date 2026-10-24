# Phase 24 plan — Remove Material Requests and Procurement

> **Status: draft, waiting for Dylan's go (2026-10-23).** Brief:
> `docs/prompts/factory-visit-changes.md` → `<phase_24>` (C-1 and part of C-18). Branch: none.
> The work stays uncommitted in `C:\dev\CPoint-PMS` until Dylan branches from the latest `main`.

## 0. Starting point

- `main` is at `33ea7f3` (#18, the factory-visit plan), clean and level with `origin/main`.
- Newest QA reports: `qa/reports/2026-10-22-phase-23-qa-run2.md` and
  `qa/reports/2026-10-22-demo-seed-refresh.md`, both **PASS**. Nothing to fix first.
- Last migration: `20261021133748_production_progression`. Last decision: D-090, so this phase
  writes **D-091**.
- The visit notes and the brief agree here (C-1: remove Material Requests and Procurement after
  checking that what depends on them can go too).

## 1. What I reuse

| Need                                       | Reused from                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| How a module is removed                    | Phase 20's component tracking (D-071): a hand-written drop migration (`20261020100000_drop_component_types`), then the code, then a sweep |
| Stock without requests                     | `StockBadge`, `LowStockCard`, `StockRiskCard` and the ledger (`recordMovement`, D-023), unchanged                                         |
| The demo constructor's camera access       | `setCameraOperator` (`camera.service.ts`, D-075)                                                                                          |
| The constructor home without camera access | The empty-state pattern used on Inventory and Users (dashed box, heading, one sentence)                                                   |

## 2. Every caller, and what replaces it

| Caller                                                                                 | Uses today                                                                                                                                                        | After Phase 24                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FM home (`floor-manager/page.tsx`)                                                     | `pendingRequestsCard()`, `PendingRequestsCard`                                                                                                                    | Removed. The other seven cards stay                                                                                                                                                                                                                                                      |
| Constructor home (`constructor/page.tsx`)                                              | `myOpenRequests`, `requestLabelsFor`, `summarizeItems`, the request badges, `canRequestLeatherRollsFor`, "New material request"                                   | The Capture card when `canCaptureFor` (as today). Otherwise an empty state: "Your work in the system is at the camera. Ask the System Admin for camera access." (the brief's sentence)                                                                                                   |
| Inventory list (`inventory/page.tsx`)                                                  | `openRequestCodes`, the "Requested" badge, the "Request" link (`procurement:request`)                                                                             | Removed. The Stock column shows the stock badge only                                                                                                                                                                                                                                     |
| Users (`admin/users/page.tsx`, `user-dialogs.tsx`)                                     | The "Leather rolls" badge, Allow / Stop leather roll requests (`setRequesterAction`)                                                                              | Removed. The Camera badge and switch stay (Phase 26 changes them)                                                                                                                                                                                                                        |
| Sidebar (`navigation.ts`, `sidebar.tsx`)                                               | The Procurement item, the `requestLabelsFor` label map, the cart icon                                                                                             | Removed                                                                                                                                                                                                                                                                                  |
| Session (`auth.service.ts`)                                                            | `canRequestLeatherRolls` on `SessionUser`                                                                                                                         | Removed                                                                                                                                                                                                                                                                                  |
| Account edits (`user-admin.service.ts`, `user.model.ts`)                               | A role change ends the leather-roll flag; the flag in `adminSelect`, `CreateUserData`, `updateUser`                                                               | Removed. An edit saves name, email and role                                                                                                                                                                                                                                              |
| Operations data (`ops-report.service.ts`, `ops-report.model.ts`)                       | `procurementFlow`, `urgencyCutoffs`, `requested` on each stock row (a subquery on the purchase tables)                                                            | Removed. The report has no `procurement` key                                                                                                                                                                                                                                             |
| Attention items (`ops-rules.ts`)                                                       | `requests-high`, `requests-old`, `requests-late`; low stock says "Raise a purchase request before they run out."                                                  | The three items go. Low stock says "Restock them before they run out."                                                                                                                                                                                                                   |
| Operations page (`operations-view.tsx`, `ops-sections.tsx`, `ops-parts.tsx`)           | The Purchasing card beside Stock at risk; "Requested" in Stock at risk; "…the line, stock, purchasing and supply…"                                                | The card and the badge go; Stock at risk takes the full width; "…the line, stock and supply…"                                                                                                                                                                                            |
| `stock.csv`                                                                            | The "Open request" column                                                                                                                                         | Removed                                                                                                                                                                                                                                                                                  |
| Bootstrap (`bootstrap.service.ts`)                                                     | Creates the demo constructor with `canRequestLeatherRolls`                                                                                                        | Removed                                                                                                                                                                                                                                                                                  |
| Demo week (`demo-seed.service.ts`)                                                     | `seedRequests()`: nine requests, two deliveries that post stock IN, generated proof files (`receipt-sample.ts`). It also gives the demo constructor camera access | Requests and proof files go. The two deliveries become plain stock IN movements at the same times and quantities (thread 4 and tacks 5 on the second day; black cowhide 2 and tacks 5 on the fourth), so the shelf ends where D-090's demo does. The camera access moves to its own step |
| `demo:reset` (`demo-reset.service.ts`, `demo-reset.model.ts`, `scripts/demo-reset.ts`) | Deletes the purchase tables, counts requests, sets the leather-roll flag                                                                                          | Those go. It still empties `UPLOADS_DIR/pod`, so proof files left from before Phase 24 go at the next reset                                                                                                                                                                              |
| `scripts/demo-seed.ts`                                                                 | Prints the request count                                                                                                                                          | Removed                                                                                                                                                                                                                                                                                  |
| `src/lib/domain.ts`                                                                    | Re-exports `PurchaseRequestStatus`, `PurchaseLineDecision`                                                                                                        | Removed                                                                                                                                                                                                                                                                                  |
| `inventory.model.ts`                                                                   | `listRequestableItems` (the request form's picker)                                                                                                                | Removed                                                                                                                                                                                                                                                                                  |

**Procurement data used anywhere else:** none beyond this table. Stock movements that deliveries
posted stay, with their reason text ("Delivery for MR-…"), so stock and the ledger still agree.
Old `procurement.*` audit rows stay until the next reset; the audit log already shows them without
a link. Suppliers stay (rolls and Supplier quality use them); `/api/v1/suppliers` stays and
`/api/v1/procurement/suppliers` goes.

## 3. Schema and the migration `20261023090000_drop_procurement`

Hand-written, like `drop_component_types`, in Prisma's own order:

1. Drop the 20 foreign keys on the purchase tables.
2. Drop the eight tables: `purchase_request_sequences`, `purchase_requests`,
   `purchase_request_lines`, `purchase_request_events`, `purchase_deliveries`,
   `purchase_delivery_lines`, `purchase_attachments`, `purchase_request_remarks`.
3. Drop the enums `PurchaseRequestStatus` and `PurchaseLineDecision`.
4. `ALTER TABLE "users" DROP COLUMN "canRequestLeatherRolls"`.

`prisma/schema.prisma` loses the eight models, the two enums and the relation fields on `User`
(eight), `Supplier` (`purchaseRequests`), `InventoryItem` (`requestLines`) and
`InventoryMovement` (`deliveryLines`).

**Existing rows (A-10):** on the dev database the demo week's nine requests, with their lines,
events, deliveries, file rows and remarks, are dropped with the tables. Stock doesn't change: the
movements stay. Proof files on disk stay until `demo:reset` empties `pod/`. CI and a new Docker
database run every migration in order, so the old procurement migrations still apply before this
one. After `npm run db:deploy`, `prisma migrate diff` from the database to the schema must come
back empty, which shows the hand-written SQL matches what Prisma would write.

## 4. Access and the sidebar

- Permissions: the five `procurement:*` keys go (32 → 27). `canRequestLeatherRollsFor`,
  `mayActOnRequest`, `mayRemarkOnRequest` and `mayCopyRequest` go.
- The Shoe Constructor keeps no permission in the matrix. Capture still comes from the
  per-person switch (`canCaptureFor`, D-075).

| Role        | Sidebar before                                                                                                                                | After                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| FM          | Overview, Production, Attendance, Batches, Inventory, **Procurement**, Camera, Capture, Scans, Review queue, Repair Station, Salvage, Reports | The same without Procurement    |
| QI          | Overview, Production, Batches, Camera, Capture, Scans, Review queue, Repair Station, Salvage, Reports                                         | Unchanged                       |
| Admin       | Overview, Production, Attendance, Batches, Inventory, **Procurement**, Camera, Scans, Users, Settings, API tokens, Audit log                  | The same without Procurement    |
| Constructor | Home, **Material requests** (and Capture when allowed)                                                                                        | Home (and Capture when allowed) |

`/procurement`, `/procurement/new`, `/procurement/{id}` and every `/api/v1/procurement/**` path
answer 404: their folders are gone, so Next.js serves the not-found page.

## 5. Files

**Delete (44):**

- Pages: `src/app/(app)/procurement/**` (15 files: the list, the form, the request page and its
  dialogs, the requesters panel, the actions).
- API: `src/app/api/v1/procurement/**` (16 routes).
- Server: `procurement.controller.ts`, `procurement.service.ts`, `procurement.model.ts`,
  `procurement.validator.ts`, `src/server/lib/attachment-type.ts`, `src/server/lib/receipt-sample.ts`.
- Lib: `src/lib/procurement-rules.ts`.
- Components: `src/components/features/procurement/` (`pending-requests-card.tsx`,
  `request-badges.tsx`).
- Tests: `tests/unit/procurement-rules.test.ts`, `tests/unit/procurement.service.test.ts`,
  `tests/unit/attachment-type.test.ts`, `tests/e2e/procurement.spec.ts`.
- Only with Dylan's word (question Q1): `docs/screenshots/procurement-list.png` and
  `docs/screenshots/purchase-request.png`.

**Change (26 app files, one new migration):** the 24 files in section 2, plus
`prisma/schema.prisma` and `src/server/policies/permissions.ts`.

## 6. Tests

**Unit (I run them):**

- `permissions.test.ts`: the matrix without procurement; the constructor has no matrix
  permission; each role's sidebar as in section 4; the procurement access block goes.
- `validator-messages.test.ts`: the procurement schemas go. The general D-038 tests (field errors
  keyed by the full path, the "couldn't be saved" sentence) move to the attendance schema, so that
  coverage stays.
- `ops-report.service.test.ts`, `ops-rules.test.ts`: no `procurement` key, no request items, no
  "Open request" column, the new low-stock wording.
- `demo-seed.test.ts`: no request mocks; the demo constructor still gets camera access; the two
  deliveries are stock IN movements.
- `demo-reset.test.ts`, `bootstrap.service.test.ts`, `user-admin.service.test.ts`: the leather-roll
  parts go.
- `auth.service.test.ts`: "read fresh on every request" moves from the leather-roll flag to
  `canCapture`.

**E2E (I update them; Codex runs them):**

- `auth.spec.ts`: the nav lists in section 4.
- `smoke.spec.ts`: no urgent request set-up; the constructor's home renders and passes axe, and
  `/procurement` answers 404.
- `cv-helpers.ts`: `makeConstructor()` without the flag; `urgentPendingRequest` and `daysAhead`
  go. `capture.spec.ts` follows.
- `inventory.spec.ts`: a low item has no Request link; the FM home has no Purchase requests card.
- `reports.spec.ts`: no Purchasing card, no "Open request" in `stock.csv`, and
  `/api/v1/procurement/requests` answers 404.

## 7. Docs (the wrap-up, without committing)

- `docs/API.md`: the Procurement section goes. Its "Validation errors (D-038)" paragraph moves to
  Conventions, because it applies to every endpoint. The operations response loses `procurement`.
- `README.md`: the Procurement feature, the roles table, demo script section 3 (the rest
  renumbered), the FM home step, the "requests close the loop" talking point, the purchase tables
  in the data model.
- `docs/prompts/system-rebuild.md`: the nine Procurement rows of the roles table, the constructor
  home row and "pending purchase requests" in the FM overview.
- `DESIGN.md`: the procurement lines in Intent and the procurement component rows (a live doc,
  and the brief says no live doc stays behind).
- `docs/AGENTIC_WORKFLOW.md`: two examples that name procurement.
- `docs/ROADMAP.md`: Phases 9, 11, 12 and 13 marked "removed in Phase 24 (D-091)" (Phase 9's
  review-access line stays true until Phase 25); Phase 24's criteria ticked.
- `docs/STATUS.md`: progress, test counts, next step. The procurement open questions (D-029 and
  D-044, D-031 and survey Q14, D-037, D-039, D-040, D-041, D-042, D-045) close as "module removed".
- `docs/DECISIONS.md`: D-091, and the status words in the headings of the entries it supersedes
  point to it, as D-019 and D-025 already do.
- `docs/SESSION_LOG.md`; the QA handoff `qa/handoffs/2026-10-23-phase-24-remove-procurement.md`
  and `qa/CODEX_PROMPT_PHASE_24.md`; the vault (Daily note, the Phase 24 summary, `Phases.md`).
- Left for Phase 31: `docs/screenshots/floor-manager-home.png` still shows the Purchase requests
  card until the screenshots are retaken.

## 8. Decision to log

**D-091 · Material requests and procurement are removed** (CPoint, factory visit of
23 Oct 2026, C-1). Supersedes D-029, D-030, D-031, D-035 to D-045 and the MR numbers of D-046 (the
full-width pages stay); D-023's link from deliveries to stock movements; amends D-033 (no
purchasing section and no request attention items). Suppliers, inventory, the ledger and the
low-stock alerts stay; old movements keep their reason text.

## 9. Checks, in checkpoints

1. Migration, schema and `npm run db:generate`.
2. Delete the module and fix every caller until typecheck and the unit tests pass.
3. The test and e2e spec changes.
4. The docs.

The dev database and the Windows `node_modules` are on the laptop, so the commands run there
(question Q2): back up the dev database to `storage/backups/before-phase-24-2026-10-23.dump`,
then `npm run db:deploy`, `npm run db:generate`, the drift check, `npm run check` (lint,
typecheck, unit tests, build) and the brief's removal sweep, whose output goes in the report. No
e2e or browser tests: Codex runs those.

## 10. Where the brief and the code differ

1. The constructor home sentence says "Ask the System Admin". Until Phase 26 the Floor Manager can
   also allow capture (Camera → Camera operators, D-075). I keep the brief's sentence: the Admin
   can grant it today, and C-23 makes it the Admin's alone from Phase 26.
2. The brief names `attachment-type.ts`. `receipt-sample.ts` (the demo's sample proof files) serves
   only the deliveries, so it goes too.
3. The brief expects procurement checks in `inventory.spec.ts` and `reports.spec.ts`. They have
   none today, so I add the negative checks there instead.
4. The demo week's procurement deliveries are its only receipts after the first day. Without a
   replacement the shelf would end lower than the demo week Codex passed (D-090). The smallest fix
   is the same two deliveries as plain stock IN.
5. The seed gives the demo constructor camera access inside the request step. It moves to its own
   step, so D-090's "Noel Manalo may also capture" stays true.

## 11. Questions (recommended option first)

- **Q1.** Delete the two procurement screenshots in `docs/screenshots`? (a) Yes: nothing links to
  them after this phase (recommended; the vault's rules say agents delete under `docs/` only with
  your word). (b) Keep them.
- **Q2.** The migration and `npm run check` need your laptop. (a) After the code changes I start a
  Remote Control session that backs up the dev database first, then migrates and runs the checks
  (recommended). (b) I give you the commands and you run them.

## 12. Git (after the build, for Dylan)

A new branch from the latest `main` (for example `feature/phase-24-remove-procurement`), `git add`
with only this phase's files (the list goes in the final report), one commit, `git push -u origin
<branch>`, then the PR on GitHub (D-032).
