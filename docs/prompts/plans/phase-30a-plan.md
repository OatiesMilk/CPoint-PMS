# Phase 30A plan: leather rolls come from Inventory

Brief: `docs/prompts/factory-visit-changes.md` → Phase 30, reordered by Dylan on 26 Oct 2026:
**30A** rolls come from Inventory (this plan), **30B** the measuring test (`cv/`, saved as
`docs/prompts/plans/phase-30b-plan.md`), **30C** cuts from 3 inches and the 10% Return to supplier.
Status: **approved by Dylan on 2026-10-26** (answers in section 8); built the same day. Decisions: D-103 (the roll's area is entered by the FM,
per roll; changes C-33) and D-104 (rolls come from Inventory; amends D-095 and D-102).

## 0. Dylan's decisions (26 Oct 2026)

1. The FM adds each leather roll to Inventory as its own record, with **its own area** (sq ft, from
   the stamp or the receipt). The area is never added up from the shots.
2. Each supplier has a **short code**; roll codes read `LR-MLT-001` and replace `R-YYYY-NNNN`.
3. The constructor **picks a roll from Inventory** at Capture instead of starting one.
4. A leather item's page lists its rolls: scanned or not, area, defects found (defect % in 30C).
   Never who scanned it (D-008).
5. At **Finish batch** the QI ticks rolls **Fully used** (someone on the line tells them); only
   then does a roll leave stock. One tick per roll, no per-batch tracking.
6. A roll can't be ticked before it's scanned. (A Return to supplier roll can't be ticked unless
   the FM chose Keep: that part comes with the mark in 30C.)

## 1. What I read and reuse

- Newest QA report `qa/reports/2026-10-25-phase-29-run2.md`: PASS, nothing to fix first.
- **Reused as is:** the `Roll` model (table `batches`) keeps every roll, shot and report; the
  ledger (`InventoryMovement` already has `rollId`, D-023) gives the counts; `roll.service.ts`
  (finish, cancel, `resolveCaptureRoll`, the device's oldest open roll); `saveCheckIn` and
  `correctCheckIn` in `production.service.ts`; the Update stock sheet (`stock-update.service.ts`);
  Settings → Suppliers; `materials.service.ts` (leather used beside rolls checked).
- No new table: a roll just starts earlier in its life, in Inventory.

## 2. A roll's life (status worked from one column)

| Status (UI)               | Stored           | How it gets there                                                  | Stock |
| ------------------------- | ---------------- | ------------------------------------------------------------------ | ----- |
| **In stock, not scanned** | `IN_STOCK` (new) | FM: Add rolls on the leather item                                  | +1    |
| **Being scanned**         | `OPEN`           | Constructor picks it at Capture (Scan this roll)                   |       |
| **Scanned**               | `FINISHED`       | Constructor: Finish roll (at least one shot, as now)               |       |
| **Fully used**            | `USED` (new)     | QI (or the FM on a day with no QI, D-088) ticks it at Finish batch | −1    |
| **Removed**               | `CANCELLED`      | FM: Remove roll, with a reason (damaged, lost, added by mistake)   | −1    |

- Cancel at Capture on an empty roll puts it back to **In stock, not scanned** (picked by mistake).
- Each +1 and −1 is an `IN` or `OUT` movement with the roll's `rollId` and a reason ("Roll
  LR-MLT-001 added", "Fully used in Batch 2 (10:00–13:00)"), so the ledger stays the only way stock
  changes (D-023) and Reports → Materials counts a fully used roll as used.

## 3. Data (migration `rolls_from_inventory`)

- `RollStatus` + `IN_STOCK`, `USED`.
- `Roll`: `itemId` (the leather item), `areaSqFt` Decimal(8,2), `addedById`/`addedAt` (the FM),
  `startedById` (who picked it; audit and the "my roll" default only, D-008), `startedAt` becomes
  nullable, `usedAt`, `usedById`, `usedCheckInId` (→ `production_check_ins`), `removedReason`
  reuses `cancelledReason`. All nullable, so old rows stay valid.
- `Supplier.code` (2 to 6 capital letters, unique). The migration fills it from each supplier's
  initials (Marikina Leather Trading → MLT, Meycauayan Tannery → MT, JM Leather Supply → JLS),
  adding a digit if two clash.
- **Old rolls** (`R-` and `B-` codes) keep their code and status and read "Before rolls came from
  Inventory": no item, no area, never in the tick list. An old open roll can still be scanned and
  finished. Leather counts on the dev database aren't touched; `demo:reset` gives every leather
  item roll records that match its count (A-10). Back up first.

## 4. Screens

- **Inventory → a leather item** (FM): a **Rolls** section (15-row pager): Code, Area (sq ft),
  Received, Status, Shots, Rejected (for salvage), Defects found ("cut 2, hole 1"), and a Defect %
  column reading "To be implemented" until then. Filter: status. The code links to the roll
  in Reports → Rolls. **Add rolls**: received date (today), then one row per roll with Area and
  the supplier's tag (optional), "Add another roll", "Save 3 rolls". Every message names the row
  and the fix ("Roll 2: enter the area in square feet, e.g. 24.5"). **Remove roll** on a roll
  that isn't fully used, with a reason.
- **Inventory list and Update stock:** leather rows show the count from their rolls; on the sheet
  they are read-only ("Counted from its rolls. Add or remove rolls on the item."). Other materials
  are unchanged.
- **Capture** (constructor, phone layout): the Roll dropdown lists rolls **being scanned**;
  **Start another roll** becomes **Scan another roll**: a list of rolls in stock, not scanned
  ("LR-MLT-001 · Black cowhide · 24.5 sq ft"), with a Find box. No supplier or tag to type. With
  none in stock: "No rolls are waiting to be scanned. Ask the Floor Manager to add them in
  Inventory."
- **Batches → Finish batch** (QI; FM with no QI): a new optional part, **Rolls fully used**:
  check boxes for scanned rolls not yet used, oldest first. A same-day **Correct** can tick or
  untick them (an untick puts the roll back with an `IN`).
- **Settings → Suppliers** (Admin): the Code field, required, with its own message.
- **Reports → Rolls** (FM): Area and the new statuses; filters follow. The claim sheet shows area.

## 5. API (docs/API.md in the same phase)

- `POST /api/v1/inventory/{id}/rolls` (FM): add rolls. `POST /api/v1/rolls/{id}/remove` (FM).
- `GET /api/v1/rolls/ready` (capture): rolls in stock, not scanned. `POST /api/v1/rolls/{id}/start`
  (capture): picks one. `POST /api/v1/rolls` (start a new roll) answers **405**.
- `POST /api/v1/rolls/{id}/cancel`: at Capture back to In stock; the FM's cancel becomes Remove.
- The check-in and its correction take `usedRollIds`. A roll already used, not scanned, or not a
  roll from Inventory: `409` with the roll's code named.
- Suppliers take `code`. The scan API is unchanged.

## 6. Tests and checks

- Unit: the code (`LR-MLT-001`, the sequence per supplier, past 999), the status moves (allowed
  and refused), the Add rolls validator (row messages), the tick rules (only Scanned, once, untick
  on correct), the sheet refusing a leather row, the counts from movements, supplier codes from
  initials, the demo seed. `npm run check`.
- E2E (written, **not run**; Codex runs them): FM adds 3 rolls → constructor picks one, captures,
  finishes → QI ticks it at Finish batch → the count drops by one; refusals (a second tick, an
  unscanned roll, a leather row on the sheet, `POST /rolls` 405); every role's access.
- QA handoff `qa/handoffs/2026-10-26-phase-30a-rolls-from-inventory.md` and
  `qa/CODEX_PROMPT_PHASE_30A.md`, with a 390 px pass for Capture and Batches.

## 7. Docs

STATUS (open questions resolved), SESSION_LOG, DECISIONS (D-103, D-104), ROADMAP (30A/B/C),
API.md, README demo script, the brief's Phase 30 (reordered), `docs/STATION_SETUP.md` (pick a roll
instead of starting one), the vault's Daily note and phase summary. The two uncommitted Phase 29
STATUS/ROADMAP edits go in this phase's commit.

## 8. Questions (my recommendation first)

**Dylan's answers (2026-10-26):** 1. codes from initials, the Admin edits them; 2. yes, 0.1 to 200
sq ft with two decimals; 3. yes, Correct ticks or unticks; 4. yes, Remove any roll not fully used; 5. the column reads "To be implemented".

1. **Supplier codes:** filled from initials for existing suppliers, the Admin edits them
   (recommended), or the Admin must type each one before the FM can add rolls.
2. **Area limits:** 0.1 to 200 sq ft, two decimals (recommended; a cowhide is usually 15 to 60).
3. **Correct** may tick or untick rolls the same day (recommended), or ticks are final.
4. **Remove roll** (FM, with a reason) for any roll not fully used (recommended), or only rolls
   not yet scanned.
5. **Defect %** shows "Measured from Phase 30C" until then (recommended), or the column is left out
   until 30C.

## 9. Done when

The FM adds rolls with their areas and they show on the item with `LR-` codes; the constructor
picks one at Capture and can't type a new roll; the QI ticks a scanned roll at Finish batch and the
leather count drops by one; an unscanned or already used roll is refused by name; leather rows are
read-only on the sheet; old rolls still show in Reports; `npm run check` passes; the e2e specs,
handoff and Codex prompt are written.
