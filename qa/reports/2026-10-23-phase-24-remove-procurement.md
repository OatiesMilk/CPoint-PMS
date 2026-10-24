# QA report: Phase 24, remove Material Requests and Procurement

| Field     | Value                                                   |
| --------- | ------------------------------------------------------- |
| Date      | 2026-10-24, approximately 12:20–12:40 (Asia/Shanghai)   |
| Handoff   | `qa/handoffs/2026-10-23-phase-24-remove-procurement.md` |
| Tested by | Codex                                                   |
| Verdict   | **FAIL**                                                |

## 1. Summary

The module's navigation, pages, API endpoints, database tables and adjacent workflows passed. All 18 handoff scenarios passed, and the full e2e suite finished with **84 passed, 0 failed, 1 skipped**. However, step 5 found historical procurement vocabulary in Admin → Audit log, including its live filter choices; the requested “step 5 found nothing” condition therefore prevents PASS.

Scenarios: **18 passed, 0 failed, 0 blocked, 18 total**. Additional acceptance check: **step 5 FAIL** (F1). This is a historical-audit presentation/acceptance issue, not evidence that procurement functionality remains available.

## 2. Environment

| Item               | Value                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| OS                 | Windows, PowerShell                                                                                            |
| Node / npm         | v25.2.1 / 11.7.0                                                                                               |
| Branch / commit    | `feature/phase-24-remove-procurement` @ `d7f462b6d0e281187692e4f7436ca47930526c5c`; initial working tree clean |
| How the app ran    | Production build, `npm run start` on 3001; e2e's production server on 3100; throwaway Docker app on 3002       |
| Dev database       | Existing `cpoint-pms-db-1`, localhost:5432; existing demo users/data                                           |
| Throwaway database | `cpoint-qa-db-1`, localhost:5434; demo users and week enabled only in subprocess environments                  |
| Browser            | Playwright 1.63.0 bundled Chromium, headless                                                                   |
| Viewport           | 1440 × 900                                                                                                     |

Evidence directory: [artifacts](artifacts/2026-10-23-phase-24-remove-procurement/). All log files were saved/normalized as UTF-8. Credentials were read from `.env` in process memory and not printed. `.env`, including both seed switches, was not edited. Port 3000 was not used or stopped.

| Required setup command                                                        | Result                                                         | Evidence              |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------- |
| `npm run db:up`                                                               | PASS, exit 0                                                   | `db-up.log`           |
| `npm run db:deploy`                                                           | PASS, exit 0; 19 migrations; “No pending migrations to apply.” | `db-deploy.log`       |
| `npm run db:generate`                                                         | PASS, exit 0                                                   | `db-generate.log`     |
| `npm run build`                                                               | PASS, exit 0                                                   | `build.log`           |
| `docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "\dt purchase*"` | PASS; “Did not find any tables named \"purchase*\".”           | `purchase-tables.log` |

Read `prisma/migrations/20261023090000_drop_procurement/migration.sql`: drops eight purchase tables, both purchase enums and `users.canRequestLeatherRolls`; no stock-movement deletion. No migration was authored or modified during QA.

## 3. Scenario results

Evidence filenames below are relative to the artifact directory. Detailed browser results and navigation inventories are in `browser-results.json`, `followup-results.json`, and `page-variants.json`.

| ID  | Scenario                           | Result | What actually happened / evidence                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | FM sidebar                         | PASS   | All remaining sidebar destinations opened; no Procurement/Material requests. `S1.png`, `SCAN-manager` navigation inventory.                                                                                                                                                                                                                                                                                                                                  |
| S2  | Inspector and Admin sidebars       | PASS   | Both roles' remaining destinations rendered; no removed navigation. `S2-inspector.png`, `S2-admin.png`; e2e sidebar/axe checks also passed.                                                                                                                                                                                                                                                                                                                  |
| S3  | FM home                            | PASS   | Exactly seven direct card children; no Pending requests. `S3.png`, `followup-results.json`.                                                                                                                                                                                                                                                                                                                                                                  |
| S4  | Inventory and stock actions        | PASS   | Contact cement showed Low, no Requested badge/Request link. Receive +1 and Use −1 succeeded. Saved a count +0.5, then saved the original count; final on-hand **3.5 cans**. `S4.png`, `S4-count-saved.png`; restored balance verified.                                                                                                                                                                                                                       |
| S5  | Constructor allowed to capture     | PASS   | Greeting and Capture sections displayed; Open Capture reached `/camera/capture`. Home and Capture navigation. `S5.png`.                                                                                                                                                                                                                                                                                                                                      |
| S6  | Constructor without capture access | PASS   | Exact “No camera access yet” and “Your work in the system is at the camera. Ask the System Admin for camera access.” text; Home only. `S6.png`.                                                                                                                                                                                                                                                                                                              |
| S7  | Operations                         | PASS   | No Purchasing or request attention items; low-stock guidance was “Restock them before they run out.” No Requested badge. `S7.png`, attention text in `browser-results.json`.                                                                                                                                                                                                                                                                                 |
| S8  | CSV downloads                      | PASS   | Stock, operations, suppliers and production returned 200. Stock header ends `Days of cover,Status`; no `Open request`. Saved four CSVs.                                                                                                                                                                                                                                                                                                                      |
| S9  | Supplier claim sheet               | PASS   | Supplier section/claim link remained; fully rendered a dev claim sheet with supplier information, 200. `S9.png`, `page-variants.json`. Initial quick screenshot was replaced after awaiting content.                                                                                                                                                                                                                                                         |
| S10 | Admin users/edit/audit             | PASS   | No leather-roll badge or menu action; camera action present. Changed constructor name temporarily, saved, and restored. `user.update` before/after contained exactly name, email and role. `S10-menu.png`, `browser-results.json`.                                                                                                                                                                                                                           |
| S11 | Historic deliveries / ledger       | PASS   | Old `Delivery for MR-…` movement rows remained visible. All three affected items matched their movement sums: 8, 29 and 13. `S11.png`, `browser-results.json`. These historical movement reasons are explicitly allowed by the handoff.                                                                                                                                                                                                                      |
| U1  | Throwaway demo week                | PASS   | Startup logged 14 batches, 116 scans, five attendance days and 14 check-ins. Home, Inventory and Operations had no request feature. Plain `Delivery from …` IN movements present, including Marikina Leather Trading +2 and San Roque Shoe Supplies +5. `throwaway-startup.log`, `U1-browser.json`, `U1-deliveries.json`, `U1-home.png`, `U1-inventory.png`, `U1-operations.png`. Final detail screenshot `U1-delivery-movements.png` was taken after reset. |
| U2  | Throwaway reset                    | PASS   | Host-only database URL guard printed **True** for `:5434/`; uploads folder freshly created and empty. Both commands exited 0. Dry run had no request count and included the exact scan-images/old-proof-files sentence. Confirmed reset seeded 14 batches, 117 scans and five attendance days. `U2-guards.log`, `U2-dry-run.log`, `U2-reset.log`. This is a CLI scenario; logs are its evidence.                                                             |
| U3  | Constructor after reset            | PASS   | Demo constructor saw Capture sections. `U3.png`, `U3-browser.json`.                                                                                                                                                                                                                                                                                                                                                                                          |
| A1  | Removed pages                      | PASS   | `/procurement`, `/procurement/new`, and UUID detail each returned HTTP 404 with the app's 404 page. `A1-0.png`, `A1-1.png`, `A1-2.png`.                                                                                                                                                                                                                                                                                                                      |
| A2  | Removed APIs                       | PASS   | Signed-in GET requests to `/api/v1/procurement/requests` and `/api/v1/procurement/items` returned 404. `browser-results.json`.                                                                                                                                                                                                                                                                                                                               |
| A3  | Signed-out removed page            | PASS   | No procurement page was accessible; response met 404/login condition. `browser-results.json`.                                                                                                                                                                                                                                                                                                                                                                |
| A4  | Constructor access                 | PASS   | Both `/batches` and `/inventory` redirected to `/forbidden`. `browser-results.json`.                                                                                                                                                                                                                                                                                                                                                                         |

Existing automated tests run:

| Command                                                                                                | Result                                                     |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `npm run test:e2e -- --output=qa/reports/artifacts/2026-10-23-phase-24-remove-procurement/e2e-results` | **84 passed, 0 failed, 1 skipped**, 2.3 minutes; `e2e.log` |

No failing test titles, lines or errors; no file rerun required. The suite's existing skip was not changed or overridden.

## 4. Failures

### F1 — Step 5: historical procurement remains visible in the audit trail and filter choices

- **Severity:** Low (retained history; all removed module entry points tested were inaccessible).
- **Role / page:** System Admin, `/admin/audit`.
- **Steps to reproduce:** Sign in as Admin. Open Audit log. Choose Action `procurement.delivery.record` and Record type `PurchaseRequest`, then Apply. The same vocabulary is offered by the unfiltered page's selectors.
- **Expected:** Under this run's literal step-5 condition, no Procurement/Purchase vocabulary anywhere in accessible running-app pages.
- **Actual:** Action choices include `procurement.delivery.record`, `procurement.remark.add`, and `procurement.request.approve`, `.cancel`, `.create`, `.decide`, `.order`, `.reject`. Record type offers `PurchaseRequest`. The filtered page displays two historical delivery audit rows dated October 22, for MR-2026-0003 and MR-2026-0001. No application error message appears; these are actual record labels.
- **Evidence:** [filters and records](artifacts/2026-10-23-phase-24-remove-procurement/leftover-audit.png), [expanded record](artifacts/2026-10-23-phase-24-remove-procurement/leftover-audit-expanded.png), `audit-leftovers.json`.
- **App or test wrong:** The browser observation is valid. The app retains historical audit vocabulary, which conflicts with the literal acceptance wording. This may be intended audit preservation; it is not a failing e2e test or a restored procurement workflow. The handoff explicitly exempts historic stock reasons, but does not exempt the audit page.
- **Suspected source:** `src/server/models/audit-log.model.ts:67` (`auditFacets` groups all recorded actions/entities); `src/app/(app)/admin/audit/page.tsx:76` and `:89` render those options. Existing records provide the strings; this is not a leftover hardcoded procurement menu.
- **Suggested resolution:** Claude/Dylan should clarify whether preserved audit history is exempt. If it is, update acceptance wording; if not, define how to present historical records without these labels while preserving audit data. No fix applied.

## 5. Other observations

- Step 5 covered each role's sidebar destinations, reachable detail/edit page templates, constructor camera states, account password pages, Production plan, both report views, supplier claim sheets and all Settings tabs. Dynamic record pages were sampled by route template, not every row or every historical audit page. Full visited URLs are saved in the JSON evidence. The only discovered vocabulary leftover was F1; permitted old MR stock-movement reasons were also observed.
- Stock CSV and adjacent exports passed. Supplier and claim-sheet pages rendered after waiting for streamed content. An early screenshot captured a loading skeleton; final key evidence was retaken after content assertions.
- A startup probe to the throwaway app ran before readiness and got `net::ERR_EMPTY_RESPONSE`; retry after the demo-week startup log passed. This was setup timing, not an app scenario failure.
- The suggested `%TEMP%\cpoint-qa-uploads` directory already existed. The guard refused it before any reset. A fresh unique `cpoint-qa-uploads-phase24-…` directory was used instead; the pre-existing directory was left untouched.
- Existing Next standalone-start and pg concurrent-query deprecation warnings appeared in logs. They did not fail the build, suite or browser scenarios.

### Restoration and cleanup

- Constructor camera access restored to its original **true** value after S5/S6, verified again from the dev database.
- Constructor name restored to **Dylan (CV)** after the temporary ` QA24` suffix; database verification passed. No other user names edited.
- Contact cement restored to **3.5 cans**. Successful QA transactions remain as ledger/audit history: receive +1, use −1, count +0.5 and count −0.5.
- The requested existing e2e suite created its normal test data; no dev reset was run. No app, test, migration, config, package or environment files edited.
- `docker compose -p cpoint-qa down -v` removed only the throwaway stack, volumes and network. The newly created uploads folder was removed after verifying its absolute path was inside TEMP with the expected unique prefix. `throwaway-cleanup.log` records success.
- Throwaway environment overrides were subprocess-local and expired when those processes ended. The dev database/container was not removed. The production QA server on port 3001 was stopped at completion.

## 6. Suggested fixes (priority order)

1. Resolve F1's audit-history acceptance ambiguity with Claude; preserve the audit trail. No functional procurement fix was identified by these checks.

## Needs Dylan

**0 BLOCKED scenarios.** Decide whether retained historical audit labels are allowed by step 5. The verdict remains FAIL under the current literal criterion.
