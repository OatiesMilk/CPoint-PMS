# QA handoff: Phase 13 material requests

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Date            | 2026-10-13                                            |
| Feature         | phase-13-material-requests                            |
| Branch          | `main` checkout at `c044511`, **uncommitted** changes |
| Spec / prompt   | `material-requests.md` (project root), Phase 13       |
| Written by      | Claude                                                |
| Previous report | `qa/reports/2026-10-13-phase-12-material-requests.md` |

The previous report found no fault in the app. Its one failure (S17) was a wrong expectation in
that handoff and was corrected there; S20 and S21 were blocked because the dev database had no
older approved or rejected request. Do not re-test them.

Claude ran lint, typecheck, the 494 unit tests and the production build for this change. Claude
did **not** open the app in a browser and did **not** run any e2e test, so every screen below is
unverified until you check it.

## 1. What changed

A request now goes **Pending → Approved → Ordered → Partly received → Received**. The supplier
never uses the system; the Floor Manager records everything.

- **Ordering (Floor Manager).** An approved request has **Mark as ordered…**. The dialog asks for
  the **Supplier** (from Settings → Suppliers), an optional **Order or reference number**, a
  required **Expected delivery** date (today or later) and an optional **Note**. The request
  becomes **Ordered** and an **Order** card appears on the right.
- **Delivery late.** An ordered or partly received request whose expected date has passed shows a
  red **Delivery late** badge in the list, on the request and in the Order card. The list has a
  **Delivery** filter, and the Floor Manager's home card says "N deliveries are late".
- **Recording a delivery (Floor Manager).** **Mark received…** is gone. An ordered request has
  **Record delivery…**. The dialog lists each approved item with a quantity box that starts at
  what is still to come, a **Delivered on** date, a required **Proof of delivery** file picker
  (photo or PDF) and an optional **Note**. Saving adds exactly the quantities entered to stock.
  - If something is still outstanding, the request becomes **Partly received** and
    **Record delivery…** stays available for the next delivery.
  - If nothing is outstanding, the request becomes **Received**.
- **Close short (Floor Manager).** A partly received request also has **Close short…**. It needs
  a reason, ends the request as **Received** with a **Closed short** badge, and the page keeps
  what never arrived.
- **Proof files.** Shown in a new **Deliveries** card and in the Timeline: photos as small
  thumbnails, PDFs as a named link. Each opens in a new tab. The Floor Manager can **Add a proof
  file** to a delivery later. Files can't be removed.
- **Cancel after approval (Floor Manager).** An approved or ordered request has
  **Cancel request…**, and now a **Reason** is required. Once anything has arrived the button is
  replaced by a sentence saying to use Close short.
- **Copy to a new request.** On their own rejected or cancelled request, the requester sees
  **Copy to a new request**. The new-request form opens with the items filled in. Items that were
  rejected are listed under **Rejected last time**, unticked, each with its reason.
- **Floor Manager's own requests.** The Floor Manager now has **New purchase request** on
  Procurement, and a **Request** link on low or out-of-stock items in Inventory. Their request is
  marked **Raised by Floor Manager**, and they approve or reject its items themselves.
- **List.** The tabs are now Pending, Approved, Ordered, Partly received, Received, Rejected,
  Cancelled, All. There is a new **Expected** column (date and supplier).
- **Old requests were migrated.** A request received before this change shows one delivery with
  the text "Recorded before proof of delivery was added, so there is no file."

## 2. Files touched

| File                                                                                            | Change                                                                                    |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261013090000_purchase_ordering_deliveries/`        | two statuses, order and closing fields, deliveries, delivery lines, attachments           |
| `src/lib/procurement-rules.ts`                                                                  | new moves and refusals, outstanding quantity, receipt status, late flag, file limits      |
| `src/server/lib/attachment-type.ts` (new), `src/server/lib/receipt-sample.ts` (new)             | file type from the bytes, safe file names; sample proof files for the demo week           |
| `src/server/models/procurement.model.ts`, `src/server/models/ops-report.model.ts`               | deliveries, attachments, late filter, home-card counts; report counts by new statuses     |
| `src/server/services/procurement.service.ts`                                                    | order, record delivery, add proof, close short, cancel with a reason, copy, proof file    |
| `src/server/validators/procurement.validator.ts`, `src/server/policies/permissions.ts`          | new schemas; the Floor Manager can request; who may cancel and copy                       |
| `src/server/controllers/procurement.controller.ts`, `src/app/api/v1/procurement/**`             | new routes `order`, `deliveries`, `close-short`, `attachments`, `suppliers`; no `receive` |
| `src/app/(app)/procurement/[id]/page.tsx`, `request-actions.tsx`                                | Order card, Deliveries card, Arrived column, new buttons and dialogs                      |
| `src/app/(app)/procurement/[id]/delivery-dialog.tsx` (new), `proof-files.tsx` (new)             | the Record delivery dialog; proof thumbnails and "Add a proof file"                       |
| `src/app/(app)/procurement/page.tsx`, `request-filters.tsx`, `request-form.tsx`, `new/page.tsx` | tabs, Expected column, badges, Delivery filter; copy and Floor Manager mode in the form   |
| `src/app/(app)/inventory/page.tsx`, `src/components/features/procurement/*`                     | "Request" on low items; new badges; home card lines                                       |
| `src/lib/ops-rules.ts`, `src/app/(app)/reports/_components/ops-sections.tsx`                    | "late" in the Operations report now means past the expected delivery date                 |
| `src/server/services/demo-seed.service.ts`                                                      | nine demo requests, with generated proof files                                            |
| `tests/unit/*`, `tests/e2e/procurement.spec.ts`                                                 | new and updated tests                                                                     |
| `docs/*`, `README.md`, `DESIGN.md`, `.gitignore`                                                | decisions D-041 to D-045, roadmap, API, status, session log, demo script                  |

Database migration in this change: **yes** (name: `20261013090000_purchase_ordering_deliveries`).
It is already applied to the local dev database.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # apply migrations (should say nothing is pending)
npm run db:generate    # Prisma client matches the new schema
npm run dev            # app on http://localhost:3000
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change:

- Do **not** run `npm run demo:seed` on this database; it only works on an empty one.
- Uploaded proof files are written to `./storage/uploads/pod/` (the `UPLOADS_DIR` in `.env`). That
  folder is ignored by git. Leave the files there.
- The e2e specs start their own production server on port 3100 and need a build. A build and
  `npm run dev` both write to `.next`, so **stop the dev server before building**: run the manual
  scenarios with `npm run dev` first, stop it, then run the specs below.
- If Playwright's Chromium is missing, run `npx playwright install chromium` and say in the report
  which browser you used.

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts
```

`procurement.spec.ts` changed a lot. Two existing tests were updated (the approve-and-receive
journey and the item-decision test now order first, then use **Record delivery…** with a proof
file) and six were added (short delivery then close short; a refused file; cancel an ordered
request and copy it; copy with rejected items; a Floor Manager request that becomes late; the
status tabs). Claude wrote them but **did not run them**, so a failure may be the test, not the
app: say which you think it is. The new tests include axe checks on the new screens.

**Optional, before the PR (not required for this report):** the demo week changed and now writes
proof files. On a throwaway stack with an empty database and `SEED_DEMO_WEEK=true`, check that
Procurement shows nine requests with at least one in every tab, that the partly received one has
a photo and a PDF, and that one ordered request shows Delivery late.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

**Files to prepare** in a scratch folder outside the project:

| File        | How to make it                                                             |
| ----------- | -------------------------------------------------------------------------- |
| `photo.jpg` | any real JPEG or PNG image, for example a screenshot                       |
| `note.pdf`  | any real PDF, for example a page printed to PDF                            |
| `fake.pdf`  | a plain text file containing `hello`, saved or renamed as `fake.pdf`       |
| `big.jpg`   | a file over 10 MB: in PowerShell, `fsutil file createnew big.jpg 11534336` |

**Supplier.** Settings → Suppliers (System Admin) should already list at least one active
supplier. If it is empty, add one named `QA13 Supplier` before S2.

**Items.** Sign in as the **Floor Manager** and add three items under Inventory → Add item. Use
category **Other** and unit **box** for all three. If a name is taken, add a suffix and use that
name in the steps.

| Name       | Reorder level | Opening stock |
| ---------- | ------------- | ------------- |
| QA13 Tacks | 5             | 2             |
| QA13 Glue  | 5             | 1             |
| QA13 Laces | 5             | 3             |

**Requests.** As the **Shoe Constructor**, from **New material request**. Use a Needed by date
about two weeks ahead and leave Remarks empty. Note each code (`PR-2026-…`).

- **REQ-A:** QA13 Tacks, quantity 6; QA13 Glue, quantity 4; and a third item with
  "Something not in inventory yet": name `QA13 eyelets`, kind Other, unit `pack`, quantity 2.
- **REQ-B:** QA13 Laces, quantity 3.
- **REQ-C:** QA13 Tacks, quantity 1, and QA13 Laces, quantity 2.
- **REQ-D:** QA13 Glue, quantity 1.

## 5. Test scenarios

Run them in order: later scenarios use the state earlier ones leave behind. "FM" is the Floor
Manager, "SC" the Shoe Constructor.

Quoted text is what the screen should say. Two things are not failures: apostrophes and quotation
marks may be curly on screen where this file has straight ones, and a label and its value sit in
two columns where this file writes them with a colon ("Cancelled because: …").

| ID  | Role | Steps                                                                                                                                                                                             | Expected result                                                                                                                                                                                                                                                                                                                                        | Priority |
| --- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| S1  | FM   | Procurement → open REQ-A. Leave every item on Approve (choose Approve for QA13 eyelets) and click **Save decisions**.                                                                             | Status **Approved**. The Decision card shows **Mark as ordered…** as the main button and **Cancel request…** below it. There is no **Mark received…** and no **Record delivery…**.                                                                                                                                                                     | High     |
| S2  | FM   | On REQ-A click **Mark as ordered…**, then **Mark as ordered** without filling anything.                                                                                                           | Two messages: "Choose the supplier you ordered from." under Supplier and "Choose the date the supplier expects to deliver." under Expected delivery. Focus is in Supplier. The dialog stays open.                                                                                                                                                      | High     |
| S3  | FM   | In the same dialog choose a supplier, type `PO-QA13` as the reference, pick a date 3 days ahead, type the note `Half paid up front`, click **Mark as ordered**.                                   | Toast "PR-… marked as ordered from <supplier>." Status **Ordered**. An **Order** card shows the supplier, Reference `PO-QA13`, the Expected date, "Ordered by" with the FM's name, and the note. A **Deliveries** card says "Nothing has arrived yet. The supplier expects to deliver on <date>."                                                      | High     |
| S4  | FM   | Look at the Timeline on REQ-A.                                                                                                                                                                    | A new **Ordered** entry reading "Ordered from <supplier>, reference PO-QA13. Expected <date>." and "Half paid up front" on the next line.                                                                                                                                                                                                              | Medium   |
| S5  | FM   | Procurement → **Ordered** tab.                                                                                                                                                                    | REQ-A is listed. Its **Expected** column shows the date and the supplier's name. No "Delivery late" badge.                                                                                                                                                                                                                                             | Medium   |
| S6  | FM   | Open REQ-A → **Record delivery…**. Do not change anything yet.                                                                                                                                    | Dialog "Record a delivery for PR-…". Three items: QA13 Tacks with `6`, QA13 Glue with `4`, QA13 eyelets with `2`. Under each: "N boxes still to come." (packs for eyelets). Under eyelets also: "Not in inventory, so it won't be added to stock. Add this item to inventory to receive it into stock." Delivered on is today.                         | High     |
| S7  | FM   | Click **Record delivery** with no file attached.                                                                                                                                                  | "Attach a photo or PDF of the delivery receipt. A delivery can't be recorded without proof." under Proof of delivery. Nothing is saved.                                                                                                                                                                                                                | High     |
| S8  | FM   | Attach `fake.pdf` and click **Record delivery**.                                                                                                                                                  | "“fake.pdf” isn't a photo or a PDF. Attach a JPEG, PNG, WebP or PDF file." under Proof of delivery. The dialog stays open and the quantities are still there. Reload the page: status is still **Ordered**.                                                                                                                                            | High     |
| S9  | FM   | Open the dialog again, attach `big.jpg`, click **Record delivery**.                                                                                                                               | "“big.jpg” is larger than 10 MB. Attach a smaller photo or PDF." Nothing is saved.                                                                                                                                                                                                                                                                     | Medium   |
| S10 | FM   | Remove `big.jpg` with its **Remove** button. Attach `photo.jpg`. Change QA13 Tacks to `7` and click **Record delivery**.                                                                          | "Received quantity can't be more than the 6 boxes still outstanding." under QA13 Tacks, and focus is in that box. `photo.jpg` is still listed.                                                                                                                                                                                                         | High     |
| S11 | FM   | Set all three quantities to `0` and click **Record delivery**.                                                                                                                                    | "Enter what arrived for at least one item. If nothing came, there is no delivery to record." Nothing is saved.                                                                                                                                                                                                                                         | Medium   |
| S12 | FM   | Set QA13 Tacks `4`, QA13 Glue `4`, QA13 eyelets `0`. Also attach `note.pdf` (so two files). Note: `Two boxes of tacks short`. Click **Record delivery**.                                          | Toast "Delivery recorded for PR-…. Still to come: 2 boxes of QA13 Tacks, 2 packs of QA13 eyelets." Status **Partly received**.                                                                                                                                                                                                                         | High     |
| S13 | FM   | Look at the Items table on REQ-A.                                                                                                                                                                 | The third column is now **Arrived**. QA13 Tacks: "4 boxes" and "2 still to come", badge "Arrived part added to stock". QA13 Glue: "4 boxes" and "all here", badge "Added to stock". QA13 eyelets: "0 packs" and "2 still to come", badge "Not in inventory".                                                                                           | High     |
| S14 | FM   | Look at the **Deliveries** card.                                                                                                                                                                  | One delivery: "Delivered <today>", "recorded by" the FM, a list with "4 boxes of QA13 Tacks" and "4 boxes of QA13 Glue" (no eyelets line), the note, one photo thumbnail and a link named `note.pdf`. An **Add a proof file** button is below.                                                                                                         | High     |
| S15 | FM   | Click the thumbnail, then the `note.pdf` link.                                                                                                                                                    | Each opens in a new tab and shows the image or the PDF.                                                                                                                                                                                                                                                                                                | Medium   |
| S16 | FM   | Inventory → open QA13 Tacks, then QA13 Glue.                                                                                                                                                      | QA13 Tacks on hand **6 boxes** (2 + 4). QA13 Glue on hand **5 boxes** (1 + 4). Each ledger has a "Delivery for PR-…" entry.                                                                                                                                                                                                                            | High     |
| S17 | FM   | Back on REQ-A. Look at the Decision card.                                                                                                                                                         | **Record delivery…** (main) and **Close short…** are shown. There is no **Cancel request…** button. Instead: "Part of this request has already arrived, so it can't be cancelled. Use Close short for what won't come."                                                                                                                                | High     |
| S18 | FM   | **Record delivery…** again.                                                                                                                                                                       | QA13 Tacks starts at `2`, QA13 Glue is `0` and greyed out with "All of it has arrived.", QA13 eyelets starts at `2`. No files are attached (the earlier ones are not carried over).                                                                                                                                                                    | Medium   |
| S19 | FM   | Set QA13 Tacks `1`, QA13 eyelets `2`, attach `photo.jpg`, click **Record delivery**.                                                                                                              | Status stays **Partly received**. Toast ends "Still to come: 1 box of QA13 Tacks." The Deliveries card now has two deliveries; the second lists "2 packs of QA13 eyelets (not in inventory, so not added to stock)". Below the Items table: "Items not in inventory weren't added to stock. Add them under Inventory, then record what arrived there." | High     |
| S20 | FM   | On the first delivery click **Add a proof file** and choose `note.pdf`.                                                                                                                           | Toast "1 proof file added to PR-…." The first delivery now shows two `note.pdf` links (or the photo and two PDFs). The Timeline has an entry "Added proof of delivery: note.pdf."                                                                                                                                                                      | Medium   |
| S21 | FM   | On any delivery click **Add a proof file** and choose `fake.pdf`.                                                                                                                                 | A red message under the button naming `fake.pdf` as not a photo or a PDF. No file is added.                                                                                                                                                                                                                                                            | Medium   |
| S22 | FM   | Click **Close short…**, then **Close short** with the Reason empty.                                                                                                                               | The dialog text names what never arrived ("1 box of QA13 Tacks"). Message: "Enter a reason of at least 3 characters for closing short, e.g. “The supplier is out of stock.”" Nothing changes.                                                                                                                                                          | High     |
| S23 | FM   | Type `Supplier is out of tacks` and click **Close short**.                                                                                                                                        | Status **Received** with a **Closed short** badge next to it. Decision card: "Closed short because: Supplier is out of tacks" and "Never arrived: 1 box of QA13 Tacks". Items table: QA13 Tacks "5 boxes" and "1 never arrived". No Record delivery, Close short or Cancel buttons. QA13 Tacks stock is 7 boxes (not 8).                               | High     |
| S24 | SC   | Open REQ-A from Material requests.                                                                                                                                                                | Status Received, Closed short. The Order card, both deliveries and their proof files are visible, and the thumbnail opens. There is no **Add a proof file** button and no action button.                                                                                                                                                               | High     |
| S25 | FM   | Open REQ-B, save it with QA13 Laces on Approve, then **Mark as ordered…** with any supplier and a date 2 days ahead. Then click **Cancel request…** and **Cancel request** with the Reason empty. | "Enter a reason of at least 3 characters, so the requester knows why it's cancelled." Focus is in Reason. Status still **Ordered**.                                                                                                                                                                                                                    | High     |
| S26 | FM   | Type `Supplier can't deliver this month` and click **Cancel request**.                                                                                                                            | Status **Cancelled**. Decision card: "Cancelled because: Supplier can't deliver this month". QA13 Laces stock is unchanged (3 boxes). The FM sees no **Copy to a new request** button (it is not their request).                                                                                                                                       | High     |
| S27 | SC   | Open REQ-B. Click **Copy to a new request**.                                                                                                                                                      | The new-request page opens with "Copied from PR-…" (the code is a link). Item 1 is QA13 Laces with quantity 3. Needed by is empty.                                                                                                                                                                                                                     | High     |
| S28 | SC   | Pick a Needed by date two weeks ahead and click **Send request**. Note the new code (**REQ-B2**).                                                                                                 | A new pending request. Its header line ends "copied from PR-…" with a link to REQ-B, and its first Timeline entry says "Copied from PR-…." Open REQ-B: its Timeline ends with "Copied to a new request: PR-…" linking to REQ-B2.                                                                                                                       | High     |
| S29 | FM   | Open REQ-C. Choose Approve for QA13 Tacks and Reject for QA13 Laces with the reason `QA13: laces came in yesterday`. Save. Then **Cancel request…** with the reason `QA13: order is off`.         | Status Cancelled (it was Approved, not yet ordered).                                                                                                                                                                                                                                                                                                   | Medium   |
| S30 | SC   | Open REQ-C → **Copy to a new request**.                                                                                                                                                           | Item 1 is QA13 Tacks, quantity 1. There is no Item 2. A box titled **Rejected last time** lists "QA13 Laces · 2 boxes" with an **unticked** checkbox and "Rejected: QA13: laces came in yesterday".                                                                                                                                                    | High     |
| S31 | SC   | Tick the QA13 Laces checkbox, then untick it.                                                                                                                                                     | Ticking adds Item 2: QA13 Laces, quantity 2. Unticking removes Item 2 again. Leave the page without sending.                                                                                                                                                                                                                                           | Medium   |
| S32 | SC   | Open REQ-D (pending). Click **Cancel request…**, leave the Note empty, click **Cancel request**.                                                                                                  | It is cancelled without asking for a reason (a pending request's own sender needs none). **Copy to a new request** appears.                                                                                                                                                                                                                            | Medium   |
| S33 | FM   | Inventory. Find QA13 Glue (5 on hand, reorder at 5, so Low, and no open request now). Click **Request** in its Stock column.                                                                      | The **New purchase request** page opens with QA13 Glue already chosen. The page says "Raise a restock request yourself…". The button at the bottom reads **Raise request**.                                                                                                                                                                            | High     |
| S34 | FM   | Enter quantity 5, a Needed by date a week ahead, click **Raise request**. Note the code (**REQ-E**).                                                                                              | Toast "PR-… raised. Decide its items next." The request page shows a **Raised by Floor Manager** badge and the decision panel with Approve already selected for QA13 Glue.                                                                                                                                                                             | High     |
| S35 | FM   | Click **Save decisions** on REQ-E.                                                                                                                                                                | Status Approved, "Approved by" the FM. Procurement → Approved tab lists REQ-E with **Raised by Floor Manager** next to the requester's name.                                                                                                                                                                                                           | High     |
| S36 | FM   | Inventory → QA13 Glue row.                                                                                                                                                                        | It now shows a **Requested** badge and no **Request** link.                                                                                                                                                                                                                                                                                            | Medium   |
| S37 | FM   | Procurement → **New purchase request**. Open the Item list.                                                                                                                                       | Leather roll items can be chosen (they are not greyed out) and there is no "Leather rolls are greyed out" line. Leave without sending.                                                                                                                                                                                                                 | Medium   |
| S38 | FM   | Home page (`/floor-manager`), the **Purchase requests** card.                                                                                                                                     | A line "1 approved, waiting to be ordered" (or more, if other approved requests exist) linking to the Approved tab.                                                                                                                                                                                                                                    | Medium   |
| S39 | FM   | Procurement, any tab.                                                                                                                                                                             | Tabs in this order: Pending, Approved, Ordered, Partly received, Received, Rejected, Cancelled, All, each of the first seven with a count in brackets. The **Delivery** filter has "Any delivery" and "Delivery late".                                                                                                                                 | Medium   |
| S40 | FM   | Open `PR-2026-0001` (received before this change; if it is missing, use any request received before today's session and say which).                                                               | Status Received. The Arrived column shows each approved item's full quantity and "all here", with "Added to stock". The Deliveries card has one delivery with "Recorded before proof of delivery was added, so there is no file." Inventory stock for those items is unchanged from before.                                                            | High     |
| S41 | FM   | Reports → Operations, the purchasing section.                                                                                                                                                     | The middle figure is labelled "Approved, not all received" with "none late" or "N past the expected date" under it. The page loads without an error.                                                                                                                                                                                                   | Low      |
| S42 | FM   | Open REQ-E, click **Mark as ordered…**, press Tab through the dialog and Escape.                                                                                                                  | Focus stays inside the dialog and is visible on every control. Escape closes it and nothing is saved.                                                                                                                                                                                                                                                  | Medium   |
| S43 | FM   | Resize the window to 960 px wide. Open REQ-A, then open **Mark as ordered…** on REQ-E, then the Procurement list.                                                                                 | No sideways page scroll on any of them. The dialog fits and its buttons are reachable. The tabs wrap onto a second line if needed.                                                                                                                                                                                                                     | Medium   |
| S44 | FM   | On REQ-E order it with a date of today. Then, in the database, move the date back three days (see the note under this table) and reload Procurement → Ordered.                                    | REQ-E shows a red **Delivery late** badge. Choosing **Delivery late** in the Delivery filter keeps it listed. The home card says "1 delivery is late" (or more). The Order card on REQ-E shows the badge next to Expected.                                                                                                                             | Medium   |

Note for S44: a past expected date can't be entered through the app, so set it in the database.
With the DB user and name from `.env` (`POSTGRES_USER`, `POSTGRES_DB`):

```bash
docker exec cpoint-pms-db-1 psql -U <POSTGRES_USER> -d <POSTGRES_DB> -c "UPDATE purchase_requests SET \"expectedDeliveryOn\" = CURRENT_DATE - 3 WHERE code = '<REQ-E code>'"
```

If that is not possible, mark S44 Blocked: the e2e test "the Floor Manager raises a restock
request…" covers the same thing.

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                                                                                                                                                                                 | Expected                                                                                                           |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A1  | Shoe Constructor               | Open REQ-E's URL (a request they did not send)                                                                                                                                                                                                | The not-found page                                                                                                 |
| A2  | Shoe Constructor               | On REQ-B2, saved as approved by the FM first: look for **Mark as ordered…**, **Record delivery…**, **Cancel request…**                                                                                                                        | None of them is shown. The page says "Approved. The Floor Manager orders the approved items next."                 |
| A3  | Shoe Constructor               | `POST /api/v1/procurement/requests/<REQ-B2 id>/order` with `{"supplierId":"<any uuid>","expectedDeliveryOn":"<a date ahead>"}`                                                                                                                | HTTP 403                                                                                                           |
| A4  | Shoe Constructor               | `POST /api/v1/procurement/requests/<REQ-B2 id>/cancel` with `{}` (it is approved now)                                                                                                                                                         | HTTP 403, message says only the Floor Manager can cancel after approval                                            |
| A5  | System Admin                   | Open REQ-A                                                                                                                                                                                                                                    | Read-only: the Order card, deliveries and proof files show and open; no action buttons and no **Add a proof file** |
| A6  | System Admin                   | `POST /api/v1/procurement/requests/<REQ-E id>/close-short` with `{"reason":"test"}`                                                                                                                                                           | HTTP 403                                                                                                           |
| A7  | Quality Inspector              | Open a proof file's URL copied from REQ-A (`/api/v1/procurement/attachments/<id>`)                                                                                                                                                            | HTTP 403                                                                                                           |
| A8  | Signed out                     | Open the same proof file URL in a private window                                                                                                                                                                                              | HTTP 401, no file                                                                                                  |
| A9  | Floor Manager                  | `POST /api/v1/procurement/requests/<REQ-E id>/deliveries` (after S44, so it is ordered) as multipart with no `files` and `data` = `{"deliveredOn":"<today>","lines":[{"lineId":"<REQ-E's line id, from GET …/requests/<id>>","quantity":5}]}` | HTTP 422; `details[0].path` is `["files"]`. Stock is unchanged                                                     |
| A10 | Floor Manager                  | `POST /api/v1/procurement/requests/<REQ-A id>/cancel` with `{"reason":"test"}` (REQ-A is received)                                                                                                                                            | HTTP 409, "Only pending, approved or ordered requests can be cancelled. This one is received."                     |

## 6. Out of scope / known issues

- **No message goes to the supplier**, and suppliers have no accounts. That is by design (D-041).
- **One order per request.** There is no way to order two items of one request from two
  suppliers; that is a team decision (D-041), not a gap.
- **An order can't be edited** after it is marked, and **proof files can't be removed**
  (D-042). Do not report either.
- **A typed item** (not in inventory) is recorded as arrived but never added to stock. Expected.
- **Urgency** still counts while a request is ordered or partly received; it disappears once the
  request is received, rejected or cancelled. Expected.
- The Expected date field has a browser date picker limited to today or later; typing an earlier
  date by keyboard is still caught with "Expected delivery can't be in the past. Pick today or a
  later date."
- Carried over from earlier reports, with no failing test: the "destination stream closed early"
  lines and the `next start` with `output: standalone` warning in the e2e server log. Mention them
  only if their number or wording changed.
- Per-person counts or rankings must not appear anywhere (D-008). "Raised by Floor Manager" is a
  label on a request, not a count. Report it if you see a count per person.
