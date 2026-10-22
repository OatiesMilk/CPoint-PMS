# QA handoff: Phase 20 website-only camera, "Cut around or clean", supplier quality, no components

| Field           | Value                                                                               |
| --------------- | ----------------------------------------------------------------------------------- |
| Date            | 2026-10-20                                                                          |
| Feature         | phase-20-website-camera-and-reports                                                 |
| Branch          | `main` checkout at `cc612ee`, uncommitted                                           |
| Spec / prompt   | `docs/prompts/plans/phase-20-plan.md`, `docs/ROADMAP.md` Phase 20, D-069 to D-072   |
| Written by      | Claude                                                                              |
| Previous report | `qa/reports/2026-10-19-phase-16-camera-page-run2.md` (no 17, 18 or 19 report exist) |

This one run also covers what Phases 18 and 19 still need (their handoffs were never run). Phase
17 (the station window) is retired, so its handoff is **not** run.

## 1. What changed

- **The CPoint Camera desktop app is gone (D-069).** Capturing happens only on the website's
  Capture page. `cv/` keeps `predict`, `evaluate` and `export-onnx`; `run`, `doctor`, `window`
  and `shortcut` are removed. The Camera page no longer talks about a station: its badge is
  **Capture page active**, **Simulator active** or **No recent captures**, and "Ways to capture"
  lists the Capture page and the simulator. No "check before starting" button was added to the
  Capture page, on purpose.
- **"Rework" now reads "Fixable" (D-070).** Every place a user sees the verdict (badges, scan
  filters, charts, the decision dialog, review page, Settings, reports, CSV headers). The board at
  `/rework` is **Cut around or clean** with columns **To handle**, **Being handled**, **Done,
  usable**. Each card says what the section needs: **Clean before cutting** or **Cut around the
  marked area**, from a new per-defect-type setting (Settings → Defect types → **When Fixable**).
  Done cards read **Cleaned, usable** or **Cut around, usable**. Buttons are **Start** and **Mark
  done**. A completed batch with open sections is tagged **Being handled · N**.
- **Supplier quality (D-072).** Floor Manager → Reports → Operations has a **Supplier quality**
  card: per supplier Rolls, Sections, Fixable %, Reject %, Top defect, with a red **High** badge on
  a supplier well above the rest. Below it, **Rolls with the most rejects** (top 5) with "Rejected
  N of M", the main defects and a **Claim sheet** button. The claim sheet
  (`/reports/claims/<batchId>`) lists the roll, supplier, counts and every rejected section with
  its photo; **Save as PDF** opens the print dialog, and the sidebar is left out of the printout.
  Two CSVs: `suppliers.csv` (new columns) and `supplier-rolls.csv`.
- **Component tracking is gone (D-071).** No `/components` page, no Settings → Components tab, no
  `/api/v1/component-types`, and the `component_types` table is dropped.

## 2. Files touched

| Area                  | Files                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations            | `prisma/migrations/20261020090000_defect_handling`, `20261020100000_drop_component_types`, `prisma/schema.prisma`                                                             |
| Camera page           | `src/app/(app)/camera/page.tsx`, `src/server/services/camera.service.ts`, `src/server/models/api-token.model.ts`, `src/lib/capture-rules.ts`                                  |
| Cut around or clean   | `src/app/(app)/rework/*`, `src/lib/outcome-rules.ts`, `src/server/services/rework.service.ts`, `src/server/models/outcome.model.ts`, Settings defect tab and validator        |
| Fixable wording       | verdict badge, legend, scan filters and pages, review, QI home, admin home, thresholds form, reports views, CSV headers, batch page and badge, stage-machine, ops-rules, nav  |
| Supplier quality      | `src/server/models/ops-report.model.ts`, `src/server/services/ops-report.service.ts`, `reports/_components/ops-sections.tsx`, `reports/claims/[batchId]/*`, CSV route, layout |
| Demo data             | `src/server/lib/demo-suppliers.ts`, `demo-seed.service.ts`, `demo-reset.service.ts`, `bootstrap.service.ts`                                                                   |
| Components removed    | `src/app/(app)/components/`, `src/app/api/v1/component-types/`, settings service/controller/validator/model, audit link, demo-reset model                                     |
| Model toolkit (`cv/`) | window, station, spool, transport, doctor and their tests removed; `cli.py`, `config.py`, `sources.py`, `README.md` rewritten                                                 |
| Tests                 | unit: camera status, outcome rules, ops rules, ops report, settings, stage machine; e2e: updated wording, new `supplier-quality.spec.ts` and `cut-around-or-clean.spec.ts`    |
| Docs                  | README, `docs/API.md`, DECISIONS D-069 to D-072, ROADMAP, STATUS, SESSION_LOG                                                                                                 |

Database migration in this change: **yes** (`defect_handling`, `drop_component_types`).

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm ci` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`). The
project is in `C:\dev\CPoint-PMS`.

```bash
npm run db:up
npm run db:deploy      # must apply the two new migrations (scenario M1)
npm run dev            # http://localhost:3000 (or PORT=3001 if another app holds 3000)
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change:

- The model files `cv/models/yolo-v1.onnx` and `yolo-v1.json` must exist (they do on Dylan's
  laptop).
- For P18 and P19 below, the Phase 18 and 19 handoffs' own section 3 steps (HTTPS, Docker).

Automated tests (run these too):

```bash
npm run build && npm run test:e2e
```

New specs: `tests/e2e/supplier-quality.spec.ts` (3 tests), `tests/e2e/cut-around-or-clean.spec.ts`
(2 tests). Updated for the new wording: admin, auth, cv, outcomes, reports, rework-columns, smoke.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs:

- A batch at Preparation that has a supplier (FM: Batches → New batch, pick a supplier, Start
  production). Note its code and roll code.
- A few Fixable and rejected sections on it: capture on the Capture page, or use the simulator
  (`npm run cv:token` once, then `npm run cv:simulate -- --count 20 --interval 1`).
- **Do not run `npm run demo:reset`**: it rewrites Dylan's database.

## 5. Test scenarios

### Migrations and model toolkit

| ID  | Role | Steps                                                                                                         | Expected result                                                                                    | Priority |
| --- | ---- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| M1  | —    | `npm run db:deploy` on the existing dev database                                                              | Applies `20261020090000_defect_handling` and `20261020100000_drop_component_types` with no error   | High     |
| M2  | —    | In `cv/`: `.venv\Scripts\python -m cpoint_cv --help`, then `.venv\Scripts\python -m cpoint_cv run webcam`     | Help lists only `predict`, `evaluate`, `export-onnx`; `run` fails with "invalid choice"            | Medium   |
| M3  | —    | In `cv/`: `.venv\Scripts\python -m cpoint_cv predict "C:/Users/micro/OneDrive/Pictures/Sample Photos (CAP2)"` | Prints each photo's detections, `yolo-v1-1d729fb0` and a preview verdict                           | Medium   |
| M4  | —    | `cv/CPoint Camera.cmd` and the cv `window` command                                                            | The `.cmd` no longer exists in the repo (an old desktop shortcut to it now fails; that's expected) | Low      |

### Camera page (no station)

| ID  | Role | Steps                                                                    | Expected result                                                                                                                                         | Priority |
| --- | ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| C1  | FM   | Open **Camera** when nothing was captured in the last minute             | Badge **No recent captures**; text says nothing was captured in the last minute. No "Connect the camera station" steps, no "Station connected" anywhere | High     |
| C2  | QI   | Capture one section on **Capture**, then open **Camera** within a minute | Badge **Capture page active**; "Sections are being captured on the Capture page. Last scan … ago."                                                      | High     |
| C3  | FM   | Run `npm run cv:simulate -- --count 3 --interval 2`, open **Camera**     | Badge **Simulator active** while it runs; **No recent captures** a minute after it stops                                                                | Medium   |
| C4  | FM   | Read the **Ways to capture** card                                        | Two parts: "From the Capture page" and "No camera yet?" with `npm run cv:simulate`. Nothing about CPoint Camera, `cv/.env` or `shortcut`                | Medium   |
| C5  | QI   | Open **Capture**                                                         | No "Check this machine" or similar button; the camera starts on its own (as in Phase 18)                                                                | Medium   |

### Fixable and "Cut around or clean"

| ID  | Role  | Steps                                                                                                | Expected result                                                                                                                                                          | Priority |
| --- | ----- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| F1  | Admin | Settings → **Defect types**                                                                          | A **When Fixable** column. `dirt` reads **Clean before cutting**; every other type **Cut around the marked area**                                                        | High     |
| F2  | Admin | Edit `scratch`: **When Fixable** → Clean before cutting, Save. Then set it back.                     | The row shows Clean before cutting, then Cut around the marked area again. Audit log has two `defect_type.update` rows                                                   | High     |
| F3  | Admin | `POST /api/v1/defect-types` with `{ "key": "e2e-x", "label": "X", "handling": "WASH" }` (signed in)  | `422 VALIDATION_FAILED`, message "Choose how a Fixable section is handled: Cut around the marked area, or Clean."                                                        | Medium   |
| F4  | FM    | Sidebar → **Cut around or clean**                                                                    | Heading "Cut around or clean", the description about cleaning or cutting around; columns **To handle**, **Being handled**, **Done, usable**                              | High     |
| F5  | FM    | On a card in To handle: read it, press **Start**, then **Mark done**; try **Undo** in the toast once | Card shows "B-… · section #N", "Defect, NN%", and the action line with its icon. Start moves it to Being handled, Mark done to Done, usable; Undo moves it back one step | High     |
| F6  | FM    | A done card whose defect is `dirt`-like (Clean) and one that's Cut around                            | Green line **Cleaned, usable** vs **Cut around, usable**                                                                                                                 | High     |
| F7  | QI    | Scans list: verdict filter, badges; a scan's page; Review page; decision dialog (Override)           | The verdict reads **Fixable** everywhere (filter option, badge, "Fixable when found", radio "Fixable" with "Goes to the Cut around or clean board.")                     | High     |
| F8  | FM    | Complete a batch that still has a section in To handle                                               | Dialog: "1 section is still to be cleaned or cut around. The batch will be tagged Being handled…"; the batch shows **Being handled · 1**                                 | Medium   |
| F9  | Admin | Settings → **Thresholds**                                                                            | Field "Fixable at or above"; entering 95 shows "Fixable must start below Reject (90%)."                                                                                  | Medium   |
| F10 | QI    | Reports (Quality) and the **Daily CSV**                                                              | KPI and table columns say **Fixable** and **Cleaned or cut around**; the CSV header is `Date (Manila),Scanned,Pass,Fixable,Reject,…`                                     | Medium   |
| F11 | FM    | FM home and Reports → Operations                                                                     | The card "Cut around or clean" (not "Open reworks"); KPI "To clean or cut around"; no "repair station" wording                                                           | Medium   |

### Supplier quality and claim sheet

| ID  | Role | Steps                                                                                          | Expected result                                                                                                                                                                       | Priority |
| --- | ---- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Q1  | FM   | Reports → **Operations**, range that includes your scans; scroll to **Supplier quality**       | Table Supplier, Rolls, Sections, Fixable, Reject, Top defect; worst supplier first; "never by person" line at the bottom                                                              | High     |
| Q2  | FM   | Compare one supplier's numbers with its batches' scans                                         | Rolls = distinct roll codes, Sections = scans in range, Fixable % and Reject % add up with Pass to 100% (pending excluded)                                                            | High     |
| Q3  | FM   | A supplier with ≥ 30 sections whose Fixable + reject share is ≥ 10 points above all suppliers' | Red **High** badge on that row; the attention list has "Leather from … has more defects than the rest" linking to `#supplier-quality`. If no data qualifies, mark BLOCKED with why    | Medium   |
| Q4  | FM   | **Rolls with the most rejects** → **Claim sheet** on the first roll                            | `/reports/claims/<id>`: heading "Claim sheet: roll …", supplier, roll · batch, "N of M rejected (P%)", one card per rejected section with its photo, section number, time and defects | High     |
| Q5  | FM   | On the claim sheet press **Save as PDF**, save it                                              | The print dialog opens; the preview has no sidebar or buttons; the PDF shows the photos. Attach the PDF                                                                               | High     |
| Q6  | FM   | Click **Suppliers CSV** and **Rolls CSV** on the card                                          | Both download for the range on screen; `suppliers.csv` has Rolls, Fixable %, Reject %, Top defect, High; `supplier-rolls.csv` has Roll, Batch, Supplier, Sections, Rejected, Defects  | Medium   |
| Q7  | FM   | A roll with no rejected section: open `/reports/claims/<its batch id>`                         | "This roll has no rejected sections, so there is nothing to claim."                                                                                                                   | Low      |
| Q8  | FM   | Run axe on `/reports?view=operations` and on a claim sheet                                     | No WCAG 2.1 A/AA violations                                                                                                                                                           | Medium   |

### Components removed

| ID  | Role  | Steps                                                | Expected result                                     | Priority |
| --- | ----- | ---------------------------------------------------- | --------------------------------------------------- | -------- |
| K1  | Admin | Settings tabs; then `/admin/settings?tab=components` | No Components tab; the URL shows the Thresholds tab | High     |
| K2  | any   | `/components` and `GET /api/v1/component-types`      | 404 page; 404                                       | Medium   |
| K3  | Admin | Audit log, filter old `component_type.*` rows if any | Old rows still list without an error                | Low      |

### Carried over from Phases 18 and 19 (never run)

| ID  | Steps                                                                                                                                                                                   | Expected result                                                                                                | Priority |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| P18 | `qa/handoffs/2026-10-19-phase-18-capture-page.md` section 5 and its access checks, **except S19** (the station's `run folder`, retired). In S18 ignore "or the Phase 17 station window" | As written there, with "Rework" read as "Fixable". S16's last line now reads "All 5 photos agree with predict" | High     |
| P19 | `qa/handoffs/2026-10-20-phase-19-cleanup.md` S2 to S6 (its S1 is the e2e run above)                                                                                                     | As written there                                                                                               | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                            | Expected                            |
| --- | ------------------------------ | ---------------------------------------- | ----------------------------------- |
| A1  | Quality Inspector              | `/reports/claims/<batchId>`              | `/forbidden`                        |
| A2  | System Admin                   | `/reports/claims/<batchId>`              | `/forbidden`                        |
| A3  | Quality Inspector (API)        | `GET /api/v1/reports/supplier-rolls.csv` | `403`                               |
| A4  | Shoe Constructor               | Sidebar; `/rework`                       | No "Cut around or clean"; forbidden |
| A5  | Floor Manager                  | `/reports/claims/<random uuid>`          | 404 page                            |

## 6. Out of scope / known issues

- Claude ran typecheck, lint, unit tests (591), build and the cv checks (ruff, mypy, pytest 81).
  No browser or e2e test was run (project rule); everything in section 5 is first-run.
- Internal names still say rework (`REWORK`, `/rework`, `rework:manage`, audit actions `rework.*`,
  the `rework` field in report JSON). That's deliberate (D-070); only what users read changed.
- The page eyebrow "Quality · Rework" from Dylan's mockup isn't shown: pages have no eyebrow; the
  sidebar's Quality section gives the context.
- An old **CPoint Camera** desktop shortcut on the laptop still points at the deleted `.cmd`.
  Deleting it is Dylan's step.
- The claim sheet is a print page, not a generated PDF file (D-072). Page breaks are the
  browser's.
- `demo:reset` and `SEED_DEMO_WEEK` now add two demo suppliers; not to be run on Dylan's database
  in this pass.
