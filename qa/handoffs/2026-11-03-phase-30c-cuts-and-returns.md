# QA handoff: Phase 30C, cuts from 3 inches and the return to the supplier

| Field           | Value                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Date            | 2026-11-03                                                                                           |
| Feature         | phase-30c-cuts-and-returns                                                                           |
| Branch          | `main` at 6966fcd, **uncommitted** on the laptop (`C:\dev\CPoint-PMS`)                               |
| Spec / prompt   | `docs/prompts/factory-visit-changes.md` Phase 30 Part B; plan `docs/prompts/plans/phase-30c-plan.md` |
| Written by      | Claude                                                                                               |
| Previous report | `qa/reports/2026-11-02-materials-weeks-run3.md` (nothing open)                                       |

## 1. What changed

- **The 3-inch line (C-37).** A defect type can have "Not accepted from __ in long". The cut has 3:
  a cut whose box diagonal is under 3 in is Usable (Pass), from 3.00 in Not accepted (Reject). A
  shot from a phone that isn't calibrated can't be measured, so a cut counts as Not accepted (the
  safe side, as before).
- **Cuts count a flat 1% (D-110, Dylan 3 Nov).** Each cut 3 in or longer adds exactly 1% to its
  roll's defect share, whatever its box size; a shorter cut adds nothing. Holes, scratches and
  creases count by their box area (D-106). The 1% is a per-type setting ("Counts as a flat share of
  the roll").
- **Calibrate this phone (Capture, A-18).** Capture shows "Calibrate this phone so cuts can be
  measured." until the phone is calibrated: one photo of an A4 or letter sheet, tap its four
  corners, "This phone sees 22.4 in across the table." It is kept in the browser per camera and
  frame size. Typing the number from `python -m cpoint_cv calibrate` is the fallback. Each shot then
  carries `widthIn`.
- **The roll's defect share (C-9, C-35).** At Finish roll: the shots' defect area (each shot's union
  of boxes, overlaps once) over the roll's entered area, plus the flat shares. More than the limit
  (Settings, default 10%, strict) marks it **Return to supplier**; the constructor sees "12.4% of
  this roll has defects (limit 10%). Set it aside for the Floor Manager." A roll with a shot from an
  uncalibrated phone is "Not measured" and isn't marked.
- **The Floor Manager decides (C-36).** Reports → Rolls has a "N rolls are marked Return to
  supplier" band and a **To return** status filter; each roll shows **Defect %**. A roll's page has
  "Defects and the supplier limit" (area, defect area, share and limit, defects by type with the
  longest, the largest defects) and **Returned to supplier…** (day, optional note; it leaves stock,
  status Returned to supplier) or **Keep…** (reason required). A decision is final. A marked roll
  can't be ticked Fully used at Finish batch until it is kept.
- **Elsewhere:** Inventory → a leather item's Rolls table shows Defect % (no more "To be
  implemented"); the claim sheet carries the same findings and each defect's length; a section's page
  shows each defect's length and "Phone calibrated: 20 in across" under Rules used; Reports →
  Operations → Supplier quality adds Defect area, Marked and Returned (rolls finished in the range),
  and `suppliers.csv` four columns. Settings → Thresholds has the supplier limit; Settings → Defect
  types has the two new fields and a "Counts toward the roll" column.
- **Demo week:** demo shots carry a calibration (24 in), so every finished demo roll has a Defect %;
  three rolls with a long cut on every shot go over 10%: the first is returned, the second kept, the
  last waits in To return. `demo:reset` sets cut "Not accepted from 3 in" and 1%.

## 2. Files touched

| File                                                                                                                                                                                                                         | Change                                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261103103243_measure_and_return/`                                                                                                                                               | New fields (defect types, CV settings, scans, detections, rolls), `RETURNED` status, `ReturnDecision`; cut set to 3 in and 1%      |
| `src/lib/measure.ts` (new), `src/lib/decision-engine.ts`, `src/lib/roll-findings.ts` (new), `src/lib/roll-rules.ts`, `src/lib/domain.ts`, `src/lib/admin-rules.ts`                                                           | Box length and area, union, roll share, calibration from corners, the length rule, findings, decision and Fully used rules, labels |
| `src/server/services/scan-ingest.service.ts`, `capture.service.ts`, `src/server/lib/image-type.ts`, `src/server/validators/scan.validator.ts`, `src/server/controllers/scan.controller.ts`                                   | `widthIn` on both scan routes, image size, measuring at ingest                                                                     |
| `src/server/services/roll.service.ts`, `src/server/models/roll.model.ts`, `src/server/validators/roll.validator.ts`, `src/server/controllers/roll.controller.ts`, `src/app/api/v1/rolls/[id]/return-decision/route.ts` (new) | Share at Finish roll, `decideReturn`, To return filter, Fully used blocked                                                         |
| `src/server/services/settings.service.ts`, `src/server/validators/settings.validator.ts`, `src/server/models/reference-data.model.ts`                                                                                        | Supplier limit, length limit and flat share                                                                                        |
| `src/server/services/ops-report.service.ts`, `src/server/models/ops-report.model.ts`                                                                                                                                         | Supplier quality share, marked, returned; claim lengths                                                                            |
| `src/app/(app)/camera/capture/calibration.tsx` (new), `capture-client.tsx`, `roll-bar.tsx`, `last-scan.tsx`                                                                                                                  | Calibrate this phone, `widthIn` sent, the finish line, lengths                                                                     |
| `src/app/(app)/admin/settings/page.tsx`, `thresholds-form.tsx`                                                                                                                                                               | Supplier limit field, defect type fields                                                                                           |
| `src/app/(app)/reports/rolls/*`, `reports/claims/[rollId]/page.tsx`, `reports/_components/ops-sections.tsx`, `inventory/[id]/page.tsx`, `scans/[id]/*`                                                                       | To return, findings, decision, Defect %, Supplier quality columns, lengths                                                         |
| `src/components/features/rolls/defect-share.tsx`, `return-decision.tsx`, `roll-findings.tsx` (new), `roll-status-badge.tsx`                                                                                                  | The share cell, the decision dialog, the findings section, the Returned badge                                                      |
| `src/server/services/demo-seed.service.ts`, `demo-reset.service.ts`, `bootstrap.service.ts`, `src/server/models/demo-reset.model.ts`                                                                                         | Demo calibration and returns; cut 3 in and 1%                                                                                      |
| `tests/unit/*` (measure, return-decision validator, roll service, scan ingest and others), `tests/e2e/returns.spec.ts` (new), `tests/e2e/inventory.spec.ts`                                                                  | Unit tests (670 pass); e2e written, not run                                                                                        |
| `.github/workflows/ci.yml`                                                                                                                                                                                                   | The Docker job checks every scanned demo roll has a share and every detection a length                                             |
| `docs/API.md`, `docs/STATION_SETUP.md`                                                                                                                                                                                       | The new fields and route; calibrating on Capture                                                                                   |

Database migration in this change: **yes** (`20261103103243_measure_and_return`, already applied to
the laptop's `cpoint_pms` by Claude).

## 3. How to run the app locally

Prerequisites: Docker Desktop running, `npm install` done, `.env` filled in (`AUTH_SECRET`,
`BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker (the Docker app stays stopped)
npm run db:deploy      # "No pending migrations" (measure_and_return is applied)
npm run db:generate
npm run dev            # http://localhost:3000, or the port it prints
```

Health check: `http://localhost:3000/api/health` returns OK.

Existing automated tests that cover this area (run these too):

```bash
npx playwright test tests/e2e/returns.spec.ts tests/e2e/rolls.spec.ts tests/e2e/inventory.spec.ts tests/e2e/capture.spec.ts tests/e2e/admin.spec.ts tests/e2e/supplier-quality.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page         |
| ----------------- | -------------------------- | ----------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`  |
| Quality Inspector | `inspector@cpoint.local`   | `/batches`        |
| System Admin      | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture` |

Data: the dev database is **not** reset for this run (don't run `demo:reset`). Run
`tests/e2e/returns.spec.ts` **first**: it leaves on the database one roll Kept, one Returned to
supplier and one marked roll waiting in To return (each `LR-E2E-…` with its own item, area 1 sq ft).
Use those for S5 to S10. Note their codes in the report.

## 5. Test scenarios

| ID  | Role                                                | Steps                                                                                                    | Expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Priority |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | System Admin                                        | Settings → Thresholds.                                                                                   | A field "Mark a roll Return to supplier when defects cover more than" showing 10 and %, and a third line under "What the camera will decide": "Return to supplier when a finished roll’s defects cover more than 10% of it. The Floor Manager decides."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | High     |
| S2  | System Admin                                        | In that field type `0`, press Save. Then `10.25`, Save. Then put back `10` (or leave it unsaved).        | Both times the field shows "Enter a percentage from 1 to 100, like 10 (one decimal at most)." under it, focus on the field; nothing saved. Leave it at 10.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | High     |
| S3  | System Admin                                        | Settings → Defect types. Open Edit on Cut.                                                               | Table has a "Counts toward the roll" column; Cut's "When found" reads "Usable under 3 in, Not accepted from 3 in" and "Counts toward the roll" "1% each, from 3 in"; Hole "Its box area". The Edit form has "Not accepted from (inches long)" = 3 and "Counts as a flat share of the roll (%)" = 1. Type `0` in the length and save: the message "Enter the length in inches from 0.1 to 100, like 3, or leave it blank for no length limit." Cancel without saving.                                                                                                                                                                                                                                                                                                                                            | High     |
| S4  | Shoe Constructor (a constructor with camera access) | Open Capture with a camera available in the in-app browser.                                              | Under the picture: "Calibrate this phone so cuts can be measured. Until then every cut counts as Not accepted, and a roll’s defect share can’t be worked out." with **Calibrate this phone**. Press it: a dialog "Calibrate this phone" with the frozen picture, a Sheet choice (A4, Letter), "Corners tapped: 0 of 4." Tap four points that aren't a sheet's shape (a square): "Those four points don’t match the shape of a A4 sheet…" (the sheet chosen). Press "Type the width from the calibrate tool instead", type `2`, Save: "Enter the inches the phone sees across the table, from 4 to 120, like 22.4." Type `20`, Save: the band becomes "This phone sees 20.0 in across the table." with Calibrate again. If the in-app browser has no camera, mark **NOT POSSIBLE** (Dylan checks it on a phone). | Medium   |
| S5  | Floor Manager                                       | Reports → Rolls.                                                                                         | A band "1 roll is marked Return to supplier." (or N rolls) with **Show rolls to return**; the table has a **Defect %** column. Press the button: the URL has `toReturn=1`, Status shows "To return (marked, not decided)", only marked rolls without a decision are listed, each with its share (e.g. 16.7%) and a "Return to supplier" badge.                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | High     |
| S6  | Floor Manager                                       | Open the waiting marked roll from S5.                                                                    | A caution line "Marked Return to supplier: defects cover 16.7% of this roll, more than the 10% limit. It can’t be ticked Fully used until you keep it…"; buttons **Returned to supplier…** and **Keep…**; a section "Defects and the supplier limit" with "Over the limit: …", Area (as entered) 1 sq ft, Defect area, Defect share "16.7% (limit 10%)", "Defects found, by type" and "Largest defects" with Shot links and lengths in inches. Each shot row lists its defects with a length ("… · 5.0 in").                                                                                                                                                                                                                                                                                                    | High     |
| S7  | Floor Manager                                       | On that roll press **Keep…**, then **Keep roll** with the reason empty. Then press Esc.                  | "Write why this roll is kept, like: the defects are at the edge and can be cut around." under "Why it is kept", focus there. Esc closes; nothing saved (the roll is still in To return). Don't decide it, so it stays for Dylan's demo.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | High     |
| S8  | Floor Manager                                       | Open the **Kept** e2e roll (Reports → Rolls, Find its code).                                             | No decision buttons; "Kept" badge under Defect % on the list; on the page "Decision: Kept" and "Why it was kept: The holes are at one edge".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Medium   |
| S9  | Floor Manager                                       | Open the **Returned** e2e roll; then its leather item in Inventory; then its Claim sheet.                | Status badge "Returned to supplier"; "Returned to the supplier on <date>. It left stock."; no Remove or decision buttons. In Inventory the item's rolls table shows the roll as Returned to supplier with its Defect % and on hand 0. The claim sheet has "Defects and the supplier limit" with "Note: Claim no. 1042" and each rejected section's defects with a length ("E2E hole 5.0 in 90%").                                                                                                                                                                                                                                                                                                                                                                                                               | High     |
| S10 | Floor Manager                                       | Reports → Operations → Supplier quality. Then the Suppliers CSV.                                         | Columns Defect area, Marked, Returned (a supplier with no measured roll in the range shows "Not measured"); the description says they count the rolls finished in the range. The CSV has "Defect area %", "Rolls measured", "Rolls marked Return to supplier", "Rolls returned".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Medium   |
| S11 | Quality Inspector                                   | Batches → Finish batch on a due batch (if one is open in the time window): look at **Rolls fully used**. | The waiting marked roll from S5 is **not** in the list; the Kept roll is (if it isn't ticked yet). If no batch can be finished now, mark **NOT POSSIBLE** with the time.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Medium   |
| S12 | any                                                 | Open a shot of the waiting marked roll (`/scans/<id>`, from the roll's page).                            | The detections table has a **Length** column ("5.0 in"); under Rules used "e2e-…" lines as before and "Phone calibrated: 20 in across". An older shot (from before today) shows "Phone not calibrated: nothing measured" and "—" lengths.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Low      |

### Access checks

| ID  | Role that must NOT have access                    | URL or action                                                                                                              | Expected                                                 |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| A1  | Quality Inspector, Shoe Constructor, System Admin | `POST /api/v1/rolls/<any roll id>/return-decision` with `{"decision":"KEPT","note":"x"}` while signed in as each           | `403` for each                                           |
| A2  | (axe)                                             | Reports → Rolls with `?toReturn=1`, a marked roll's page with the Keep dialog open, Settings → Thresholds, the claim sheet | axe (WCAG 2.1 A/AA, every rule and impact): 0 violations |

## 6. Out of scope / known issues

- **Claude doesn't run e2e (project rule):** `tests/e2e/returns.spec.ts` is new and was never run.
  A failure in it may be a test fault; report it with the error and Claude fixes it.
- A real phone calibration and real knife cuts are Dylan's device checks (S4 may be NOT POSSIBLE
  in the in-app browser).
- The FM home has no "rolls to return" card in this phase; the band is on Reports → Rolls.
- The share's numbers depend on the box (D-106): a slanted cut's box is mostly clean leather. Since
  D-110 a cut counts a flat 1% instead, so this only affects holes, scratches and creases.
- Rolls finished before this phase show "Not measured".
- `.github/workflows/ci.yml` changed (two Docker-job checks); CI runs it on the PR.

## 7. Run 2 (after run 1, `qa/reports/2026-11-03-phase-30c-run1.md`)

Run 1 FAIL: S7 (F1), two e2e test faults (F2) and three timeouts in the full suite (F3). What
changed since:

- **F1 fixed:** the decision dialog keeps its own kind while it closes, so Esc on Keep never shows
  the Send back dialog or carries the Keep message into it (`return-decision.tsx`). `returns.spec.ts`
  now presses Esc in the Keep test.
- **F2 fixed:** the Thresholds toast is back to "Saved. New scans use it from now on." (the
  `admin.spec.ts` text); the roll's area isn't repeated in the new section, so "24.5 sq ft" is on
  the roll page once (`rolls.spec.ts:74`).
- **F3:** no 30C code in those paths (sign-in, a non-leather item's page, axe on a section); they
  timed out at 30 s under the parallel full run. Rerun each spec alone once (below).
- **Plain words (Dylan, 3 Nov):** every 30C screen now uses short, plain text. The texts below
  replace the ones in §5.

| Where              | New text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roll page, marked  | "**This roll has too many defects (16.7%, over 10%).** Look at the photos below, then choose: send it back to the supplier, or keep it."                                                                                                                                                                                                                                                                                                                                                                                      |
| Roll page, buttons | **Send back to supplier…** and **Keep and use…**                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Send back dialog   | "Send LR-… back to the supplier?", "It will be taken out of stock. You can’t undo this.", "Day it was sent back", "Note (optional)", button **Send back**                                                                                                                                                                                                                                                                                                                                                                     |
| Keep dialog        | "Keep LR-…?", "It stays in stock and can be used as normal. You can’t undo this.", "Why are you keeping it?", error "Write why you’re keeping it, for example: the cuts are at the edge.", button **Keep roll**                                                                                                                                                                                                                                                                                                               |
| Sent back          | "Sent back to the supplier on <date>."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Section heading    | "How damaged is this roll?", "16.7% of this roll has defects. The limit is 10%.", facts "Area with defects" and "Part of the roll with defects", "Defects found", "· 2 rejected", "Largest defects" with "Check these photos before you decide. A long, slanted cut can look bigger here than it really is."                                                                                                                                                                                                                  |
| Reports → Rolls    | band "1 roll has too many defects and is waiting for your decision." with **Show it** (**Show them** for more); status option "Waiting for your decision"; badge "Too many defects"                                                                                                                                                                                                                                                                                                                                           |
| Capture            | "**Set up this phone first.** It needs one photo of a paper sheet so it can measure cuts." with **Set up this phone**; once set up "This phone is set up to measure cuts." with **Set up again**; dialog "Set up this phone" with three numbered steps, "Paper size", "That doesn’t look like the corners of an A4 paper. Press Tap again and try once more.", "Done. Press Save.", **Save**; after Finish roll of a marked roll "Put LR-… aside. It has too many defects (16.7%). The Floor Manager will decide what to do." |
| Settings           | "Send a roll back when defects cover more than" (hint "Checked when the roll is finished at Capture."), error "Enter a percentage from 1 to 100, like 10 (one decimal at most)."; Defect types: "OK under 3 in, rejected from 3 in", "Rejected from (inches long)", "Each one adds this to the roll’s total (%)", "Its size"                                                                                                                                                                                                  |

### Run 2 checks

| ID  | Steps                                                                                                        | Expected                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `npx playwright test tests/e2e/returns.spec.ts` first (it adds a fresh waiting roll)                         | 5 passed                                                                                                                                                 |
| R2  | S7 again on the waiting roll: Keep and use…, Keep roll empty, then Esc                                       | The Keep message shows; Esc closes it; no Send back dialog appears at any point; the roll is still waiting (Reports → Rolls → Waiting for your decision) |
| R3  | S1, S5, S6, S9 and S3 again with the texts above                                                             | Each text as in the table; nothing else changed                                                                                                          |
| R4  | `npx playwright test tests/e2e/admin.spec.ts tests/e2e/rolls.spec.ts`                                        | 0 failed                                                                                                                                                 |
| R5  | `npx playwright test tests/e2e/inventory.spec.ts`, then `tests/e2e/smoke.spec.ts`, each alone                | 0 failed (report both if a rerun is needed)                                                                                                              |
| R6  | Full suite `npm run test:e2e`                                                                                | 0 failed; if one of F3's three fails again, rerun that spec alone once and report both                                                                   |
| R7  | axe on the waiting roll's page with the Keep dialog open, and on Capture's Set up dialog if the camera works | 0 violations                                                                                                                                             |

## 8. Run 3 (after run 2, `qa/reports/2026-11-03-phase-30c-run2.md`)

Run 2: R2 to R5 and R7 passed. Its one failure was a test fault: `returns.spec.ts:128` still expected
the old badge "Return to supplier"; it now expects "Too many defects". The smoke Floor Manager
journey timed out once in the full run and passed 10/10 alone (load, as in run 1).

| ID  | Steps                                           | Expected                                                                                      |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- |
| T1  | `npx playwright test tests/e2e/returns.spec.ts` | 5 passed                                                                                      |
| T2  | Full suite `npm run test:e2e`                   | 0 failed; a spec that times out under the full run is rerun alone once, both results reported |
