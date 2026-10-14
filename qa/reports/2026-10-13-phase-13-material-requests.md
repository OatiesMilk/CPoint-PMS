# QA report: Phase 13 material requests

| Field     | Value                                                  |
| --------- | ------------------------------------------------------ |
| Date      | 2026-10-14 10:24 (Asia/Shanghai)                       |
| Handoff   | `qa/handoffs/2026-10-13-phase-13-material-requests.md` |
| Tested by | Codex                                                  |
| Verdict   | **FAIL**                                               |

## 1. Summary

Ran all 44 manual scenarios and 10 access checks against the Phase 13 handoff. S10 failed: after removing an oversized file, choosing a valid proof file left the proof list empty; a serial e2e flow reproduced the same upload-state issue. Six scenarios, S19–S24, were blocked after the QA runner tried to edit a disabled Glue quantity and then closed REQ-A before its planned second delivery.

Scenarios: **47 passed, 1 failed, 6 blocked, 54 total.** The production build passed. The listed e2e command had 36 passed and 9 failed; a serial diagnostic rerun had 1 passed and 8 failed, with most failures caused by test selectors or sign-in waits.

## 2. Environment

| Item            | Value                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OS              | Windows, PowerShell 5.1.26100.9444                                                                                                                        |
| Node / npm      | Node v25.2.1 / npm 11.7.0                                                                                                                                 |
| Branch / commit | `main` @ `c044511` (worktree already dirty; Phase 13 source changes were present before QA)                                                               |
| How the app ran | `npm run dev`; health returned HTTP 200. The CPoint Next dev session was stopped after manual checks.                                                     |
| Base URL        | `http://localhost:3000`                                                                                                                                   |
| Database        | Docker `cpoint-pms-db-1`, healthy; existing demo/development data plus QA13 fixtures created through the UI. Migration already applied; no demo seed run. |
| Browser         | Playwright 1.63.0 / Chromium 153.0.8010.12; headless for most scenarios, headed for PDF proof viewing in S15 and A5                                       |
| Viewport        | 1440 × 900; S43 also checked at 960 × 900                                                                                                                 |

The database container was left running. Playwright stopped its production server after the e2e runs. A separate Vite process from another checkout was already listening on host port 3000; it was left untouched.

## 3. Scenario results

Scenario screenshots are in qa/reports/artifacts/2026-10-13-phase-13-material-requests/; each table file name is relative to that folder.

| ID  | Scenario                                                       | Result   | Notes / evidence                                                                                                                                       |
| --- | -------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Approve REQ-A                                                  | PASS     | Approved; order/cancel actions shown, receive actions absent. `S1.png`                                                                                 |
| S2  | Order required-field validation                                | PASS     | Supplier/date errors and focus verified. `S2.png`                                                                                                      |
| S3  | Order REQ-A                                                    | PASS     | Supplier, PO-QA13, Oct 17 expected date and note saved. `S3.png`                                                                                       |
| S4  | Ordered timeline                                               | PASS     | Order entry and note shown. `S4.png`                                                                                                                   |
| S5  | Ordered list                                                   | PASS     | REQ-A shows date and supplier without a late badge. `S5.png`                                                                                           |
| S6  | Delivery dialog defaults                                       | PASS     | Tacks 6, Glue 4, eyelets 2, today, and non-inventory explanation. `S6.png`                                                                             |
| S7  | Delivery requires proof                                        | PASS     | Required-proof error; no delivery saved. `S7.png`                                                                                                      |
| S8  | Refuse invalid fake PDF                                        | PASS     | HTTP 422 names `fake.pdf`; status and stock unchanged after reload. `S8.png`                                                                           |
| S9  | Refuse file over 10 MB                                         | PASS     | Oversized file rejected; stock unchanged. `S9.png`                                                                                                     |
| S10 | Remove oversized file, select valid proof, submit over-receipt | **FAIL** | Over-receipt message/focus worked, but `photo.jpg` was not retained and the proof-required error appeared. `S10.png`                                   |
| S11 | Reject all-zero delivery                                       | PASS     | Zero-quantity message shown; nothing saved. `S11.png`                                                                                                  |
| S12 | Record first partial delivery                                  | PASS     | Tacks 4, Glue 4, eyelets 0; photo and PDF saved; status Partly received. `S12.png`                                                                     |
| S13 | Arrived quantities                                             | PASS     | 4 tacks arrived/2 outstanding; Glue all here; typed eyelets not in stock. `S13.png`                                                                    |
| S14 | Delivery card and proof                                        | PASS     | Quantities, note, photo, PDF and Floor Manager proof action shown. `S14.png`                                                                           |
| S15 | Open photo and PDF proof                                       | PASS     | Both opened in new tabs; PDF viewer showed “QA13 delivery proof.” `S15.png`, `S15-image-popup.png`, `S15-pdf-headed.png`                               |
| S16 | Inventory and ledger                                           | PASS     | Tacks 6 boxes and Glue 5 boxes with delivery ledger entries. `S16.png`                                                                                 |
| S17 | Partly received decision actions                               | PASS     | Record delivery and Close short shown; cancel replaced by explanatory text. `S17.png`                                                                  |
| S18 | Second-delivery defaults                                       | PASS     | Tacks 2, Glue 0 disabled/all arrived, eyelets 2; no files carried forward. `S18.png`                                                                   |
| S19 | Record second partial delivery                                 | BLOCKED  | Runner tried to fill disabled Glue quantity 0; no second delivery saved. `S19.png`                                                                     |
| S20 | Add proof to first delivery                                    | BLOCKED  | S19 did not create the planned second delivery; intended two-delivery state unavailable. `S20.png`                                                     |
| S21 | Reject invalid added proof                                     | BLOCKED  | S19 prerequisite missing; no valid conclusion for Add proof in the planned state. `S21.png`                                                            |
| S22 | Empty-reason Close short validation                            | BLOCKED  | S19 prerequisite missing; expected one remaining box of Tacks was not the current outstanding state. `S22.png`                                         |
| S23 | Close short after second delivery                              | BLOCKED  | Runner closed REQ-A before the second delivery; see B5 below. `S23.png`                                                                                |
| S24 | Requester read-only view of closed-short request               | BLOCKED  | Read-only access was checked, but only one delivery exists instead of the expected two. `S24.png`                                                      |
| S25 | Require reason when cancelling ordered REQ-B                   | PASS     | Empty reason message/focus; request remained Ordered. `S25.png`                                                                                        |
| S26 | Cancel ordered REQ-B                                           | PASS     | Cancelled with reason; Laces stock unchanged and no requester Copy action for FM. `S26.png`                                                            |
| S27 | Copy cancelled request                                         | PASS     | Copy form carried Laces quantity 3 and left Needed by empty. `S27.png`                                                                                 |
| S28 | Submit copied request REQ-B2                                   | PASS     | Pending request links to source in header and timeline. `S28.png`                                                                                      |
| S29 | Mixed decision then cancel REQ-C                               | PASS     | Tacks approved, Laces rejected with reason, then request cancelled. `S29.png`                                                                          |
| S30 | Copy request with rejected item                                | PASS     | Rejected Laces listed unticked with reason; approved Tacks retained. `S30.png`                                                                         |
| S31 | Toggle rejected item in copy form                              | PASS     | Tick adds Laces quantity 2; untick removes it. `S31.png`                                                                                               |
| S32 | Requester cancels pending REQ-D                                | PASS     | Cancelled without reason; Copy action shown. `S32.png`                                                                                                 |
| S33 | FM restock link from Inventory                                 | PASS     | QA13 Glue preselected on the Floor Manager restock form. `S33.png`                                                                                     |
| S34 | Raise REQ-E                                                    | PASS     | REQ-E created with Raised by Floor Manager badge and default Approve. `S34.png`                                                                        |
| S35 | Approve REQ-E                                                  | PASS     | Approved by FM and listed on Approved tab. `S35.png`                                                                                                   |
| S36 | Requested badge on QA13 Glue                                   | PASS     | Requested badge present; Request link absent. `S36.png`                                                                                                |
| S37 | Leather roll options                                           | PASS     | Leather roll items selectable; no greyed-out warning. `S37.png`                                                                                        |
| S38 | FM home purchase-request card                                  | PASS     | Approved-waiting count links to Approved tab. `S38.png`                                                                                                |
| S39 | Procurement tabs and Delivery filter                           | PASS     | Order/counts and both delivery filter choices verified. `S39.png`                                                                                      |
| S40 | Legacy received request                                        | PASS     | Used PR-2026-0001; migrated delivery note shown and stock unchanged. `S40.png`                                                                         |
| S41 | Operations purchasing report                                   | PASS     | “Approved, not all received” section loaded with late indicator. `S41.png`                                                                             |
| S42 | Order dialog keyboard focus and Escape                         | PASS     | Focus stayed in dialog; date segments had a visible ring; Escape closed without saving. `S42.png`                                                      |
| S43 | 960 px layout                                                  | PASS     | No horizontal overflow on REQ-A, order dialog, or Procurement list; dialog controls reachable. `S43.png`, `S43-REQA-960.png`, `S43-dialog-960.png`     |
| S44 | Late-order badge/filter/home card                              | PASS     | REQ-E stayed in late filter; home card showed “1 delivery is late”; detail showed Oct 11 and late badge. `S44.png`, `S44-filtered.png`, `S44-home.png` |
| A1  | Constructor opens another role’s request                       | PASS     | Error 404/not-found UI with no request details. Navigation response status was 200. `A1.png`                                                           |
| A2  | Constructor action controls on approved REQ-B2                 | PASS     | No order/delivery/cancel controls; expected FM handoff sentence shown. `A2.png`                                                                        |
| A3  | Constructor POSTs order                                        | PASS     | HTTP 403. `A3.png`                                                                                                                                     |
| A4  | Constructor POSTs cancel after approval                        | PASS     | HTTP 403; message says only the Floor Manager can cancel after approval. `A4.png`                                                                      |
| A5  | System Admin reads REQ-A and proof                             | PASS     | Read-only; photo opened and PDF viewer showed proof content; no mutation or Add proof action. `A5.png`, `A5-photo-open.png`, `A5-pdf-open.png`         |
| A6  | System Admin POSTs close short                                 | PASS     | HTTP 403. `A6.png`                                                                                                                                     |
| A7  | Quality Inspector requests proof URL                           | PASS     | HTTP 403; no file returned. `A7.png`                                                                                                                   |
| A8  | Signed-out proof URL                                           | PASS     | HTTP 401; no file returned. `A8.png`                                                                                                                   |
| A9  | FM submits delivery without files                              | PASS     | HTTP 422 with `details[0].path = ["files"]`; Glue remained at 5 boxes. `A9.png`                                                                        |
| A10 | FM cancels received REQ-A                                      | PASS     | HTTP 409 with expected Received-state message. `A10.png`                                                                                               |

Existing automated tests run:

| Command                                                                                                                                                                                                                                  | Result                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm run build`                                                                                                                                                                                                                          | PASS, exit 0. Full output: `qa/reports/artifacts/2026-10-13-phase-13-material-requests/build.log` |
| `npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --output=qa/reports/artifacts/2026-10-13-phase-13-material-requests/e2e-results` | **36 passed, 9 failed** of 45; exit 1. Full log: `e2e.log`.                                       |
| `npx playwright test tests/e2e/procurement.spec.ts --grep "a constructor asks                                                                                                                                                            | rejecting needs a reason                                                                          | the requester cancels their own pending request | the Quality Inspector has no procurement access | order, a short delivery with proof | a file that isn't a photo or PDF | the Floor Manager cancels an ordered request with a reason | the Floor Manager raises a restock request from a low item | the status tabs follow a request" --workers=1 --output=qa/reports/artifacts/2026-10-13-phase-13-material-requests/e2e-results-serial` | **1 passed, 8 failed** of 9; exit 1. Diagnostic log: `e2e-serial.log`; error contexts are under `e2e-results-serial/`. |

The first e2e command’s failures were: the constructor approve/order/receive flow; empty rejection-reason validation; requester cancellation; Quality Inspector access; short delivery/close short; invalid-file refusal; ordered cancellation/copy; Floor Manager restock/late order; status tabs. The serial rerun passed the Quality Inspector access case. It reproduced the proof-selection failure; two other failures were test locator mismatches; five cases remained at the login page after the spec navigated immediately after calling `signIn`.

## 4. Failures

### F1 — S10: Valid proof file disappears after removing an oversized file

- **Severity:** Medium
- **Role / page:** Floor Manager / REQ-A delivery dialog
- **Steps to reproduce:** 1. Open Record delivery and select `big.jpg`. 2. Remove it. 3. Select `photo.jpg`, enter 7 for QA13 Tacks, and submit.
- **Expected:** The over-receipt message appears under Tacks, focus moves to that quantity, and `photo.jpg` remains listed.
- **Actual:** The over-receipt message and focus work, but the file list is empty and the proof-required message also appears; the delivery is not saved.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/S10.png`; serial e2e context `qa/reports/artifacts/2026-10-13-phase-13-material-requests/e2e-results-serial/procurement-a-constructor--06cef--receives-and-stock-goes-up-chromium/error-context.md`.
- **Suggested fix:** In `src/app/(app)/procurement/[id]/delivery-dialog.tsx` around `addFiles` and the file input `onChange`, copy the `FileList` to an array before scheduling the state update, then clear the input. The live `FileList` is currently read inside a functional update after the input value is cleared.

### B1 — S19: Second delivery was not saved

- **Severity:** Low (test execution)
- **Role / page:** Floor Manager / REQ-A delivery dialog
- **Steps to reproduce:** 1. Open S18’s second-delivery dialog. 2. Set Tacks to 1 and eyelets to 2, attach `photo.jpg`, and submit. The runner instead also tried to fill Glue with 0.
- **Expected:** Status remains Partly received; the second delivery is saved with one box of Tacks still outstanding.
- **Actual:** Glue was disabled because it was fully received; the automation timed out trying to edit it, so no second delivery was saved. This is a QA runner error, not an app verdict.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/S19.png`.
- **Suggested fix:** Correct the runner to skip disabled Glue and continue only after confirming the delivery save.

### B2 — S20: Add proof to the planned two-delivery state was blocked

- **Severity:** Low (blocked prerequisite)
- **Role / page:** Floor Manager / REQ-A Deliveries card
- **Steps to reproduce:** Complete S19, then add `note.pdf` to the first delivery.
- **Expected:** Proof is added and appears in the delivery and timeline.
- **Actual:** S19 did not save the second delivery, so the planned state for S20 was not reached and this check is blocked.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/S20.png`.
- **Suggested fix:** Rerun after correcting S19’s runner step; no product fix is inferred.

### B3 — S21: Invalid added-proof check was blocked

- **Severity:** Low (blocked prerequisite)
- **Role / page:** Floor Manager / REQ-A Deliveries card
- **Steps to reproduce:** Complete S19, then add `fake.pdf` through Add a proof file.
- **Expected:** A red message names `fake.pdf` as invalid and no file is added.
- **Actual:** S19 did not save the second delivery, so the intended Add proof sequence was not reached; no S21 product verdict is assigned.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/S21.png`.
- **Suggested fix:** Rerun after correcting S19’s runner step; no product fix is inferred.

### B4 — S22: Empty-reason Close short check was blocked

- **Severity:** Low (blocked prerequisite)
- **Role / page:** Floor Manager / REQ-A Close short dialog
- **Steps to reproduce:** Complete S19, then open Close short and submit with the Reason empty.
- **Expected:** Dialog names one never-arrived box of QA13 Tacks and shows the required-reason message without changing status.
- **Actual:** S19 did not save, so the request still had two boxes of Tacks and two packs of eyelets outstanding; the expected one-box state was unavailable.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/S22.png`.
- **Suggested fix:** Rerun after correcting S19’s runner step; no product fix is inferred.

### B5 — S23: Close short ran before the planned second delivery

- **Severity:** Low (test execution)
- **Role / page:** Floor Manager / REQ-A Close short dialog
- **Steps to reproduce:** After S19 fails to save, the runner continued and submitted Close short with `Supplier is out of tacks`.
- **Expected:** After the second delivery, only one Tacks box remains; stock should be 7 boxes and the request closes short for that one box.
- **Actual:** The app closed the request against the then-current outstanding quantities: two boxes of Tacks and two packs of eyelets. REQ-A is now Received, closed short, and Tacks stock remains 6. This does not judge the intended S23 state. No repair was attempted.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/S23.png`.
- **Suggested fix:** Stop the dependent sequence when S19 fails; no product fix is inferred.

### B6 — S24: Requester view had only one delivery to inspect

- **Severity:** Low (blocked prerequisite)
- **Role / page:** Shoe Constructor / REQ-A detail
- **Steps to reproduce:** Open REQ-A as its requester after the planned second delivery and close-short action.
- **Expected:** Order, both deliveries and proof files are visible; no mutation actions are available.
- **Actual:** The read-only portion passed: the requester saw the closed-short request, order, one delivery and its files, with no mutation actions. Only one delivery existed, so the full scenario is blocked.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/S24.png`.
- **Suggested fix:** Rerun after completing S19–S23 in order; no product fix is inferred.

### F3 — E2E rejection-reason test uses a stale error ID

- **Severity:** Low (test-only)
- **Role / page:** Floor Manager / Reject request dialog
- **Steps to reproduce:** Run the e2e case “rejecting needs a reason, and the requester sees it”; submit with the Reason field empty.
- **Expected:** The spec finds the expected validation message.
- **Actual:** The message is visible in the dialog, but the spec queries `#request-text-error`, which does not exist. The current field and error IDs are `request-reason` and `request-reason-error`.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/e2e-results-serial/procurement-rejecting-need-25d37-n-and-the-requester-sees-it-chromium/error-context.md`.
- **Suggested fix:** Update the assertion in `tests/e2e/procurement.spec.ts` around line 326 to use `#request-reason-error` or scope by the visible message.

### F4 — E2E cancellation test matches the same note twice

- **Severity:** Low (test-only)
- **Role / page:** Shoe Constructor / cancelled request detail
- **Steps to reproduce:** Run “the requester cancels their own pending request; others can't” and cancel with `Found some in storage`.
- **Expected:** The test verifies the saved note.
- **Actual:** `getByText("Found some in storage")` resolves to both the Decision definition and the timeline paragraph, so strict-mode assertion fails although both show the text.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/e2e-results-serial/procurement-the-requester--2b5cb-ending-request-others-can-t-chromium/error-context.md`.
- **Suggested fix:** Scope the assertion to the decision field or use `.first()` in `tests/e2e/procurement.spec.ts`.

### F5 — E2E procurement cases navigate before sign-in completes

- **Severity:** Low (test-only / CI reliability)
- **Role / page:** Floor Manager / procurement e2e flows
- **Steps to reproduce:** Run the short-delivery, invalid-file, ordered-cancellation, restock, or status-tab e2e case. Each calls `signIn` and immediately navigates to the next page without waiting for the Floor Manager home URL.
- **Expected:** The next page is opened in the authenticated session.
- **Actual:** The serial run’s affected cases remained on `/login` and then timed out looking for an authenticated action/link. The Quality Inspector login case failed in the parallel run but passed in the serial rerun.
- **Evidence:** `qa/reports/artifacts/2026-10-13-phase-13-material-requests/e2e-results-serial/` and `e2e-serial.log`; parallel failures are listed in `e2e.log`.
- **Suggested fix:** In `tests/e2e/procurement.spec.ts`, await `expect(page).toHaveURL(ACCOUNTS.manager.home)` after `signIn`, or use the existing `signedIn` helper. For the parallel-only Inspector failure, wait for the role home before continuing and avoid depending on a shared account under concurrent navigation.

## 5. Other observations

- S8’s console 422 was the expected invalid-file response; no server error was logged.
- S40 and S44 logged a React hydration warning on a `caret-color: transparent` style difference between server and client markup. Both scenarios completed and the state was correct; no matching `caret-color` declaration was found in the project source during this review.
- The e2e server emitted 16 “The destination stream closed early” messages with digest `3349080732`, compared with 17 in the Phase 12 report. The wording and digest are unchanged.
- S43 found no horizontal scrolling at 960 px. No per-person counts/rankings or unexpected role controls were observed in the completed access checks.
- The previous Phase 12 findings were not retested, as directed by this handoff.

## 6. Suggested fixes (priority order)

1. Fix delivery proof selection state in `delivery-dialog.tsx` by snapshotting the selected files before clearing the input. This affects recovery after invalid selections and was also reproduced by the serial e2e journey.
2. Update e2e selectors for the rejection error and duplicate cancellation note; add a wait for the post-sign-in role URL before the affected tests navigate.
3. Review the S40/S44 hydration warning if it reproduces outside this browser environment; the warning only identified the caret-color style difference in these runs.
