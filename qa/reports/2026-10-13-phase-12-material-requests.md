# QA report: Phase 12 material requests

| Field     | Value                                                |
| --------- | ---------------------------------------------------- |
| Date      | 2026-10-13 11:24 (Asia/Shanghai)                     |
| Handoff   | qa/handoffs/2026-10-13-phase-12-material-requests.md |
| Tested by | Codex                                                |
| Verdict   | **FAIL**                                             |

## 1. Summary

Tested the item-by-item decision flow, partial receiving, role access, and the listed e2e specs against the local Docker database. One scenario failed because REQ-C did not have Approve preselected after REQ-A receipt raised Adhesive stock to 6; two migration checks were blocked because no pre-change approved or rejected fixture existed. The production build passed and all 39 e2e cases passed.

Scenarios: **28 passed, 1 failed, 2 blocked, 31 total** (25 scenarios plus 6 access checks).

## 2. Environment

| Item            | Value                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| OS              | Windows 11, PowerShell 5.1                                                                                  |
| Node / npm      | v25.2.1 / 11.7.0                                                                                            |
| Branch / commit | main @ 8adab3a; working tree was already dirty before QA                                                    |
| How the app ran | Manual: npm run dev on port 3000. E2E: production build, then Playwright-managed npm run start on port 3100 |
| Base URL        | http://localhost:3000                                                                                       |
| Database        | Docker cpoint-pms-db-1; local demo data; 8 migrations applied, none pending; no reseed                      |
| Browser         | Playwright Chromium 153.0.8010.12, headless                                                                 |
| Viewport        | 1440 × 900; S24 also at 960 × 900                                                                           |

Four QA inventory items and REQ-A through REQ-D were created through the UI. The received legacy request PR-2026-0001 was present. Before decisions, the procurement list showed Pending (4), Approved (0), Received (1), Rejected (0); the handoff's old approved and rejected fixtures were not present.

## 3. Scenario results

Screenshots and logs are in qa/reports/artifacts/2026-10-13-phase-12-material-requests/; filenames in the table are relative to that folder.

| ID  | Scenario                                                            | Result  | Notes / evidence                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Floor Manager: decision panel controls on REQ-A                     | PASS    | Per-item choices, Save decisions, and Reject whole request are present; obsolete whole-request buttons are absent. S1.png                                                                                            |
| S2  | Floor Manager: well-stocked QA12 Nails suggestion                   | PASS    | Still in stock, 40 / reorder 5 / was 40, Reject selected, suggested reason filled. S2.png                                                                                                                            |
| S3  | Floor Manager: low QA12 Adhesive suggestion                         | PASS    | Low badge, 2 / reorder 5 / was 2, Approve selected, no reason box. S3.png                                                                                                                                            |
| S4  | Floor Manager: reload leaves REQ-A pending                          | PASS    | Reload preserved Pending and did not save a decision. S4.png                                                                                                                                                         |
| S5  | Floor Manager: reject reason required                               | PASS    | Exact inline error, focus moved to the reason box, request stayed Pending. S5.png                                                                                                                                    |
| S6  | Floor Manager: switching back to Reject restores the reason         | PASS    | Suggested reason returned and the validation error cleared. S6.png                                                                                                                                                   |
| S7  | Floor Manager: save mixed REQ-A decisions and requester note        | PASS    | Success toast appeared; after refresh the request showed Approved and 1 of 2 items approved. S7.png and S8.png                                                                                                       |
| S8  | Floor Manager: REQ-A item results and timeline                      | PASS    | Rejected Nails reason, approved Adhesive, timeline items, and requester note were present. S8.png                                                                                                                    |
| S9  | Shoe Constructor: REQ-A outcome is read-only                        | PASS    | Partial summary and per-item result were visible; decision controls were absent. S9.png                                                                                                                              |
| S10 | Shoe Constructor: list and home show partial summary                | PASS    | Both All requests and the constructor home showed 1 of 2 items approved. S10.png                                                                                                                                     |
| S11 | Floor Manager: inventory request badges exclude rejected REQ-A line | PASS    | After the inventory row finished updating, Adhesive showed Requested; Nails had no REQ-A request indicator and could show a badge for another open request. S11.png, S11-nails-recheck.png, S11-adhesive-recheck.png |
| S12 | Floor Manager: receive only approved REQ-A item                     | PASS    | Dialog listed only Adhesive +4; after receipt Adhesive was 6 boxes and Nails remained 40. S12.png, recheck-qa12-adhesive.png, recheck-qa12-nails.png                                                                 |
| S13 | Floor Manager: in-between, zero-reorder, and custom item guidance   | PASS    | Thread, Wire, and eyelets had no selection; eyelets showed Not in inventory; count was 3 of 3. S13.png                                                                                                               |
| S14 | Floor Manager: missing decisions show item errors and focus         | PASS    | All three item errors and the summary appeared; focus moved to Thread Approve; request stayed Pending. S14.png                                                                                                       |
| S15 | Floor Manager: approve remaining items                              | PASS    | Thread and Wire became Approve; eyelets remained Reject with its reason; bulk button disappeared. S15.png                                                                                                            |
| S16 | Floor Manager: save mixed REQ-B decisions                           | PASS    | Approved, 2 of 3 items approved; rejected eyelets showed its reason. S16.png                                                                                                                                         |
| S17 | Floor Manager: one-item REQ-C decision                              | FAIL    | Approve was not preselected after REQ-A receipt. Stock was 6, reorder 5, and was 2 when requested. Explicitly choosing Approve then saved successfully. S17-before-save.png, S17.png                                 |
| S18 | Floor Manager: whole-request rejection requires a reason            | PASS    | Exact minimum-length message, focus in Reason, request stayed Pending. S18.png                                                                                                                                       |
| S19 | Floor Manager: reject every REQ-D item with one reason              | PASS    | Request became Rejected; both items showed QA: not this month. S19.png                                                                                                                                               |
| S20 | Floor Manager: pre-change approved request migration fixture        | BLOCKED | No pre-change approved request existed at baseline. PR-2026-0003 was assigned to the new REQ-B during this run, so it could not serve as the old migration fixture. pre-change-statuses.png, S20.png                 |
| S21 | Floor Manager: pre-change rejected request migration fixture        | BLOCKED | No pre-change rejected request existed at baseline and no alternate pre-2026-10-13 rejected request was present. pre-change-statuses.png, S21.png                                                                    |
| S22 | Floor Manager: pre-change received request migration fixture        | PASS    | PR-2026-0001 was Received; all three items showed Approved and Added to stock on receipt. S22-recheck.png                                                                                                            |
| S23 | Floor Manager: stale second tab cannot save a second decision       | PASS    | Red conflict message appeared; within 2.5 seconds the second tab showed Approved and no decision controls. S23.png, S23-recheck-after-error.png                                                                      |
| S24 | Floor Manager: decision panel at 960 px                             | PASS    | No horizontal page overflow; decision controls and reason stayed inside the Items card. S24.png                                                                                                                      |
| S25 | Floor Manager: keyboard decision controls and focus                 | PASS    | Tab, arrow keys, reason entry, and Save decisions worked with visible focus; request stayed Pending. S25.png                                                                                                         |
| A1  | Shoe Constructor: own pending request is read-only                  | PASS    | No decision radios, Save decisions, or whole-request rejection control. A1.png                                                                                                                                       |
| A2  | System Admin: pending request is read-only                          | PASS    | No decision radios, Save decisions, or whole-request rejection control. A2.png                                                                                                                                       |
| A3  | Shoe Constructor: decision API access                               | PASS    | POST returned HTTP 403. A3.png; response in manual-results-phase2.json                                                                                                                                               |
| A4  | System Admin: decision API access                                   | PASS    | POST returned HTTP 403. A4.png; response in manual-results-phase2.json                                                                                                                                               |
| A5  | Quality Inspector: procurement access                               | PASS    | Redirected to /forbidden and rendered the Error 403 no-access page. A5.png                                                                                                                                           |
| A6  | Floor Manager: API requires a decision for each line                | PASS    | Partial POST returned HTTP 422; details named QA12 Adhesive and path lines / 1 / decision. A6.png; response in manual-results-phase2.json                                                                            |

Existing automated tests run:

| Command                                                                                                                                                                                                                                | Result                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| npm run build                                                                                                                                                                                                                          | PASS; the production build completed. Evidence: build.log |
| npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-13-phase-12-material-requests/e2e-results | 39 passed, 0 failed. Evidence: e2e.log                    |

## 4. Failures

### F1 — S17: Approve was not preselected for REQ-C after receipt

- **Severity:** Medium
- **Role / page:** Floor Manager; REQ-C at /procurement/01a13336-1a1c-72ec-a2bb-88ca53fbc467
- **Steps to reproduce:**
  1. Create QA12 Adhesive with 2 boxes on hand and reorder at 5; create REQ-A and REQ-C before deciding either.
  2. Partly approve REQ-A and mark it received, adding 4 boxes of Adhesive.
  3. Open REQ-C.
- **Expected:** Approve is already selected, as S17 says to leave it selected.
- **Actual:** Neither choice was selected. The panel showed 6 boxes on hand, reorder at 5, and 2 when requested. Selecting Approve manually and saving succeeded.
- **Evidence:** qa/reports/artifacts/2026-10-13-phase-12-material-requests/S17-before-save.png and S17.png
- **Suggested fix:** S17's setup conflicts with the general rule for stock between the reorder level and twice that level. Update the handoff step to explicitly select Approve, or run S17 before receiving REQ-A. No application change is indicated by this observation.

### B1 — S20: pre-change approved migration fixture unavailable

- **Severity:** Low (missing local test data)
- **Role / page:** Floor Manager; Procurement
- **Steps to reproduce:** Before deciding the new requests, open Procurement and inspect the status counts, then look for the older PR-2026-0003 approved request.
- **Expected:** An approved request from before 2026-10-13 with every item marked Approved and Mark received available.
- **Actual:** Baseline counts were Approved (0). The code PR-2026-0003 was assigned to the new REQ-B created for this run; it was not a pre-change request. No alternate older approved request was available.
- **Evidence:** qa/reports/artifacts/2026-10-13-phase-12-material-requests/pre-change-statuses.png and S20.png
- **Suggested fix:** Restore the expected legacy approved request in the local QA database or provide another pre-change approved request for this migration check.

### B2 — S21: pre-change rejected migration fixture unavailable

- **Severity:** Low (missing local test data)
- **Role / page:** Floor Manager; Procurement
- **Steps to reproduce:** Before deciding the new requests, open Procurement and inspect the status counts, then look for PR-2026-0015 or another request rejected before 2026-10-13.
- **Expected:** An older rejected item with reason “QA: still 3 boxes in the back room”.
- **Actual:** Baseline counts were Rejected (0); no pre-change rejected request or alternate older rejected request was present.
- **Evidence:** qa/reports/artifacts/2026-10-13-phase-12-material-requests/pre-change-statuses.png and S21.png
- **Suggested fix:** Restore the expected legacy rejected request in the local QA database or provide another pre-change rejected request for this migration check.

## 5. Other observations

- The Phase 11 report's only failure was rechecked at 960 px. The new-request Item and Quantity fields stayed side by side without horizontal overflow, matching the Phase 12 clarification. Evidence: prior-S30-960-form.png and prior-S30-960-form.json.
- No unexpected browser page exceptions or server errors were recorded during the manual scenarios. Chromium logged the expected 403 and 422 API responses in A3, A4, and A6 as failed resource requests.
- The e2e server emitted 17 “The destination stream closed early” messages (digest 3349080732); all 39 tests still passed. The Phase 12 handoff notes this was also seen in Phase 11.
- Playwright's production server printed a warning that next start does not work with output: standalone. The prescribed e2e run still completed successfully.
- The local dev server and Playwright production server were stopped after testing. Docker cpoint-pms-db-1 remains healthy and running. The saved logs were checked for the demo password and sanitized.

## 6. Suggested fixes (priority order)

1. Correct S17's handoff setup or expectation so the one-item approval scenario matches the documented in-between-stock rule.
2. Restore pre-change approved and rejected requests in the local QA database so S20 and S21 can run.
3. Investigate the repeated destination-stream messages and the standalone output warning if the team wants to clean up the e2e server logs; they did not cause a test failure in this run.
