# Plan: Phase 32 — Roll IDs and storage locations you can find on the floor (revision 4)

**Status:** APPROVED (Dylan's go, 2026-11-17, with the four recommendations below) and BUILT the same day; D-128. Waiting for Codex QA (`qa/CODEX_PROMPT_PHASE_32.md`). One change while building: the item page's Print labels prints the item's rolls not scanned yet (`/inventory/labels?item=<id>`), and Add rolls' toast prints the new ones.
**Written:** 2026-11-17, on the laptop (`C:\dev\CPoint-PMS`, `main` at 7f69dbe, #53; uncommitted:
`docs/STATUS.md`, `docs/DEMO_SCRIPT.md` (left out, Dylan), `docs/prompts/plans/defense-revisions-plan.md`).
**Parent plan:** `docs/prompts/plans/defense-revisions-plan.md` → Phase 32. This file is the detail;
where the two differ, this file says why (see "Changes from the parent plan").
**Panel's line (revision 4):** "Ensure that unique leather roll identifiers and storage locations can
be physically traced so that users can locate specific rolls for use or return, rather than only
tracking quantities in the system."
**Inputs read:** vault (CLAUDE.md, Rules, Home, CPoint commands, Defense revisions (32 to 36),
Daily 2026-11-17, Inbox Defense revisions 2026-11-16), repo CLAUDE.md, STATUS, the parent plan,
DESIGN.md (headings, Phone layout), DECISIONS D-008, D-018, D-019, D-096, D-104, D-110, D-112,
D-113, D-116, `prisma/schema.prisma` (Roll, InventoryItem, InventoryMovement, RollCodeSequence),
`src/server/models/roll.model.ts`, `src/server/services/roll.service.ts`, `src/lib/roll-rules.ts`,
`src/server/policies/{permissions,navigation}.ts`, `docs/API.md` → Rolls, the routes under
`src/app/api/v1/{rolls,inventory}`, the pages under `src/app/(app)/{inventory,reports/rolls,camera/capture}`.
**Newest Codex report:** `qa/reports/2026-11-14-ci-recheck-pr50-run1.md`, PASS, nothing unresolved.

## Goal

A person on the floor can answer "where is roll LR-MLT-004?" and "what is on rack R1, bin 3?" in a
few seconds, from a printed label or a typed code, and the system keeps a history of every place a
roll has been until it leaves storage (scanned at Capture, removed, or picked up by the supplier).

Done means:

1. Storage locations exist as data (code, name, kind, active), with printable QR labels.
2. Every roll in stock can be placed in one location; the Floor Manager can move one or many rolls.
3. Every roll has a printable QR label (its existing `LR-…` code, A-52).
4. **Find roll** looks a roll up by code or tag, or by scanning a roll or location label with the
   phone camera, and shows its status, location and location history.
5. Picking a roll at Capture, putting it back, removing it, and setting aside a roll that is
   Returned to supplier all update its location and write one history row each.
6. The location shows on the leather item's roll list, the roll's page and Capture's roll picker.

## What exists today (checked in the code, 7f69dbe)

- **Roll codes:** `addRolls` (`roll.service.ts`) gives each roll `LR-<supplier code>-NNN` from
  `formatRollCode` / `rollCodePrefix` (`src/lib/roll-rules.ts`), numbered per prefix by
  `nextRollCodeNumber` (an `INSERT … ON CONFLICT` on `roll_code_sequences`), checked with
  `rollCodeTaken`. `Roll.code @unique`. Optional supplier tag `Roll.tagCode` (column `rollCode`).
  Older rolls keep `R-YYYY-NNNN` / `B-YYYY-NNNN`.
- **Life of a roll (D-112, D-113, D-116):** `IN_STOCK` (added in Inventory, +1) → `OPEN` (picked at
  Capture, `startRoll`) → `FINISHED` (`finishRoll`, −1, defect share saved; over the limit
  `markedForReturn = true`, shown as **Returned to supplier**, no Floor Manager decision since
  D-112) or `CANCELLED` (`removeRoll`, −1 if still in stock). `putBackRoll` returns an empty open
  roll to `IN_STOCK`. Status moves go through `moveRoll(id, from, data)` (optimistic, D-019).
- **Gap:** nothing says where a roll is, there is no label, no lookup by scan, no history of moves.
- **Camera:** Capture already opens the phone camera with `getUserMedia` (needs HTTPS or localhost,
  the Cloudflare quick tunnel, D-076). No QR reading anywhere. No `qrcode` / `jsqr` in
  `package.json` yet.
- **Access:** Inventory, rolls and reports are the Floor Manager's (`inventory:*`, `roll:*`);
  Capture is a Shoe Constructor's with `canCapture` (`canCaptureFor`). The System Admin has only the
  administration pages (D-119). Suppliers and defect types are managed in Admin → Settings with
  `reference-manager.tsx`.
- **Migrations:** `prisma/migrations/YYYYMMDDHHMMSS_snake_name/`, latest `20261109090000_demo_clock`.

## Questions for Dylan before code (each with my recommendation)

1. **Who manages the locations list?** Recommended: the **Floor Manager**, under Inventory →
   Storage locations, because the FM is on the floor, adds the rolls and prints the labels, and the
   System Admin has no Inventory access (D-119). Alternative: the System Admin under Settings →
   Storage locations (like suppliers), with the FM only printing labels and moving rolls. The
   coordinator's brief said "Admin storage locations manager"; the parent plan said FM. Your call.
2. **What the QR holds.** Recommended: the **plain code** (`LR-MLT-004` on a roll,
   `LOC:R1-B3` on a location), read inside the app's Find roll and Capture. The parent plan had a
   URL (`/r/LR-MLT-001`), but the quick tunnel's address changes every run (D-076), so a printed
   URL would break the next day. The cost: a phone's own camera app shows the text instead of
   opening the page. (A URL would need a fixed public address, which we don't have.)
3. **Return to supplier pickup.** Recommended: **in scope, small**: a roll that finishes Returned
   to supplier can be set aside in a location (e.g. the return area), and the FM marks it **Picked
   up by supplier** on the roll's page, which clears its location. This is the "for … return" half
   of the panel's line. If you'd rather keep Phase 32 smaller, it can go, and returned rolls simply
   leave storage at Finish roll like passed ones.
4. **Put back at Capture.** Recommended: when active locations exist, **Put back** asks where the
   roll went, prefilled with the location it was taken from (one tap to confirm). Without locations
   it works as today.

## Data model (migration `roll_locations`)

Created with `npm run db:migrate -- --name roll_locations` (folder `2026111…_roll_locations`), then
`npm run db:generate`. UUIDv7 ids, snake_case tables (D-018).

```prisma
/// Where a roll can be kept (Phase 32, D-128): a rack, a bin on a rack, or a floor area.
/// CPoint's real layout is unknown (A-53); the codes are theirs to choose.
enum LocationKind {
  RACK
  BIN
  AREA
}

model StorageLocation {
  id          String       @id @default(uuid(7)) @db.Uuid
  /// Printed on its label and inside its QR ("R1-B3"); upper case, unique.
  code        String       @unique
  /// What people call it ("Rack 1, bin 3"); optional.
  name        String?
  kind        LocationKind
  notes       String?
  /// Only an empty location can be deactivated; inactive ones are left out of every picker.
  isActive    Boolean      @default(true)
  sortOrder   Int          @default(0)
  createdById String       @db.Uuid // audit only (D-008)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  createdBy User      @relation("LocationCreatedBy", fields: [createdById], references: [id])
  rolls     Roll[]
  movesFrom RollMove[] @relation("MoveFrom")
  movesTo   RollMove[] @relation("MoveTo")

  @@index([isActive, sortOrder])
  @@index([createdById])
  @@map("storage_locations")
}

/// Why a roll's location changed (Phase 32).
enum RollMoveReason {
  PLACED                 // first placed (Add rolls, or later on an unplaced roll)
  MOVED                  // the Floor Manager moved it
  TAKEN_FOR_USE          // picked at Capture (location cleared)
  PUT_BACK               // put back at Capture
  REMOVED                // removed with a reason (location cleared)
  SET_ASIDE_FOR_RETURN   // finished as Returned to supplier and set aside (question 3)
  PICKED_UP_BY_SUPPLIER  // the supplier took it (location cleared, question 3)
}

/// One change of a roll's location; the roll's location history (Phase 32).
model RollMove {
  id             String         @id @default(uuid(7)) @db.Uuid
  rollId         String         @db.Uuid
  fromLocationId String?        @db.Uuid
  toLocationId   String?        @db.Uuid
  reason         RollMoveReason
  note           String?
  /// Who did it: kept for the audit only, never shown or totalled per person (D-008).
  byId           String         @db.Uuid
  at             DateTime       @default(now())

  roll         Roll             @relation(fields: [rollId], references: [id])
  fromLocation StorageLocation? @relation("MoveFrom", fields: [fromLocationId], references: [id])
  toLocation   StorageLocation? @relation("MoveTo", fields: [toLocationId], references: [id])
  by           User             @relation("RollMoveBy", fields: [byId], references: [id])

  @@index([rollId, at])
  @@index([fromLocationId])
  @@index([toLocationId])
  @@index([byId])
  @@map("roll_moves")
}
```

On `Roll` (table `batches`): `locationId String? @db.Uuid` (null = Not placed), `locatedAt
DateTime?`, `pickedUpAt DateTime?` (question 3; null until the supplier takes it), relations
`location StorageLocation?` and `moves RollMove[]`, `@@index([locationId])`. On `User`: the three
back-relations.

- Existing rolls: `locationId` null, no history rows. Nothing is guessed or back-filled.
- No change to `RollStatus`, codes or stock movements: location is beside the status, not a new
  status. Stock counts stay exactly as today.

## Rules (pure, `src/lib/location-rules.ts`, unit-tested)

- **Code:** trimmed and upper-cased; 2 to 20 characters, letters, digits and `-`, starting with a
  letter or digit (`/^[A-Z0-9][A-Z0-9-]{1,19}$/`); unique. Message: "Location code: use 2 to 20
  letters, numbers or dashes, like R1-B3." Taken: "R1-B3 is already a location. Choose another
  code."
- **Code change:** allowed only while no roll has ever been placed there (no `RollMove` refers to
  it), because the code is printed on its label (A-79). Name, kind and notes can always change.
- **Deactivate:** only when no roll is in it ("R1-B3 still holds 3 rolls. Move them first.").
  Reactivate any time. Never deleted (history refers to it).
- **Which rolls have a location:** only rolls in storage: `IN_STOCK`, and (question 3) a
  `FINISHED` roll marked for return that hasn't been picked up. `OPEN`, passed `FINISHED`,
  `CANCELLED` and old `USED` / `RETURNED` rolls have none (A-55).
- **Place / move:** the target must be active; a roll already there is refused ("LR-MLT-004 is
  already in R1-B3."); an `OPEN` roll is refused ("LR-MLT-004 is being scanned at Capture. Put it
  back first."). Up to 50 rolls at a time (`ADD_ROLLS_MAX`). Each roll gets one `RollMove`
  (`PLACED` when it had no location, else `MOVED`).
- **Concurrency:** a move updates only if the roll still has the status and location the caller
  saw (`updateMany where { id, status, locationId }`, like `moveRoll`, D-019); otherwise the stale
  message, nothing saved.
- **Pick at Capture (`startRoll`):** in the same transaction, clears the location and writes
  `TAKEN_FOR_USE` (from = where it was). A roll with no location writes nothing.
- **Put back (`putBackRoll`):** `locationId` optional; when given, sets it and writes `PUT_BACK`;
  the picker is prefilled with the `from` of its last `TAKEN_FOR_USE` (question 4).
- **Remove (`removeRoll`):** clears the location and writes `REMOVED` (note = the reason).
- **Finish (`finishRoll`):** a passed roll has no location (it was cleared at pick). A roll marked
  for return can be set aside afterwards (`POST /rolls/{id}/set-aside`) → `SET_ASIDE_FOR_RETURN`;
  **Picked up by supplier** clears it, sets `pickedUpAt`, writes `PICKED_UP_BY_SUPPLIER`
  (question 3).
- **History:** newest first: date and time (Manila), reason in plain words ("Moved", "Taken for
  scanning", "Put back", "Removed", "Set aside for return", "Picked up by supplier"), from → to.
  No names (D-008); the Admin's audit log keeps the actor.
- **Scanned code parsing (`parseScannedCode`):** `LOC:<code>` → a location; anything else trimmed
  and upper-cased → a roll code (`LR-…`, `R-…`, `B-…`). Unknown → "No roll or location has the code
  …. Check the label or type the code."

## Server (MVC layering, CLAUDE.md)

Models (only place importing Prisma):

- **New `src/server/models/location.model.ts`:** `listLocations({ activeOnly })` with roll counts,
  `findLocation(id)`, `findLocationByCode(code)`, `insertLocation`, `updateLocation`,
  `countRollsIn(id)`, `locationEverUsed(id)`, `listRollsIn(id)`.
- **`roll.model.ts`:** add `location { id, code, name }` to `listSelect`, `detailSelect`,
  `openSelect` (ready rolls); `setRollLocation(id, seen: { status, locationId }, data, tx)` →
  boolean; `insertRollMove`, `listRollMoves(rollId)`, `findRollsByCodeOrTag(q)` (exact code first,
  then `contains`, insensitive, 10 max), `lastTakenFrom(rollId)`.

Services:

- **New `src/server/services/location.service.ts`:** `listLocations`, `getLocation` (with rolls),
  `addLocation`, `editLocation`, `setLocationActive`; each mutation in `runInTransaction` +
  `recordAudit` (`location.add`, `location.edit`, `location.deactivate`, `location.reactivate`).
- **`roll.service.ts`:** `moveRolls(rollIds, toLocationId, note, actor)` (`roll.move`, one audit
  row listing the codes, from and to), `setAsideRoll` (`roll.set_aside`), `markPickedUp`
  (`roll.picked_up`), `findRolls(q)` (code/tag search + location match), `rollHistory(id)`;
  `addRolls` takes an optional `locationId` (each roll `PLACED`; the `roll.add` audit gains the
  location); `startRoll`, `putBackRoll`, `removeRoll` write their moves in the same `tx` and put
  the location in their audit `before` / `after`.
- **New `src/server/services/label.service.ts`:** `rollLabels(ids)` and `locationLabels(ids)` →
  label data plus an inline SVG QR from `qrcode` (`QRCode.toString(text, { type: "svg", margin: 1,
errorCorrectionLevel: "M" })`), all on the server, no network.

Validators (`src/server/validators/`): new `location.validator.ts` (add, edit, move,
set-aside, find query); `roll.validator.ts` / `inventory.validator.ts` gain optional `locationId`
(UUID). Every message names the field and the fix, matching `validator-messages.test.ts`.

Controllers and routes (one-liner `route.ts` → controller; every route `requireApiPermission`):

| Route                                       | Permission                                                            | Body / query                                 | Response                                                        |
| ------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| `GET /api/v1/locations`                     | `location:read`                                                       | `active` (`true` default)                    | `{ data: Location[] }` with `rolls` count, by `sortOrder`, code |
| `POST /api/v1/locations`                    | `location:manage`                                                     | `{ code, name?, kind, notes? }`              | `201 { data: Location }`                                        |
| `GET /api/v1/locations/{id}`                | `location:read`                                                       | —                                            | the location with its rolls                                     |
| `PATCH /api/v1/locations/{id}`              | `location:manage`                                                     | `{ code?, name?, kind?, notes?, isActive? }` | `{ data: Location }`; `409` named (in use, not empty)           |
| `POST /api/v1/rolls/move`                   | `roll:move`                                                           | `{ rollIds: [1..50], toLocationId, note? }`  | `{ data: { moved: [{ id, code, from, to }] } }`                 |
| `POST /api/v1/rolls/{id}/set-aside`         | `roll:move`, or a constructor with camera access (right after Finish) | `{ locationId }`                             | `{ data: { id, code, location } }`                              |
| `POST /api/v1/rolls/{id}/picked-up`         | `roll:manage`                                                         | `{}`                                         | `{ data: { id, code, pickedUpAt } }`                            |
| `GET /api/v1/rolls/find`                    | `location:read`                                                       | `q` (code, tag or `LOC:` code, 1 to 60)      | `{ data: { rolls: FoundRoll[], location: Location \| null } }`  |
| `GET /api/v1/rolls/{id}/moves`              | `location:read`                                                       | —                                            | `{ data: RollMove[] }` (no person)                              |
| `POST /api/v1/inventory/{id}/rolls`         | unchanged                                                             | + `locationId?`                              | unchanged                                                       |
| `POST /api/v1/rolls/{id}/cancel` (put back) | unchanged                                                             | + `locationId?`                              | unchanged                                                       |

`ReadyRoll` and `OpenRoll` gain `location: { code, name } | null`.

## Role access

New permissions in `src/server/policies/permissions.ts` (with a test row each):

- `location:read`: `FLOOR_MANAGER`, `SHOE_CONSTRUCTOR` (the constructor also needs `canCapture`;
  the Find page and `find` / `moves` routes check `can(role, "roll:read") || canCaptureFor(user)`).
- `location:manage`: `FLOOR_MANAGER` (or `SYSTEM_ADMIN`, question 1).
- `roll:move`: `FLOOR_MANAGER` (A-56: a constructor only picks and puts back).
- Quality Inspector and System Admin: no Find roll (the QI doesn't track rolls, D-111; the Admin
  has only administration, D-119). Pages call `requireRole` / `requirePermission`.

Navigation (`navigation.ts`, new `NavIcon` `"find"`): **Find roll** (`/find`) for the Floor
Manager (after Inventory) and for the Shoe Constructor (after Capture). A constructor now has two
pages, so the phone top bar shows its Pages menu (DESIGN → Phone layout already covers this).
Storage locations is a tab/link inside Inventory, not a sidebar item (keeps the FM's list at six).

## Screens (DESIGN.md tokens, ui-craft, plain copy)

1. **Inventory → Storage locations** (`/inventory/locations`, desktop): table Code, Name, Kind,
   Rolls in it, Status; **Add location** dialog (Code, Name, Kind, Notes); row actions Edit,
   Deactivate / Reactivate; tick rows → **Print labels**. Empty state: "No storage locations yet.
   Add your racks, bins and areas, then print their labels." Reached from a "Storage locations"
   button on `/inventory` and the leather item page. (Question 1 may move it to Settings.)
2. **Location labels** (`/inventory/locations/labels?ids=…`, print page): A4 grid, each label the
   code in very large text, the QR (`LOC:R1-B3`), the name and kind. `@media print` hides the app
   shell; a **Print** button calls `window.print()`.
3. **Roll labels** (`/inventory/labels?rolls=…`, print page): A4 sticker grid (A-54), each label:
   roll code very large, QR (the code), leather item, supplier, area (sq ft), received date, tag
   number. Reached from **Print labels** on the leather item page (ticked rolls, or "all not
   scanned") and from the Add rolls success message ("3 rolls added. Print their labels.").
4. **Leather item page** (`/inventory/[id]`): the roll list gains a **Location** column ("R1-B3"
   or "Not placed"), row checkboxes, and **Move** (dialog: Location select of active locations,
   optional note) and **Print labels** for the ticked rolls; **Add rolls** gets an optional
   Location select, prefilled with the last one used in this browser (localStorage, try/catch).
   Desktop; the table scrolls inside its card (D-034).
5. **Find roll** (`/find`, phone layout like Capture, A-71): one search field ("Roll code or tag
   number") and a **Scan label** button. Scanning opens the rear camera in a sheet; frames are read
   with the browser's `BarcodeDetector` when it exists, else `jsqr` on a canvas every ~200 ms; the
   first good code closes the camera and runs the lookup. Results:
   - **A roll:** "LR-MLT-004" in `text-xl`, item, supplier, status badge, and the location in large
     text ("R1-B3 · Rack 1, bin 3", or "Not placed", or "Being scanned at Capture", or "Left
     storage: scanned on 12 Nov"); below it the location history. The FM sees **Move** (and
     **Picked up by supplier** for a set-aside returned roll).
   - **A location:** its code and name, and the rolls in it (code, item, area), each opening the
     roll result.
   - **Several matches** (a partial code or tag): a short list to pick from.
   - Errors name the fix: camera blocked → the same wording as Capture (`capture-rules.ts`);
     no match → "No roll or location has the code LR-MLT-040. Check the label or type the code."
6. **Capture** (`start-roll-form.tsx`, `roll-bar.tsx`): each roll option reads "LR-MLT-004 ·
   24.5 sq ft · R1-B3"; a **Scan label** button (same scanner component) chooses the leather and
   the roll from the QR ("LR-MLT-004 isn't waiting to be scanned: it is Scanned." when it can't).
   **Put back** asks "Where did you put it?" (question 4). After **Finish roll** on a roll marked
   Returned to supplier, the result card asks "Set it aside for the supplier: where?" with a
   Location select (optional, skip leaves it unplaced) (question 3).
7. **Roll's page** (`/reports/rolls/[id]`): a **Location** line and a **Location history** card;
   FM actions Move and (question 3) Picked up by supplier. Reports → Rolls' table gains no column
   (Phase 35 reworks the reports).

Shared client component: `src/components/features/rolls/qr-scanner.tsx` (camera, BarcodeDetector /
`jsqr` fallback, stop on unmount, torch-free, 44 px controls). Pure helpers it uses
(`parseScannedCode`) are in `location-rules.ts` so they are unit-tested.

## Dependencies (Dylan's OK, 2026-11-17)

- `qrcode` (+ `@types/qrcode` dev) — server-side SVG QR codes, no native build.
- `jsqr` — QR decoding in the browser where `BarcodeDetector` is missing (iOS Safari, Firefox).
- Exact versions pinned in `package.json` like the rest; `npm audit` noted in STATUS.

## Seed and demo data

- **Bootstrap (`npm run db:seed`):** no locations (CPoint adds theirs, A-53).
- **Demo seed / reset (`demo-seed.service.ts`, `demo-reset`):** placeholder locations `R1-B1` to
  `R1-B3`, `R2-B1` to `R2-B3` (kind BIN, names "Rack 1, bin 1" …) and `RETURN` (AREA, "Return
  area"); every demo roll still in stock placed (`PLACED`) at its added time, round-robin, one
  moved once (`MOVED`); demo rolls scanned during the two weeks get `PLACED` then `TAKEN_FOR_USE`
  at their start; the returned demo rolls `SET_ASIDE_FOR_RETURN` to `RETURN`, the oldest one also
  `PICKED_UP_BY_SUPPLIER`. `demo:reset` deletes `roll_moves` before rolls and recreates the demo
  locations. The demo week's counts (D-126, D-127) stay the same.
- CI `docker` SQL checks for locations are Phase 36's (parent plan); Phase 32 doesn't change
  `.github/workflows/ci.yml`. The existing check "In-stock batches ≥ 1" still holds.

## Unit tests to add or extend (`tests/unit/`, run by `npm run check`)

- `location-rules.test.ts` (new): code normalising and pattern, which statuses may hold a location,
  move refusals (same place, open roll, inactive target, over 50), deactivate only when empty, code
  change only when never used, `PLACED` vs `MOVED`, `parseScannedCode` (`LOC:`, `LR-`, `R-`, `B-`,
  junk, spaces, lower case), history wording.
- `location.service.test.ts` (new): add / edit / deactivate / reactivate with audit in the same
  `tx`, taken code, non-empty deactivate.
- `location.validator.test.ts` (new), and `validator-messages.test.ts` for the new messages.
- `roll.service.test.ts`: move (one move row per roll, stale refused, audit), add rolls with a
  location, start clears it with `TAKEN_FOR_USE`, put back with a location, remove writes `REMOVED`,
  set aside only on a roll marked for return, picked up clears it; find by code / tag / location.
- `label.service.test.ts` (new): label fields, QR text is the code / `LOC:` code, SVG returned.
- `permissions.test.ts`: the three new permissions per role; navigation shows Find roll to the FM
  and a constructor, not the QI or Admin.
- `roll.validator.test.ts` / inventory validator: optional `locationId`.
- `demo-seed.test.ts`: demo locations created, every in-stock demo roll placed, counts unchanged.

Claude runs only `npm run check` (lint, typecheck, unit tests, build). Browser and e2e tests are
Codex's.

## Docs to update (wrap-up, no commit)

- `docs/API.md`: Rolls (location on `ReadyRoll` / `OpenRoll`, move, set-aside, picked-up, find,
  moves, `locationId` on add and put back, the new audit actions) and a new **Storage locations**
  section; remove "Coming next" lines this covers.
- `docs/DECISIONS.md`: **D-128** locations, labels and Find roll (QR content, who manages, the
  history and D-008, return pickup), with the answers to the four questions.
- `docs/STATUS.md`: Phase 32 state, A-52 to A-56 and A-77 to A-80 under Open questions, the next
  step; `docs/ROADMAP.md`: Phase 32 with acceptance criteria; `docs/SESSION_LOG.md`: the entry.
- `DESIGN.md`: Find roll in "Phone layout"; the label print pages (print styles, sizes).
- **Not now:** README, USER_MANUAL, master spec, paper figures (Phase 36). `docs/DEMO_SCRIPT.md` is
  left out (Dylan).
- **Vault:** Daily note (Did / Next / Questions / Agent sessions with brief, plan, handoff, prompt,
  report), the phase summary `Notes/Phases/Defense revisions (32 to 36).md`, and an Inbox
  `#question` for CPoint on the rack layout and label paper.

## QA handoff outline for Codex (`qa/handoffs/2026-11-xx-roll-locations.md`, `qa/CODEX_PROMPT_PHASE_32.md`)

Setup: `npm run db:deploy` (new migration), `npm run demo:reset '--' --yes` in PowerShell, dev
server, the in-app browser; camera scenarios use Playwright's fake camera with a QR image (a
fixture PNG of `LR-…` and `LOC:R1-B3` codes, generated in the handoff from a seeded code).

- **L1 Locations:** FM adds `R9-B1`, edits its name, can't add a duplicate, can't deactivate one
  holding rolls, deactivates an empty one (gone from pickers), reactivates it.
- **L2 Add rolls with a location:** 2 rolls into `R1-B1`; the list shows R1-B1; history `Placed`.
- **L3 Move:** tick 3 rolls → Move to `R2-B2`; list, roll page and Find show it; one history row
  each; moving to the same place refused with the named message.
- **L4 Labels:** roll labels and location labels print to PDF (`page.pdf`), each label's QR decodes
  (jsqr in the test) to the code; text sizes readable.
- **L5 Find roll by typing:** code, partial code, tag number, a location code; no-match message.
- **L6 Find roll by scanning** (fake camera): a roll label → its result; a location label → its
  rolls; on a 390 × 844 viewport, no sideways scroll, 44 px controls.
- **L7 Capture:** picker shows locations; Scan label picks the roll; start writes `Taken for
scanning` and clears the location; Put back asks where, prefilled, and writes `Put back`.
- **L8 Return:** finish a demo roll over the limit → set aside in `RETURN`; FM marks Picked up by
  supplier; location cleared; history complete (if question 3 is in).
- **L9 Remove:** remove a placed roll with a reason → location cleared, `Removed` row.
- **L10 Access:** QI and Admin get 403 / no nav item for `/find`, locations and move APIs; a
  constructor without capture access can't open `/find`; a constructor can't move rolls.
- **L11 Audit:** Admin's audit log shows `location.add`, `roll.move`, `roll.set_aside`,
  `roll.picked_up` with before / after.
- **L12 Regression:** full `npm run test:e2e` (existing `inventory`, `rolls`, `capture`, `returns`
  specs); stock counts on the item page unchanged by moves.

## Assumptions (to log in STATUS → Open questions when approved)

From the parent plan, kept:

- **A-52:** a roll's code stays `LR-<supplier>-NNN`; the label prints that code, not a new one.
- **A-53 (changed wording): ASSUMPTION: CPoint has not confirmed its rack layout, so rack/bin
  naming (e.g. R1-B3) is a placeholder.** Locations are free-form codes CPoint will choose; the
  demo's `R1-B1 … R2-B3` and `RETURN` are placeholders only.
- **A-54:** rolls and locations are labelled on plain A4 sticker paper from an office printer (no
  label printer); the sheet layout (e.g. 3 × 7) is a placeholder until CPoint names their paper.
- **A-55:** once a roll is picked at Capture it leaves storage; a scanned roll that passes is used
  up (D-112), so it never returns to a location; leftover pieces aren't tracked as rolls.
- **A-56:** the Floor Manager places and moves rolls; a constructor only picks (taken) and puts back.

New for Phase 32 (numbered after the parent plan's A-76):

- **A-77:** a roll that finishes Returned to supplier stays in storage until the supplier takes it;
  it may be set aside in a location and the FM marks **Picked up by supplier** (question 3). The
  status stays `FINISHED` with `markedForReturn` (D-116); only its location changes.
- **A-78:** the location history shows no names (D-008, like every "who" in the roll data); the
  System Admin's audit log keeps the actor.
- **A-79:** a location's code can't change once a roll has been placed there, because the code is
  printed on its label; its name can.
- **A-80:** the QR holds the plain code (`LR-…`, `LOC:…`), read in the app, not a URL (question 2).
- **A-71 (parent plan):** Find roll is a phone page like Capture.

## Changes from the parent plan (and why)

- QR content: plain code instead of `/r/<code>` URL; the `src/app/r/[code]` route is dropped
  (the quick tunnel's address changes each run, D-076).
- Find roll at `/find` (not `/rolls/find`), since rolls pages live under Reports and Inventory.
- Location naming `R1-B3` (coordinator brief) instead of `RACK-A-2`; still a placeholder (A-53).
- Return flow: there is no "marking Returned" action since D-112; the system marks the roll
  Returned to supplier at Finish roll (D-116), so set-aside happens after Finish and the closing
  step is **Picked up by supplier** (`PICKED_UP_BY_SUPPLIER`, new reason; `REMOVED` added too).
- The history table is `RollMove` (`roll_moves`) rather than `RollLocationEvent`; same columns.
- Who manages locations is put to Dylan (question 1) rather than settled.

## Files expected to change

`prisma/schema.prisma`, `prisma/migrations/2026111…_roll_locations/`, `package.json` /
`package-lock.json` (`qrcode`, `@types/qrcode`, `jsqr`), `src/lib/location-rules.ts` (new),
`src/server/models/{location.model.ts (new),roll.model.ts}`,
`src/server/services/{location.service.ts (new),label.service.ts (new),roll.service.ts,demo-seed.service.ts,demo-reset.service.ts}`,
`src/server/models/demo-reset.model.ts`, `src/server/validators/{location.validator.ts (new),roll.validator.ts,inventory.validator.ts}`,
`src/server/controllers/{location.controller.ts (new),roll.controller.ts,inventory.controller.ts}`,
`src/app/api/v1/locations/{route.ts,[id]/route.ts}`, `src/app/api/v1/rolls/{move,find}/route.ts`,
`src/app/api/v1/rolls/[id]/{set-aside,picked-up,moves}/route.ts`,
`src/app/(app)/inventory/{page.tsx,locations/**,labels/page.tsx,[id]/page.tsx,[id]/add-rolls-dialog.tsx,[id]/move-rolls-dialog.tsx (new)}`,
`src/app/(app)/find/{page.tsx,find-client.tsx}` (new),
`src/app/(app)/camera/capture/{start-roll-form.tsx,roll-bar.tsx,capture-client.tsx}`,
`src/app/(app)/reports/rolls/[id]/page.tsx`, `src/components/features/rolls/{qr-scanner.tsx,location-history.tsx}` (new),
`src/components/layout` nav icon map, `src/server/policies/{permissions,navigation}.ts`,
`tests/unit/*` (above), `docs/API.md`, `DESIGN.md`, wrap-up docs.

## Order of work (one session, after Dylan's go)

1. Schema + migration + generate; `location-rules.ts` with its tests.
2. Models, services, validators, controllers, routes; permissions and nav; service tests.
3. Inventory: locations page, labels pages, item page Move / Location / Print, Add rolls location.
4. Find roll page and the QR scanner; Capture picker, Scan label, Put back, set aside.
5. Roll's page location and history; demo seed / reset.
6. `npm run check`; docs; handoff and Codex prompt; vault.
