# Phase 30C plan: cuts from 3 inches, and the 10% return to the supplier

Brief: `docs/prompts/factory-visit-changes.md` → Phase 30, Part B (C-9 to C-12, C-20, C-33 to
C-37, C-39; A-18). Decisions it builds on: D-093 (Pass or Reject, final), D-103 (the roll's area
is entered), D-104 (rolls from Inventory, Fully used at Finish batch), D-106 (measured by the box).
Status: **approved and built** (3 Nov 2026), D-110. Handoff `qa/handoffs/2026-11-03-phase-30c-cuts-and-returns.md`.

## 00. Dylan's answers (3 Nov 2026), D-110 on the go

1. **Calibration:** once per phone on Capture by tapping an A4 or letter sheet's four corners. Redo
   it only when that phone's height or zoom changes or another phone goes on the stand; the app
   asks again by itself when the camera's frame size changes.
2. **Cuts count a flat 1% (for now):** each cut **3 in or longer** (box diagonal) adds exactly 1% to
   the roll's defect share, whatever its box size; a cut under 3 in adds nothing. Holes, scratches
   (and creases, ASSUMPTION A-30) count by box area as in D-106. This amends D-106 for cuts, to get
   around slanted cuts' large boxes. The 1% is data: a per-type setting "Counts as a flat __% of the
   roll" (cut 1, others empty = box area).
3. **One session.**

## 0. Already settled (not reopened)

- **By the box (D-106).** A defect's length is its box diagonal in inches; a shot's defect area is
  the union of its boxes, overlaps counted once (C-35); a roll's share is the sum over its shots ÷
  its entered area (D-103). **More than** the limit is over (strict, C-9): exactly 10.00% isn't marked.
- **One phone on the stand**, calibrated once per phone (A-18), from Capture's 1920 × 1080 frames.
- **A roll marked Return to supplier can't be ticked Fully used** unless the FM chose Keep
  (30B plan §6). The FM may also return a roll under the limit (C-36).
- The roll's area is never added up from the shots, and nothing looks for the leather in the frame.
- The newest Codex report (`qa/reports/2026-11-02-materials-weeks-run3.md`) has nothing open: its
  one failure was a cold-start sign-in on a fresh dev server, and D-107 to D-109 are merged (#33).

## 1. What changes, by area

**Data (one migration, `measure_and_return`):**

- `CvSettings.returnSharePct` (default 10). `DefectType.notAcceptedFromIn` (optional, in inches):
  set to 3 for `cut` (C-37), empty for `scratch` (C-39) and the rest.
- `Scan.imageWidth`, `imageHeight` (read from the photo at ingest) and `widthIn` (the phone's
  calibration, null when it has none), plus `defectAreaSqIn` (the shot's union of boxes).
- `Detection.lengthIn`, `areaSqIn` (null when the shot has no scale).
- `Roll`: at Finish roll, `defectAreaSqIn`, `defectSharePct`, `returnLimitPct` (the limit then)
  and `markedForReturn`; the FM's `returnDecision` (`RETURNED` or `KEPT`), its date, note and who
  (audit only, D-008). A new `RollStatus.RETURNED`: the roll leaves stock with an OUT movement
  "Returned to supplier" (this is what 30D's F9 split needs).

**Settings (Admin):** "Mark a roll Return to supplier when defects cover more than __% of it" (1 to
100, default 10) next to "counts as found at". Under Defect types, per type: "Not accepted from __ in
long" (optional, 0.1 to 100). A type with a length set shows "Usable under 3 in, Not accepted from 3
in" instead of its outcome picker.

**Capture (per phone, A-18):** a "Calibrate this phone" step. The constructor lays an A4 or letter
sheet flat on the table, takes one frame, and taps the sheet's four corners on the photo; the app
works out pixels per inch the same way `cpoint_cv calibrate` does (long and short sides averaged)
and shows "This phone sees 22.4 in across the table." It is kept in this browser per camera **and
frame size**, so a camera that comes up at another resolution asks again. Typing the number from
`python -m cpoint_cv calibrate` is the fallback. Without it, Capture shows "Calibrate this phone so
cuts can be measured" and still captures.

**Ingest and engine (`src/lib/decision-engine.ts`, `scan-ingest.service.ts`):** each found
detection gets its length and area in inches; each scan its union area. A type with a length limit
is **Not accepted at or above it and Usable below** (2.99 in Usable, 3.00 in Not accepted). Without
a scale nothing is measured and a type with a length limit counts as **Not accepted** (the safe
side, as today). The snapshot on the scan keeps the limits and the scale, so old verdicts stay
explainable. Every other type works as now.

**Rolls:**

- At Finish roll the share is worked out and saved. Over the limit: the roll is marked, and the
  constructor sees "12.4% of this roll has defects (limit 10%). Set it aside for the Floor Manager."
- A roll with any shot that has no scale gets **"Not measured"** (no share, not marked); the FM can
  still return it by hand. Rolls from before this phase show "Not measured" too.
- Inventory → a leather item's Rolls table: **Defect %** replaces "To be implemented".
- **Reports → Rolls** gets a **To return** filter (marked, no decision yet), and the roll's page
  shows its findings: area, defect area, share, the limit, defects by type with each one's length,
  and the photos with their boxes drawn, longest first, so a slanted cut whose box is mostly clean
  leather is easy to see (D-106's known cost). The FM decides **Returned to supplier** (date, note)
  or **Keep** (reason, required), or returns any finished roll. A decision can't be changed; a
  mistake is fixed by Inventory → Remove as now (ASSUMPTION A-27).
- **Finish batch:** a marked roll with no decision, or a returned one, isn't in Rolls fully used.
- **Claim sheet** (`/reports/claims/[rollId]`) carries the same findings.

**Reports → Operations, Supplier quality:** per supplier, the defect area share (over its measured
rolls), rolls marked and rolls returned; `suppliers.csv` and `supplier-rolls.csv` follow.

**API (`docs/API.md`):** the scan upload takes an optional `widthIn`; `POST
/api/v1/rolls/:id/return-decision` (FM); settings and defect-type PATCH take the two new fields.

**Demo week and `demo:reset`:** demo scans carry a scale, so every demo roll has a Defect %; one
finished roll is over 10% and waits in To return, one was returned and one kept. CI's Docker job
check follows.

## 2. Tests

- **Unit:** length and union maths, with the letter-test fixture from 30B (the 3.5 in line reads
  3.58 in and the 5.5 in line 5.80 in by box; its 15.33 sq in box) so the app matches the toolkit;
  overlapping boxes counted once; 2.99 and 3.00 in; no scale → Not accepted for a limited type; 10.00%
  not marked, 10.01% marked; "Not measured" with one unscaled shot; the four-corner calibration;
  services and validators for the decision, the settings and the Fully used block.
- **E2E (written, not run by me):** a marked roll from Capture to the FM's decision and the claim
  sheet; Keep lets it be ticked Fully used; Returned takes it out of stock.
- I run `npm run check` and the `cv/` checks; Codex runs the browser and e2e checks from a handoff.

## 3. Assumptions to log in STATUS (open questions)

- **A-27:** the FM's decision is final in the app (a mistake goes through Remove); Keep needs a
  reason, Returned a date and an optional note.
- **A-28:** a roll with any unscaled shot is "Not measured" and isn't marked automatically.
- **A-29:** a returned roll leaves stock (OUT, "Returned to supplier"), the same as Fully used for
  the count, and is reported apart from it.

## 4. Questions for Dylan (my recommendation first)

1. **Calibration on Capture:** tap the sheet's four corners on a photo (recommended: no laptop
   needed, the same formula as the toolkit), or only type the number from `cpoint_cv calibrate`?
2. **Slanted cuts (D-106):** build as planned with the FM seeing the boxes and deciding
   (recommended), or also check a few real knife cuts on scrap leather through `measure` first?
3. **Size:** one session as above (recommended), or split into 30C-1 (settings, calibration, the
   3-inch line) and 30C-2 (the roll share, To return, the claim sheet and reports)?

## 5. Files (main ones)

`prisma/schema.prisma` + migration; `src/lib/decision-engine.ts` and a new `src/lib/measure.ts`;
`src/server/services/{scan-ingest,roll,settings,ops-report,report,demo-seed,demo-reset}.service.ts`;
`src/server/validators/{scan,settings}.validator.ts`; `src/app/(app)/camera/capture/*` (a new
calibration dialog); `src/app/(app)/admin/settings/*`; `src/app/(app)/reports/rolls/*`,
`reports/claims/[rollId]`; `src/app/(app)/inventory/[id]/page.tsx`; the Finish batch roll list;
`src/app/api/v1/rolls/[id]/return-decision/route.ts`; `docs/API.md`, `docs/STATION_SETUP.md`
(calibrate on Capture). Wrap-up: STATUS, SESSION_LOG, ROADMAP, DECISIONS (D-110), the handoff and
`qa/CODEX_PROMPT_PHASE_30C.md`.

Doc fix on the way: DECISIONS has D-106 twice (a short and a long copy); I'll keep the long one.
