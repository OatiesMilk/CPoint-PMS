# QA handoff: Phase 16, the Camera page, "When found" actions, a small model check and the demo reset

| Field           | Value                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------ |
| Date            | 2026-10-19                                                                                 |
| Feature         | phase-16-camera-page                                                                       |
| Branch          | `main` @ `57694eb` plus uncommitted Phase 16 changes                                       |
| Spec / prompt   | `camera-yolo-integration.md` Phase 16; `phase-16-plan.md`; `docs/ROADMAP.md` 16            |
| Written by      | Claude                                                                                     |
| Previous report | `qa/reports/2026-10-19-phase-15-camera-station-run2.md` (5 of 6; R3 was a handoff mistake) |

## 1. What changed

- **Camera page** (FM, QI and Admin): new copy for every state. The badge reads **Not
  connected**, **Station connected** (the station is running and waiting for the next section),
  **Simulator active** or **Camera station active**. A new **Model** card names the model that
  judged the last section (`yolo-v1-1d729fb0`) and, when the setting is on and the last scan isn't
  simulated, shows "Early model (yolo-v1). Results are for testing; the Quality Inspector checks
  every flagged section." "Connect a camera" is now "Connect the camera station" (token, `doctor`,
  `run webcam`, the simulator).
- **Station check-in (D-054):** while `run webcam` waits for Space, it calls
  `GET /api/v1/batches/current` every 20 s. The page shows **Station connected** while a camera
  token (not the simulator's) was used in the last 2 minutes and no scan came in the last minute.
- **"When found" actions (D-053):** Settings → Defect types has a **When found** column and field
  (By confidence / Rework when found / Reject when found). Settings → Thresholds has **A defect
  counts as found at** (default 50%) and a **Show “Early model” on the Camera page** switch. A
  detection of a type with an action gives that action from the found-at value up, whatever the
  confidence above it; other types keep the two thresholds; the worst result decides the section;
  an unknown class still goes to review.
- **Scan page:** "Rules used" lists the actions in force when the scan was decided (e.g. "Reject
  when found: cut, hole") with the found-at value, then the thresholds. Older scans show the
  thresholds only. Box colours follow the same rule.
- **`npm run demo:reset` (D-056):** shows what it would remove; with `-- --yes` it removes test
  accounts, tokens (except the one in `CV_DEVICE_TOKEN`), batches, scans, repairs, salvage, stock
  items and movements, purchase requests and their files, the audit log and the image and proof
  files; sets cut/hole to Reject when found, crease/scratch to Rework when found, abrasion/dirt off;
  then seeds a fresh demo week. Accounts kept: the four demo accounts and the bootstrap admin.
- **Simulator and demo week** draw the model's classes (the demo week from the active defect
  types in Settings).
- **Station:** duplicate same-class boxes (IoU ≥ 0.7) are sent once; `[camera] url` opens an IP
  camera; `python -m cpoint_cv evaluate <folder>` writes a report from `labels.csv`.
- **E2E tests** post their own defect types (`e2e-rule-cut`, `e2e-rule-hole`, `e2e-rule-abrasion`,
  `e2e-rule-dirt`: active, no action), so they pass whatever Settings say.

## 2. Files touched

| File                                                                                                                                                   | Change                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261019120000_defect_actions/`                                                                             | `DefectAction` enum, `DefectType.action`, `CvSettings.foundAtOrAbove`, `earlyModelNotice` |
| `src/lib/decision-engine.ts`, `src/server/services/scan-ingest.service.ts`                                                                             | Per-type actions, worst outcome wins; snapshot keeps found-at and actions                 |
| `src/app/(app)/camera/page.tsx`, `src/server/services/camera.service.ts`, `src/lib/camera-rules.ts`                                                    | States, Model card, early-model notice, station check-in                                  |
| `src/server/models/{api-token,scan,reference-data,cv-settings}.model.ts`                                                                               | Latest camera token, model version, actions, settings updates                             |
| `src/app/(app)/admin/settings/{page,thresholds-form,model-notice-form,actions}.tsx`                                                                    | When found field and column, found-at field, notice switch                                |
| `src/server/{services/settings.service,validators/settings.validator}.ts`, `src/lib/admin-rules.ts`                                                    | Validation and audit for the new settings                                                 |
| `src/app/(app)/scans/[id]/{page,scan-viewer}.tsx`, `src/components/features/scans/scan-image.tsx`                                                      | Rules used, box colours                                                                   |
| `src/server/{models/demo-reset.model,services/demo-reset.service}.ts`, `scripts/demo-reset.ts`, `src/server/lib/storage.ts`, `src/server/models/db.ts` | The reset                                                                                 |
| `src/server/lib/leather-scan.ts`, `src/server/services/demo-seed.service.ts`, `scripts/cv-simulate.ts`                                                 | Model classes                                                                             |
| `cv/cpoint_cv/{station,triggers,sources,mapper,config,preview,evaluate,cli,doctor}.py`                                                                 | Check-in, IP camera, overlap filter, preview actions, `evaluate`                          |
| `tests/unit/*`, `cv/tests/*`, `tests/e2e/{cv-helpers,reports.spec}.ts`                                                                                 | New and updated tests                                                                     |
| `cv/README.md`, `cv/config.example.toml`, `cv/reports/2026-10-19-yolo-v1.md`, `docs/*`                                                                 | Runbook, demo script, report, decisions D-053 to D-058                                    |

Database migration in this change: **yes** (name: `20261019120000_defect_actions`)

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # apply migrations (adds defect_actions)
npm run dev            # app on http://localhost:3000 (PORT=3001 if 3000 is taken)
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change:

- **The reset is destructive.** Run S12–S13 only on a throwaway stack (`docker compose -p
cpoint-qa ...` with its own `DB_PORT`/`APP_PORT` and `DATABASE_URL`), or on the dev database
  only after Dylan has said so. Every other scenario works on any database.
- Before S1–S6, make the defect types match the reset (or run the reset): in Settings → Defect
  types, cut and hole = **Reject when found**, crease and scratch = **Rework when found**,
  abrasion and dirt off; Thresholds → **A defect counts as found at** 50%.
- The station needs `cv/.venv`, `cv/models/yolo-v1.pt`, `cv/.env` with `CV_DEVICE_TOKEN` and
  `CV_BASE_URL` (see `cv/README.md`). For S3 the webcam must be free. If no camera can be used,
  mark S3 blocked and use the API check in S3b.
- The five sample photos are in `C:\Users\micro\OneDrive\Pictures\Sample Photos (CAP2)`, with
  `labels.csv`.

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/cv.spec.ts tests/e2e/outcomes.spec.ts tests/e2e/reports.spec.ts tests/e2e/admin.spec.ts tests/e2e/smoke.spec.ts
cd cv && .venv/Scripts/python -m pytest
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs: one batch in progress at Preparation (Batches → New → Start), a device token
in `cv/.env`, the sample photos.

## 5. Test scenarios

| ID  | Role                | Steps                                                                                                                                                                      | Expected result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Priority |
| --- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | FM                  | With no station running and no scan for over 2 minutes, open `/camera`.                                                                                                    | Badge **Not connected**. "Scans go to" says "No camera station has checked in for 2 minutes. The last scan came … ago" (or "…hasn't checked in yet" on an empty DB).                                                                                                                                                                                                                                                                                                                                                                                    | High     |
| S2  | FM                  | Cancel or advance every batch so none is at Preparation; open `/camera`.                                                                                                   | The amber box reads "No batch is at Preparation, so the station waits and won't capture. Start a batch first." with a working **Start a batch** link.                                                                                                                                                                                                                                                                                                                                                                                                   | High     |
| S3  | FM                  | Start a batch. In `cv/`, run `.venv/Scripts/python -m cpoint_cv run webcam`; don't press Space. After about 30 s reload `/camera`.                                         | Badge **Station connected**; "Scans go to" reads "“<token name>” is connected and waiting for the next section. It last checked in … ago."                                                                                                                                                                                                                                                                                                                                                                                                              | High     |
| S3b | FM                  | If no camera: with the token, call `GET /api/v1/batches/current` (curl, `Authorization: Bearer …`) and reload `/camera` within 2 minutes, with no scan in the last minute. | Badge **Station connected**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Medium   |
| S4  | FM                  | Press Space at the station (S3), then reload `/camera` within a minute.                                                                                                    | Badge **Camera station active**; the last capture shows with boxes; the **Model** card says "The last section was judged by yolo-v1-1d729fb0." and shows the early-model notice naming **yolo-v1**.                                                                                                                                                                                                                                                                                                                                                     | High     |
| S5  | FM                  | While S3 waits, as the FM choose another batch under **Batch the camera feeds**; watch the station console within 20 s.                                                    | The console prints "The batch changed. Next scan goes to B-…" once, and the next capture lands in that batch.                                                                                                                                                                                                                                                                                                                                                                                                                                           | Medium   |
| S6  | FM                  | Run `run folder "<Sample Photos (CAP2)>" --interval 5`. Open each new scan from **Scans**.                                                                                 | Verdicts: IMG_6320 **REWORK**, IMG_6693, 6725, 6728, 6742 **REJECT** (cut/hole Reject when found; a 0.51 cut counts). "Rules used" lists "Reject when found: cut, hole", "Rework when found: crease, scratch", "Found at 50% or more", then "Other types: Reject ≥ 90%, Rework ≥ 60%".                                                                                                                                                                                                                                                                  | High     |
| S7  | FM                  | Run `npm run cv:simulate -- --count 3 --interval 2`, then reload `/camera` within a minute; again after 2 minutes.                                                         | First: **Simulator active**, no early-model notice, the Model card says "(simulated detections)". After 2 minutes: **Not connected** (never "Station connected").                                                                                                                                                                                                                                                                                                                                                                                       | Medium   |
| S8  | Admin               | Settings → Thresholds: untick **Show “Early model” on the Camera page**, **Save notice**; open `/camera` with a station scan as the last scan.                             | Toast "The early-model notice is off."; the Camera page has no notice; the Model card still names the model. Tick it again afterwards.                                                                                                                                                                                                                                                                                                                                                                                                                  | Medium   |
| S9  | Admin               | Settings → Defect types → Edit **scratch** → **When found** = **Reject when found** → Save. Post a scratch at 0.55 (simulator `--classes scratch:REJECT` or the station).  | The column shows "Reject when found"; the new scan is **REJECT**. Set it back to Rework when found.                                                                                                                                                                                                                                                                                                                                                                                                                                                     | High     |
| S10 | Admin               | Settings → Thresholds: set **A defect counts as found at** to `100` and save; then `0`; then `60` and save.                                                                | 100: under the field "Use a value above 0% and below 100%."; 0: "The found-at value must be above 0 and at most 100."; 60 saves with a toast. Set it back to 50.                                                                                                                                                                                                                                                                                                                                                                                        | Medium   |
| S11 | Admin               | Audit log, filter action `settings.`.                                                                                                                                      | Rows for the threshold, notice and defect-type changes above, each with before/after.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Low      |
| S12 | (shell)             | On a throwaway stack (see §3): `npm run demo:reset`.                                                                                                                       | Lists what it would remove and "Nothing changed. Back up the database, then run: npm run demo:reset -- --yes". Counts in the database are unchanged.                                                                                                                                                                                                                                                                                                                                                                                                    | High     |
| S13 | (shell, then Admin) | Same stack: `npm run demo:reset -- --yes`, then sign in as each demo account.                                                                                              | Prints "Reset done …" and "Seeded a fresh demo week: … batches …". All four demo accounts sign in; Users lists only them (and the bootstrap admin); API tokens lists only the `CV_DEVICE_TOKEN` one plus "Demo camera (seed)"; Settings lists no E2E shoe types, suppliers or defect types; defect types are cut/hole Reject when found, crease/scratch Rework when found, abrasion/dirt off; the audit log starts with one `system.demo_reset` row; Inventory shows the demo items with stock that matches their ledgers. Running it again also works. | High     |
| S14 | (shell)             | `cd cv`, `.venv/Scripts/python -m cpoint_cv evaluate "<Sample Photos (CAP2)>" --out out/qa-eval.md`.                                                                       | Prints "The preview matched the expected verdict on 5 of 5 photos." The report opens with "Small check on 5 photos."                                                                                                                                                                                                                                                                                                                                                                                                                                    | Medium   |
| S15 | (shell)             | Set `[camera] url = "rtsp://user:secret@10.255.255.1/stream"` in a copy of the config and run `doctor --config <copy>`.                                                    | The Camera line FAILs with "IP camera rtsp://10.255.255.1/stream couldn't be opened…"; the password never appears.                                                                                                                                                                                                                                                                                                                                                                                                                                      | Low      |
| S16 | QI                  | Run `npm run cv:simulate -- --count 5 --classes qa-unknown` (a key no defect type has).                                                                                    | Every scan with a detection is **NEEDS_REVIEW** and in the QI's review queue (clean sections pass), with actions set on the other types.                                                                                                                                                                                                                                                                                                                                                                                                                | High     |
| S17 | (shell)             | Revoke the station's token under API tokens while `run webcam` waits.                                                                                                      | Within 20 s the station prints "The device token was refused…" and stops.                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Medium   |

### Access checks

| ID  | Role that must NOT have access   | URL or action                                                                             | Expected                                                  |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A1  | Shoe Constructor                 | `/camera`                                                                                 | Redirect to the forbidden page; no Camera link in the nav |
| A2  | Floor Manager, Quality Inspector | `/admin/settings?tab=thresholds`; `PUT /api/v1/settings/cv`                               | Forbidden / 403                                           |
| A3  | Device token                     | `PUT /api/v1/settings/cv` with the station's token                                        | 401                                                       |
| A4  | All roles                        | axe on `/camera` (every state you reach) and `/admin/settings` (Thresholds, Defect types) | No WCAG 2.1 A/AA violations                               |

## 6. Out of scope / known issues

- The expected verdicts in `labels.csv` were drafted by Claude from the photos; S6 and S14 check
  the integration and the rule, not the model's accuracy.
- "Station connected" can show for up to 2 minutes after the station stops (the app records a
  token's use at most once a minute). By design (D-054).
- `PUT /api/v1/settings/cv` without `foundPercent` keeps the stored value (backwards compatible).
- A Docker app container runs with `NODE_ENV=production`, so `demo:reset` refuses there; run it
  from the host against the stack's `DATABASE_URL`.
- Claude didn't run any browser or e2e test.
