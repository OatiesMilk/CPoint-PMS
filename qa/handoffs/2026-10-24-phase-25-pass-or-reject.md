# QA handoff: Phase 25, Pass or Reject

| Field           | Value                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Date            | 2026-10-24                                                                                              |
| Feature         | phase-25-pass-or-reject                                                                                 |
| Branch          | `main` checkout in `C:\dev\CPoint-PMS` at #19, **uncommitted** (or Dylan's new branch with it)          |
| Spec / prompt   | `docs/prompts/factory-visit-changes.md` → `<phase_25>`; plan `docs/prompts/plans/phase-25-plan.md`      |
| Decisions       | D-093 (Pass or Reject, the camera's verdict is final), D-094 (Review Queue, Repair Station, Salvage go) |
| Written by      | Claude                                                                                                  |
| Previous report | `qa/reports/2026-10-23-phase-24-remove-procurement.md` (PASS, on `docs/phase-24-qa`)                    |

CPoint said on the 23 October visit that a section is usable or not, and that nobody corrects the
camera (C-11, C-12, C-19 to C-21). Dylan approved the plan with "yes to all": an unknown class
rejects the section and is listed in Settings; `aiVerdict` and `finalVerdict` both stay; a type
with no "when found" action became Not accepted.

## 1. What changed

- **Two results only:** every section is **Pass** or **Reject**, decided by the camera at once and
  final. Fixable and Needs review are gone from badges, filters, legends, charts, CSVs and the
  API.
- **The rule:** each defect type has an outcome, **Usable** or **Not accepted**. A detection at or
  above "A defect counts as found at" (50%) gives its type's outcome; below it, nothing. Any Not
  accepted → Reject; otherwise Pass. Inactive types are ignored. An **unknown class** → Reject.
- **Settings (Admin):**
  - Defect types: "When found" is a required choice, **Usable (Pass)** or **Not accepted
    (Reject)**, in the new and the edit dialog. "When Fixable" is gone.
  - Thresholds: only "A defect counts as found at" and the early-model notice; the two confidence
    thresholds are gone.
  - Unknown classes: listed as before; the Admin home shows an alert while any are waiting
    ("Those sections are rejected until you add the type and choose whether it is Usable or Not
    accepted.").
- **Removed (404):** `/review`, `/rework`, `/salvage`, `/api/v1/rework/**`, `/api/v1/salvage/**`,
  `/api/v1/reports/repairs`, `POST /api/v1/scans/{id}/decision`. The nav items Review queue,
  Repair Station and Salvage are gone for every role.
- **A section's page:** no decision panel or override; "The camera’s verdict is final."; Rules
  used lists found-at and each type's outcome; each detection row says Usable or Not accepted.
  A section from before Phase 25 says it was decided by the earlier rule.
- **A roll's page:** Passed sections, Rejected (for salvage), Total. No In repair badge, salvage
  reused or open-repairs note on Finish roll.
- **Capture and Floor view:** Last scan and the band are green **Pass** ("Goes on to cutting") or
  red **Reject** ("Set aside for salvage"). `docs/STATION_SETUP.md` has two bins.
- **Homes:** the QI home has no flagged count or review link; the FM home has no Open repairs.
- **Reports → Quality:** tiles Scanned, Pass, **Reject (for salvage)**; no AI agreement figure;
  defects by type with a Rejected column; the trend has two series.
- **Reports → Operations:** a **Reject rate** KPI; a **For salvage** card (rejected sections, link
  to the rejected scans); Supplier quality shows Pass % and Reject %, High from the reject share;
  no Repair Station section or repairs attention item.
- **CSVs:** `daily.csv` Date (Manila), Scanned, Pass, Reject (for salvage); `defects.csv` adds the rejected
  count; `operations.csv`, `suppliers.csv` and `supplier-rolls.csv` have no Fixable column.
- **Data:** migration `pass_or_reject` converts first (Fixable → Pass, Needs review → Reject, a
  pending scan takes its converted camera verdict, a person's decision is kept as the final
  verdict), then drops `rework_tickets`, `salvage_items`, the scan status and override columns,
  the defect type's action and handling, and the two thresholds. A type's Rework → Usable,
  Reject or no action → Not accepted. Audit rows of the removed modules stay as history.
- **Seeds:** a new database gets crease and scratch Usable, cut, hole, abrasion and dirt Not
  accepted. `demo:reset` sets cut and hole Not accepted, crease and scratch Usable, abrasion and
  dirt off. The demo week has Pass and Reject only and at least one rejected section with an unknown
  class.

## 2. Files touched

| File                                                                                                    | Change                                                                           |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261024090000_pass_or_reject/`                              | Two verdicts, outcomes, removed tables and columns                               |
| `src/app/(app)/{review,rework,salvage}/**`, `scans/[id]/decision-panel.tsx`, `scans/actions.ts`         | Deleted                                                                          |
| `src/app/api/v1/{rework,salvage}/**`, `scans/[id]/decision`, `reports/repairs`                          | Deleted                                                                          |
| `src/server/services/{rework,salvage,scan-decision}.service.ts`, `outcome.{controller,model,validator}` | Deleted                                                                          |
| `src/lib/decision-engine.ts` (and `outcome-rules.ts` deleted)                                           | The Pass or Reject rule                                                          |
| `src/lib/{admin,capture,report,ops,stage}-rules`, `domain.ts`                                           | Two verdicts, found-at only, no repairs                                          |
| `src/server/{services,models,validators,controllers}/**`                                                | Ingest, settings, reports, batches, seeds and reset on the new rule              |
| `src/server/policies/{permissions,navigation}.ts`, `sidebar.tsx`                                        | Five permissions and three nav items removed                                     |
| `src/app/(app)/{admin,batches,camera,scans,reports,floor-manager,quality-inspector,production}/**`      | Screens as in §1                                                                 |
| `src/components/**` (badge, verdict badge, charts, cards)                                               | Two verdicts; In repair badge, Open repairs card and verdict flow deleted        |
| `src/styles/tokens.css`, `src/app/globals.css`                                                          | Chart Pass/Reject re-stepped; `--rework`/`--review` renamed `--caution`/`--info` |
| `cv/cpoint_cv/**`, `cv/tests/**`, `cv/config.example.toml`, `cv/README.md`, `cv/MODEL_CARD.md`          | The preview uses the same rule; old config keys warn                             |
| `tests/unit/**`                                                                                         | Three files deleted, 16 updated                                                  |
| `tests/e2e/{outcomes,rework-columns,cut-around-or-clean}.spec.ts`                                       | Deleted                                                                          |
| `tests/e2e/{cv,reports,admin,auth,smoke,capture,supplier-quality}.spec.ts`, `cv-helpers.ts`             | Updated for Pass or Reject (written, not run)                                    |
| Docs                                                                                                    | API, DESIGN, STATION_SETUP, master spec, ROADMAP, STATUS, DECISIONS, SESSION_LOG |

Database migration in this change: **yes** (`pass_or_reject`). It is **not** applied to the dev
database yet: Dylan backs up first, then runs `npm run db:deploy`. Claude ran it on a scratch
database with old rows (Fixable, pending Needs review, an override, a repair ticket, a salvage
item, types with Rework, Reject and no action): the result was as in §1, and `prisma migrate diff`
found no difference from the schema.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, `npm install` done, `.env` filled in (`AUTH_SECRET`,
`BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`), and **Dylan's backup
taken and `pass_or_reject` applied** (prompt step 2 checks this).

```bash
npm run db:up
npm run db:deploy      # nothing pending once Dylan has applied pass_or_reject
npm run db:generate
npm run build
npm run start          # http://localhost:3000 (PORT=3001 if 3000 is taken)
```

Simulator (for S4 and S5): `npm run cv:token` gives a token (or use the one in `.env` as
`CV_DEVICE_TOKEN`); start a roll as the FM, then `npm run cv:simulate -- --count 10 --interval 2`.

E2E (all of it): `npm run test:e2e`.

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD` from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

- After the migration, the dev database's old Fixable sections read Pass and its Needs review
  sections read Reject.
- Anything changed in Settings for S6 to S9 is put back afterwards (the prompt lists it).

## 5. Test scenarios

| ID  | Role              | Steps                                                                                                         | Expected result                                                                                                                                                                                                                                                            | Priority |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Every role        | Sign in as each. Read the sidebar.                                                                            | No Review queue, Repair Station or Salvage item. Everything else as before Phase 25 opens.                                                                                                                                                                                 | High     |
| S2  | QI, FM            | Open Scans. Use the verdict filter.                                                                           | Verdict choices Pass and Reject only; no status filter; every badge reads Pass or Reject.                                                                                                                                                                                  | High     |
| S3  | QI                | Open a rejected section's page.                                                                               | Boxes drawn; "The camera’s verdict is final."; Rules used shows found-at and the outcomes; detections say Usable or Not accepted; no Override or decision button.                                                                                                          | High     |
| S4  | FM, then QI       | Start a roll; run the simulator (10 scans). Watch the QI home and Scans.                                      | Every new scan is Pass or Reject at once; a `sim-unknown` scan is Reject; nothing waits for review.                                                                                                                                                                        | High     |
| S5  | QI (or FM)        | Capture page with the fake or a real camera; capture twice; open Floor view and capture.                      | Last scan and the band are green Pass "Goes on to cutting" (or red Reject "Set aside for salvage"); never orange or blue.                                                                                                                                                  | High     |
| S6  | Admin             | Settings → Defect types → New type. Save without choosing "When found".                                       | The form refuses it with a message under "When found" that names the fix. Choose Usable, save: the row shows Usable (Pass).                                                                                                                                                | High     |
| S7  | Admin             | Edit that type to Not accepted and save. Then turn it off and back on.                                        | The row shows Not accepted (Reject); no "When Fixable" field anywhere.                                                                                                                                                                                                     | Medium   |
| S8  | Admin             | Settings → Thresholds. Change "A defect counts as found at" to 45, save; put it back to 50.                   | Only that field and the early-model notice; the save works and the audit log has a row. No Reject or Fixable threshold.                                                                                                                                                    | High     |
| S9  | Admin             | After S4's unknown scan: open the Admin home, then Settings → Unknown classes.                                | The home alert names the class and says those sections are rejected; Unknown classes lists it.                                                                                                                                                                             | High     |
| S10 | FM                | Open a roll with scans; try Finish roll.                                                                      | Passed sections, Rejected (for salvage), Total; no In repair or salvage reused; Finish has no open-repairs note.                                                                                                                                                           | High     |
| S11 | QI, FM            | Open each home.                                                                                               | QI: no flagged count or review link. FM: no Open repairs card. Both load without error.                                                                                                                                                                                    | Medium   |
| S12 | FM                | Reports → Quality.                                                                                            | Tiles Scanned, Pass, Reject (for salvage); no AI agreement; defects by type has a Rejected column; the trend has two series (green and red) with a legend.                                                                                                                 | High     |
| S13 | FM                | Reports → Operations.                                                                                         | Reject rate KPI; a For salvage card linking to the rejected scans; Supplier quality with Pass % and Reject %; no Repair Station section or repairs attention item.                                                                                                         | High     |
| S14 | FM                | Download every CSV on Quality and Operations.                                                                 | No Fixable, Rework, pending or agreement column; `daily.csv` header is Date (Manila), Scanned, Pass, Reject (for salvage).                                                                                                                                                 | Medium   |
| S15 | FM                | Open a claim sheet (Supplier quality → Claim sheet).                                                          | Percentages of the roll's sections; "… passed. The camera’s verdict is final; rejected sections are set aside for salvage."; no person named.                                                                                                                              | Medium   |
| S16 | Admin             | Audit log: filter by an old `rework.*` or `scan.decide` row (if the dev database has one).                    | The row is listed as history with no broken link.                                                                                                                                                                                                                          | Low      |
| S17 | Any               | Light and dark mode on Reports → Quality and Operations.                                                      | Pass and Reject are told apart in both; text stays readable.                                                                                                                                                                                                               | Medium   |
| U1  | (throwaway stack) | Start it with the demo week (prompt step 7). Sign in as the FM and the Admin.                                 | Demo week loaded with Pass and Reject only; at least one rejected section with an unknown class (the newest roll's last one; the random mix adds a few more), listed under Unknown classes; Settings → Defect types: crease and scratch Usable, cut and hole Not accepted. | High     |
| U2  | (throwaway stack) | From the host, against the throwaway database only: `npm run demo:reset`, then `npm run demo:reset -- --yes`. | The dry run lists what it would remove (no repair or salvage line) and changes nothing; the reset ends with "Defect types: cut and hole Not accepted, crease and scratch Usable, abrasion and dirt off." and seeds a fresh demo week with no error.                        | High     |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                       | Expected                       |
| --- | ------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------ |
| A1  | Everyone (signed in as the QI) | `/review`, `/rework`, `/salvage`                                                    | The app's 404 page for each    |
| A2  | Everyone (signed in as the FM) | `GET /api/v1/rework`, `GET /api/v1/salvage`, `GET /api/v1/reports/repairs`          | 404                            |
| A3  | QI                             | `POST /api/v1/scans/<a scan id>/decision` (from the browser console or the e2e API) | 404                            |
| A4  | Admin                          | `PUT /api/v1/settings/cv` with `rejectPercent` and `reworkPercent`                  | 422 with a message naming them |
| A5  | Shoe Constructor               | `/scans`, `/reports`                                                                | `/forbidden`                   |

## 6. Out of scope / known issues

- Phase 26 changes capture (constructors' phones, rolls started there); this run doesn't test it.
- The cut's 3-inch rule waits for Phase 30B; a cut is Not accepted at any length until then.
- Claude never ran the e2e suite; the updated specs are Codex's first run.
- Old audit rows and `docs/SESSION_LOG.md` still mention Fixable, review and salvage as history.
- The device checks at the real station stay with Dylan (Phase 30A).
