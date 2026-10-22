# QA handoff: Phase 20 QA fixes (run 2)

| Field           | Value                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| Date            | 2026-10-20                                                                         |
| Feature         | phase-20-qa-fixes                                                                  |
| Branch          | `main` @ `cc612ee`, uncommitted (Phase 20 and these fixes are in the working tree) |
| Spec / prompt   | `docs/prompts/plans/phase-20-qa-fixes-plan.md` (approved by Dylan, 2026-10-20)     |
| Written by      | Claude                                                                             |
| Previous report | `qa/reports/2026-10-20-phase-20-website-camera-and-reports.md` (FAIL)              |

## 1. What changed

- **Review queue (QI):** the middle decision button reads **Fixable**, not Rework.
- **Scan → Override decision (QI):** the dialog names the camera's verdict the way the badge does
  (Pass, Fixable, Reject, Needs review) and says the section moves to match: onto or off the Cut
  around or clean board, or into or out of Salvage. No "rework" or "repair or salvage record".
- **Reports → Operations (FM, QI):** the Cut around or clean card says "Fixable leather sections,
  with how far each has got"; the batch list says "N being handled", not "N in repair".
- **Settings → Thresholds (Admin):** the server's own checks now show under the field they name
  once you leave it (Tab or click away), then update live while it is wrong. Fixable 95 with
  Reject 90 shows **"Fixable must start below Reject (90%)."** under "Fixable at or above". An empty
  field shows "Enter a percentage between 0 and 100." Saving with an error marks every field. The
  preview box says "Fix the value marked above to see what the camera will decide." when a value
  is wrong, and keeps the old line only when a field is empty.
- **Rolls CSV (FM):** the header is `Roll,Batch,Supplier,Sections,Rejected,Defects`.
- **E2E tests:** the 10 failures from run 1 were all in the tests and are updated (see section 3).
- Nothing else changed. No migration.

## 2. Files touched

| File                                                 | Change                                                                                                     |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/app/(app)/review/review-row-actions.tsx`        | Button label Fixable                                                                                       |
| `src/app/(app)/scans/[id]/decision-panel.tsx`        | Override dialog wording, verdict label                                                                     |
| `src/components/features/verdict-badge.tsx`          | New `verdictLabel()` shared with the dialog                                                                |
| `src/app/(app)/reports/_components/ops-sections.tsx` | Card description                                                                                           |
| `src/app/(app)/reports/_components/ops-parts.tsx`    | "being handled"                                                                                            |
| `src/app/(app)/admin/settings/thresholds-form.tsx`   | Inline validation on blur, then live                                                                       |
| `src/server/services/ops-report.service.ts`          | Rolls CSV header `Sections`                                                                                |
| `tests/e2e/auth.spec.ts`                             | Capture in the FM and QI nav                                                                               |
| `tests/e2e/cut-around-or-clean.spec.ts`              | Wait for the home URL after sign-in                                                                        |
| `tests/e2e/outcomes.spec.ts`                         | Card names `… · section #1`                                                                                |
| `tests/e2e/rework-columns.spec.ts`                   | Column button `To handle, N sections`                                                                      |
| `tests/e2e/smoke.spec.ts`                            | Creates its own stock item; card name `… · section #2`                                                     |
| `tests/e2e/supplier-quality.spec.ts`                 | Missing claim sheet: checks the 404 page content (the Reports `loading.tsx` streams, so the status is 200) |

Database migration in this change: **no**

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up
npm run db:deploy
npm run build
npm run dev            # PORT=3001 if port 3000 is taken by another project
```

Health check: `/api/health` returns OK.

Automated tests (run the full suite once):

```bash
npm run test:e2e
```

The 10 tests that failed in run 1 and should now pass:

| Run 1 # | Test                                                                                                           |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| 1-2     | `auth.spec.ts`: manager and inspector "signs in, lands on their home and sees only their nav"                  |
| 3       | `cut-around-or-clean.spec.ts`: "the board says what each Fixable section needs, and how it ended"              |
| 4       | `cut-around-or-clean.spec.ts`: "Settings sets how a Fixable section of a type is handled; components are gone" |
| 5       | `outcomes.spec.ts`: "a batch completes with a repair open, is tagged Being handled, …"                         |
| 6       | `outcomes.spec.ts`: "Undo in the toast puts a repair back where it was"                                        |
| 7       | `rework-columns.spec.ts`: "Board columns collapse, persist, and the next column moves up when stacked"         |
| 8       | `smoke.spec.ts`: "Floor Manager journey: register a roll as a batch, start it, receive stock, read the report" |
| 9       | `smoke.spec.ts`: "Quality Inspector journey: settle a review-queue scan, then repair a section"                |
| 10      | `supplier-quality.spec.ts`: "a claim sheet for a batch that doesn't exist is a 404"                            |

### Throwaway Docker stack (for U1 to U3)

Run 1 blocked three checks because Dylan's database has 23+ batches at Preparation and no received
request. Use a separate stack so his data is never touched:

```bash
# PowerShell
$env:APP_PORT="3005"; $env:DB_PORT="5440"; $env:SEED_DEMO_USERS="true"; $env:SEED_DEMO_WEEK="true"
docker compose -p cpoint-qa up --build -d
```

- If the `certs/` mount gets in the way, use the same compose override with an empty certificate
  folder under the artifacts folder that run 1 used.
- The demo week gives 14 batches, three suppliers (Marikina Leather has more defects) and a
  received request with a proof photo.
- When done: `docker compose -p cpoint-qa stop`. Never `down -v`, and never touch the default
  project's stack or volumes.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data: any NEEDS_REVIEW scan (R1), any scan with a final verdict (R2, R3), any batch with an open
Fixable section (R4). The simulator makes them: `npm run cv:simulate -- --count 20 --interval 1`.

## 5. Test scenarios

### Re-tests of run 1 failures

| ID  | Role  | Steps                                                                                                                              | Expected result                                                                                                                                                                                                     | Priority |
| --- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | QI    | Open **Review queue**                                                                                                              | Each row's buttons are **Pass**, **Fixable**, **Reject**. Clicking Fixable on one shows a toast "… marked Fixable."                                                                                                 | High     |
| R2  | QI    | Open a scan the camera decided **Fixable** → **Override decision…**                                                                | The dialog says "The camera decided **Fixable**." and "the section moves to match: onto or off the Cut around or clean board, or into or out of Salvage." No "rework" or "repair". Close with **Keep the decision** | High     |
| R3  | QI    | Open a scan decided **Pass**, then one decided **Reject**, and open Override on each                                               | The dialog names **Pass** and **Reject** with a capital letter, same as the badge                                                                                                                                   | Medium   |
| R4  | FM    | **Reports → Operations**, the **Cut around or clean** card and the batch list                                                      | Card: "Fixable leather sections, with how far each has got. Updated live, not by the range." A batch with open sections shows "N being handled", never "in repair"                                                  | Medium   |
| R5  | Admin | **Settings → Thresholds**. Reject at or above stays 90. Type **95** in **Fixable at or above**, then press Tab                     | Under Fixable: **"Fixable must start below Reject (90%)."** in red, the field is marked invalid, and the preview box says "Fix the value marked above to see what the camera will decide."                          | High     |
| R6  | Admin | Continue R5: change Fixable to **60**                                                                                              | The message clears straight away and the preview box shows the Reject / Fixable / Pass bands again                                                                                                                  | High     |
| R7  | Admin | Restore the original values. Clear **Fixable at or above** entirely and press Tab                                                  | "Enter a percentage between 0 and 100." under that field. Put the value back; nothing is saved unless you click Save thresholds                                                                                     | Medium   |
| R8  | Admin | Set Reject to **50** while Fixable is **60**, then press Tab out of Reject                                                         | The Fixable-below-Reject message appears under **Fixable at or above** (it is one rule). Restore 90 / 60 and don't save                                                                                             | Low      |
| R9  | FM    | **Reports → Operations → Supplier quality**, click **Rolls CSV**                                                                   | First row is exactly `Roll,Batch,Supplier,Sections,Rejected,Defects`. **Suppliers CSV** is unchanged from run 1                                                                                                     | High     |
| R10 | Any   | Walk through the pages the run 1 copy scan covered (Review, scan detail and Override, Operations, Cut around or clean, home pages) | No user-visible "Rework", "repair station", "In repair", "camera station" or "Components". List any you find with page and screenshot                                                                               | Medium   |

### Unblocked from run 1 (in the throwaway `cpoint-qa` stack on port 3005)

| ID  | Role        | Steps                                                                                                                                                            | Expected result                                                                                                                                                                                                                                                                                                       | Priority |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| U1  | FM          | **P20 Q3.** Reports → Operations, range **30 days**. Look at Supplier quality and the attention list                                                             | If a supplier has ≥ 30 sections and a Fixable + reject share ≥ 10 points above the line's: a red **High** badge on its row and "Leather from … has more defects than the rest" in the attention list linking to `#supplier-quality`. If the demo week doesn't qualify, make data as in the note below and check again | Medium   |
| U2  | FM          | **P19 S5.** Open a scan's page, then Procurement → the **Received** request → its proof photo                                                                    | Both images load                                                                                                                                                                                                                                                                                                      | Medium   |
| U3  | FM, then QI | **P18 S7.** As the FM, complete or move every batch that is at Preparation (the demo week has only a few). Then, as the QI, open **Capture** and wait up to 20 s | "No batch is at Preparation, so Capture is off." with a Start a batch link; Capture is disabled with "Capture is off until a batch is at Preparation."                                                                                                                                                                | High     |

**U1 data, only if needed** (in the `cpoint-qa` stack only): as the Admin add a supplier "QA
Outlier Leather" (Settings → Suppliers) and create a device token (Admin → API tokens). As the FM
register and start two batches: A with that supplier, B with any other. Post scans with
`POST http://localhost:3005/api/v1/scans` (`Authorization: Bearer <token>`, multipart `image` any
JPEG, `batchId`, `source=SIMULATOR`, `detections` JSON): to A, 25 scans with
`[{"classKey":"hole","confidence":0.95,"box":{"x":0.1,"y":0.2,"width":0.2,"height":0.2}}]` and 10
with `[]`; to B, 35 with `[]`. Range **Today**: A is 71% against a line of 36%, so A must be High.
Do U1 before U3, because U3 moves the batches out of Preparation. A small script for this goes
under `qa/reports/artifacts/…`; never print the token.

### Access checks

Unchanged from run 1 (all passed). Re-run only P20 A3 (QI requests `supplier-rolls.csv` → 403),
since that export changed.

| ID  | Role that must NOT have access | URL or action                            | Expected |
| --- | ------------------------------ | ---------------------------------------- | -------- |
| A1  | Quality Inspector              | `GET /api/v1/reports/supplier-rolls.csv` | `403`    |

## 6. Out of scope / known issues

- **Still needs Dylan** (don't attempt; list them under "Needs Dylan" again): P18 S3 (leather or
  a leather photo under the webcam), S12 (a second device over plain HTTP), S13 to S15 (iPhone
  Safari with a trusted certificate, back camera, permission denial), S18 (another app holding the
  webcam).
- Everything that passed in run 1 doesn't need re-running, except through the full e2e suite.
- "The destination stream closed early." lines in the e2e web-server log were harmless in run 1.
- Internal names (`/rework` URL, `REWORK` in the API and database, `rework.*` audit actions) stay
  as they are on purpose; only what a user reads says Fixable.
