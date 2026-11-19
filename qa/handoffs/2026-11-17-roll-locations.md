# QA handoff: roll locations, QR labels and Find roll (Phase 32)

| Field           | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| Date            | 2026-11-17                                                                              |
| Feature         | roll-locations (defense revision 4)                                                     |
| Branch          | `main` at 7f69dbe on the laptop, plus this work **uncommitted**                         |
| Spec / prompt   | `docs/prompts/plans/phase-32-roll-locations-plan.md`, `docs/ROADMAP.md` Phase 32, D-128 |
| Written by      | Claude                                                                                  |
| Previous report | `qa/reports/2026-11-14-ci-recheck-pr50-run1.md` (PASS, other work)                      |

## 1. What changed

- **Floor Manager:** Inventory has a **Storage locations** button. That page lists the racks, bins
  and areas (Code, Name, Kind, Rolls in it, Status): **Add location**, **Edit**, **Deactivate**
  (only when empty, with Undo) and **Reactivate**; tick some and **Print labels**. A code that has
  held rolls is read-only on Edit, with the reason.
- **Labels:** an A4 sheet of 3 × 7 stickers. A roll's label: its code, a QR holding the code,
  leather, supplier, area and arrival date, tag. A location's label: its code, a QR holding
  `LOC:<code>`, name, kind. Print at actual size.
- **A leather item's page:** a **Location** column, **Print labels** (rolls not scanned yet),
  **Move rolls** (tick rolls in the dialog) and a **Move** button on each roll in storage; **Add
  rolls** has an optional **Kept in** select (remembered in this browser) and its toast offers
  **Print their labels**.
- **Find roll** (`/find`, sidebar for the Floor Manager; phone Pages menu for a constructor with
  camera access): type a code, part of one or a tag number, or **Scan label** with the camera. One
  roll shows its code, leather, status, **Where it is** in large text and its **Location history**
  (no names). A location label lists the rolls kept there. The FM can **Move** / **Place it** and
  mark **Picked up by supplier** there.
- **Capture (constructor):** each roll in the picker ends with its place (`· R1-B3`); **Scan the
  roll's label** picks the leather and the roll; picking takes it out of its place; **Put roll
  back** asks "Where did you put it?" prefilled with where it was; when **Finish roll** marks a roll
  Returned to supplier, a dialog asks where it was set aside (Skip allowed).
- **A roll's page** (Reports → Rolls → a roll): **Kept in** in the details, a **Location history**
  card, and **Move** / **Place it** / **Set aside** and **Picked up by supplier** (confirm dialog).
- **System Admin:** the audit log shows `location.add`, `location.edit`, `location.deactivate`,
  `location.reactivate`, `roll.move`, `roll.set_aside`, `roll.picked_up`, and the location on
  `roll.add`, `roll.start`, `roll.put_back`, `roll.remove`.
- Demo data: six placeholder bins `R1-B1` … `R2-B3` and `RETURN` (Return area); every delivery in a
  bin; two shelf rolls moved once with the note "The first bin was full."; returned rolls set aside
  in `RETURN`; the oldest of them picked up a day later.

## 2. Files touched

| File                                                                                                                                       | Change                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261117090000_roll_locations/`                                                                 | `storage_locations`, `roll_moves`, enums, `locationId` / `locatedAt` / `pickedUpAt` on rolls |
| `package.json`, `package-lock.json`                                                                                                        | `qrcode` 1.5.4, `jsqr` 1.4.0, `@types/qrcode` 1.5.6                                          |
| `src/lib/location-rules.ts` (new), `src/lib/domain.ts`                                                                                     | rules, messages, QR parsing, "where" wording                                                 |
| `src/server/models/location.model.ts` (new), `roll.model.ts`, `demo-reset.model.ts`                                                        | queries                                                                                      |
| `src/server/services/location.service.ts`, `label.service.ts` (new), `roll.service.ts`, `demo-seed.service.ts`                             | logic, audit, demo data                                                                      |
| `src/server/validators/location.validator.ts` (new), `roll.validator.ts`                                                                   | input checks                                                                                 |
| `src/server/controllers/location.controller.ts` (new), `roll.controller.ts`                                                                | API                                                                                          |
| `src/app/api/v1/locations/**`, `rolls/move`, `rolls/find`, `rolls/[id]/{set-aside,picked-up,moves}`                                        | 7 routes                                                                                     |
| `src/server/policies/{permissions,navigation,guard}.ts`, `src/components/features/app-shell/sidebar.tsx`                                   | `location:read`, `location:manage`, `roll:move`; Find roll                                   |
| `src/app/(app)/inventory/{page.tsx,locations/**,labels/page.tsx,[id]/page.tsx,[id]/add-rolls-dialog.tsx,actions.ts}`                       | screens                                                                                      |
| `src/app/(app)/find/**` (new)                                                                                                              | Find roll                                                                                    |
| `src/app/(app)/camera/capture/{start-roll-form,roll-bar}.tsx`                                                                              | Capture                                                                                      |
| `src/app/(app)/reports/rolls/[id]/page.tsx`                                                                                                | the roll's page                                                                              |
| `src/components/features/{labels/*,rolls/qr-scanner,move-rolls-dialog,location-history,picked-up-button}.tsx` (new), `src/app/globals.css` | shared UI, label sheet CSS                                                                   |
| `scripts/demo-reset.ts`                                                                                                                    | the dry run names locations                                                                  |
| `tests/unit/*`                                                                                                                             | 4 new files, 5 updated                                                                       |
| `tests/e2e/auth.spec.ts`, `tests/e2e/capture.spec.ts`                                                                                      | expectations for Find roll in the nav and the capturer's Pages menu                          |

Database migration in this change: **yes** (name: `20261117090000_roll_locations`)

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done (new packages), `.env`
filled in (`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`,
`DEMO_LOGIN_TOOLS=true`).

```bash
npm install            # qrcode and jsqr
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # applies 20261117090000_roll_locations
npm run demo:reset '--' --yes   # PowerShell form; a fresh demo with locations (back up first if the DB matters)
npm run dev            # app on http://localhost:3000
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change:

- Make a QR fixture for the camera scenarios (L6, L7) under `qa/reports/artifacts/<run>/`: a PNG
  of a roll label and one of a location label, e.g. from the label page (screenshot one label) or
  with `node -e "require('qrcode').toFile('roll.png','LR-…')"`. Feed it to Playwright's Chromium
  as a fake camera (`--use-fake-device-for-media-stream --use-file-for-fake-video-capture=<file>.y4m`;
  convert the PNG to a still `.y4m` with ffmpeg if available). If no fake camera can be made, test
  Find roll by typing and report L6/L7 scanning as BLOCKED with the reason.

Existing automated tests that cover this area (run these too):

```bash
$env:E2E_BASE_URL="http://localhost:3000"; npx playwright test tests/e2e/inventory.spec.ts tests/e2e/rolls.spec.ts tests/e2e/capture.spec.ts tests/e2e/returns.spec.ts tests/e2e/auth.spec.ts
```

then the full suite (`npm run test:e2e` with the same `E2E_BASE_URL`).

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env` (or the login page's demo
sign-in buttons).

| Role              | Email                      | Home page         |
| ----------------- | -------------------------- | ----------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`  |
| Quality Inspector | `inspector@cpoint.local`   | `/batches`        |
| System Admin      | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture` |

Data this test needs:

- The demo week after `demo:reset` (locations `R1-B1` … `R2-B3`, `RETURN`; rolls in stock in bins;
  at least one roll Returned to supplier in `RETURN`; one picked up).
- `constructor@cpoint.local` has camera access in the demo week. For L10, a constructor without it
  (Admin → Users → another demo constructor, or one the e2e helpers create).

## 5. Test scenarios

| ID  | Role                   | Steps                                                                                                                                                                                                                                 | Expected result                                                                                                                                                                                                                                                                                                                                                                           | Priority |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| L1  | FM                     | Inventory → **Storage locations**. Add `r9-b1`, name "Test bin", kind Bin. Add `R9-B1` again. Add `R9 B1`. Edit R9-B1's name. Deactivate R9-B1, press Undo in the toast, Deactivate again, then Reactivate. Try Deactivate on `R1-B1` | Saved as `R9-B1`; the duplicate shows "R9-B1 is already a location. Choose another code." under Code; `R9 B1` shows "Location code: use 2 to 20 letters, numbers or dashes, like R1-B3."; Undo reactivates; R1-B1's Deactivate is disabled ("Move its rolls first.")                                                                                                                      | High     |
| L2  | FM                     | Open a leather item → **Add rolls**: 2 rolls, Kept in `R9-B1`, Save. Open the toast's **Print their labels**                                                                                                                          | Toast names the codes "…, in R9-B1."; the Location column shows `R9-B1`; the label page shows exactly those 2 labels; each roll's page history shows "Placed · To R9-B1 · Test bin". Add rolls again: Kept in is prefilled with R9-B1                                                                                                                                                     | High     |
| L3  | FM                     | Same item → **Move rolls**: tick 3 rolls, Move to `R2-B2`, note "Rack full". Then a row's **Move** → try `R2-B2` again                                                                                                                | Toast "3 rolls moved to R2-B2."; Location column `R2-B2`; each roll's history "Moved · R… → R2-B2 · Rack 2, bin 2" with the note; the current place is disabled "(now)" in the single-roll dialog                                                                                                                                                                                         | High     |
| L4  | FM                     | Storage locations → tick R1-B1 and RETURN → **Print 2 labels**; an item's **Print labels**. Save each page as PDF (`page.pdf`, A4)                                                                                                    | 3 × 7 grid at A4; app sidebar/header not printed; each QR decodes (jsQR) to `LOC:R1-B1`, `LOC:RETURN`, and the rolls' codes; the code is the largest text                                                                                                                                                                                                                                 | High     |
| L5  | FM                     | `/find`: type a full code (lower case), part of a code (`LR-M`), a tag number from the item page, `R1-B1`, `LOC:R1-B1`, `LR-XYZ-999`, then empty and Find                                                                             | A full code opens that roll with **Where it is** and its history; a partial shows a list "N rolls match"; `R1-B1` and `LOC:R1-B1` show the location and its rolls; the unknown code shows "No roll or location has the code LR-XYZ-999. Check the label or type the code."; empty shows "Type a roll code or tag number, like LR-MLT-004." under the field                                | High     |
| L6  | FM, 390 × 844          | `/find` → **Scan label** with the fake camera showing a roll label, then a location label                                                                                                                                             | The sheet opens at the bottom, reads by itself, closes, and shows the roll (or the location's rolls); no sideways scroll at 390 px; Find and Scan label are 44 px tall                                                                                                                                                                                                                    | High     |
| L7  | Constructor, 390 × 844 | Capture → Start a roll: the Roll list shows `· R…` at the end; **Scan the roll's label** (fake camera, a roll in stock) → Start scanning → Put roll back (no shots) → check the select → Put roll back                                | The leather and roll are chosen from the label; after Start the roll's history has "Taken for scanning · From R…"; Put back's "Where did you put it?" is prefilled with that place "(where it was)"; afterwards Find roll shows it there and the history adds "Put back"                                                                                                                  | High     |
| L8  | Constructor then FM    | At Capture, finish a roll that will be over the limit (the simulator, or a demo damaged roll left open), choose `RETURN` → Set aside. As FM open that roll's page → **Picked up by supplier** → confirm                               | The toast/line ends "It is set aside in RETURN."; the roll page shows Kept in `RETURN · Return area` and "Set aside for return"; after Picked up: Kept in "Picked up by the supplier on …", history "Picked up by supplier · From RETURN"; RETURN's roll count drops by one. Skip instead leaves it "Waiting for the supplier, not set aside yet" with a **Set aside** button on its page | High     |
| L9  | FM                     | Remove a roll that is in a bin (Inventory row → Remove, reason "Water damage")                                                                                                                                                        | Its place is freed (the bin's count drops); history "Removed · From R… · Water damage"                                                                                                                                                                                                                                                                                                    | Medium   |
| L10 | Admin                  | Audit log after L1 to L9                                                                                                                                                                                                              | Rows for `location.add`, `location.edit`, `location.deactivate`, `location.reactivate`, `roll.move`, `roll.set_aside`, `roll.picked_up`, each with before/after; `roll.start` and `roll.put_back` show the location                                                                                                                                                                       | Medium   |
| L11 | FM                     | Item page with no locations at all (after deactivating is not enough: use a DB with none, or skip if the demo always has them)                                                                                                        | Move buttons disabled with "Add a storage location first."; the "Add storage locations" link shows under Add rolls                                                                                                                                                                                                                                                                        | Low      |
| L12 | —                      | Full e2e suite                                                                                                                                                                                                                        | Pass; report any spec that fails on the new nav item, the Location column or the Put back dialog with its exact error                                                                                                                                                                                                                                                                     | High     |

### Access checks

| ID  | Role that must NOT have access        | URL or action                                                                                                    | Expected                                                                                    |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A1  | Quality Inspector                     | `/find`, `/inventory/locations`, `/inventory/labels`; `GET /api/v1/locations`, `GET /api/v1/rolls/find?q=LR`     | `/forbidden`; APIs `403`                                                                    |
| A2  | System Admin                          | the same pages and APIs                                                                                          | `/forbidden`; `403`; no Find roll in the sidebar                                            |
| A3  | Constructor **without** camera access | `/find`; `GET /api/v1/locations`                                                                                 | `/forbidden`; `403`; the phone bar has no Pages menu                                        |
| A4  | Constructor with camera access        | `/inventory/locations`; `POST /api/v1/rolls/move`; `POST /api/v1/locations`; `POST /api/v1/rolls/{id}/picked-up` | `/forbidden`; each API `403` (they may only pick, put back and set aside)                   |
| A5  | Anyone                                | `POST /api/v1/rolls/{id}/set-aside` on a roll that passed                                                        | `409` "LR-… isn’t waiting for the supplier. Only a roll Returned to supplier is set aside." |

## 6. Out of scope / known issues

- CPoint's real rack layout and label paper are unknown (A-53, A-54): don't report the placeholder
  codes or the 3 × 7 sheet size as wrong.
- The QR holds the plain code (A-80), so a phone's own camera app shows text, not a link. Expected.
- Capture's live camera and Scan the roll's label each open the camera. On some phones the second
  stream may pause the first; report what you see on the fake camera, and note it for Dylan's real
  phone check rather than as a failure.
- README, USER_MANUAL and the paper's figures are Phase 36; `docs/DEMO_SCRIPT.md` is out (Dylan).
- `next dev` first-compile timeouts / `ECONNRESET`: rerun that spec alone once and report both.
