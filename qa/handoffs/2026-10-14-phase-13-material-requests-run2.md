# QA handoff: Phase 13 material requests, run 2

| Field           | Value                                                 |
| --------------- | ----------------------------------------------------- |
| Date            | 2026-10-14                                            |
| Feature         | phase-13-material-requests (run 2)                    |
| Branch          | `main` checkout at `c044511`, **uncommitted** changes |
| Spec / prompt   | `material-requests.md` (project root), Phase 13       |
| Written by      | Claude                                                |
| Previous report | `qa/reports/2026-10-13-phase-13-material-requests.md` |

This run is short. It re-checks the one failure in the previous report, runs the six scenarios
that were blocked, and reruns the e2e specs. Everything else in the first handoff
(`qa/handoffs/2026-10-13-phase-13-material-requests.md`) passed and does **not** need re-testing.

Claude ran lint, typecheck, the 494 unit tests and the production build after these changes.
Claude did **not** open the app in a browser and did **not** run any e2e test.

## 1. What changed

- **Fixed (F1): a chosen proof file could disappear.** In the **Record delivery** dialog the file
  picker was cleared before the chosen files had been copied, so a file picked after an error or
  after removing another file was sometimes lost and "Attach a photo or PDF…" appeared again. The
  files are now copied first. Nothing else in the dialog changed.
- **E2E specs corrected (F3, F4, F5).** These were faults in the tests, not the app:
  - the reject-reason test looked for `#request-text-error`; the id is `#request-reason-error`;
  - the requester-cancel test matched its note twice (Decision card and Timeline); it now takes
    the first;
  - five tests opened the next page before sign-in had finished; each now waits for the Floor
    Manager's home page first.
  - The short-delivery test also picks a file, removes it, then picks two more, so F1 stays
    covered.
- **Not changed:** the React hydration warning about `caret-color` seen on S40 and S44. Nothing in
  the project sets that style. Say in the report whether it appears again and on which pages.

## 2. Files touched

| File                                                 | Change                                           |
| ---------------------------------------------------- | ------------------------------------------------ |
| `src/app/(app)/procurement/[id]/delivery-dialog.tsx` | chosen files are copied before the picker clears |
| `tests/e2e/procurement.spec.ts`                      | the three test corrections and the F1 step       |

Database migration in this change: **no**.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # should say nothing is pending
npm run dev            # app on http://localhost:3000
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this run:

- **Port 3000.** The previous report noted a Vite process from another project already listening
  on port 3000. Before testing, confirm that `http://localhost:3000/api/health` is answered by
  CPoint-PMS (it returns JSON with a status). If Next.js starts on another port, use that port
  for every URL and say so in the report.
- Do **not** run `npm run demo:seed`.
- **Stop the dev server before `npm run build`** and the e2e specs; both write to `.next`.

Existing automated tests (run after the manual scenarios):

```bash
npm run build && npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts
```

Last run: 36 passed, 9 failed of 45. All nine failures were in `procurement.spec.ts` and are
addressed above, but the corrected tests have still **never passed once**, so more test faults may
show up further down each test. For every failure, say whether the app or the test is wrong.

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role             | Email                      | Home page        |
| ---------------- | -------------------------- | ---------------- |
| Floor Manager    | `manager@cpoint.local`     | `/floor-manager` |
| Shoe Constructor | `constructor@cpoint.local` | `/constructor`   |

**Files:** the same four as run 1 (`photo.jpg`, `note.pdf`, `fake.pdf`, `big.jpg`), in a scratch
folder outside the project.

**Items.** As the **Floor Manager**, add two new items under Inventory → Add item, category
**Other**, unit **box**. Do not reuse the `QA13` items from run 1: their stock has changed.

| Name        | Reorder level | Opening stock |
| ----------- | ------------- | ------------- |
| QA13B Tacks | 5             | 2             |
| QA13B Glue  | 5             | 1             |

**Request.** As the **Shoe Constructor**, send **REQ-F** from New material request, Needed by
about two weeks ahead, Remarks empty: QA13B Tacks, quantity 6; QA13B Glue, quantity 4; and a third
item with "Something not in inventory yet": name `QA13B eyelets`, kind Other, unit `pack`,
quantity 2. Note its code.

**Prepare REQ-F.** As the **Floor Manager**: open REQ-F, choose Approve for every item, **Save
decisions**; then **Mark as ordered…** with any supplier and an Expected delivery 3 days ahead.
REQ-F must show **Ordered** before R1.

## 5. Test scenarios

Run them in order as the Floor Manager unless a row says otherwise. Quoted text is what the screen
should say; curly apostrophes where this file has straight ones are not failures.

**Two rules for the runner, from what went wrong in run 1:**

1. A quantity box that is greyed out (disabled) must be **left alone**. Do not type into it.
2. If a scenario does not end as expected, **stop**. Mark it failed or blocked, mark the scenarios
   that depend on it blocked, and do not continue to Close short. R10 cannot be undone.

| ID  | Role | Steps                                                                                                                                                                                                                                                    | Expected result                                                                                                                                                                                                                                                                                                                                                                                                       | Priority |
| --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R1  | FM   | Open REQ-F → **Record delivery…**. Attach `big.jpg`. Click its **Remove** button. Attach `photo.jpg`.                                                                                                                                                    | `photo.jpg` is listed under the file picker with its size. The list has exactly one file.                                                                                                                                                                                                                                                                                                                             | High     |
| R2  | FM   | Change QA13B Tacks to `7` and click **Record delivery**.                                                                                                                                                                                                 | "Received quantity can't be more than the 6 boxes still outstanding." under QA13B Tacks, with focus in that box. `photo.jpg` is **still listed**. There is **no** "Attach a photo or PDF…" message. Nothing is saved.                                                                                                                                                                                                 | High     |
| R3  | FM   | Without closing the dialog, attach `note.pdf` as a second, separate pick.                                                                                                                                                                                | Both `photo.jpg` and `note.pdf` are listed.                                                                                                                                                                                                                                                                                                                                                                           | High     |
| R4  | FM   | Click **Record delivery** again with Tacks still `7`, to fail once more. Then set QA13B Tacks `4`, QA13B Glue `4`, QA13B eyelets `0`, Note `Two boxes of tacks short`, and click **Record delivery**.                                                    | After the failed attempt both files are still listed. After the second click: toast "Delivery recorded for PR-…. Still to come: 2 boxes of QA13B Tacks, 2 packs of QA13B eyelets." Status **Partly received**. The Deliveries card shows one delivery with one photo thumbnail and a `note.pdf` link.                                                                                                                 | High     |
| R5  | FM   | Inventory → QA13B Tacks, then QA13B Glue.                                                                                                                                                                                                                | QA13B Tacks **6 boxes** (2 + 4). QA13B Glue **5 boxes** (1 + 4).                                                                                                                                                                                                                                                                                                                                                      | High     |
| R6  | FM   | REQ-F → **Record delivery…** again. Only look.                                                                                                                                                                                                           | QA13B Tacks starts at `2`. QA13B Glue shows `0`, is greyed out, and says "All of it has arrived." QA13B eyelets starts at `2`. No files are attached.                                                                                                                                                                                                                                                                 | Medium   |
| R7  | FM   | Set QA13B Tacks `1` and QA13B eyelets `2`. **Leave QA13B Glue alone.** Attach `photo.jpg`. Click **Record delivery**.                                                                                                                                    | Toast ends "Still to come: 1 box of QA13B Tacks." Status stays **Partly received**. The Deliveries card has **two** deliveries; the second lists "1 box of QA13B Tacks" and "2 packs of QA13B eyelets (not in inventory, so not added to stock)". Below the Items table: "Items not in inventory weren't added to stock. Add them under Inventory, then record what arrived there." QA13B Tacks stock is **7 boxes**. | High     |
| R8  | FM   | On the **first** delivery click **Add a proof file** and choose `note.pdf`.                                                                                                                                                                              | Toast "1 proof file added to PR-…." The first delivery shows the photo and two `note.pdf` links. The Timeline has an entry "Added proof of delivery: note.pdf."                                                                                                                                                                                                                                                       | Medium   |
| R9  | FM   | On either delivery click **Add a proof file** and choose `fake.pdf`.                                                                                                                                                                                     | A red message under that button says “fake.pdf” isn't a photo or a PDF. No file is added (reload and count the files).                                                                                                                                                                                                                                                                                                | Medium   |
| R10 | FM   | Click **Close short…**. Read the dialog, then click **Close short** with Reason empty.                                                                                                                                                                   | The dialog text names what never arrived: "1 box of QA13B Tacks". Message: "Enter a reason of at least 3 characters for closing short, e.g. “The supplier is out of stock.”" Status is still Partly received.                                                                                                                                                                                                         | High     |
| R11 | FM   | Type `Supplier is out of tacks` and click **Close short**.                                                                                                                                                                                               | Status **Received** with a **Closed short** badge. Decision card: "Closed short because" → Supplier is out of tacks, and "Never arrived" → 1 box of QA13B Tacks. Items table: QA13B Tacks "5 boxes" with "1 never arrived"; QA13B eyelets "2 packs" with "all here". No Record delivery, Close short or Cancel buttons. QA13B Tacks stock is still **7 boxes**.                                                       | High     |
| R12 | SC   | Open REQ-F from Material requests.                                                                                                                                                                                                                       | Received, Closed short. The Order card and **both** deliveries with their proof files are visible; a thumbnail opens in a new tab. No **Add a proof file** button and no action buttons.                                                                                                                                                                                                                              | High     |
| R13 | FM   | Open any other ordered request, or raise and order a new one for QA13B Glue. **Record delivery…**: attach `fake.pdf`, click **Record delivery** (refused), remove `fake.pdf`, attach `photo.jpg`, click **Record delivery** with the default quantities. | The delivery saves on the second attempt with `photo.jpg` as its proof. The first attempt saved nothing.                                                                                                                                                                                                                                                                                                              | Medium   |

### Access checks

None in this run. A1 to A10 passed in run 1 and the code they cover did not change.

## 6. Out of scope / known issues

- Everything that passed in run 1 (S1 to S9, S11 to S18, S25 to S44, A1 to A10). Do not re-test.
- REQ-A from run 1 is closed short with 2 boxes of tacks and 2 packs of eyelets never arrived.
  That is the result of the run 1 runner error, not an app fault. Leave it as it is.
- The out-of-scope list in the first handoff still applies (no message to the supplier, one order
  per request, orders can't be edited, proof files can't be removed, typed items aren't added to
  stock).
- The "destination stream closed early" lines and the `next start` with `output: standalone`
  warning in the e2e server log: mention them only if their number or wording changed.
