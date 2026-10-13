# QA handoff: Phase 12 material requests

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Date            | 2026-10-13                                            |
| Feature         | phase-12-material-requests                            |
| Branch          | `main` checkout at `8adab3a`, **uncommitted** changes |
| Spec / prompt   | `material-requests.md` (project root), Phase 12       |
| Written by      | Claude                                                |
| Previous report | `qa/reports/2026-10-11-phase-11-material-requests.md` |

The previous report's one failure (F1, Item and Quantity not stacking at 960 px) was closed in
Phase 11 as a wrong expectation in that handoff, not an app fault. Do not re-test it as a failure:
the fields stay side by side at 960 px and stack only below 640 px (D-034).

## 1. What changed

- **The Floor Manager decides each item, not the whole request.** On a pending request the
  **Items** card is now a decision panel. Every item has **Approve** and **Reject**. Choosing
  Reject opens a **Reason for rejecting <item>** box for that item. **Save decisions** saves all
  of them together. Nothing is decided until Save is clicked.
- **Stock guidance next to each item.** Each item shows a line such as "On hand 40 boxes · reorder
  at 5 · was 40 when requested".
  - More than **twice** the reorder level on hand: a **Still in stock** badge, **Reject** already
    selected, and the reason already filled in: "Stock is still high (40 boxes on hand, reorder at
    5)." The Floor Manager can change both.
  - At or below the reorder level, or nothing on hand: **Approve** already selected.
  - In between, or a reorder level of 0: nothing selected.
  - A typed item that is not in inventory: a **Not in inventory** badge, nothing selected.
- **Approve all remaining** sets every item that has no choice yet to Approve. The button is
  hidden once every item has a choice.
- **Reject whole request…** (in the **Decision** card on the right) is the shortcut: one reason,
  every item rejected. The old single **Approve** and **Reject…** buttons are gone.
- **Status follows the items.** At least one item approved: the request is **Approved**. Every
  item rejected: **Rejected**.
- **The requester sees the result per item.** The request page shows "1 of 2 items approved" in
  the Decision card, an **Approved** or **Rejected** badge under each item, and "Reason: …" under
  each rejected item. The timeline has one entry for the decision that lists the items. The list
  shows "1 of 2 items approved" next to the status of a partly approved request.
- **Receiving adds only approved items to stock.** The **Mark received…** dialog lists approved
  items only. A rejected item no longer shows a "Requested in PR-…" badge in Inventory.
- **Old requests were migrated.** Requests approved or received before this change show every
  item as Approved. Requests rejected before this change show every item as Rejected with the
  request's reason.

## 2. Files touched

| File                                                                                | Change                                                                                   |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261013030000_purchase_line_decisions/` | `PurchaseLineDecision` enum; decision fields on request lines; old decisions copied down |
| `src/lib/procurement-rules.ts`, `src/lib/domain.ts`                                 | status from items, summary, timeline note, well-stocked rule and suggestions             |
| `src/server/models/procurement.model.ts`                                            | `setLineDecision`; decision fields in reads; open requests skip rejected items           |
| `src/server/models/ops-report.model.ts`                                             | "requested" in the stock table skips rejected items                                      |
| `src/server/services/procurement.service.ts`                                        | `decideRequest`; approve and reject go through it; receive posts approved items only     |
| `src/server/validators/procurement.validator.ts`                                    | `decideSchema`                                                                           |
| `src/server/controllers/procurement.controller.ts`                                  | `decide`                                                                                 |
| `src/app/api/v1/procurement/requests/[id]/decide/route.ts` (new)                    | `POST …/decide`                                                                          |
| `src/app/(app)/procurement/actions.ts`                                              | `decideRequestAction`                                                                    |
| `src/app/(app)/procurement/[id]/line-decisions.tsx` (new)                           | the decision panel                                                                       |
| `src/app/(app)/procurement/[id]/page.tsx`, `request-actions.tsx`                    | per-item results, "N of M items approved", "Reject whole request…"                       |
| `src/app/(app)/procurement/page.tsx`, `src/app/(app)/constructor/page.tsx`          | "1 of 2 items approved" on partly approved requests                                      |
| `src/server/services/demo-seed.service.ts`                                          | the approved demo request has two items, one rejected                                    |
| `tests/unit/*`, `tests/e2e/procurement.spec.ts`                                     | new and updated tests                                                                    |
| `docs/*`, `README.md`, `DESIGN.md`                                                  | decisions D-039 and D-040, roadmap, API, status, session log, demo script                |

Database migration in this change: **yes** (name: `20261013030000_purchase_line_decisions`). It is
already applied to the local dev database.

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

- Do **not** run `npm run demo:seed` on this database; it only works on an empty one and the dev
  database already has data.
- The existing e2e specs start their own production server on port 3100 and need a build. A build
  and `npm run dev` both write to `.next`, so **stop the dev server before building**: run the
  manual scenarios with `npm run dev` first, stop it, then run the specs below.
- If Playwright's Chromium is missing, run `npx playwright install chromium` and say in the report
  which browser you used.

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts
```

`procurement.spec.ts` has two new tests (item decisions with stock guidance; every item needs a
decision) and two changed ones (the approve-and-receive journey now uses **Save decisions**; the
reject test uses **Reject whole request…**). Claude wrote them but **did not run them**, so a
failure may be the test, not the app: say which you think it is.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs. Sign in as the **Floor Manager** and add four items under Inventory → Add
item before starting. Use category **Other** and unit **box** for all four. If a name is already
taken from an earlier run, add a suffix (for example "QA12 Nails 2") and use that name in the
steps.

| Name          | Reorder level | Opening stock | What it is for                                    |
| ------------- | ------------- | ------------- | ------------------------------------------------- |
| QA12 Nails    | 5             | 40            | well stocked: 40 is more than 2 × 5               |
| QA12 Adhesive | 5             | 2             | low: 2 is below 5                                 |
| QA12 Thread   | 5             | 10            | exactly 2 × 5: **not** well stocked, not low      |
| QA12 Wire     | 0             | 50            | no reorder level: no guidance, whatever the stock |

Requests to create, as the **Shoe Constructor**, from **New material request**. Use a Needed by
date about two weeks ahead for all of them and leave Remarks empty. Note each request's code
(`PR-2026-…`).

- **REQ-A:** QA12 Nails, quantity 3, and QA12 Adhesive, quantity 4 (two items; use **Add another
  item** or the equivalent button on the form).
- **REQ-B:** QA12 Thread, quantity 1; QA12 Wire, quantity 1; and a third item with
  "Something not in inventory yet": name `QA12 eyelets`, kind Other, unit `pack`, quantity 2.
- **REQ-C:** QA12 Adhesive, quantity 1 (one item).
- **REQ-D:** QA12 Nails, quantity 1, and QA12 Adhesive, quantity 1.

The dev database should also hold older requests from before this change, for the migration
checks: `PR-2026-0001` (received), `PR-2026-0003` (approved) and `PR-2026-0015` (rejected with the
reason "QA: still 3 boxes in the back room"). Claude did not open them; if one is missing or in a
different state, use any request with that status from before 2026-10-13 and say which.

## 5. Test scenarios

| ID  | Role             | Steps                                                                                                                                                                                              | Expected result                                                                                                                                                                                                                                                                                                                                                                                                        | Priority |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Floor Manager    | Open REQ-A. Look at the **Items** card and the **Decision** card.                                                                                                                                  | Items shows two items, each with **Approve** and **Reject** and a **Save decisions** button. The Decision card shows **Reject whole request…**. There is no single **Approve** button and no **Reject…** button.                                                                                                                                                                                                       | High     |
| S2  | Floor Manager    | On REQ-A, read the QA12 Nails item.                                                                                                                                                                | A **Still in stock** badge. The text "On hand 40 boxes · reorder at 5 · was 40 when requested". **Reject** is selected. The reason box reads "Stock is still high (40 boxes on hand, reorder at 5)."                                                                                                                                                                                                                   | High     |
| S3  | Floor Manager    | On REQ-A, read the QA12 Adhesive item.                                                                                                                                                             | A **Low** badge. The text "On hand 2 boxes · reorder at 5 · was 2 when requested". **Approve** is selected. No reason box under it.                                                                                                                                                                                                                                                                                    | High     |
| S4  | Floor Manager    | On REQ-A, without clicking Save, reload the page.                                                                                                                                                  | The request is still **Pending**. Nothing was decided by opening the page.                                                                                                                                                                                                                                                                                                                                             | High     |
| S5  | Floor Manager    | On REQ-A, clear the reason box under QA12 Nails and click **Save decisions**.                                                                                                                      | Under that box: "Enter a reason of at least 3 characters for rejecting QA12 Nails, so the requester knows why." The cursor is in that box. The request is still Pending.                                                                                                                                                                                                                                               | High     |
| S6  | Floor Manager    | On REQ-A, select **Approve** for QA12 Nails, then select **Reject** again.                                                                                                                         | The reason box is back and filled with "Stock is still high (40 boxes on hand, reorder at 5)." The error from S5 is gone.                                                                                                                                                                                                                                                                                              | Medium   |
| S7  | Floor Manager    | On REQ-A, type `Ordering adhesive today` in **Note to the requester** and click **Save decisions**.                                                                                                | A toast says "<code> decided: 1 of 2 items approved." The status badge is **Approved**. The Decision card shows **Decided by** with the Floor Manager's name, and "1 of 2 items approved". The Approve and Reject choices are gone.                                                                                                                                                                                    | High     |
| S8  | Floor Manager    | Still on REQ-A, read the Items table and the Timeline.                                                                                                                                             | QA12 Nails shows a **Rejected** badge and "Reason: Stock is still high (40 boxes on hand, reorder at 5)." QA12 Adhesive shows an **Approved** badge. The timeline's Approved entry lists "Approved: QA12 Adhesive." and "Rejected: QA12 Nails. Stock is still high…" and the note.                                                                                                                                     | High     |
| S9  | Shoe Constructor | Open REQ-A.                                                                                                                                                                                        | Status **Approved**. "1 of 2 items approved" is shown. QA12 Nails shows **Rejected** with the reason from S8. QA12 Adhesive shows **Approved**. No Approve or Reject controls.                                                                                                                                                                                                                                         | High     |
| S10 | Shoe Constructor | Open **Material requests** → **All**. Find REQ-A's row. Then open the home page.                                                                                                                   | The row shows **Approved** and "1 of 2 items approved". On the home page, REQ-A under **My material requests** also shows "1 of 2 items approved".                                                                                                                                                                                                                                                                     | Medium   |
| S11 | Floor Manager    | Inventory: search for `QA12 Nails`, then for `QA12 Adhesive`.                                                                                                                                      | QA12 Nails has **no** "Requested in <REQ-A code>" badge from REQ-A (it may show one for REQ-D). QA12 Adhesive shows a "Requested in …" badge.                                                                                                                                                                                                                                                                          | Medium   |
| S12 | Floor Manager    | Open REQ-A and click **Mark received…**. Read the dialog, then click **Mark received**.                                                                                                            | The dialog lists "QA12 Adhesive: +4 boxes" and does **not** mention QA12 Nails. After confirming, the status is **Received**. In Inventory, QA12 Adhesive is at 6 boxes and QA12 Nails is still at 40.                                                                                                                                                                                                                 | High     |
| S13 | Floor Manager    | Open REQ-B. Read all three items.                                                                                                                                                                  | QA12 Thread (10 on hand, reorder at 5): **no** "Still in stock" badge, nothing selected. QA12 Wire (reorder at 0): **no** "Still in stock" badge, nothing selected. QA12 eyelets: a **Not in inventory** badge, nothing selected. Below: "3 of 3 items still to decide."                                                                                                                                               | High     |
| S14 | Floor Manager    | On REQ-B, click **Save decisions** with nothing selected.                                                                                                                                          | Three messages, one under each item: "Choose Approve or Reject for QA12 Thread." (and the same for QA12 Wire and QA12 eyelets). A summary box on top lists the three. Focus is on QA12 Thread's Approve option. Still Pending.                                                                                                                                                                                         | High     |
| S15 | Floor Manager    | On REQ-B, select **Reject** for QA12 eyelets and type `Found a pack in storage`. Click **Approve all remaining**.                                                                                  | QA12 Thread and QA12 Wire are now on **Approve**. QA12 eyelets is still on **Reject** with its reason. The **Approve all remaining** button is gone. The text reads "Every item has a decision. Nothing is final until you save."                                                                                                                                                                                      | High     |
| S16 | Floor Manager    | On REQ-B, click **Save decisions**.                                                                                                                                                                | Status **Approved**, "2 of 3 items approved". QA12 eyelets shows **Rejected** and "Reason: Found a pack in storage".                                                                                                                                                                                                                                                                                                   | High     |
| S17 | Floor Manager    | Open REQ-C (one item, QA12 Adhesive). Select **Approve** and click **Save decisions**.                                                                                                             | Before choosing: nothing is selected, because S12 raised QA12 Adhesive to 6 boxes, which is between its reorder level (5) and twice that. After saving: toast "<code> approved." Status **Approved**. The Decision card shows **Approved by** (not "Decided by"). There is no "1 of 1 items approved" line. (Corrected after the 2026-10-13 report: the first wording wrongly said Approve would already be selected.) | Medium   |
| S18 | Floor Manager    | Open REQ-D. Click **Reject whole request…**, leave Reason empty and click **Reject request**.                                                                                                      | In the dialog: "Enter a reason of at least 3 characters, so the requester knows why it's rejected." The cursor is in the Reason box. The request is still Pending.                                                                                                                                                                                                                                                     | High     |
| S19 | Floor Manager    | Continue: type `QA: not this month` and click **Reject request**.                                                                                                                                  | Status **Rejected**. The Decision card shows **Rejected by** and Reason "QA: not this month". Both items show **Rejected** and "Reason: QA: not this month".                                                                                                                                                                                                                                                           | High     |
| S20 | Floor Manager    | Open `PR-2026-0003` (approved before this change).                                                                                                                                                 | Every item shows an **Approved** badge. **Mark received…** is still offered.                                                                                                                                                                                                                                                                                                                                           | Medium   |
| S21 | Floor Manager    | Open `PR-2026-0015` (rejected before this change).                                                                                                                                                 | Its item shows **Rejected** and "Reason: QA: still 3 boxes in the back room".                                                                                                                                                                                                                                                                                                                                          | Medium   |
| S22 | Floor Manager    | Open `PR-2026-0001` (received before this change).                                                                                                                                                 | Every item shows **Approved**, and items in inventory still show "Added to stock on receipt".                                                                                                                                                                                                                                                                                                                          | Low      |
| S23 | Floor Manager    | Create one more request as the constructor (QA12 Adhesive, 1). Open it in **two** browser tabs as the Floor Manager. Save decisions in the first tab, then click **Save decisions** in the second. | The second tab shows a red message: "Only a pending request can be decided. This one is approved." The page then shows the decided request, and no second decision is saved.                                                                                                                                                                                                                                           | Medium   |
| S24 | Floor Manager    | Resize the window to about 960 px wide and open a pending request (create one more if none is left).                                                                                               | No sideways page scroll. The Approve and Reject options and the reason box stay inside the Items card.                                                                                                                                                                                                                                                                                                                 | Low      |
| S25 | Floor Manager    | On a pending request, use only the keyboard: Tab to an item's Approve and Reject options, switch with the arrow keys, Tab to the reason box and to **Save decisions**.                             | Every control is reachable and shows a visible focus ring. Arrow keys move between Approve and Reject for one item only.                                                                                                                                                                                                                                                                                               | Low      |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                                     | Expected                                                                                                      |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A1  | Shoe Constructor               | Open their own pending request                                                                    | Items are listed read-only: no Approve or Reject options, no **Save decisions**, no **Reject whole request…** |
| A2  | System Admin                   | Open a pending request                                                                            | Read-only, as in A1                                                                                           |
| A3  | Shoe Constructor               | `POST /api/v1/procurement/requests/<their pending request id>/decide` with body `{ "lines": [] }` | HTTP 403                                                                                                      |
| A4  | System Admin                   | The same `POST …/decide` call                                                                     | HTTP 403                                                                                                      |
| A5  | Quality Inspector              | Open `/procurement`                                                                               | Redirect to `/forbidden`                                                                                      |
| A6  | Floor Manager                  | `POST …/decide` on a pending two-item request with only one of its lines in the body              | HTTP 422; `error.details` has a path ending in `"decision"` and the message names the missing item            |

## 6. Out of scope / known issues

- **Not built yet (Phase 13):** the ordering step, partial deliveries, proof of delivery, cancel
  after approval, "Copy to a new request" and Floor Manager–raised requests. "Mark received" still
  receives the full approved quantity in one go.
- The 2× "well stocked" factor is a fixed value for now, not an admin setting. An item between its
  reorder level and twice that level has nothing pre-selected on purpose.
- The 960 px layout of the **new request form** (Item and Quantity side by side) is intended; see
  the note at the top.
- The e2e server's "The destination stream closed early." log lines were seen in the Phase 11 run
  while tests passed. The cause is still unknown; note it if it appears, but it is not a Phase 12
  regression by itself.
- The demo-week seed changed (one seeded request is decided item by item) but cannot be checked on
  this database, which already has data. Do not reseed.
