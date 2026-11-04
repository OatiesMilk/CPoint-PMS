# QA handoff: Reports clean-up (rolls returned to supplier) and reports by roll

| Field           | Value                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| Date            | 2026-11-04                                                                                                 |
| Feature         | reports-cleanup                                                                                            |
| Branch          | uncommitted in `C:\dev\CPoint-PMS` on c8c68dc (Phase 30E-2)                                                |
| Spec / prompt   | `docs/prompts/plans/reports-cleanup-plan.md` (D-116), `docs/prompts/plans/reports-by-roll-plan.md` (D-117) |
| Written by      | Claude                                                                                                     |
| Previous report | none (this feature); 30E-2 has its own runs                                                                |

## 1. What changed

- **Floor Manager, Reports → Rolls:** the Status filter offers only **Not yet scanned**,
  **Scanning passed** and **Returned to supplier** (plus All statuses). A scanned roll whose defects
  cover more than the limit (Settings, 10%) of its area reads **Returned to supplier** in its
  Status; the old "Too many defects" badge is gone. Rolls being scanned or removed show only under
  All statuses. The roll's page says "Returned to supplier: defects cover 16.7% of this roll, over
  the 10% limit."
- **"for salvage" is gone** from every report, chart legend, CSV header, the FM home's Rolls today
  card, Inventory's roll table, a scan's page and Capture. Operations' "For salvage" card is gone
  (D-117). Capture's Last scan reads "Reject: this part of the roll is not for
  cutting."; Floor view "Set aside, not for cutting".
- **Reports → Materials:** the **8 weeks to selected** and **Per 100 pairs** columns are gone (and
  `materials-used.csv` has no "Used per 100 pairs"). **Leather rolls** has a new **Returned to
  supplier** column per week.
- **Supplier quality** (Operations): see D-117 below.
- **System Admin, Settings → Thresholds:** the label reads "Mark a roll Returned to supplier when
  defects cover more than". **Shoe Constructor**, Finish roll over the limit: "… over the 10%
  limit, so it is marked Returned to supplier. Set it aside for the Floor Manager."

- **D-117, the reports count whole rolls, not sections.** Each roll finished at Capture counts once,
  on its Manila finish day, as **Scanning passed** or **Returned to supplier** (the rule above; a
  roll that couldn't be measured is passed). A shot's own Pass or Reject now shows only on the
  roll's page, a scan's page and Capture.
  - **Quality tab:** tiles **Rolls scanned**, **Scanning passed** (% and rolls), **Returned to
    supplier**; chart **Rolls scanned per day** (Scanning passed and Returned to supplier); Defects
    by type has **Rolls found on** and **Returned**; Daily summary by rolls; the empty state reads
    "No rolls scanned in this range".
  - **Operations tab:** tiles Pairs finished (sub "all pairs the QI counted at Finish batch,
    failed ones included"), Failed inspection, Of quota, **Rolls passed** and **Returned to
    supplier** (each "N of M rolls scanned"). **Gone:** Rolls finished, Rolls open, First-pass
    yield, Reject rate and the Rejected sections card. The checkpoint card shows rolls scanned,
    passed and returned and the top defects by rolls. Daily summary: Rolls started, Rolls scanned,
    Scanning passed, Returned to supplier.
  - **Supplier quality:** Supplier, Rolls, Scanning passed, Returned to supplier, Returned %, Top
    defect (no Sections, Pass %, Reject % or Defect area); High when Returned % is 10 points over the
    line's and the supplier has at least 5 rolls. **Rolls with the most defects** (was "most
    rejects"): Roll · tag, Supplier, Defect %, Status, Defects, View, Claim sheet.
  - **FM home:** Rolls today (Rolls scanned, Returned to supplier, rolls open) and Daily summary
    (Rolls scanned, Scanning passed, Returned to supplier) for yesterday and today.
  - **CSVs:** `daily.csv` Date (Manila), Rolls scanned, Scanning passed, Returned to supplier;
    `defects.csv` Defect type, Class key, Rolls found on, Returned to supplier; `operations.csv`
    Date (Manila), Rolls started, Rolls scanned, Scanning passed, Returned to supplier;
    `suppliers.csv` Supplier, Rolls, Scanning passed, Returned to supplier, Returned %, Top
    defect, High; `supplier-rolls.csv` Roll, Tag number, Supplier, Defect %, Status, Defects.

## 2. Files touched

| File                                                                                                                                                                                                                                                                                                       | Change                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/lib/roll-rules.ts`                                                                                                                                                                                                                                                                                    | `rollReportStatus`, `isReturnedToSupplier`, the three labels; finish line |
| `src/lib/domain.ts`                                                                                                                                                                                                                                                                                        | In stock reads "Not yet scanned"                                          |
| `src/components/features/rolls/roll-status-badge.tsx`, `defect-share.tsx`                                                                                                                                                                                                                                  | badge by report status; no Too many defects badge                         |
| `src/app/(app)/reports/rolls/page.tsx`, `roll-filters.tsx`, `[id]/page.tsx`                                                                                                                                                                                                                                | three-status filter, Rejected, the Returned line                          |
| `src/server/validators/roll.validator.ts`, `src/server/models/roll.model.ts`, `src/server/services/roll.service.ts`                                                                                                                                                                                        | `?status=NOT_SCANNED\|PASSED\|RETURNED`                                   |
| `src/app/(app)/reports/materials/page.tsx`, `src/server/services/materials.service.ts`, `src/server/models/materials.model.ts`, `src/lib/stock-rules.ts`                                                                                                                                                   | trend and Per 100 pairs removed; `rollsReturnedByDay`                     |
| `src/app/(app)/reports/_components/*`, `reports/page.tsx`, `reports/claims/[rollId]/page.tsx`, `src/components/features/charts/*`, `src/components/features/reports/home-cards.tsx`, `src/server/services/{ops-report,report}.service.ts`, `src/server/models/ops-report.model.ts`, `src/lib/ops-rules.ts` | "for salvage" wording; Supplier quality Returned to supplier              |
| `src/app/(app)/inventory/[id]/page.tsx`, `scans/[id]/page.tsx`, `camera/capture/last-scan.tsx`, `src/lib/capture-rules.ts`, `admin/settings/page.tsx`, `admin/settings/thresholds-form.tsx`, `src/lib/admin-rules.ts`                                                                                      | wording                                                                   |
| `tests/unit/*` (materials, stock-rules, report, ops-report, roll.service, roll.validator, return-decision, capture-rules), `tests/e2e/{rolls,returns,reports,smoke,inventory,admin}.spec.ts`                                                                                                               | updated                                                                   |

| D-117: `src/server/models/{report,ops-report}.model.ts`, `src/server/services/{report,ops-report}.service.ts`, `src/lib/ops-rules.ts`, `src/app/(app)/reports/_components/{quality-view,operations-view,ops-sections}.tsx`, `src/components/features/charts/verdict-{legend,trend-chart}.tsx`, `src/components/features/reports/home-cards.tsx` | counts by roll; cards removed |
| D-117 tests: `tests/unit/{report.service,ops-report.service,ops-rules}.test.ts`, `tests/e2e/{reports,supplier-quality}.spec.ts` | rewritten for rolls |

Database migration in this change: **no**.

## 3. How to run the app locally

As in `qa/CODEX_PROMPT_REPORTS_CLEANUP.md`: database container only, `npm run dev`, no reset.

Existing automated tests that cover this area:

```powershell
npx playwright test tests/e2e/rolls.spec.ts tests/e2e/returns.spec.ts tests/e2e/reports.spec.ts tests/e2e/supplier-quality.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts tests/e2e/admin.spec.ts
```

## 4. Test accounts and data

Floor Manager `manager@cpoint.local`, System Admin `admin@cpoint.local`, the demo constructor;
password `DEMO_USER_PASSWORD`. Dylan's own data; `returns.spec.ts` creates a roll over the limit.

## 5. Test scenarios

| ID  | Role        | Steps                                                                                                                                                                                        | Expected result                                                                                                                                                                                                                                    | Priority |
| --- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | FM          | Reports → Rolls, open the Status dropdown                                                                                                                                                    | Exactly: All statuses, Not yet scanned, Scanning passed, Returned to supplier                                                                                                                                                                      | High     |
| S2  | FM          | Pick each of the three statuses in turn                                                                                                                                                      | Not yet scanned: only rolls with a "Not yet scanned" badge; Scanning passed: only "Scanning passed"; Returned to supplier: only "Returned to supplier" (or the "No rolls match" message). The URL has `status=NOT_SCANNED`, `PASSED` or `RETURNED` | High     |
| S3  | FM          | Open a Returned to supplier roll (run `returns.spec.ts` first if none)                                                                                                                       | Badge Returned to supplier; "Returned to supplier: defects cover N% of this roll, over the 10% limit."; no "Too many defects" anywhere; claim sheet still opens                                                                                    | High     |
| S4  | FM          | Open `/reports/rolls?status=FINISHED`                                                                                                                                                        | The page shows all rolls (an old value is ignored), no error                                                                                                                                                                                       | Low      |
| S5  | FM          | Reports (Quality and Operations), the FM home, Reports → Rolls and a roll's page, an Inventory leather item, a rejected scan's page; search the page text for "salvage"                      | No "salvage" anywhere; no "Rejected sections" card on Operations (D-117)                                                                                                                                                                           | High     |
| S6  | FM          | Download daily.csv, defects.csv, operations.csv, suppliers.csv, supplier-rolls.csv                                                                                                           | Headers exactly as listed under D-117 in section 1; no "salvage", "Sections" or "Pass %"                                                                                                                                                           | Medium   |
| S7  | FM          | Reports → Materials                                                                                                                                                                          | Used per material has no "8 weeks to selected" or "Per 100 pairs" column; the note above mentions only Days left                                                                                                                                   | High     |
| S8  | FM          | Reports → Materials → Leather rolls                                                                                                                                                          | Columns Week, Rolls used, Rolls checked by the camera, **Returned to supplier**, Pairs finished; this week's Returned count matches the rolls finished this week with that status on Reports → Rolls                                               | High     |
| S9  | FM          | Download `materials-used.csv`                                                                                                                                                                | Last header is "Pairs finished"; no "Used per 100 pairs"                                                                                                                                                                                           | Medium   |
| S10 | FM          | Operations → Supplier quality                                                                                                                                                                | Columns Supplier, Rolls, Scanning passed, Returned to supplier, Returned %, Top defect; no Sections or Defect area column; Rolls = Scanning passed + Returned to supplier on every row                                                             | Medium   |
| S11 | Admin       | Settings → Thresholds                                                                                                                                                                        | Field "Mark a roll Returned to supplier when defects cover more than"; the summary says "Returned to supplier when more than 10% …"                                                                                                                | Medium   |
| S12 | Constructor | Capture: capture a section the camera rejects                                                                                                                                                | Last scan says "Reject: this part of the roll is not for cutting."; Floor view band "Set aside, not for cutting"                                                                                                                                   | Low      |
| S13 | FM          | Axe (all rules) on Reports → Rolls, a Returned roll, Materials, Operations, Quality, the FM home                                                                                             | 0 violations                                                                                                                                                                                                                                       | Medium   |
| S14 | FM          | Reports → Operations, last 14 days                                                                                                                                                           | KPI tiles exactly Pairs finished, Failed inspection, Of quota, Rolls passed, Returned to supplier; no Rolls finished, Rolls open, First-pass yield or Reject rate tile; no Rejected sections card                                                  | High     |
| S15 | FM          | Operations → the Pairs finished tile                                                                                                                                                         | Sub text "all pairs the QI counted at Finish batch, failed ones included"; the number equals the sum of Pairs finished on Batches' Recent days for the range, plus Today's finished pairs when the range ends today (Recent days leaves today out) | High     |
| S16 | FM          | Operations, Rolls passed and Returned to supplier tiles; then Reports → Rolls filtered by Scanning passed and by Returned to supplier for the same days (count rolls by their Finished date) | Rolls passed + Returned = the "M" in "N of M rolls scanned"; each matches the Reports → Rolls count for those days                                                                                                                                 | High     |
| S17 | FM          | Reports → Quality, last 14 days                                                                                                                                                              | Tiles Rolls scanned, Scanning passed, Returned to supplier; the chart is titled "Rolls scanned per day" with the legend Scanning passed and Returned to supplier; on a day in the Daily summary, Rolls scanned = Scanning passed + Returned        | High     |
| S18 | FM          | Quality → Defects by type                                                                                                                                                                    | Columns Defect, Rolls found on, Returned, Share, Cumulative; no number is larger than Rolls scanned                                                                                                                                                | Medium   |
| S19 | FM          | Quality with a range of days with no finished roll (e.g. a Sunday only)                                                                                                                      | "No rolls scanned in this range" with Show the last 30 days                                                                                                                                                                                        | Low      |
| S20 | FM          | Operations → Supplier quality → Rolls with the most defects                                                                                                                                  | Columns Roll · tag, Supplier, Defect %, Status, Defects; sorted by Defect % high to low; View and Claim sheet open the roll's page and its claim sheet                                                                                             | Medium   |
| S21 | FM          | The FM home                                                                                                                                                                                  | Rolls today: Rolls scanned, Returned to supplier, rolls open; Daily summary: Rolls scanned, Scanning passed, Returned to supplier for yesterday and today, matching Quality for those two days                                                     | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                                          | Expected            |
| --- | ------------------------------ | ------------------------------------------------------ | ------------------- |
| A1  | Quality Inspector              | `/reports/rolls?status=RETURNED`, `/reports/materials` | 403 page, as before |
| A2  | Shoe Constructor               | `GET /api/v1/rolls?status=RETURNED`                    | 403                 |

## 6. Out of scope / known issues

- Phase 30E-2 (planning calendar) sits uncommitted in the same folder and has its own handoff.
- Inventory's own roll filter on a leather item keeps its six statuses (only In stock now reads
  "Not yet scanned"); the badges there use the new words.
- The roll's own page, a scan's page, Capture and Floor view still show each shot's Pass or Reject
  (D-117 keeps them).
- The `forSalvage` data and the `for-salvage` test id are gone with the card (D-117).
