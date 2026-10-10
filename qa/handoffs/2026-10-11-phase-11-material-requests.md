# QA handoff: Phase 11 material requests

| Field           | Value                                           |
| --------------- | ----------------------------------------------- |
| Date            | 2026-10-11                                      |
| Feature         | phase-11-material-requests                      |
| Branch          | `main` checkout, **uncommitted** working tree   |
| Spec / prompt   | `material-requests.md` (project root), Phase 11 |
| Written by      | Claude                                          |
| Previous report | none                                            |

## 1. What changed

- **Naming by role.** A Shoe Constructor now sees **Material requests** everywhere: the sidebar
  item, the list page title and browser tab title, the **New material request** button and page,
  and **My material requests** on their home. The Floor Manager and System Admin still see
  **Procurement** for the same pages. URLs did not change (`/procurement`, `/procurement/new`,
  `/procurement/<id>`).
- **Remarks replace "Why it's needed".** The new-request form no longer has a required "Why it's
  needed" box. It has an optional **Remarks** box. What is typed there shows as the first entry
  under **Remarks** on the request page. Old requests kept their text: it was moved into a first
  remark.
- **Urgency is automatic.** The **Priority** dropdown is gone. **Needed by** is now required
  (today or later, at most 180 days ahead). Urgency is worked out from that date by **working
  days left, Monday to Friday**:

  | Urgency | Working days until the needed-by date |
  | ------- | ------------------------------------- |
  | High    | 0 to 3, or the date has passed        |
  | Medium  | 4 to 7                                |
  | Low     | 8 or more                             |

  It shows as a badge with an icon, a label and the time left (for example "High · needed today",
  "Medium · in 5 working days"). Received, rejected and cancelled requests show no urgency (a
  dash in the list, no badge on the request page). The Floor Manager's **Pending** tab lists the
  soonest needed-by date first. There is an **Urgency** filter. The Floor Manager home card and
  Reports → Operations → Purchasing count "high urgency" requests instead of "urgent" ones.

- **Specific messages on every form.** Each error names the field and how to fix it, sits under
  its field, and the keyboard focus moves to the first invalid field on submit. The request form
  shows a summary box on top only when 3 or more fields are wrong. No form should show "Some
  fields need fixing.", "Something went wrong.", "Invalid input" or a bare "Required".

## 2. Files touched

| File                                                                                          | Change                                                                                                      |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261010153000_material_requests_remarks_urgency/` | `neededBy` required; `justification`, `priority` and the `PurchasePriority` enum dropped; old data migrated |
| `src/lib/procurement-rules.ts`                                                                | role → label map, urgency rules, working-day counting, filter date ranges                                   |
| `src/lib/focus-first-invalid.ts` (new)                                                        | focus the first invalid field in hand-built forms                                                           |
| `src/server/validators/*.ts`, `shared.ts` (new)                                               | every message rewritten to name the field and the fix                                                       |
| `src/server/lib/errors.ts`, `action-result.ts`, `http.ts`                                     | form-level sentence built from field messages; field errors keyed by full path                              |
| `src/server/{models,services,controllers}/procurement.*`                                      | remarks on create, urgency on reads, sort, filter, High count                                               |
| `src/server/{models,services}/ops-report.*`, `src/lib/ops-rules.ts`                           | "urgent" → "high urgency" in the Operations report                                                          |
| `src/server/policies/navigation.ts`                                                           | sidebar label by role                                                                                       |
| `src/server/services/demo-seed.service.ts`                                                    | seeded requests use needed-by dates and remarks                                                             |
| `src/app/(app)/procurement/**`                                                                | list, new, detail, form, filters, dialogs, loading and error screens                                        |
| `src/app/(app)/constructor/page.tsx`, `src/components/features/procurement/*`                 | constructor home, urgency badge, FM home card                                                               |
| `src/components/ui/field-error.tsx`, `form-error-summary.tsx` (new)                           | shared error text and summary                                                                               |
| `src/app/(app)/{salvage,inventory,batches,scans,admin}/**`                                    | messages, `aria-describedby`, focus on the first invalid field                                              |
| `tests/unit/*`, `tests/e2e/*`                                                                 | new and updated tests                                                                                       |
| `vitest.config.mts`                                                                           | unit-test stub path works when the project folder name has spaces                                           |
| `docs/*`, `README.md`                                                                         | decisions D-035 to D-038, roadmap, API, status, session log, demo script                                    |

Database migration in this change: **yes** (name: `20261010153000_material_requests_remarks_urgency`).
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

- Do **not** run `npm run demo:seed` on this database; it only works on an empty one and the dev
  database already has data.
- The existing e2e specs start their own production server on port 3100 and need a build. A
  build and `npm run dev` both write to `.next`, so **stop the dev server before building**:
  run the manual scenarios with `npm run dev` first, stop it, then run the specs below.
- Playwright's own Chromium is not installed on this machine (it looks for
  `chromium_headless_shell-1243`). Run `npx playwright install chromium` first. Using the
  installed Chrome through `PLAYWRIGHT_CHROMIUM_PATH` made sign-ins time out in one earlier run,
  so prefer the installed Chromium and say in the report which one you used.

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/procurement.spec.ts tests/e2e/auth.spec.ts tests/e2e/smoke.spec.ts tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts tests/e2e/cv.spec.ts
```

`procurement.spec.ts` has three new tests (urgency sort, specific messages, labels and remarks in
the first journey). These specs were updated for the new wording but have **not been run to
completion by Claude**, so a failure may be the test, not the app: say which you think it is.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs:

- At least one active inventory item that is not a leather roll. If the item picker on the new
  request form is empty, sign in as the Floor Manager and add one under Inventory → Add item
  (category Other, unit box, reorder level 5, opening stock 2) before starting.
- The dev database already holds three older requests (`PR-2026-0001` received, `PR-2026-0002`
  pending, `PR-2026-0003` approved), all with needed-by 2026-10-12. Their old "why it's needed"
  text was "need", "ads" and "low on stock".
- **Dates.** "Today" means today's date in Manila. Work out working days by skipping Saturdays
  and Sundays and not counting today. Example for Monday 2026-10-12: Thursday 10-15 is 3 working
  days (High), Friday 10-16 is 4 (Medium), Wednesday 10-21 is 7 (Medium), Thursday 10-22 is 8
  (Low). Write the dates you used in the report.

## 5. Test scenarios

| ID  | Role             | Steps                                                                                                                                       | Expected result                                                                                                                                                                                                                                                                                                                                                                                                   | Priority |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Shoe Constructor | Sign in. Look at the sidebar, the home page heading area and the button at the top right.                                                   | Sidebar shows **Material requests** (no "Procurement"). The card is titled **My material requests**. The button reads **New material request**.                                                                                                                                                                                                                                                                   | High     |
| S2  | Shoe Constructor | Click **Material requests** in the sidebar. Read the page heading and the browser tab title.                                                | Heading is **Material requests**; the tab title starts with "Material requests". The button reads **New material request**.                                                                                                                                                                                                                                                                                       | High     |
| S3  | Floor Manager    | Sign in. Look at the sidebar, then open `/procurement`.                                                                                     | Sidebar shows **Procurement** (no "Material requests"). Page heading is **Procurement**.                                                                                                                                                                                                                                                                                                                          | High     |
| S4  | System Admin     | Sign in and open `/procurement`.                                                                                                            | Page heading is **Procurement**; there is no "New" button.                                                                                                                                                                                                                                                                                                                                                        | Medium   |
| S5  | Shoe Constructor | Open **New material request**. Look at the form fields.                                                                                     | Heading is **New material request**. There is **no** "Priority" dropdown and **no** "Why it's needed" box. There is a **Needed by** date field and a **Remarks (optional)** box.                                                                                                                                                                                                                                  | High     |
| S6  | Shoe Constructor | On the new form, click **Send request** without filling anything.                                                                           | Under Item: "Choose an item from the list. If it isn't there, pick “Something not in inventory yet”." Under Quantity: "Enter a quantity greater than 0." Under Needed by: "Choose the date you need the items by." A red summary box on top says "3 fields need fixing before this can be sent:" with three links. The Item dropdown has the keyboard focus. The text "Some fields need fixing." appears nowhere. | High     |
| S7  | Shoe Constructor | Continue from S6: pick any item, type quantity `0`, set Needed by to `2020-01-01`, click **Send request**.                                  | Under Quantity: "Enter a quantity greater than 0." Under Needed by: "Needed by can't be in the past. Pick today or a later date." The summary box is gone (only 2 errors).                                                                                                                                                                                                                                        | High     |
| S8  | Shoe Constructor | Continue: quantity `1.234`, Needed by a date more than 180 days ahead (type it; the picker may block it), click **Send request**.           | Under Quantity: "Quantity can have at most 2 decimal places." Under Needed by: "Needed by can be at most 180 days ahead. Pick an earlier date."                                                                                                                                                                                                                                                                   | Medium   |
| S9  | Shoe Constructor | Continue: quantity `2`, Needed by = today. Before sending, read the line under the date field.                                              | The line reads "The Floor Manager will see this as" followed by a **High** badge and "needed today".                                                                                                                                                                                                                                                                                                              | High     |
| S10 | Shoe Constructor | Continue: type `QA: half a box left` in Remarks and click **Send request**.                                                                 | You land on the request page (`/procurement/<id>`), status **Pending**, with a **High** badge next to it and "needed by <today's date>" in the line below the code. Under **Remarks** the first entry is "QA: half a box left" by the constructor. There is no "Why it's needed" card. Note the request code as **REQ-HIGH**.                                                                                     | High     |
| S11 | Shoe Constructor | Send a second request: any item, quantity `1`, Needed by = a date 8 or more working days ahead, Remarks left empty.                         | Request page shows a **Low** badge with "in N working days". Under Remarks it says "No remarks yet." Note the code as **REQ-LOW**.                                                                                                                                                                                                                                                                                | High     |
| S12 | Shoe Constructor | Send a third request with Needed by 4 to 7 working days ahead.                                                                              | Request page shows a **Medium** badge. Note the code as **REQ-MED**.                                                                                                                                                                                                                                                                                                                                              | Medium   |
| S13 | Floor Manager    | Open Procurement → **Pending** tab. Find REQ-HIGH, REQ-MED and REQ-LOW in the table.                                                        | The column is headed **Urgency** (not Priority). REQ-HIGH is above REQ-MED, which is above REQ-LOW. Every row above REQ-MED has a needed-by date no later than REQ-MED's.                                                                                                                                                                                                                                         | High     |
| S14 | Floor Manager    | On the Pending tab choose **Urgency → High**, then **Low**, then **Any urgency**.                                                           | High: REQ-HIGH is listed, REQ-LOW is not, and the URL has `urgency=HIGH`. Low: REQ-LOW is listed, REQ-HIGH is not. Any urgency: both are back.                                                                                                                                                                                                                                                                    | High     |
| S15 | Floor Manager    | Go to the home page (`/floor-manager`) and read the **Purchase requests** card.                                                             | It shows a line like "N high urgency, needed within 3 working days" with N ≥ 1. Clicking it opens the Pending tab filtered to High. The word "urgent" alone ("marked urgent") does not appear.                                                                                                                                                                                                                    | Medium   |
| S16 | Floor Manager    | Open REQ-HIGH. Click **Reject…**, leave Reason empty, click **Reject request**.                                                             | Under Reason: "Enter a reason of at least 3 characters, so the requester knows why it's rejected." The Reason box has the focus. The dialog stays open.                                                                                                                                                                                                                                                           | High     |
| S17 | Floor Manager    | Continue: type `QA: still 3 boxes in the back room` and click **Reject request**.                                                           | Dialog closes, status is **Rejected**, the reason shows under Decision. The **High** badge next to the status is gone.                                                                                                                                                                                                                                                                                            | High     |
| S18 | Floor Manager    | Open Procurement → **Rejected** tab and find REQ-HIGH.                                                                                      | Its Urgency cell shows a dash, not a badge.                                                                                                                                                                                                                                                                                                                                                                       | Medium   |
| S19 | Floor Manager    | Open `PR-2026-0003` (approved, from before this change).                                                                                    | Under Remarks the first entry is "low on stock" by the requester. There is no "Why it's needed" card. It has a needed-by date and an urgency badge.                                                                                                                                                                                                                                                               | High     |
| S20 | Floor Manager    | Open `PR-2026-0001` (received).                                                                                                             | Under Remarks the first entry is "need". No urgency badge next to the status.                                                                                                                                                                                                                                                                                                                                     | Medium   |
| S21 | Floor Manager    | Open REQ-LOW, add nothing in the remark box and click **Add remark**.                                                                       | Under the box: "Write a remark before you add it." The box has the focus.                                                                                                                                                                                                                                                                                                                                         | Medium   |
| S22 | Floor Manager    | Inventory → open any active item → **Receive stock**. Leave Quantity empty and click the submit button. Then type `1.999` and submit again. | First: "Enter a quantity greater than 0." Then: "Quantity can have at most 2 decimal places." Each time the Quantity field has the focus and nothing is saved.                                                                                                                                                                                                                                                    | High     |
| S23 | Floor Manager    | Same item → **Stock count…**. Type any number in Counted quantity, clear the Reason and submit.                                             | Under Reason, a message starting "Enter a reason" and mentioning the count difference.                                                                                                                                                                                                                                                                                                                            | Medium   |
| S24 | Floor Manager    | Batches → **New batch**. Click the submit button with everything empty.                                                                     | Under Roll code: "Enter the roll code from the leather roll's tag." Under Shoe type: "Choose a shoe type from the list." No generic line such as "Some fields need fixing." The Roll code field has the focus.                                                                                                                                                                                                    | High     |
| S25 | Floor Manager    | New batch: set the arrival date to tomorrow and submit.                                                                                     | Under the date: "The arrival date can't be in the future. Pick today or an earlier date."                                                                                                                                                                                                                                                                                                                         | Medium   |
| S26 | System Admin     | Admin → Users → **Add user**. Submit empty. Then type email `nope` and submit.                                                              | Each of Name, Email and Role shows its own message; none says only "Required" or "Invalid". With `nope`: "Enter the email in full, like name@cpoint.local." The first invalid field has the focus.                                                                                                                                                                                                                | Medium   |
| S27 | System Admin     | Admin → Settings → thresholds form. Type `0` in the reject threshold and save.                                                              | A message under that field naming the "reject threshold" and the allowed range (above 0, at most 100).                                                                                                                                                                                                                                                                                                            | Low      |
| S28 | Any              | On `/login`, type email `nope` and any password, click Sign in.                                                                             | Under Email: "Enter your email in full, like name@cpoint.local."                                                                                                                                                                                                                                                                                                                                                  | Low      |
| S29 | Floor Manager    | Reports → Operations → **Purchasing** card.                                                                                                 | Under "Waiting for a decision" it says "N high urgency" or "none high urgency", not "urgent".                                                                                                                                                                                                                                                                                                                     | Low      |
| S30 | Shoe Constructor | Resize the window to about 960 px wide and open the new request form and the list.                                                          | No sideways page scroll. Item and Quantity stay side by side at 960 px and stack only below 640 px (D-034). The urgency badge and text wrap inside the table cell or the table scrolls inside its own box. (Corrected after the 2026-10-11 report: the first wording wrongly said the fields stack at 960 px.)                                                                                                    | Low      |

### Access checks

| ID  | Role that must NOT have access                                             | URL or action                                                                                                                            | Expected                                                                                                           |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A1  | Quality Inspector                                                          | Open `/procurement`                                                                                                                      | Redirect to `/forbidden`; no "Material requests" or "Procurement" item in the sidebar                              |
| A2  | Floor Manager                                                              | Open `/procurement/new`                                                                                                                  | Redirect to `/forbidden` (FM-raised requests come in Phase 13)                                                     |
| A3  | System Admin                                                               | Open REQ-LOW                                                                                                                             | No Approve, Reject or Cancel buttons, and no remark box                                                            |
| A4  | Shoe Constructor (a second one, if you can create one under Admin → Users) | Open REQ-LOW's URL                                                                                                                       | "Not found" page; they only see their own requests                                                                 |
| A5  | Shoe Constructor                                                           | `POST /api/v1/procurement/requests` with the old body `{ "priority": "URGENT", "justification": "x", "lines": [...] }` and no `neededBy` | `422`; `error.details` has an issue with `path: ["neededBy"]` and message "Choose the date you need the items by." |

## 6. Out of scope / known issues

- **Phase 12 and 13 are not built.** Do not report: the Floor Manager can only approve or reject
  a whole request; receiving posts the full quantity; no supplier, ordering step or proof of
  delivery; no "copy to a new request"; the FM cannot raise a request.
- The Floor Manager home card is still titled "Purchase requests" and links to "Procurement".
  That is intended: those are the FM's words.
- Request codes still start with `PR-`. Intended; codes and URLs were not renamed.
- Holidays are not skipped when counting working days. Intended for now (to confirm with CPoint).
- On a weekend, a date on the same weekend shows "needed this weekend" and counts as High.
- The summary box is only on the request form. Other forms show messages under their fields and
  a short alert, without the summary.
- Loading and error screens for this module say "requests" without the role's name, because
  they render before the role is known.
- The Docker demo-week check and a full e2e run were not done by Claude. If the demo seed is in
  scope for you, say so in the report rather than assuming it passed.
