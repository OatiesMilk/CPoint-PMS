# Phase 30B plan: can the camera measure a cut? (was 30A; reordered 26 Oct)

> Part A here is 30B and Part B is 30C. The measuring decision is D-106 (D-104 is now rolls from
> Inventory, built in 30A; D-105 is the Monday-to-Friday schedule). **Decided 2026-11-02 (D-106):
> by the box** (length = the box diagonal, area = each shot's union of boxes); the check is
> `cv/reports/2026-11-02-LETTER-TEST-measure.md`.

Brief: `docs/prompts/factory-visit-changes.md` → Phase 30, Part A (C-9, C-10, C-24, C-35, C-37;
A-18, A-20). Status: **draft, waiting for Dylan's go** (26 Oct 2026). Decisions: D-103 (the roll's
area is entered by the FM, roll by roll) and D-106 (how defects are measured, after the check).

Part A changes only the `cv/` toolkit and `docs/STATION_SETUP.md`, plus the small read-only
photo export in section 3. The app's behaviour doesn't change. Part B (the app) is a separate
session; what Dylan decided for it today is in section 6 so it isn't lost.

## 0. Dylan's answers (26 Oct 2026)

1. **The roll's area is entered, never added up from the shots**, not even as a cross-check, and
   nothing looks for the leather in the frame. The share is defect area ÷ the entered area. This
   changes C-33 ("the roll's total size comes from those shots, if the model can measure it");
   D-103 records it.
2. **One phone** on the stand. Each phone gets its own one-time A4 calibration in Part B (A-18).
   Firefox's responsive mode can't stand in: it changes the screen size, not the camera.
3. **No whole rolls for the test.** With the area entered, 30A only has to show that the camera
   measures defects in inches. One A4-sized piece of leather (0.67 sq ft, a known area) with cuts
   made on purpose does that, and also tests the whole formula end to end.
4. **Photos through the app's Capture page**, so they are the same 1920 × 1080 frames Part B
   measures (my recommendation, carried with the plan's go).

## 1. What I read and what this reuses

- Vault: `CLAUDE.md`, `Rules.md`, `Home.md`, `CPoint commands and where to look`, Daily 26 Oct,
  the factory-visit note. Repo: `CLAUDE.md`, `STATUS.md`, the brief, `CPOINT_VISIT_10232026.md`.
- Newest QA report: `qa/reports/2026-10-25-phase-29-run2.md`, **PASS**, nothing open to fix first.
- Reused: `YoloDetector` already keeps each detection's **mask outline** (`RawDetection.polygon`,
  `cv/cpoint_cv/yolo_detector.py`; the model is `yolo26s-seg`), so outlines exist today and only
  the overlays use them. `map_with_sources`, `collect_images`, the config loader, and the CLI
  pattern of `predict` and `evaluate` (a dated report in `cv/reports/`).
- Git: `main` at Phase 29 (`c827311`). The uncommitted `docs/STATUS.md` and `docs/ROADMAP.md`
  (Phase 29 merged, and today's 30B notes) go into this phase's commit.

## 2. The test at the station (Dylan)

| What                          | How                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| The phone on the stand        | At its fixed height (C-24), photos taken through the Capture page into one roll.                                           |
| One plain A4 paper            | Shot first, flat, all of it in the frame: the calibration.                                                                 |
| One A4-sized piece of leather | Cuts of **1.5, 2.5, 3, 3.5 and 5 in**, each marked with the ruler before cutting, and one or two scratches, also measured. |
| 3 or 4 shots of the leather   | Moved to the centre and to the edges of the frame, to see whether the lens stretches lengths near the edges.               |
| A list of lengths             | Each cut's and scratch's ruler length, sent here with the photos.                                                          |

Risk, said up front: fresh knife cuts may not look like the cuts the model was trained on, so it
may miss some or box them oddly. The report says so if it happens.

## 3. What I build

**`cv/cpoint_cv/measure.py`** (pure; no numpy or OpenCV, so CI's tests run without them):

- Scale: inches per pixel from the width the phone sees and the image width.
- Each defect: box area; outline area (shoelace); length as the box diagonal and as the outline's
  longest span; inches and square inches.
- Each shot: the union of its defects, overlaps counted once (C-35), by box and by outline
  (rasterised on a grid).
- The roll: defect area = sum of the shots' unions; share = defect area ÷ the entered area, by box
  and by outline; "more than 10%" strict (exactly 10% isn't over, C-9); areas in square feet.
- Against the ruler: each defect's diagonal and span beside its ruler length; whether 2.5 in and
  3 in fall on the right side of the 3-inch line (C-37).

**`cv/cpoint_cv/calibration.py`** (OpenCV, imported only when used): finds the A4 sheet.

**Commands** (`cv/cpoint_cv/cli.py`):

- `python -m cpoint_cv calibrate <a4-photo>`: prints the width the phone sees across the frame, or
  what went wrong ("No white sheet found: lay it flat, all of it in the frame").
- `python -m cpoint_cv measure <folder>... [--width-in W]`: runs the model on the shots and
  writes `cv/reports/<date>-roll-measure.md`. Each folder holds a `roll.toml` (code, area in sq ft,
  `width_in` or the A4 photo) and a `ruler.csv` (photo, class, inches).

**Photo export** (read-only, no app screen): `npm run cv:roll-photos -- <roll-code> <folder>`
copies a roll's shots out of the uploads folder, with each shot's time (model → service → script,
the layering `demo-reset` uses).

**The report answers**: box or outline, which is closer to the ruler; whether the centre and the
edges agree; whether the 3-inch line holds; the share on the A4 leather; the formula I recommend.
Dylan picks; D-106 records it before Part B.

**Tests**: `cv/tests/test_measure.py` (about 15: scale, shoelace, diagonal and span, overlapping
boxes once, strict 10%, 2.99 vs 3.00 in, missing or zero area refused, `roll.toml` and
`ruler.csv`, the report, the CLI with `FakeDetector`) and a unit test for the export service.
Checks: ruff, mypy (strict), pytest, and `npm run check`.

## 4. Docs

- `docs/STATION_SETUP.md`: "Calibrate your phone" and "Measuring defects (Phase 30A)".
- `cv/README.md` (the commands), `cv/MODEL_CARD.md` (outlines used for measuring; stretch marks
  still not a class, C-22).
- The brief's Part B updated with section 6. Wrap-up: STATUS, SESSION_LOG, ROADMAP, DECISIONS
  (D-103 now, D-106 after the check); the vault's Daily note and phase summary.
- No Codex QA handoff: there's no app screen to test. Dylan's station test is the test.

## 5. Done when (Part A)

- `calibrate` and `measure` work on Dylan's photos and write the report with the answers above;
  ruff, mypy, pytest and `npm run check` pass.
- `docs/STATION_SETUP.md` has "Calibrate your phone".
- D-103 is recorded; Dylan picks the formula and D-106 records it. Then Part B in a new session.

## 6. Decided today for Part B (not built in 30A)

- **Rolls come from Inventory.** The FM adds each leather roll as its own record with its own area
  (from the receipt). Each supplier gets a short code in Settings, so codes read `LR-MLT-001` and
  replace `R-YYYY-NNNN` (D-095). The constructor picks a roll at Capture instead of starting one.
- A leather item's page lists its rolls: scanned or not, area, defect %, defects found. Never who
  scanned it (D-008).
- **Fully used.** At Finish batch the QI ticks a roll as Fully used (someone on the line tells
  them which); only then does it leave stock. The list shows only scanned rolls not yet fully used.
  A leather item's count is its rolls added, less those fully used or returned, instead of Added
  (+) on the stock sheet (D-102).
- A roll can't be used before it's scanned. A roll marked Return to supplier can't be ticked unless
  the FM chose Keep.
- Old dev and demo rolls are converted or reset (A-10). Part B may split in two (rolls from
  Inventory, then the measuring and the 10% rule) when it is planned.
