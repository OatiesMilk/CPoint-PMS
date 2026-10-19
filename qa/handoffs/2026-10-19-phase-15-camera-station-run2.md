# QA handoff: Phase 15, the camera station — run 2 (fixes)

| Field           | Value                                                             |
| --------------- | ----------------------------------------------------------------- |
| Date            | 2026-10-19                                                        |
| Feature         | phase-15-camera-station-run2                                      |
| Branch          | `main` @ `94844bc` plus uncommitted fixes                         |
| Spec / prompt   | `camera-yolo-integration.md` Phase 15; `docs/ROADMAP.md` Phase 15 |
| Written by      | Claude                                                            |
| Previous report | `qa/reports/2026-10-19-phase-15-camera-station.md` (FAIL: F1, F2) |

## 1. What changed

- **F2, e2e test:** the D-028 test in `tests/e2e/cv.spec.ts` sent `crease` as its unknown class.
  `crease` is a real defect type now (D-052), so it uses `sim-unknown`. No app change.
- **F1, station log:** `send_refused` events now carry `attempts`, like `sent` and `send_failed`.
- **The React duplicate-key warning for `crease`** (report section 5) was a real bug: the
  "Defects by type" breakdown (the Quality Inspector home's "Defects today" card, and Reports) showed a key
  twice when some of its scans arrived while it was unknown and later ones after it was added as
  a defect type. Those scans now join the type, so each key is one row with the type's label.

## 2. Files touched

| File                                   | Change                                                     |
| -------------------------------------- | ---------------------------------------------------------- |
| `tests/e2e/cv.spec.ts`                 | D-028 test uses `sim-unknown`                              |
| `cv/cpoint_cv/client.py`, `station.py` | `attempts` on refused outcomes and their log line          |
| `cv/tests/test_station.py`             | New test: every send event has `httpStatus` and `attempts` |
| `src/server/models/report.model.ts`    | `defectBreakdown` joins a once-unknown key to its type     |

Database migration in this change: **no**

## 3. How to run the app locally

As in `qa/handoffs/2026-10-19-phase-15-camera-station.md` section 3, including the device token
in `cv/.env` and the photos in `cv/out/qa/`. Settings already has `crease` and `scratch` active
and `abrasion`/`dirt` off (S4 of run 1).

Existing automated tests that cover this area (run these too):

```bash
npm run test
cd cv; .venv/Scripts/python -m pytest; .venv/Scripts/ruff check .; .venv/Scripts/mypy
npm run build && npx playwright test tests/e2e/cv.spec.ts
```

## 4. Test accounts and data

As in run 1. The dev database already has `crease` and `scratch` scans from before and after they
became defect types, which is what R3 needs.

## 5. Test scenarios

| ID  | Role              | Steps                                                                                                                                                | Expected result                                                                                                                                                                                            | Priority |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | none              | From the repo root: `npm run build && npx playwright test tests/e2e/cv.spec.ts` (app running, `E2E_BASE_URL` set as in run 1)                        | 8 passed, 0 failed                                                                                                                                                                                         | High     |
| R2  | Floor Manager     | Repeat run 1's S13 (spool a capture with the app stopped, advance its batch, restart, `run file ...`). Then open `cv/out/logs/station-<today>.jsonl` | The refused capture's `send_refused` line has `httpStatus: 409` and `attempts: 1`. Every `sent`, `send_failed` and `send_refused` line has both `httpStatus` and `attempts`. The token appears nowhere     | High     |
| R3  | Quality Inspector | Open the QI home (`/quality-inspector`) and Reports → Defects by type, with the browser console open                                                 | `Crease` and `Scratch` each appear **once** (with those labels, not lowercase `crease`/`scratch`). The console has no "Encountered two children with the same key" warning. The server log has none either | High     |
| R4  | Floor Manager     | In Reports → Defects by type, click the `Crease` row (or open `/scans?defect=crease`)                                                                | The scans list shows every scan whose detections include `crease`, both from before and after it became a defect type                                                                                      | Medium   |
| R5  | none              | Regression: run 1's S3 (`run folder out/qa --interval 3`)                                                                                            | Five result lines, five new rows in Latest scans; no errors                                                                                                                                                | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action   | Expected                              |
| --- | ------------------------------ | --------------- | ------------------------------------- |
| A1  | Shoe Constructor               | Open `/reports` | Forbidden page, as before (unchanged) |

## 6. Out of scope / known issues

- Everything that passed in run 1 isn't repeated except R5.
- The sample photos produce only `hole` and `cut`; `crease`/`scratch` from a real photo aren't
  expected in R5.
- The Camera page placeholder is replaced in Phase 16.
