# Phase 42 plan: Roll tags, a managed list that starts every roll code (planning thread, 2026-11-26)

Request (Dylan, 2026-11-26): (1) in Inventory → a leather item → **Add rolls**, the **Supplier's tag** box becomes a
dropdown of tag codes; the supplier's own tag is selected by default (Bulacan supplier A → `BLC`), then the user types the
digits, so the code reads `[item code][tag]-[digits]` = `LR-BLC-001`. (2) On the Inventory page the Floor Manager can
create, edit or remove tags.

One session, Sonnet (high), after Dylan's go. No code, git or vault was touched by this planning thread. **Vault steps
are for the laptop** (Dylan is on the PC; the vault is laptop-only): the coding thread skips them and lists them in its
report. Numbers assume Phases 40 and 41 are merged (repo at `bd8dc71`, #69); D-139 and A-119 onward are the next free
numbers (check `docs/DECISIONS.md` and STATUS before using them).

## What exists today (checked in the code)

| Thing              | Where                                                            | What it is                                                                                                                                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Roll code**      | `Roll.code`, unique                                              | `LR-<supplier code>-NNN`, made by the system on save: `formatRollCode(supplier.code, n)` with `n` from `roll_code_sequences` (`nextRollCodeNumber`) in `addRolls` (`roll.service.ts` ~l.505). On the QR label, in Find roll, claim sheets, reports. Nobody types it. |
| **Supplier code**  | `Supplier.code`, unique, 2 to 6 caps/digits                      | Made from the name's initials (Bulacan Supplier A → `BSA`; the Add rolls dialog in Dylan's screenshot says "Codes run LR-BSA-…"), editable by the Admin in Settings → Suppliers. Only job: the middle of the roll code.                                              |
| **Supplier's tag** | `Roll.tagCode` (column `rollCode`), free text up to 40, optional | The number printed on the supplier's own paper tag. Typed per roll in Add rolls, shown as "Tag 123", searched by Find roll, printed on labels and claim sheets, correctable by the FM (Phase 35B). Has **no** effect on the roll code.                               |

So today `BLC` cannot appear: the code's middle part is the supplier's initials (`BSA`), and the "Supplier's tag" box is a
free-text note that never reaches the code. Dylan's request makes the tag part of the code and gives it a managed list.

## The one decision that shapes this plan (for Dylan)

**Q1. Does the tag replace the supplier code in the roll code, or sit beside it? DECIDED (Dylan, 2026-11-26): option 1.**

1. **The tag starts the roll code** (recommended): `LR-<tag code>-<digits>`. The tag list is the only source of the code's
   middle part. Matches your example exactly (`LR-BLC-001`), one code to read off a label, and the free-text "Supplier's
   tag" box goes away from Add rolls (its job is now done by the dropdown plus digits).
2. **The tag is a second, structured value** (`BLC-001` stored in Supplier's tag) next to the system's `LR-BSA-001`. Two
   codes of the same shape on one roll, and the label still says `BSA`. Not recommended; it does not produce `LR-BLC-001`.

The rest of this plan is option 1. Two smaller questions, each with the recommended answer already built in:

- **Q2. Digits: must they be typed?** (Dylan did not change the recommendation; the coding thread builds it as written.) Recommended: typed by the FM (the number on the stamp or the roll's own sequence), **but
  left blank they take the next free number** (the hint under the box shows it, "Next free: 004"). That keeps today's
  one-tap delivery of ten rolls working, and the API and e2e callers that send no digits keep working too.
- **Q3. What happens to the old free-text tag numbers?** Recommended: removed from Add rolls only. Old rolls keep their
  "Tag number" (shown, searchable, printed, correctable in Edit roll details as now); no data is touched.

## Design (option 1)

### Data (one migration, `roll_tags`)

```
model RollTag {
  id          String   @id @default(uuid(7)) @db.Uuid
  /// The middle of a roll code, LR-<code>-001: 2 to 6 capital letters or digits, starting with a letter
  /// (the same SUPPLIER_CODE_PATTERN as a supplier's short code).
  code        String   @unique
  /// The supplier this tag belongs to; null = a tag for any supplier.
  supplierId  String?  @db.Uuid
  /// The supplier's default in the Add rolls dropdown; at most one per supplier.
  isDefault   Boolean  @default(false)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  rolls       Roll[]
  @@map("roll_tags")
}
Roll.tagId  String? @db.Uuid   // the tag its code was made from; null for rolls from before this phase
```

- Migration also: one tag per existing supplier (`code = supplier.code`, `supplierId`, `isDefault = true`) so **today's
  codes and today's dropdown default stay exactly as they are**; backfill `Roll.tagId` for rolls whose `code` starts with
  `LR-<that code>-`; a partial unique index (`supplierId` where `isDefault`) so a supplier has one default.
- `Supplier.code` stays (labels, bootstrap, demo seed, the Admin's field). It now only **seeds the supplier's first tag**:
  creating a supplier (`settings.service.ts` ~l.179, `ensureSupplierWithCode`) also creates that tag as default in the same
  transaction. Editing a supplier's code later does not rename its tag; Settings says so under the field. Nothing reads
  `Supplier.code` for a new roll code any more.
- `roll_code_sequences` stays, unused by new rolls (dropped in a later clean-up, not here). "Next free" is the highest
  number found in `Roll.code` for the prefix, plus 1, read inside the save transaction.

### Roll code and digits (`src/lib/roll-rules.ts`, pure, unit-tested)

- `formatRollCode(tagCode, n)` as today; digits `^\d{1,6}$`, at least 1, shown zero-padded to 3 (`1` → `001`, `1234` →
  `1234`). `parseRollNumber(raw, rollNumber)` with messages that name the roll and the fix ("Roll 2: type the digits after
  BLC, like 001.").
- A code that exists already (`rollCodeTaken`) or repeats inside the same save is refused **before anything is saved**,
  on that row's digits: "LR-BLC-001 is already a roll. Next free: 004." Nothing partial (the whole add stays one transaction).

### Add rolls dialog (`add-rolls-dialog.tsx`)

- Each roll row: **Area** | **Tag** (`<Select>`, required) | **Digits** (`<Input inputMode="numeric">`, optional) and, under
  the row, the code it will get: `LR-BLC-001` (live, `font-mono`; "…" while digits are blank and then "next free").
- The dropdown lists the active tags in two groups: the item's supplier's tags first (its default preselected), then
  "Other tags". A new row starts on the previous row's tag (a delivery is mostly one tag). If the supplier has no default
  tag, the box starts on "Choose a tag" and saving needs one.
- The intro line becomes "Codes run LR-BLC-… and are given when you save" from the first row's tag. The button is disabled
  only with no active tag at all ("Add a tag first, under Roll tags"), no longer on `supplierCode`.
- `addRollsSchema` / `addRollsAction`: roll = `{ areaSqFt, tagId?, number? }`. **No `tagId` = the item's supplier's default
  tag; no `number` = next free**, so `cv-helpers.ts`, the e2e specs and the demo seed that send neither keep working.
  The old `tagCode` field is removed from this payload (Q3).

### Roll tags page (`/inventory/tags`, modeled on Storage locations)

- Inventory header gets a **Roll tags** button next to Storage locations (icon `Tag`, `variant="secondary"`, shown with
  `inventory:manage`, the Floor Manager). `/inventory/tags` calls `requirePermission("inventory:manage")`; sidebar marks
  Inventory (same `alsoActive` / prefix rule `/inventory/locations` uses).
- A table: Tag (mono), Supplier, Default, Rolls using it, Status; actions **Edit**, **Deactivate / Reactivate**, **Remove**.
  An **Add tag** dialog: code (typed, upper-cased as you type, 2 to 6), supplier (optional dropdown of active suppliers),
  "Default for this supplier" checkbox. Inline errors name the field and the fix, as the location dialogs do.
- Rules (all ASSUMPTIONS, below): the code is editable **only while no roll was made from it** (it is on printed labels, as
  a location's code, A-79); supplier and default are always editable; **Remove** only a tag no roll ever used, otherwise
  Deactivate (its rolls keep their codes; it leaves the dropdown); the last default of a supplier can be removed, and then
  that supplier's items must choose a tag per roll.
- Every mutation in `runInTransaction` with `recordAudit` on the same `tx` (`roll_tag.create | update | deactivate |
reactivate | delete`; audit holds the code and supplier name, no people).

### Layers (MVC layering unchanged)

`prisma/schema.prisma` + migration → `server/models/roll-tag.model.ts` (the only Prisma import) →
`server/services/roll-tag.service.ts` (rules above) → `server/validators/roll-tag.validator.ts` →
`server/controllers/roll-tag.controller.ts` → `app/api/v1/roll-tags/route.ts` and `[id]/route.ts` (one-liners:
`GET`, `POST`, `PATCH`, `DELETE`; `requireApiPermission`: `inventory:read` for GET, `inventory:manage` for the rest) and
`app/(app)/inventory/tags/{page,actions,tags-manager}.tsx`. `roll.service.addRolls` resolves each row's tag, builds the code
and sets `Roll.tagId`. The item page (`inventory/[id]/page.tsx`) loads the tags for the dialog.

### Other places that change

- `settings.service.ts` / `bootstrap.service.ts` / `demo-seed.service.ts`: suppliers get their default tag; the demo seed
  adds one extra tag (for example `BLC` for a demo supplier) so the dropdown shows a choice. Demo rolls stop sending
  `tagCode` (Q3) or keep it only where the demo shows an old roll's tag number; `demo:reset` keeps tags (reference data).
- Roll page and reports keep showing `Tag number` for rolls that have one; nothing is renamed there.
- No new role, no new permission, no phone layout (Inventory stays desktop, D-034).

## Tests the coding thread adds or changes (it runs `npm run check` only; Codex runs e2e)

- Unit: `roll-rules` (digits parse and pad, code format, next free), `roll-tag` service (create, code lock after use,
  remove vs deactivate, one default per supplier, audit rows), `roll.service` addRolls (tag choice, default tag, blank
  digits, taken code, duplicate in one save, nothing saved on error), validators, `demo-seed`, `label.service`,
  `validator-messages`. Search `tagCode`, `formatRollCode`, `nextRollCodeNumber`, `supplierCode` for every affected test.
- e2e (written, **not run** by Claude): `inventory.spec.ts` (Add rolls with the dropdown and digits; Roll tags page: add,
  edit, deactivate, remove), `rolls.spec.ts`, `auth.spec.ts` only if the nav changes (it should not).
- Handoff `qa/handoffs/2026-11-26-roll-tags.md` and `qa/CODEX_PROMPT_PHASE_42.md`. Scenarios: default tag preselected;
  switch tag per row; blank digits = next free; typed digits; taken code refused with nothing saved; add, edit, deactivate
  and remove a tag; tag in use cannot be removed or recoded; FM only (QI, Admin, constructor get 403).

## Docs the same session updates (D-134)

README (features, demo script), `docs/USER_MANUAL.md` (4.x Inventory, the Add rolls steps near l.496, a new "Roll tags"
subsection, screenshots to retake on the laptop and the PDF rebuild), `docs/API.md` (`/roll-tags` routes and the new rolls
payload, l.122), master spec (rules, data model, `<context>`), DECISIONS (D-139), STATUS, SESSION_LOG, ROADMAP (Phase 42).
`docs/DEMO_SCRIPT.md` is Dylan's file: tell him which step to add (Add rolls with a tag). Vault notes: laptop later.

## ASSUMPTIONS to log in STATUS under Open questions (CPoint has confirmed none)

- A-119: the tag list is the only source of a roll code's middle part; the supplier's short code only seeds its first tag.
- A-120: digits are optional; blank = next free number for that tag; padded to 3, at most 6 digits.
- A-121: a code is globally unique (it already is); a typed number that exists is refused, never overwritten.
- A-122: a tag's code can't change once a roll was made from it (labels); remove only if never used, else deactivate.
- A-123: a tag may belong to one supplier or to none; the supplier's default tag is preselected, all active tags can be picked.
- A-124: old rolls keep their codes and their free-text Tag number; no relabelling. The Phase 35B correction of Tag number stays.
- **To ask CPoint:** their real tag codes per supplier (BLC is Dylan's example) and whether the digits are the number on their
  own stamp or a running number.

## Risks

- Biggest blast radius is tests and seed code that add rolls: the optional `tagId` and `number` keep them working, so the
  change there should be small. If Dylan answers Q1 with option 2 or Q2 with "digits always required", this plan changes
  (option 2: no change to `Roll.code`, `tagCode` becomes `<tag>-<digits>`; digits required: the callers above all need digits).
- The migration backfill (`Roll.tagId` from the code prefix) must be checked on a copy of real data: a roll whose code
  prefix no longer matches its supplier's code (an edited supplier code) gets no `tagId`, which only means "not locked".
