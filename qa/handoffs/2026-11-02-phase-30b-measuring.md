# QA handoff: Phase 30B, measuring defects in inches

| Field           | Value                                                                                |
| --------------- | ------------------------------------------------------------------------------------ |
| Date            | 2026-11-02                                                                           |
| Feature         | phase-30b-measuring                                                                  |
| Branch          | `main` at 1ea0da3 plus uncommitted changes, on Dylan's PC                            |
| Spec / prompt   | `docs/prompts/plans/phase-30b-plan.md` sections 3 and 4; `docs/ROADMAP.md` Phase 30B |
| Written by      | Claude                                                                               |
| Previous report | `qa/reports/2026-10-27-phase-30a-run9.md` (PASS)                                     |

## 1. What changed

No app screen changes. Two new model-toolkit commands and one read-only export script:

- `python -m cpoint_cv calibrate <photo> [--size a4|letter|WxH] [--save-overlay DIR]` finds a sheet
  of known size (A4 by default) and prints the pixels per inch and the width the phone sees.
- `python -m cpoint_cv measure <folder> [--width-in W] [--size S] [--out FILE]` runs the model on a
  roll's shots and writes a report: each defect's length and area by box and by mask outline, each
  ruler length beside the defect found, the 3-inch line (C-37), overlaps counted once (C-35), the
  roll's defect share of its entered area and whether it's over 10% (C-9).
- `npm run cv:roll-photos -- <roll-code> <folder>` copies a roll's shots out of the uploads folder
  with `shots.csv` and `roll.toml` (code and area). It reads only, wants a new folder, and refuses
  a roll with no area (rolls from before Phase 30A) by name.

## 2. Files touched

| File                                                        | Change                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `cv/cpoint_cv/measure.py`                                   | New: scale, shoelace, span, unions, the roll's share, roll.toml, ruler.csv, the report |
| `cv/cpoint_cv/calibration.py`                               | New: finds the sheet (OpenCV, imported lazily)                                         |
| `cv/cpoint_cv/cli.py`                                       | `calibrate` and `measure`                                                              |
| `cv/tests/test_measure.py`                                  | New, 21 tests                                                                          |
| `src/server/models/roll.model.ts`                           | `findRollPhotos`                                                                       |
| `src/server/services/roll-photos.service.ts`                | New: the export                                                                        |
| `scripts/cv-roll-photos.ts`, `package.json`                 | `npm run cv:roll-photos`                                                               |
| `tests/unit/roll-photos.service.test.ts`                    | New, 5 tests                                                                           |
| `cv/reports/2026-11-02-LETTER-TEST-measure.md`              | The first check on Dylan's three photos                                                |
| `cv/README.md`, `cv/MODEL_CARD.md`, `docs/STATION_SETUP.md` | Measure defects; Calibrate your phone                                                  |

Database migration in this change: **no**

## 3. How to run it

On Dylan's PC, in `D:\IMPORTANT SHIT HERE\12th Term - BSIT\CAP2\CPoint-PMS` (the photos and the
uncommitted changes are only there). Docker Desktop running with the `db` container up.

- Python: `cv\.venv` (Python 3.11 with the system packages: ultralytics 8.4.66, OpenCV 4.13,
  torch 2.4.1 CPU; plus pytest, ruff, mypy). `cv\config.toml` has `device = "cpu"`.
- The model `cv\models\yolo-v1.pt`; the photos `cv\out\30b-letter\cut-2.5in.jpeg`,
  `cut-3.5in.jpeg`, `cut-5.5in.jpeg`, with `roll.toml` (`calibrate_each = true`,
  `sheet = "letter"`, area 0.649) and `ruler.csv` (2.5, 3.5, 5.5 in).
- In PowerShell, quote npm's separator: `npm run cv:roll-photos '--' <code> <folder>`.

## 4. Test data

- The PC's dev database has rolls from before Phase 30A only (`R-2026-…`, no area, 10 shots
  each). An `LR-` roll with shots exists only after a demo reset, which Codex must not run, so C7
  checks the refusal and C8 is NOT POSSIBLE unless an `LR-` roll with shots is there already.

## 5. Test scenarios

| ID  | Steps                                                                                                                                                     | Expected result                                                                                                                                                                                | Priority |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| C1  | In `cv\`: `.venv\Scripts\ruff check .`, `ruff format --check .`, `.venv\Scripts\mypy`, `.venv\Scripts\python -m pytest`                                   | All pass; pytest 102 passed                                                                                                                                                                    | High     |
| C2  | `npm run check` at the repo root                                                                                                                          | Exit 0; 612 unit tests passed                                                                                                                                                                  | High     |
| C3  | In `cv\`: `.venv\Scripts\python -m cpoint_cv calibrate out\30b-letter --size letter --save-overlay <artifacts>\sheet`                                     | Each photo: "(grey, dark)", 160 to 167 px per inch, the phone sees 18.3 to 18.6 in; each overlay's green outline sits on the dark leather piece, not the tan table                             | High     |
| C4  | `calibrate out\30b-letter --size legal-ish`; and `calibrate out\no-such-folder`                                                                           | Exit 2, "The sheet size "legal-ish" isn't one we know … 8.5x11"; and "… isn't a file or folder."                                                                                               | Medium   |
| C5  | `.venv\Scripts\python -m cpoint_cv measure out\30b-letter --out <artifacts>\measure.md`                                                                   | Exit 0; the report's numbers equal `cv\reports\2026-11-02-LETTER-TEST-measure.md` (2.5 in: nothing found; 3.5 in: diagonal 3.58, span 3.61; 5.5 in: 5.80, 5.86; 19.4% by box, 1.0% by outline) | High     |
| C6  | Copy `out\30b-letter\roll.toml` and one photo to a new folder under the artifacts, set `area_sq_ft = 0`, run `measure` on it                              | Exit 2, "area_sq_ft must be a number above 0 …" naming the file                                                                                                                                | Medium   |
| C7  | `npm run cv:roll-photos '--' R-2026-0002 <artifacts>\export-old`                                                                                          | Exit 2, "Roll R-2026-0002 has no area. Only rolls added in Inventory (LR-…) have one …"; the folder isn't created                                                                              | High     |
| C8  | Only if an `LR-` roll with shots exists (query below): `npm run cv:roll-photos '--' <code> <artifacts>\export-lr`, then run it again into the same folder | First: `shot-NN.jpg` files, `shots.csv`, `roll.toml` with that code and its area as Inventory shows it. Second: exit 2, "… isn't empty". Otherwise NOT POSSIBLE                                | Medium   |

Query for C8 (pipe through stdin to `psql` in the `db` container):
`select b.code, b."areaSqFt", count(s.id) from batches b join scans s on s."batchId" = b.id where b.code like 'LR-%' group by 1, 2;`

### Access checks

None: no app page or API changed.

## 6. Out of scope / known issues

- No browser or e2e tests: nothing in the app's pages or API changed.
- The model missing the 2.5 in pen line, and pen lines in general, are a model limit (the
  model was trained on cuts), not a fault to report.
- `cv\.venv` runs Python 3.11, not the README's 3.13 (the PC has no 3.13). Report it only if a
  check fails because of it.
