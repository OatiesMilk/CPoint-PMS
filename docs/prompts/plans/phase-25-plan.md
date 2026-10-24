# Phase 25 plan — Pass or Reject: a final verdict, no Review Queue, Repair Station or Salvage

> **Status: draft, waiting for Dylan's go (2026-10-24).** Brief:
> `docs/prompts/factory-visit-changes.md` → `<phase_25>` (C-1, C-11 to C-15, C-19 to C-22, DQ-5,
> DQ-7; A-10 to A-13). Branch: none. The work stays uncommitted in `C:\dev\CPoint-PMS` until Dylan
> branches from the latest `main`.

## 0. Starting point

- Laptop `main` is at `2c55824` (#19, Phase 24), clean and level with `origin/main`.
- Newest QA: the Phase 24 report (18 of 18; e2e 84 passed, 0 failed, 1 skipped). Its one finding
  (old `procurement.*` audit rows) is kept history (D-091). **Nothing to fix first.** Note: that
  report and the QA notes sit on `docs/phase-24-qa` (`d371318`), which is **not in `main` yet**;
  Dylan opens or merges that PR.
- Last migration: `20261023090000_drop_procurement`. Last decision: D-092, so this phase writes
  **D-093** (Pass or Reject) and **D-094** (the three modules removed).
- Codex's earlier draft plan was not used as a source; everything below is from the brief and a
  search of the laptop repo on 2026-10-24.

## 1. What I reuse

| Need                    | Reused from                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| How a module is removed | Phase 24 (D-091) and Phase 20 (D-071): one hand-written migration, then the code, then a sweep with the removal check |
| "When found"            | D-053's `foundAtOrAbove` (50%) and the snapshot of the rule in force, kept                                            |
| Unknown classes         | Settings → Unknown classes (unchanged; `rawClassKey`, `isUnknownClass` stay)                                          |
| Two-colour charts       | The existing `--chart-pass` / `--chart-reject` tokens, rechecked with the dataviz validator in light and dark         |
| Field messages          | D-038's pattern in `admin-rules.ts` and `settings.validator.ts`                                                       |

## 2. The rule (`src/lib/decision-engine.ts`, pure)

- `DefectOutcome = "USABLE" | "NOT_ACCEPTED"`; `Verdict = "PASS" | "REJECT"`.
- Per detection of an active, known type: confidence ≥ `foundAtOrAbove` gives the type's outcome;
  below it counts for nothing. Inactive types are ignored (`ignoredKeys`).
- Any Not accepted → **Reject**, otherwise **Pass**. Any unknown key → **Reject** (A-12), with
  `unknownKeys` kept for Settings.
- Snapshot written on new scans: `{ foundAtOrAbove, outcomes: { key: "USABLE" | "NOT_ACCEPTED" } }`.
  `readSnapshot` still reads the old shapes (`rejectAtOrAbove`/`reworkAtOrAbove`, `actions`) so an
  old section's "Rules used" says "Decided by the earlier rule (before 24 Oct 2026)" plus whatever
  it stored.
- `validateThresholds` and the two-threshold helpers in `admin-rules.ts` go; one found-at check
  stays.

## 3. Schema and the migration `20261024090000_pass_or_reject`

Order (A-10: convert first, then drop):

1. `scans`: `aiVerdict`/`finalVerdict` REWORK → PASS, NEEDS_REVIEW → REJECT; a null
   `finalVerdict` (pending) takes the converted `aiVerdict`.
2. Recreate `Verdict` as `PASS | REJECT` (Postgres can't drop enum values: new type, cast, drop,
   rename). `finalVerdict` becomes required.
3. Drop from `scans`: `status`, `isOverride`, `overrideReason`, `decidedById`, `decidedAt`, their
   indexes and the `ScanDecidedBy` relation; drop enum `ScanStatus` (nothing else uses it).
4. `defect_types`: add `outcome DefectOutcome` from `action` (REWORK → USABLE, REJECT →
   NOT_ACCEPTED, null → NOT_ACCEPTED, the brief's ASSUMPTION), set NOT NULL with no default (the
   form makes it a required choice); drop `action`, `handling`, enums `DefectAction`,
   `DefectHandling`.
5. `cv_settings`: drop `rejectAtOrAbove`, `reworkAtOrAbove` (`activeBatchId` stays until Phase 26).
6. Drop `rework_tickets`, `salvage_items`, enums `ReworkStatus`, `SalvageStatus`, and the
   relations on `Batch`, `Scan`, `User`.

Audit rows (`rework.*`, `salvage.*`, `scan.decide`) stay as history, as D-091 did; the audit page
shows them without a link.

## 4. Access and the sidebar

Remove `scan:review`, `scan:decide`, `rework:manage`, `salvage:read`, `salvage:manage` and
`decisionPermissionFor`. Nav items Review queue, Repair Station and Salvage go. `/review`,
`/rework`, `/salvage` answer 404.

## 5. Screens (DESIGN.md + ui-craft; tokens only)

- **Badges, filters, legends, charts:** Pass and Reject only. `--chart-rework`, `--chart-review`
  and the badge's Fixable/Needs review variants go. Scans filter: no status filter; verdict
  Pass/Reject.
- **Capture → Last scan and Floor view:** green Pass ("Goes on to cutting") or red Reject ("For
  salvage"), each defect line marked Usable or Not accepted (or "Unknown class, rejected").
  `docs/STATION_SETUP.md`: two results, not four bins.
- **Settings → Defect types:** "When found: Usable or Not accepted" (required radio, both
  dialogs); "When Fixable" goes. **Thresholds** keeps "A defect counts as found at" and the
  early-model notice. **Unknown classes:** "Sections with these classes are rejected until you set
  the type up."
- **Admin home:** a line when unknown classes are waiting (A-12), linking Settings.
- **A section's page:** "Rules used" shows found-at and the outcomes; the decision panel and its
  server action go (C-21). No "Decided by".
- **A roll's page:** Passed, Rejected (for salvage), Total. No "In repair", "Salvage reused here",
  "pending review" link or open-repairs note on Finish roll.
- **Homes:** QI loses the flagged count and review links; FM loses Open repairs.
- **Reports → Quality:** the two-way split, the trend in two series, defects by type; the AI
  agreement figure goes.
- **Reports → Operations:** the Repair Station section and the repairs attention item go. Supplier
  quality: Reject % (for salvage) and the top defect; **High** = reject share well above the
  line's (same margin and minimum sections as now). A **For salvage** section: rejected sections
  per day (in the existing chart), top rolls, per supplier, per defect type.
- **CSVs:** `daily.csv` Passed, Rejected (for salvage), no Fixable/pending/agreement columns;
  `defects.csv` adds "Sections rejected"; `suppliers.csv` and `supplier-rolls.csv` drop Fixable.
  No new CSV.

## 6. API (`docs/API.md` updated)

Remove `/api/v1/rework/**`, `/api/v1/salvage/**`, `/api/v1/reports/repairs`,
`POST /api/v1/scans/{id}/decision`. `PUT /api/v1/settings/cv` takes `foundAtOrAbove` and
`earlyModelNotice` only (old keys refused with a named message). Defect types require `outcome`.
Every verdict is `PASS` or `REJECT`; scans lose `status` and the override fields.

## 7. Files

**Delete (about 30):** `src/app/(app)/review/**` (2), `rework/**` (5), `salvage/**` (3),
`scans/[id]/decision-panel.tsx`, `scans/actions.ts` (only `decideScanAction`);
`src/app/api/v1/rework/**` (2), `salvage/**` (4), `scans/[id]/decision/route.ts`,
`reports/repairs/route.ts`; `rework.service.ts`, `salvage.service.ts`, `scan-decision.service.ts`,
`outcome.{controller,model,validator}.ts`, `src/lib/outcome-rules.ts`,
`components/features/rework/open-reworks-card.tsx`, `components/features/batches/in-repair-badge.tsx`;
tests `outcome-rules.test.ts`, `rework-salvage.service.test.ts`, `scan-decision.test.ts`,
e2e `outcomes.spec.ts`, `rework-columns.spec.ts`, `cut-around-or-clean.spec.ts`.

**Change (about 60):** `prisma/schema.prisma`; `src/lib/{decision-engine,capture-rules,report-rules,
ops-rules,admin-rules,stage-machine,domain}.ts`; services `scan-ingest, scan-query, settings,
report, ops-report, batch, audit-query, demo-seed, demo-reset, bootstrap`; models `scan, report,
ops-report, batch, reference-data, demo-reset, cv-settings`; validators `scan, settings`;
`server/lib/{leather-scan.ts,cv/mapper.ts}`; `policies/{permissions,navigation}.ts`; pages and
parts listed in §5; `verdict-badge.tsx`, `badge.tsx`, `charts/*`, `scans/*` widgets,
`reports/home-cards.tsx`, `production-cards.tsx`, `attendance-card.tsx`, `sidebar.tsx`,
`tokens.css`, `globals.css`; `scripts/{cv-simulate,demo-reset}.ts`; `cv/cpoint_cv/{preview,config,
evaluate,summary,overlay,mapper,cli}.py`, `cv/config.example.toml`, `cv/README.md`,
`cv/MODEL_CARD.md`, `cv/tests/*`; `docs/API.md`, `docs/STATION_SETUP.md`.

**Add:** the migration.

## 8. Python preview (`cv/cpoint_cv`)

Same rule as §2: `[preview] found_at_or_above` and `[preview.outcomes]` (`crease = "USABLE"`,
…); verdict PASS or REJECT; unknown → REJECT. Old `reject_at_or_above`, `rework_at_or_above` and
`[preview.actions]` in a local `config.toml` give a warning that names them and the new keys
(Dylan's git-ignored config keeps working). `evaluate`'s `labels.csv` uses Pass/Reject (the five
sample labels converted the same way). The overlay colours follow.

## 9. Seeds

- **Bootstrap (DQ-7, A-13):** a new database gets crease and scratch Usable, cut and hole Not
  accepted; abrasion and dirt stay as they are today. Existing rows are never overwritten (D-017).
- **Demo week:** Pass and Reject only; no repairs, salvage or corrections; one section with an
  unknown class, rejected and listed under Unknown classes.
- **`demo:reset`:** sets A-13's outcomes; no rework or salvage to clear.
- **Simulator:** keeps `sim-unknown` (now a Reject).

## 10. Tests

- Unit: `decision-engine.test.ts` gets the brief's cases (none; 0.4999 and 0.50; Usable + Not
  accepted; only Usable; inactive Not accepted ignored; unknown alone and beside Usable; several
  types; an old snapshot read back). Updated: `scan-ingest` (no rework/salvage rows),
  `leather-scan`, `cv-mapper-parity`, `settings.service`, `admin-rules`, `capture-rules`,
  `report-rules`, `report.service`, `ops-rules`, `ops-report.service`, `batch.service`,
  `permissions`, `validator-messages`, `demo-seed`, `demo-reset`, and the others the search lists.
- pytest: preview, config (old keys warn), evaluate, summary.
- E2E, **written, not run** (Codex runs them): delete the three specs; update `cv`, `capture`,
  `reports`, `supplier-quality`, `admin`, `smoke`, `auth`.

## 11. Docs (wrap-up, no commit)

STATUS, SESSION_LOG, DECISIONS (D-093, D-094; mark D-007, D-011's thresholds, D-020's unknown
rule, D-021, D-022, D-028, D-053's Rework, D-070, D-073, D-074's four colours superseded; amend
D-025, D-033, D-072), ROADMAP, API, STATION_SETUP, cv README and model card; QA handoff
`qa/handoffs/2026-10-24-phase-25-pass-or-reject.md` and `qa/CODEX_PROMPT_PHASE_25.md`; the vault's
Daily note and `Notes/Phases/Phase 25 - Pass or reject.md`.

## 12. Checks, in checkpoints

1. Schema + migration + `db:generate` + engine and its tests → typecheck.
2. Removals and services → `npm run check`.
3. Screens, seeds, Python → `npm run check`, `cd cv && ruff check . && mypy && pytest`.
4. The removal check (brief §9), output pasted in the report.

The migration and checks run on the laptop. Dylan backs up first (the vault's command), then
`npm run db:deploy`; after QA, `npm run demo:reset -- --yes` for a fresh demo week.

## 13. Where the brief and the code differ

- `decidedAt` is shown on a section's page and drives demo timing; with no decisions it goes
  (`capturedAt` is the time).
- `ScanStatus` has no other user, so it is dropped (the brief left that to the plan).

## 14. Questions (recommended option first)

1. **An unknown class:** Reject and list it in Settings (recommended, A-12), or Pass with a
   warning?
2. **`aiVerdict` and `finalVerdict`:** keep both, always equal (recommended: smaller migration,
   old reports keep working), or merge into one `verdict`?
3. **Types with no "when found" action today** (abrasion, dirt, any test type) become Not
   accepted (the brief's ASSUMPTION). OK?
