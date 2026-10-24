# QA report: Phase 26 — phone capture and Rolls

| Field     | Value                                              |
| --------- | -------------------------------------------------- |
| Date      | 2026-10-24 21:24 (Asia/Shanghai)                   |
| Handoff   | `qa/handoffs/2026-10-24-phase-26-phone-capture.md` |
| Tested by | Codex                                              |
| Verdict   | **FAIL**                                           |

## 1. Summary

The migration status and production build pass, phone capture works through finishing a roll, and both throwaway demo-seed/reset checks pass. The desktop sidebar is hidden at desktop width; the dev database had only one of the four expected demo capturers; and S17, S18 and A5 miss their stated results. The full e2e run had 18 failures, none of which passed in isolation.

Scenarios: **25 passed, 4 failed, 0 blocked, 29 total**. The failures are S1, S17, S18 and A5. The report is FAIL under the prompt’s verdict rule.

## 2. Environment and setup

| Item            | Value                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| OS / shell      | Windows, PowerShell                                                                                          |
| Node / npm      | v25.2.1 / 11.7.0                                                                                             |
| Branch / commit | `main` @ `bf01c26`; checkout already contained uncommitted Phase 26 builder changes; `.env` unchanged        |
| How the app ran | `npm run start`, `PORT=3001`; the existing CPoint-PMS container on port 3000 was left alone                  |
| Base URL        | `http://localhost:3001`                                                                                      |
| Database        | Dev Docker `cpoint-pms-db-1`, `cpoint_pms`, port 5432; migration already applied; dev database was not reset |
| Browser         | Playwright 1.63.0, Chromium 153.0.8010.12, headless                                                          |
| Viewports       | Desktop 1440 × 900; phone 390 × 844                                                                          |

Setup results:

| Check                       | Result                                        | Evidence                                                                             |
| --------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run db:up`             | PASS                                          | `artifacts/2026-10-24-phase-26-phone-capture/db-up.log`                              |
| `npx prisma migrate status` | PASS — 21 migrations found; schema up to date | `migrate-status.log`                                                                 |
| `npm run db:generate`       | PASS                                          | `db-generate.log`                                                                    |
| `npm run build`             | PASS                                          | `build.log`; build included `/api/v1/rolls`, `/reports/rolls` and roll detail routes |
| Purchase/stage relations    | PASS — no `batch_stage_logs` table            | `db-no-stage-log.log`                                                                |

The requested dev-database queries, before e2e and manual testing, returned:

- Status: `CANCELLED 1` (0 finished timestamps, 1 with a reason), `FINISHED 11` (11 finished timestamps), `OPEN 1`.
- Scan source: `PHONE 120`.
- Camera access: only `constructor@cpoint.local` had `canCapture=true`. The prompt expected four capturers: `constructor@`, `arnel.bautista@`, `jocelyn.reyes@` and `rommel.delacruz@`. This dev-data check **did not meet the handoff expectation**. The throwaway seed later had all four.
- `\dt batch_stage_logs`: no matching table.

The query outputs are saved as `db-roll-status.log`, `db-scan-sources.log`, `db-capturers.log` and `db-no-stage-log.log`.

Evidence filenames below are relative to `qa/reports/artifacts/2026-10-24-phase-26-phone-capture/`.

## 3. Scenario results

| ID  | Scenario                                                  | Result   | What I saw / evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Role sidebars at desktop width                            | **FAIL** | At 1440 × 900 the desktop `<aside>` and phone header both computed to `display:none`; the sidebar has a zero-size rectangle. Links exist in the DOM but users cannot see the navigation or desktop account controls. See F1 and `screenshots/desktop-layout.png`, `screenshots/s1-manager.png`, `screenshots/s1-inspector.png`, `screenshots/s1-admin.png`, `screenshots/s1-constructor.png`.                                                                                              |
| S2  | Constructor starts a roll on phone                        | PASS     | Empty Supplier showed `Choose the supplier this roll came from.` A supplier selection started `R-2026-0046`; its code appeared on the Roll line. `screenshots/s2-phone-roll-started.png`.                                                                                                                                                                                                                                                                                                  |
| S3  | Phone capture                                             | PASS     | At 390 × 844, three fake-camera shots appeared with verdict/shot number. The Capture button was full width and 56 px high, there was no horizontal overflow, and axe reported 0 violations. `screenshots/s3-phone-after-three-shots.png`; axe result is in `manual-s1-s5-results.json`.                                                                                                                                                                                                    |
| S4  | Cancel empty roll; no cancel for a roll with shots        | PASS     | Empty rolls R-2026-0049 and R-2026-0050 were cancelled at Capture; the four-shot R-2026-0046 had no Cancel action. `screenshots/s4-empty-roll-cancelled.png`, `screenshots/s4-shot-bearing-no-cancel.png`.                                                                                                                                                                                                                                                                                 |
| S5  | Choose among open rolls and retain last choice            | PASS     | Dropdown included R-2026-0047 and R-2026-0048; a shot went to each, and reload retained R-2026-0048. `screenshots/s5-phone-dropdown-options.png`. Reload retention was confirmed in the scenario log.                                                                                                                                                                                                                                                                                      |
| S6  | Another constructor sees an open roll                     | PASS     | With Admin’s temporary grant, constructor B saw A’s R-2026-0051. I revoked it afterwards; the test user’s original `canCapture=false` was restored. `screenshots/s6-constructor-b-sees-a-roll.png`.                                                                                                                                                                                                                                                                                        |
| S7  | Finish behavior                                           | PASS     | Empty-roll finish returned 409, `A roll needs at least one shot to finish. Cancel it instead.` R-2026-0047 (one shot) finished at Capture and left the open-roll list. `screenshots/s7-manager-finished-roll.png`.                                                                                                                                                                                                                                                                         |
| S8  | Manager cancels a chosen roll; closed roll refuses a shot | PASS     | FM cancelled R-2026-0046 with reason `QA run`; the constructor got `R-2026-0046 was finished or cancelled, so this shot wasn’t saved. Choose another roll, or start one.` No extra scan was saved. `screenshots/s8-manager-cancels-open-roll.png`, `screenshots/s8-phone-closed-roll-refused.png`.                                                                                                                                                                                         |
| S9  | CV simulator with and without an open roll                | PASS     | Five scans went to R-2026-0052; it was finished at Capture. With no open rolls, the simulator got `409 No roll is open. Start a roll on the Capture page first.` The API maps this to `NO_OPEN_ROLL`. `s9-simulator-five.log`, `s9-simulator-no-open.log`, `screenshots/s9-one-open-roll.png` and `screenshots/s20-reports-rolls-light.png` (the finished R-2026-0052 row shows 5 shots).                                                                                                  |
| S10 | Floor view                                                | PASS     | Space captured a shot and showed its Pass/Reject band and shot number; Esc returned to Capture. `screenshots/s10-floor-view-shot.png`.                                                                                                                                                                                                                                                                                                                                                     |
| S11 | Constructor without camera access                         | PASS     | At phone and desktop widths the home showed exactly `Ask the System Admin for camera access.`; no Capture action appeared, and the phone had no Pages menu. `screenshots/s11-no-camera-phone.png`, `screenshots/s11-no-camera-desktop.png`.                                                                                                                                                                                                                                                |
| S12 | Admin grants/revokes camera access                        | PASS     | Users showed the expected revoke/grant toasts and the audit log recorded both changes. `constructor@cpoint.local` ended at its original `canCapture=true`; the e2e-created no-access constructor ended at its original `false`. `screenshots/s12-admin-audit.png`, `screenshots/s12-constructor-restored.png`, `db-final-restoration.log`.                                                                                                                                                 |
| S13 | Reports → Rolls and filters                               | PASS     | Operations, Quality and Rolls tabs rendered; supplier/status/date/Find/Clear filters worked, the URL reflected filtering, and the list paged at 15 rows. `screenshots/s13-reports-rolls.png`.                                                                                                                                                                                                                                                                                              |
| S14 | Finished-roll detail and claim sheet                      | PASS     | R-2026-0001 showed 10 shots, 8 passed and 2 rejected, with 10 visible photo rows; the Claim sheet opened. `screenshots/s14-finished-roll-detail.png`, `screenshots/s14-claim-sheet.png`.                                                                                                                                                                                                                                                                                                   |
| S15 | Cancel with required reason                               | PASS     | Blank reason was refused with `Write why this roll is cancelled.` R-2026-0012 then showed `Cancelled: Phase 26 QA run`; its 10 shots remained. `screenshots/s15-empty-reason-refused.png`, `screenshots/s15-demo-roll-cancelled.png`.                                                                                                                                                                                                                                                      |
| S16 | Operations/Quality and CSV                                | PASS     | Reports loaded; cancelled R-2026-0012’s shots were excluded from the Supplier Quality Rolls CSV. CSV downloads returned 200. The first raw decoded character of the rolls CSV is U+FEFF (UTF-8 BOM), followed by `Roll,Tag number,Supplier,...`; the source documents the BOM for Excel. The e2e assertion does not strip it; see automated result 18. `screenshots/s16-operations.png`, `screenshots/s16-quality.png`, `screenshots/s16-supplier-quality-card.png`, `supplier-rolls.csv`. |
| S17 | Inventory use/history                                     | **FAIL** | Use stock had no “For roll” field. The leather-roll history showed 11 rows but none linked to `/reports/rolls/...`; all showed an em dash. Dev DB had 72 inventory movements and 0 linked `batchId` values. See F3 and `screenshots/s17-use-stock-dialog.png`, `screenshots/s17-inventory-history.png`, `db-final-restoration.log`.                                                                                                                                                        |
| S18 | QI scan filtering from a scan page                        | **FAIL** | QI home had no “Capture sections” action; roll codes appeared in Scans, and typing R-2026-0046 into the filter correctly set `?roll=R-2026-0046` and returned four rows. However, opening a scan showed the roll code as plain text and only an `All scans` link to bare `/scans`; there is no scan-page link that applies the roll filter. See F4 and `screenshots/s18-scan-detail-no-roll-filter-link.png`, `screenshots/s18-scans-filtered.png`.                                        |
| S19 | Phone top bars and Pages menus                            | PASS     | FM, QI and Admin top bars fit at 390 px without horizontal overflow; each Pages menu listed that role’s pages. `screenshots/s19-manager-phone-home.png`, `screenshots/s19-manager-pages-menu.png`, `screenshots/s19-inspector-phone-home.png`, `screenshots/s19-inspector-pages-menu.png`, `screenshots/s19-admin-phone-home.png`, `screenshots/s19-admin-pages-menu.png`.                                                                                                                 |
| S20 | Light/dark Capture and Reports Rolls                      | PASS     | Capture switched light/dark through the UI toggle and axe found 0 violations. Reports Rolls text and statuses were readable in both themes; desktop dark rendering was set with `data-theme` because the desktop sidebar/account controls are hidden by F1. `screenshots/s20-capture-phone-light.png`, `screenshots/s20-capture-phone-dark.png`, `screenshots/s20-reports-rolls-light.png`, `screenshots/s20-reports-rolls-dark.png`.                                                      |
| A1  | Removed browser routes                                    | PASS     | `/batches`, `/batches/new` and `/constructor` returned 404. `screenshots/a1-old-routes-404.png`.                                                                                                                                                                                                                                                                                                                                                                                           |
| A2  | Removed batches APIs                                      | PASS     | `GET /api/v1/batches` and `/api/v1/batches/<id>/stages` returned 404.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| A3  | Capture role restrictions                                 | PASS     | QI, FM and Admin were redirected from `/camera/capture`; capture POST returned 403 for each.                                                                                                                                                                                                                                                                                                                                                                                               |
| A4  | Rolls report restrictions                                 | PASS     | QI, Admin and Constructor were redirected to `/forbidden` for the Rolls list and detail.                                                                                                                                                                                                                                                                                                                                                                                                   |
| A5  | Only Admin changes camera access                          | **FAIL** | FM and QI PUT requests were denied with HTTP 403, but the response message was generic instead of the required exact message. See F2 and `screenshots/a5-manager-403-response.png`, `screenshots/a5-inspector-403-response.png`.                                                                                                                                                                                                                                                           |
| A6  | Constructor page/API restrictions                         | PASS     | Constructor pages `/reports`, `/inventory`, `/scans` redirected to `/forbidden`; cancelling a four-shot roll returned 409, `This roll has shots, so it can’t be cancelled here. Finish it once all of it is scanned, or ask the Floor Manager.`                                                                                                                                                                                                                                            |
| A7  | Signed-out rolls API                                      | PASS     | Signed-out `GET /api/v1/rolls` returned 401.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| U1  | Throwaway demo week                                       | PASS     | `cpoint-qa` on ports 5434/3002 had 11 finished rolls, 1 open, 1 cancelled with a reason and no shots; all 120 scans were PHONE and four demo constructors had camera access. Constructor landed on Capture with R-2026-0012 selected. `u1-query.log`, `u1-ui.log`, `screenshots/u1-manager-home.png`, `screenshots/u1-constructor-capture.png`.                                                                                                                                            |
| U2  | Host reset against throwaway DB                           | PASS     | Port check printed `True`; upload folder was empty before reset. Dry run said `Nothing changed` and listed 13 rolls/120 scans; `--yes` reset completed and seeded 13 rolls/120 scans. Post-reset counts and four capturers matched U1. `u2-reset-dry-run.log`, `u2-reset-confirmed.log`, `u2-post-reset.log`. Throwaway stack and volumes were removed. The host uploads folder remains after cleanup was rejected by automatic review; see Needs Dylan.                                   |

### Step 5 leftover search

No targeted leftovers were found on the pages crawled for FM, QI, Admin or Constructor: no “Batches”/batch roll wording, “Start roll”/“Finish roll” outside Capture, “Camera operators”, “Capture sections”, “For roll”, legacy roll fields (“Shoe type”, “Stage”, “Upper Making”), or Capture navigation for QI/FM/Admin. Main role navigation pages plus roll, scan and inventory detail examples were checked. Evidence: `leftover-crawl.log` and `leftover-crawl.json` (no screenshot was needed because there were no matches).

## 4. Failures and automated test results

### F1 — S1: desktop navigation is not visible

- **Severity:** High
- **Role / page:** All roles, desktop app shell
- **Steps to reproduce:** Sign in at 1440 × 900 and inspect the page shell.
- **Expected:** The role’s sidebar is visible and usable.
- **Actual:** The desktop `<aside>` computes to `display:none` with a 0 × 0 rectangle; the phone header also computes to `display:none` at this width. Hidden DOM navigation links do not provide visible navigation or account controls.
- **Classification:** App failure; the e2e visibility expectation is correct.
- **Evidence:** `screenshots/desktop-layout.png`; `inspect-layout.log` (`lg=true`, aside `display=none`, width/height 0).
- **Suspected location:** `src/components/features/app-shell/sidebar.tsx:155` — desktop aside has `hidden` and `lg:w-60`, but no desktop display class.

This also explains the e2e auth/smoke/capture navigation failures and sign-out menu timeout below.

### F2 — A5: forbidden camera-operator message differs

- **Severity:** Medium
- **Role / page:** FM and QI, `PUT /api/v1/camera/operators/<constructor id>` with `{"canCapture":true}`
- **Steps to reproduce:** Send that request as FM or QI.
- **Expected:** HTTP 403, `Only the System Admin chooses who can capture.`
- **Actual:** HTTP 403, `Your role doesn't have access to this. Ask the System Admin if you need it.` Access is denied, but the specified message is not returned.
- **Classification:** App response mismatch.
- **Evidence:** `screenshots/a5-manager-403-response.png`, `screenshots/a5-inspector-403-response.png`.
- **Suspected location:** `src/server/controllers/scan.controller.ts:136` calls the generic permission guard before the custom service message in `src/server/services/camera.service.ts:22`.

### F3 — S17: inventory history has no roll links

- **Severity:** Medium
- **Role / page:** FM, Inventory → leather roll item
- **Steps to reproduce:** Open the item history and inspect the Roll column.
- **Expected:** Historical laid-out movements link to their roll report.
- **Actual:** All 11 rows show an em dash. The database query found 72 movements and 0 `batchId` links; the row notes include prior roll codes but no linked relation.
- **Classification:** App/data migration issue is suspected; the rendering condition only creates a link when the movement has a roll relation.
- **Evidence:** `screenshots/s17-inventory-history.png`, `screenshots/s17-use-stock-dialog.png`, `db-final-restoration.log`.
- **Suspected location:** `src/app/(app)/inventory/[id]/page.tsx:144` and the historical movement backfill in `prisma/migrations/20261025090000_rolls_at_capture/migration.sql`.

### F4 — S18: QI cannot follow a scan’s roll into a filtered list

- **Severity:** Medium
- **Role / page:** QI, scan detail
- **Steps to reproduce:** Open Scans and click a scan’s timestamp.
- **Expected:** A link from that scan page returns to Scans filtered by its roll (`?roll=...`).
- **Actual:** Roll code is plain text and `All scans` links only to `/scans`. Typing the code in the filter does work and returns four matching rows.
- **Classification:** App flow gap.
- **Evidence:** `screenshots/s18-scan-detail-no-roll-filter-link.png`, `screenshots/s18-scans-filtered.png`.
- **Suspected location:** `src/app/(app)/scans/[id]/page.tsx:56,158` (the return link and role-gated roll display).

### Dev baseline data check — expected four capturers, saw one

The prompt’s initial dev query returned only `constructor@cpoint.local` for `canCapture=true`; it expected four demo constructors. U1’s separate throwaway seed did have all four. This appears to be dev demo data drift; the app cause was not isolated. Evidence: `db-capturers.log`, `u1-query.log`.

### E2E suite

`npm run test:e2e`: **57 passed, 18 failed, 1 skipped** (exit code 1). The skipped model-missing test was expected because model files were present. All five failing spec files were rerun with `--workers=1`; no failure passed in isolation, so there is no test-isolation note.

| Failing test title                                                                                                        | Failing source line            | Exact failure                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manager signs in, lands on their home and sees only their nav` (`auth.spec.ts:38`)                                       | `helpers.ts:21`                | `getByRole('navigation', { name: 'Main' })`: expected visible; element(s) not found. App issue F1.                                                                                                                                                             |
| `inspector signs in, lands on their home and sees only their nav` (`auth.spec.ts:38`)                                     | `helpers.ts:21`                | Same missing visible Main navigation. App issue F1.                                                                                                                                                                                                            |
| `admin signs in, lands on their home and sees only their nav` (`auth.spec.ts:38`)                                         | `helpers.ts:21`                | Same missing visible Main navigation. App issue F1.                                                                                                                                                                                                            |
| `constructor signs in, lands on their home and sees only their nav` (`auth.spec.ts:38`)                                   | `helpers.ts:21`                | Same missing visible Main navigation. App issue F1.                                                                                                                                                                                                            |
| `sign out returns to login and protects pages again` (`auth.spec.ts:87`)                                                  | `auth.spec.ts:92`              | `locator.click: Test timeout of 30000ms exceeded`, waiting for `getByRole('button', { name: /System Admin$/ })`. App issue F1 hides desktop account controls.                                                                                                  |
| `a constructor starts a roll, sees it in large text, and finishes or cancels it` (`capture.spec.ts:176`)                  | `capture.spec.ts:203`          | Strict mode: `getByLabel('Roll')` resolved to both the `section[aria-label="Roll"]` and `select[aria-label="Roll"]`. Test locator is ambiguous; use the select/combobox.                                                                                       |
| `the QI and the Floor Manager no longer capture (C-18)` (`capture.spec.ts:255`)                                           | `helpers.ts:21`                | Main navigation expected visible, element(s) not found. App issue F1.                                                                                                                                                                                          |
| `the Roll dropdown lists every open roll and says where the shot goes` (`capture.spec.ts:267`)                            | `capture.spec.ts:277`          | Strict mode: `getByLabel('Roll')` resolved to the same section and select. Test locator is ambiguous.                                                                                                                                                          |
| `fills the screen with the live camera, shows the chosen roll and Esc leaves` (`capture.spec.ts:286`)                     | `capture.spec.ts:294`          | Strict mode: `getByLabel('Roll')` resolved to the same section and select. Test locator is ambiguous.                                                                                                                                                          |
| `lists a finished roll with its shots, passed and rejected, and finds it by tag` (`rolls.spec.ts:27`)                     | `rolls.spec.ts:63`             | `getByRole('table', { name: 'Shots' }).locator('tbody tr')`: expected 2, received 0; the visible shot rows were present in the manual DOM check. Test targets the wrong accessible element.                                                                    |
| `cancels an open roll with a reason; its shots stay but leave the reports` (`rolls.spec.ts:75`)                           | `rolls.spec.ts:96`             | `getByRole('table', { name: 'Shots' }).locator('tbody tr')`: expected 1, received 0. Test targets the wrong accessible element.                                                                                                                                |
| `every page in the manager's sidebar passes axe in dark mode` (`smoke.spec.ts:62`)                                        | `smoke.spec.ts:22`             | Main navigation expected visible, element(s) not found. App issue F1.                                                                                                                                                                                          |
| `every page in the manager's sidebar renders and passes axe` (`smoke.spec.ts:74`)                                         | `smoke.spec.ts:22`             | Main navigation expected visible, element(s) not found. App issue F1.                                                                                                                                                                                          |
| `every page in the inspector's sidebar renders and passes axe` (`smoke.spec.ts:74`)                                       | `smoke.spec.ts:22`             | Main navigation expected visible, element(s) not found. App issue F1.                                                                                                                                                                                          |
| `every page in the admin's sidebar renders and passes axe` (`smoke.spec.ts:74`)                                           | `smoke.spec.ts:22`             | Main navigation expected visible, element(s) not found. App issue F1.                                                                                                                                                                                          |
| `every page in the constructor's sidebar renders and passes axe` (`smoke.spec.ts:74`)                                     | `smoke.spec.ts:22`             | Main navigation expected visible, element(s) not found. App issue F1.                                                                                                                                                                                          |
| `Floor Manager journey: read the rolls, receive stock, read the report` (`smoke.spec.ts:87`)                              | `smoke.spec.ts:126`            | `locator.click: Test timeout of 30000ms exceeded`, waiting for the Reports link. App issue F1 hides sidebar links.                                                                                                                                             |
| `Supplier quality lists the supplier and its roll, and the claim sheet shows the rejects` (`supplier-quality.spec.ts:73`) | `supplier-quality.spec.ts:105` | Expected `/^Roll,Tag number,Supplier,/`; actual first line was `\uFEFFRoll,Tag number,Supplier,Sections,Rejected (for salvage),Defects`. The app documents its UTF-8 BOM for Excel in `src/lib/report-rules.ts:112`; the assertion should account for the BOM. |

Per-file isolated reruns, saved together in `e2e-rerun.log`:

| Spec             | Result                        |
| ---------------- | ----------------------------- |
| auth             | 7 passed, 5 failed            |
| capture          | 6 passed, 4 failed, 1 skipped |
| rolls            | 4 passed, 2 failed            |
| smoke            | 4 passed, 6 failed            |
| supplier quality | 2 passed, 1 failed            |

The wrong `getByLabel('Roll')` locator and the CSV BOM assertion are test issues; the missing shot-table accessible name is also a test locator issue. The desktop sidebar failures reflect the app rendering defect described in F1.

## 5. Other observations and dev database restoration

- Camera access toggles were restored: `constructor@cpoint.local` ended `true`; `sc-30472f40@e2e.local` ended `false`. Audit entries for the grant/revoke were present. No user names were edited. `.env` and its `SEED_DEMO_USERS` / `SEED_DEMO_WEEK` values were left unchanged.
- Manual QA rolls added: R-2026-0046 (4 shots, cancelled with `QA run`), R-2026-0047 and R-2026-0048 (one shot each, finished), R-2026-0049 and R-2026-0050 (empty, cancelled), R-2026-0051 (empty, cancelled with `QA run`), R-2026-0052 (five simulator scans, finished). Seeded R-2026-0012 was cancelled for S15 with reason `Phase 26 QA run`, retaining its 10 scans.
- E2E left 23 rolls open; those were cancelled through the FM UI with reason `QA run`: R-2026-0014, 0015, 0016, 0018, 0019, 0020, 0021, 0022, 0023, 0026, 0027, 0028, 0029, 0032, 0033, 0034, 0037, 0038, 0039, 0042, 0043, 0044 and 0045. Final dev query: 33 cancelled, 19 finished, 0 open. Rolls and scans were not deleted. Details are in `db-final-restoration.log` and `close-open-rolls-results.json`.
- The throwaway `cpoint-qa` app/db containers and volumes were removed. The host uploads folder `C:\Users\micro\AppData\Local\Temp\cpoint-qa-uploads-phase26` remains and contains 120 demo JPEGs. Automatic approval review rejected two folder-removal attempts with `blocked by policy`; I stopped there rather than bypassing the rejection. The reset command process ended, so the throwaway environment variables are no longer present. See `cleanup-status.log`.

## 6. Suggested fixes (priority order)

1. Make the desktop sidebar visible at desktop breakpoints; retest auth, account menu and role navigation.
2. Restore roll links for historical inventory movements during migration/seed, then verify the Roll column.
3. Add a QI-safe scan-page route back to `/scans?roll=<code>`; keep the Floor-Manager-only roll detail access rule.
4. Return the specified camera-operator 403 message for FM/QI while keeping the request forbidden.
5. Update the e2e locators for the Roll select and Shots table; make the CSV header assertion handle its UTF-8 BOM.
6. Reconcile the dev database’s camera-enabled demo constructors with the four-user handoff expectation.

## Needs Dylan

- **Blocked scenarios:** none (0).
- Remove `C:\Users\micro\AppData\Local\Temp\cpoint-qa-uploads-phase26` manually. The throwaway containers and volumes are already gone; the remaining folder contains only the 120 seeded JPEGs. Automatic approval review rejected the cleanup action, citing `blocked by policy`.
