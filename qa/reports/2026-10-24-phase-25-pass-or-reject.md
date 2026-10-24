# QA report: Phase 25 — Pass or Reject

| Field     | Value                                                 |
| --------- | ----------------------------------------------------- |
| Date      | 2026-10-24, approximately 15:36–15:50 (Asia/Shanghai) |
| Handoff   | `qa/handoffs/2026-10-24-phase-25-pass-or-reject.md`   |
| Prompt    | `qa/CODEX_PROMPT_PHASE_25.md`                         |
| Tested by | Codex                                                 |
| Verdict   | **FAIL**                                              |

## 1. Summary

Pass/Reject decisions, removal/access checks, Settings, reports and capture worked in the completed browser checks. The full e2e suite has one persistent failure in a Production test locator; its required single-file rerun failed too. Two literal handoff expectations differ from the application: the daily CSV calls its first column `Date (Manila)` rather than `Day`, and the demo week has seven unknown-class rejected sections rather than one.

Scenarios: **22 passed, 2 failed, 0 blocked, 24 total** (S1–S17, U1–U2, A1–A5). A transient Floor-view camera-readiness issue is also reported below. **Cleanup is incomplete:** automatic approval review refused deletion of the two QA temporary uploads folders; the throwaway Docker stack and volumes were removed successfully.

## 2. Environment

| Item            | Value                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------- |
| OS              | Windows, PowerShell                                                                                |
| Node / npm      | Node v25.2.1; npm 11.7.0                                                                           |
| Branch / commit | `main` @ `06715f7e94cebd593498f143a27ee38a3e9aa1d3`; initially clean                               |
| How the app ran | `npm run build`, then `npm run start` on 3001; e2e production server on 3100                       |
| Base URL        | `http://localhost:3001`                                                                            |
| Dev database    | Existing `cpoint-pms-db-1`, localhost:5432, existing demo/test data                                |
| Throwaway       | `cpoint-qa`, database port 5434, app port 3002, demo users/week enabled in subprocess environments |
| Browser         | Playwright 1.63.0 bundled Chromium, headless; fake camera for S5                                   |
| Viewport        | 1440 × 900                                                                                         |

Artifacts: [2026-10-24-phase-25-pass-or-reject](artifacts/2026-10-24-phase-25-pass-or-reject/). Evidence filenames below are relative to that directory. Logs are UTF-8. No credentials/tokens were printed or recorded; `.env` and both seed switches were left unchanged. Port 3000 was left alone. No migration deploy or dev reset was run.

### Setup and migration queries

| Command                     | Observed result                                           | Evidence             |
| --------------------------- | --------------------------------------------------------- | -------------------- |
| `npm run db:up`             | Exit 0                                                    | `db-up.log`          |
| `npx prisma migrate status` | Exit 0; 20 migrations; **Database schema is up to date!** | `migrate-status.log` |
| `npm run db:generate`       | Exit 0                                                    | `db-generate.log`    |
| `npm run build`             | Exit 0                                                    | `build.log`          |

The three requested queries were sent to `docker exec -i cpoint-pms-db-1 psql -U cpoint -d cpoint_pms` through stdin to preserve SQL quoting. Outputs are saved verbatim in `scan-verdicts.log`, `defect-outcomes.log`, and `removed-tables.log`.

```sql
SELECT "aiVerdict"::text, "finalVerdict"::text, count(*)
FROM scans GROUP BY 1, 2 ORDER BY 1, 2;
```

| aiVerdict | finalVerdict | Count before this run's e2e/browser writes |
| --------- | ------------ | ------------------------------------------ |
| PASS      | PASS         | 246                                        |
| REJECT    | PASS         | 30                                         |
| REJECT    | REJECT       | 64                                         |

Only PASS and REJECT remain. The 30 differing camera/final values are historical converted human decisions, explicitly preserved by the migration; new simulator scans had matching camera/final values.

```sql
SELECT key, outcome::text, "isActive"
FROM defect_types ORDER BY "sortOrder";
```

All 13 existing types had a non-null outcome. Crease and scratch were USABLE; cut and hole NOT_ACCEPTED; abrasion and dirt inactive and NOT_ACCEPTED. Other rows were existing e2e types. The complete rows are in `defect-outcomes.log`.

```text
\dt (rework|salvage)*
Did not find any tables named "(rework|salvage)*".
```

## 3. Scenario results

`final-scenarios.json` consolidates the final scenario results. Earlier `browser-results.json` and `followup-results.json` contain provisional harness failures; corrected observations in `final-browser-results.json` supersede them. No repository tests were edited. Examples of corrected harness assumptions: retrying Start on an already-finished roll, expecting a Capture button inside Floor view, using an exact text match for a sentence inside a longer paragraph, and setting a CSS class rather than using the actual theme toggle.

| ID  | Scenario                   | Result   | What actually happened / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | All role sidebars          | PASS     | No Review queue, Repair Station or Salvage links. Every remaining sidebar link was opened successfully for each role. `S1-manager.png`, `S1-inspector.png`, `S1-admin.png`, `S1-constructor.png`; role link inventories in `browser-results.json`.                                                                                                                                                                                                                               |
| S2  | Scan filters/badges        | PASS     | FM and QI verdict options were All verdicts, Pass, Reject; no status filter. Selecting Reject updated the URL and list. `S2-fm.png`, `S2-qi.png`.                                                                                                                                                                                                                                                                                                                                |
| S3  | Rejected section           | PASS     | Rejected simulator sections had boxes, outcome rows, found-at 50%, and the final-camera-verdict explanation. No decision/override buttons. `S3-0.png`, `S3-1.png`, `S3-2.png`; full section text in `final-browser-results.json`.                                                                                                                                                                                                                                                |
| S4  | Simulator                  | PASS     | Started QA rolls as FM, ran the actual simulator with count 10/interval 2. New rows immediately held matching PASS/REJECT values. Follow-up random ten were all known classes, so one additional deterministic `sim-unknown` scan was posted; it immediately rejected. QI home/list rendered the new data. `simulator.log`, `simulator-followup.log`, `S4-home.png`, `S4-scans.png`, `followup-results.json`.                                                                    |
| S5  | Capture twice / Floor view | PASS     | Two normal fake-camera captures returned decided results. Floor capture succeeded with video dimensions/ready-state established; green Pass band, “Goes on to cutting,” no old verdict. `S5-capture-0.png`, `S5-capture-1.png`, `S5-floor.png`, `final-browser-results.json`. Immediate entry/Space race is F4 below. The fake image produced Pass; a red Reject floor result was not forced.                                                                                    |
| S6  | Required new-type outcome  | PASS     | Saving without When found showed an inline message explaining Usable/Not accepted. Selecting USABLE saved and displayed Usable (Pass). `S6-required.png`, `S6-saved.png`.                                                                                                                                                                                                                                                                                                        |
| S7  | Edit/toggle type           | PASS     | Changed to Not accepted (Reject), deactivated, reactivated; no When Fixable field. Final cleanup deactivated both QA-added types. `S7.png`, `final-restoration.json`.                                                                                                                                                                                                                                                                                                            |
| S8  | Found-at only              | PASS     | No Reject/Fixable thresholds. Saved 45%, saw confirmation and audit rows, restored 50%. Early-model notice remained enabled. `S8-45.png`, `S8-restored.png`, `browser-results.json`, `final-restoration.json`.                                                                                                                                                                                                                                                                   |
| S9  | Unknown-class UI           | PASS     | Admin alert named unknown classes and explained rejection until a type/outcome is added; Settings listed `sim-unknown`. `S9-home.png`, `S9-settings.png`.                                                                                                                                                                                                                                                                                                                        |
| S10 | Roll yield/finish          | PASS     | Passed sections, Rejected (for salvage), Total scanned displayed; no In repair/reused status or open-repair warning. Finish succeeded. Both QA rolls ended COMPLETED. `S10.png`, `followup-results.json`, `final-restoration.json`.                                                                                                                                                                                                                                              |
| S11 | FM/QI homes                | PASS     | Both loaded; no FM Open repairs card or QI flagged/review count/link. `S11-fm.png`, `S11-qi.png`.                                                                                                                                                                                                                                                                                                                                                                                |
| S12 | Quality report             | PASS     | Scanned, Pass and Reject (for salvage) tiles; no AI agreement. Rejected column and a two-series green/red chart with legend. `S12.png`, final light/dark Quality screenshots.                                                                                                                                                                                                                                                                                                    |
| S13 | Operations                 | PASS     | Reject rate, For salvage and rejected-scans link present; no repairs section/attention item. Supplier table has Pass/Reject headers with percentage values (headers omit the literal `%`, but the values and CSV label percentages clearly). `S13.png`, `followup-results.json`.                                                                                                                                                                                                 |
| S14 | Both CSV sets              | **FAIL** | All seven linked CSVs returned 200 and had no obsolete verdict/pending/agreement columns. Daily header starts **Date (Manila)** rather than handoff **Day**. F2. `csv-headers.json`, seven attached CSVs, `S14-csv-header.png`.                                                                                                                                                                                                                                                  |
| S15 | Supplier claim sheet       | PASS     | Rendered the claim, percentages, and final-camera-verdict/set-aside-for-salvage sentence. No individual attribution in claim content. `S15.png`, `followup-results.json`. Sidebar account name is shell navigation, not claim attribution.                                                                                                                                                                                                                                       |
| S16 | Historic audit row         | PASS     | Filtered `rework.done` history. Row remained accessible without a removed-module link; only an audit entity filter link was offered. `S16.png`.                                                                                                                                                                                                                                                                                                                                  |
| S17 | Light/dark reports         | PASS     | Used the real theme button; verified `html[data-theme]` for both views and both themes. Visually inspected green/red chart contrast and readable text. `S17-light-quality.png`, `S17-dark-quality.png`, `S17-light-operations.png`, `S17-dark-operations.png`.                                                                                                                                                                                                                   |
| U1  | Throwaway week             | **FAIL** | Week loaded with matching PASS/REJECT only; it has **seven** unknown-class sections, all Reject, rather than the stated one. Admin/Settings correctly show the class; outcomes match requested defaults. F3. `demo-results.json`, `demo-observations.json`, `U1-manager.png`, `U1-admin.png`, `U1-types.png`, `U1-rejected.png`. Final UI screenshots were taken after U2's fresh equivalent week; original pre-reset seven-row observation is preserved in `demo-results.json`. |
| U2  | Throwaway reset            | PASS     | Port guard True for 5434, fresh empty uploads folder. Dry run had no repairs/salvage count and did not alter scan count after seed readiness; confirmed reset exited 0, printed the exact new defect-type sentence and seeded 120 scans (92 Pass, 28 Reject). `reset-guards.log`, `demo-reset-dry.log`, `demo-reset-yes.log`, `U2-after-reset.png`.                                                                                                                              |
| A1  | Removed pages              | PASS     | QI requests to `/review`, `/rework`, `/salvage` each returned 404/app not-found. `A1-review.png`, `A1-rework.png`, `A1-salvage.png`.                                                                                                                                                                                                                                                                                                                                             |
| A2  | Removed GET APIs           | PASS     | FM GET `/api/v1/rework`, `/api/v1/salvage`, `/api/v1/reports/repairs`: 404.                                                                                                                                                                                                                                                                                                                                                                                                      |
| A3  | Decision endpoint          | PASS     | QI POST to an existing scan's `/decision`: 404.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| A4  | Old settings keys          | PASS     | PUT with `rejectPercent`/`reworkPercent` returned 422 naming both keys. `A4-response.json`.                                                                                                                                                                                                                                                                                                                                                                                      |
| A5  | Constructor restrictions   | PASS     | `/scans` and `/reports` both redirected to `/forbidden`.                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Existing automated tests

| Command                                                                                                                                           | Result                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run test:e2e -- --output=qa/reports/artifacts/2026-10-24-phase-25-pass-or-reject/e2e-results`                                                | **71 passed, 1 failed, 1 skipped, 3 did not run**; 76 total; 1.7m. `e2e.log`. |
| `npm run test:e2e -- tests/e2e/production.spec.ts --workers=1 --output=qa/reports/artifacts/2026-10-24-phase-25-pass-or-reject/e2e-rerun-results` | **1 passed, 1 failed, 3 did not run**; 7.5s. `e2e-rerun.log`.                 |

The failed test did not recover on rerun, so it cannot be treated as a passing isolation note. Its serial dependents did not run: FM check-ins when no QI is present, Admin production read-only, and Constructor refusal. The existing model-absent test was skipped because this machine has the model; no skip was added or changed.

## 4. Failures

### F1 — Persistent Production e2e locator failure

- **Severity:** High for the QA gate; no demonstrated application regression.
- **Test title:** `the Quality Inspector enters the due check-in; a second entry is refused; a correction needs a reason` (`tests/e2e/production.spec.ts:123`).
- **Steps:** Run the full suite against the existing dev data; rerun `production.spec.ts` alone with one worker.
- **Expected:** The test identifies the check-in it just created and corrects it.
- **Actual, first run:** `locator.click: Error: strict mode violation` — `getByTestId('today-check-ins').getByRole('row').filter({ hasText: 'Note: E2E check-in' }).getByRole('button', { name: 'Correct' })` resolved to **2 elements** (12:00 and 15:00 check-ins). Failing call: `tests/e2e/production.spec.ts:187:54`.
- **Actual, rerun:** `expect(locator).toContainText(expected) failed`; expected `/Entered/`, but that same note-based row locator resolved to **3 elements** (12:00, 14:00 and 15:00). Failing assertion: `tests/e2e/production.spec.ts:153:21`.
- **Evidence:** `e2e.log`, `e2e-rerun.log`, error contexts under both result folders, and [duplicate rows](artifacts/2026-10-24-phase-25-pass-or-reject/e2e-production-duplicate-rows.png).
- **App or test wrong:** Test selector/fixture isolation appears wrong. Prior check-ins share the fixed note, and rerunning adds another match. No app failure is established by the strict-mode error.
- **Suspected source / suggested fix:** Claude should inspect `tests/e2e/production.spec.ts:152`, `:153`, `:187` and its fixture lifecycle; identify the created slot/record uniquely and make repeated runs independent. No test or data cleanup was applied to make it pass.

### F2 — S14: Daily CSV header differs from the handoff

- **Severity:** Low.
- **Role / page:** FM, Reports → Quality → Daily CSV.
- **Steps:** Sign in, choose Quality, download Daily CSV, inspect its first line.
- **Expected:** `Day,Scanned,Pass,Reject (for salvage)`.
- **Actual:** `Date (Manila),Scanned,Pass,Reject (for salvage)`; no HTTP/application error.
- **Evidence:** [downloaded CSV](artifacts/2026-10-24-phase-25-pass-or-reject/quality-daily.csv), `csv-headers.json`, [local preview of the exact downloaded text](artifacts/2026-10-24-phase-25-pass-or-reject/S14-csv-header.png). The preview is explicitly labelled as a QA artifact, not a product screen.
- **App or test wrong:** Acceptance wording conflicts with implementation; existing `tests/e2e/reports.spec.ts:104` expects `Date (Manila)`. The data/removed-column requirements pass.
- **Suspected source / suggested fix:** `src/server/services/report.service.ts:72`. Claude should reconcile the handoff and intended header, then align implementation/tests if needed. No fix applied.

### F3 — U1: Seven unknown rejected sections where the handoff describes one

- **Severity:** Low count/spec discrepancy; all observed unknown verdicts are correct.
- **Role / page:** Throwaway stack, FM Scans and Admin → Settings → Defect types → Unknown classes.
- **Steps:** Start the isolated seeded stack, wait for “Demo week seeded,” inspect unknown detections joined to scans; view the unknown-class list.
- **Expected:** Handoff U1 says “one rejected section with an unknown class.”
- **Actual:** **Seven** `sim-unknown` sections, all REJECT. A reset produced the same total of 120 scans and seven unknown sections. One unknown class key is present, with seven detections; no server error.
- **Evidence:** `demo-results.json`, `demo-observations.json`, [unknown-class count](artifacts/2026-10-24-phase-25-pass-or-reject/U1-types.png), `U1-rejected.png`.
- **App or test wrong:** Literal handoff count does not match seed behavior. If “one” means “at least one,” this should be accepted as a documentation clarification rather than a product defect; this report preserves the strict stated count.
- **Suspected source / suggested fix:** `src/server/services/demo-seed.service.ts:299` uses random scenarios, then `:302` forces the newest section unknown; `src/server/lib/leather-scan.ts:47` documents a roughly 5% unknown-class mix. Claude should clarify whether the seed should contain exactly one or at least one. No seed change applied.

### F4 — S5 timing observation: Space immediately after entering Floor view can fail

- **Severity:** Medium transient capture feedback issue; S5 ultimately passed with a ready camera.
- **Role / page:** QI, `/camera/capture`, fake Chromium camera.
- **Steps:** Capture twice in normal mode, enter Floor view, focus the view and press Space immediately after it appears.
- **Expected:** Capture is held until a usable video frame exists, or readiness feedback explains when capture is possible.
- **Actual:** No request reached the capture API. The red band said exactly: **“The picture couldn’t be taken from the camera. Press Capture again.”** Floor view exposes Space rather than a Capture button. A fresh retry after `videoWidth > 0` and `readyState >= 2` succeeded, returned Pass, and showed the correct green verdict band.
- **Evidence:** [error band](artifacts/2026-10-24-phase-25-pass-or-reject/S5-followup-error.png), [successful capture](artifacts/2026-10-24-phase-25-pass-or-reject/S5-floor.png), `final-browser-results.json`.
- **App or test wrong:** The original attempt occurred during video replacement/readiness; this is an observed app timing/copy issue, not a wrong verdict. Reproduction is timing-dependent; no real hardware claim is made.
- **Suspected source / suggested fix:** `src/app/(app)/camera/capture/capture-client.tsx:159` attaches the stream to the replaced video; `:374` derives capture eligibility without checking that new element's video dimensions; `:383` uses those dimensions, `:392` supplies the normal-mode error copy. Claude should check readiness and Floor-view-specific retry guidance.

## 5. Other observations

### Step 5 — Running-app leftovers

No obsolete active status, verdict, module navigation or override control was found. `leftover-scan.json` lists role/page visits, HTTP status, matches, and sampled badge colors. It covers each sidebar destination, reachable detail/edit page templates, both report views, all Settings tabs, account pages and creation/planning pages. Dynamic records were sampled per route template rather than exhaustively opening every record/page of history.

The only term matches were on **Admin → Audit log**: `rework.cancel`, `rework.done`, `rework.start`, `rework.unstart`, `salvage.assign`, `salvage.discard`, `salvage.unassign`, and `scan.override` in historical filter choices. Evidence: `leftover-admin-11.png`, `leftover-scan.json`, and `S16.png`. These are explicitly allowed history in this Phase 25 handoff, so they do **not** fail step 5. “For salvage” report text is also expected. Unknown-class informational alerts can be blue; the verdict badges remain red Reject, as shown in `S3-followup-error.png`.

### CSV attachments

Quality: `quality-daily.csv`, `quality-defects.csv`.

Operations: `operations-operations.csv`, `operations-stock.csv`, `operations-production.csv`, `operations-suppliers.csv`, `operations-supplier-rolls.csv`.

All seven downloads were inspected and returned 200; headers are saved in `csv-headers.json`. No Fixable, Rework, pending or agreement columns remain.

### Setup/harness observations

- Initial throwaway observation used the wrong diagnostic SQL column name (`classKey` instead of `rawClassKey`) and was started before seeding finished. The first dry-run comparison therefore saw scans being seeded concurrently. No confirmed reset ran in that attempt. After checking the startup seed-complete log, corrected observations and the dry/confirmed reset succeeded. These diagnostic mistakes are not application failures.
- The requested `%TEMP%\cpoint-qa-uploads` already existed. It was left untouched; fresh uniquely named `cpoint-qa-uploads-phase25-…` folders provided the required empty uploads isolation. Database URLs were checked for port 5434 without printing them.
- Next's standalone-start warning and a pg concurrent-query deprecation warning appeared. Neither caused the build/browser failures.

### Restoration and cleanup

- **Found-at restored to 50%**, verified by settings API `foundAtOrAbove: 0.5`; early-model notice still true.
- **Both QA-added types are inactive**, outcome NOT_ACCEPTED: `qa25-1792827811843` and `qa25-1792827878533`. Types were retained as required.
- **Both QA rolls finished:** B-2026-0117 and B-2026-0118, verified status COMPLETED.
- `final-restoration.json` contains final settings/type/roll evidence. Existing e2e fixtures, simulator scans and successful browser captures remain as test history; no dev reset or scan deletion was run.
- `docker compose -p cpoint-qa down -v` succeeded; only the throwaway app/database, volumes and network were removed. `throwaway-cleanup.log` records it. The dev database was left intact, and the QA server on 3001 was stopped.
- Override variables were subprocess-local; none persisted in `.env` or the parent session. No application code, tests, migrations, config, package files or `.env` were edited. No branch, commit, push or PR created.
- **Temporary-folder cleanup BLOCKED:** automatic approval review rejected both the combined cleanup command and a narrower literal-path deletion command with only **“blocked by policy.”** No alternate deletion mechanism was attempted. The two folders listed below remain; this does not change the 0 blocked handoff-scenario count, but cleanup still needs Dylan.

## 6. Suggested fixes (priority order)

1. Claude: resolve the persistent Production test fixture/locator failure (F1), then request a rerun.
2. Claude: address/review the Floor-view readiness and retry-copy timing issue (F4).
3. Reconcile the daily CSV header and unknown-section count with the handoff (F2/F3).

## Needs Dylan

**0 BLOCKED handoff scenarios; 1 blocked cleanup task.** Automatic approval review refused deletion of these verified QA-created folders and gave no detail beyond “blocked by policy”:

- `C:\Users\micro\AppData\Local\Temp\cpoint-qa-uploads-phase25-1792827758460`
- `C:\Users\micro\AppData\Local\Temp\cpoint-qa-uploads-phase25-1792827796395`

Remove those folders when convenient. The pre-existing `cpoint-qa-uploads` folder was not touched. Claude also needs to resolve F1 and clarify F2/F3; no fixes were applied by Codex.
