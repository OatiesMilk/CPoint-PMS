# QA handoff: no unknown defect classes, the Materials week label, and the D-107 axe fixes

| Field           | Value                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------- |
| Date            | 2026-11-02                                                                                  |
| Feature         | no-unknown-classes (D-108) + D-107 run 1 fixes                                              |
| Branch          | `main` at 2e63908, changes uncommitted in `C:\dev\CPoint-PMS` (laptop), together with D-107 |
| Spec / prompt   | Dylan in the thread, 2026-11-02; D-108                                                      |
| Written by      | Claude                                                                                      |
| Previous report | `qa/reports/2026-11-02-no-repeat-saves-run1.md` (FAIL on axe only)                          |

## 1. What changed

- **No unknown defect classes (D-108).** A class the camera model sends that has no defect type
  in Settings is dropped when the scan arrives: it isn't stored and it doesn't change the verdict.
  Nothing in the app says "unknown" any more:
  - Settings → Defect types has no "Unknown classes seen" card; a note under the table says a
    class that isn't listed is ignored, so a new model's classes must be added there.
  - The Admin home has no Unknown defect classes card and no unknown-classes banner.
  - `GET /api/v1/defect-types/unknown` is gone (404).
  - A scan's page, the Capture page's last result and the Camera page show no dashed "unknown"
    boxes, no "Unknown class" text and no "Unknown classes: Reject" rule line.
  - Reports → Quality, Operations and the roll pages show no "(unknown)" rows; `defects.csv`
    has no "Known type" column.
  - The simulator and the demo week only draw real defect types (no `sim-unknown`).
  - The `cv/` preview (`predict`, `evaluate`) ignores classes that aren't set up, like the app.
- **Migration `no_unknown_classes`** on existing data: a scan that was Reject **only** because of
  an unknown class becomes Pass; an unknown detection whose key is a defect type now joins it;
  every other unknown detection is deleted; the `isUnknownClass` column is dropped. One SYSTEM
  audit row `scan.unknown_classes_removed` records the counts. **It deletes data: back up first.**
- **Reports → Materials:** the line "This week is the week of Nov 2." now reads **"Week 1: Nov. 2"**
  (the week's number within the month its Monday falls in; Oct 26 is Week 4).
- **D-107 run 1 fixes (axe):** the two pagers on Plan batches are named "Schedule history pages"
  and "Quota history pages"; the Demo mode band is a labelled region.

## 2. Files touched

Main ones: `src/lib/decision-engine.ts`, `src/server/services/scan-ingest.service.ts`,
`src/server/lib/leather-scan.ts`, `src/server/services/demo-seed.service.ts`,
`src/server/services/settings.service.ts`, `src/server/models/{reference-data,report,roll}.model.ts`,
the admin home and settings pages, the scan, camera, capture and report pages,
`src/components/features/{demo-band,scans/scan-image}.tsx`, `src/lib/stock-rules.ts`,
`src/app/(app)/reports/materials/page.tsx`, `src/app/(app)/batches/plan/page.tsx`,
`prisma/schema.prisma` and `prisma/migrations/20261103090000_no_unknown_classes/`,
`cv/cpoint_cv/{preview,cli}.py`, `scripts/cv-simulate.ts`; the route
`src/app/api/v1/defect-types/unknown/route.ts` is deleted. Tests: unit (622) and e2e `admin`, `cv`,
`reports`, `smoke`. Docs: `docs/API.md`, `README.md`, `cv/README.md`, `cv/MODEL_CARD.md`.

Database migration in this change: **yes** (`20261103090000_no_unknown_classes`)

## 3. How to run the app locally

Standard (template). Before the migration, back up the dev database and note the counts:

```powershell
docker exec cpoint-pms-db-1 pg_dump -U cpoint -Fc cpoint_pms > storage/backups/before-d108-2026-11-02.dump
```

```sql
SELECT count(*) FROM detections WHERE "isUnknownClass";                       -- unknown detections
SELECT count(*) FROM scans s WHERE s."finalVerdict" = 'REJECT'
  AND EXISTS (SELECT 1 FROM detections d WHERE d."scanId" = s.id AND d."isUnknownClass");
SELECT count(*) FROM scans WHERE "finalVerdict" = 'PASS';
```

Then `npm run db:deploy`, `npm run db:generate`, `npm run build`, `npm run start` (`PORT=3001` if
needed). Checks on the `cv/` side: `cd cv`, `ruff check .`, `mypy cpoint_cv`, `pytest`.

## 4. Test accounts and data

Admin `admin@cpoint.local`, FM `manager@cpoint.local`; password `DEMO_USER_PASSWORD`. A device
token for API scans (`npm run cv:token`, or the e2e helpers).

## 5. Test scenarios

| ID  | Role         | Steps                                                                                                                                                                               | Expected result                                                                                                                                                                                                                | Priority |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| M1  | —            | Run the counts in §3, then `npm run db:deploy`.                                                                                                                                     | Migration applies. `detections` has no `isUnknownClass` column; `SELECT count(*) FROM detections WHERE "defectTypeId" IS NULL` is 0.                                                                                           | High     |
| M2  | —            | `SELECT after FROM audit_logs WHERE action = 'scan.unknown_classes_removed'`                                                                                                        | One row with `scansNowPass`, `detectionsJoinedType`, `detectionsDeleted`. `detectionsJoinedType + detectionsDeleted` equals the first count; `scansNowPass` is at most the second count; PASS scans went up by `scansNowPass`. | High     |
| M3  | —            | Run `npm run db:deploy` again.                                                                                                                                                      | "No pending migrations"; nothing changes.                                                                                                                                                                                      | Low      |
| S1  | Admin        | Admin home.                                                                                                                                                                         | No Unknown defect classes card, no unknown banner; Health, Users, Camera, Lunch break, Audit log cards.                                                                                                                        | High     |
| S2  | Admin        | Settings → Defect types.                                                                                                                                                            | No "Unknown classes seen" card; the note says a class that isn't listed is ignored. The page has no word "unknown".                                                                                                            | High     |
| S3  | Admin        | `GET /api/v1/defect-types/unknown`                                                                                                                                                  | 404.                                                                                                                                                                                                                           | Medium   |
| S4  | Device token | `POST /api/v1/scans` with one detection `{"classKey":"qa-no-type","confidence":0.95}` to an open roll.                                                                              | 201, verdict **PASS**, no detection stored for that scan (`SELECT count(*) FROM detections WHERE "rawClassKey"='qa-no-type'` = 0).                                                                                             | High     |
| S5  | Device token | Same, with `cut` 0.95 plus `qa-no-type` 0.95.                                                                                                                                       | REJECT; one detection stored (cut).                                                                                                                                                                                            | High     |
| S6  | FM           | Open the scan from S5 (Reports → Rolls → the roll → the shot).                                                                                                                      | One red box for Cut; no dashed box, no "unknown" text, no "Unknown classes: Reject" line.                                                                                                                                      | Medium   |
| S7  | FM           | Reports → Quality and Operations for this week; download `defects.csv`.                                                                                                             | No "(unknown)" anywhere; the CSV header has no "Known type".                                                                                                                                                                   | Medium   |
| S8  | FM           | Reports → Materials.                                                                                                                                                                | Under "Used per material": **"Week 1: Nov. 2"** (for the week of 2 Nov) on its own line, then "Per 100 pairs and days left use …". No "This week is the week of".                                                              | High     |
| S9  | —            | `npm run cv:simulate -- --count 10 --interval 1` (an open roll, a token).                                                                                                           | Every detection stored has a defect type; no `sim-unknown`.                                                                                                                                                                    | Low      |
| S10 | —            | `cd cv` then `ruff check .`, `mypy cpoint_cv`, `pytest`.                                                                                                                            | All pass (102 tests).                                                                                                                                                                                                          | Medium   |
| R1  | FM / Admin   | D-107 F1 recheck: with demo mode on, save an unchanged schedule on `/batches/plan` and an unchanged lunch on `/admin/settings?tab=lunch`; run axe (all rules, all impacts) on both. | 0 violations (no `landmark-unique`, no `region`).                                                                                                                                                                              | High     |

### Access checks

| ID  | Role that must NOT have access | URL or action                 | Expected |
| --- | ------------------------------ | ----------------------------- | -------- |
| A1  | Floor Manager                  | `/admin/settings?tab=defects` | 403 page |

## 6. Out of scope / known issues

- The README's Review queue and Talking points sections are from before Phase 25; Phase 31 rewrites
  them. Only their unknown-class lines changed here.
- `.github/workflows/ci.yml` (the Docker job's unknown-class check) can't be written from here;
  Dylan applies that edit by hand before the PR.
- `batches.spec.ts` fails between 00:00 and 01:00 Manila (known); rerun after 01:00.
