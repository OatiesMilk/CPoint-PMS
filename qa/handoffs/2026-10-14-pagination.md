# QA handoff: Pagination on every list (15 per page)

| Field           | Value                                                                           |
| --------------- | ------------------------------------------------------------------------------- |
| Date            | 2026-10-14                                                                      |
| Feature         | pagination                                                                      |
| Branch          | `main` (base commit `e88e7de`, change uncommitted)                              |
| Spec / prompt   | Dylan's follow-up request, 2026-10-14; `docs/DECISIONS.md` D-047                |
| Written by      | Claude                                                                          |
| Previous report | `qa/reports/2026-10-14-full-width-mr-codes.md` if Codex has run it, else "none" |

This sits on top of the full-width / MR change (`qa/handoffs/2026-10-14-full-width-mr-codes.md`).
Both are in the same working tree; run that handoff first if it hasn't been run.

## 1. What changed

- **Every list that can grow now shows 15 rows per page** (was 20, 25 or 50 depending on the page).
- **One pager under every table:** "Showing 16–30 of 42 batches · page 2 of 3" with **Previous**
  and **Next**. On an item's stock ledger and the Audit log the buttons read **Newer** / **Older**.
  A list that fits on one page shows only its count ("8 batches") and no buttons.
- **Newly paginated:**
  - **Salvage** (each tab; was cut off at 200 rows).
  - **Review queue**: "Needs a decision" and "Today's automatic Rework and Reject" page
    separately (`?page=` and `?autoPage=`); paging one keeps the other's page. The old "Showing
    the 50 oldest of N" note is gone.
  - **Admin → API tokens.**
  - **Admin → Settings** lists (defect types, shoe types, suppliers, components), now with a
    **Find …** box above each list.
  - **Procurement → Leather roll requesters** (Floor Manager), now with a **Find a Shoe
    Constructor** box (name or email).
- Not paginated on purpose (short by nature): a request's items (max 10), a batch's stages, a
  scan's detections, report summaries, the Rework board.

## 2. Files touched

| File                                                                                                                                                                         | Change                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/lib/pagination.ts` (new)                                                                                                                                                | `PAGE_SIZE = 15` and helpers                                |
| `src/lib/use-paged-rows.ts` (new)                                                                                                                                            | Find box + pages for lists already in the browser           |
| `src/components/features/table-pager.tsx` (new)                                                                                                                              | The shared pager                                            |
| `src/server/services/{batch,scan-query,inventory,procurement,user-admin,audit-query}.service.ts`                                                                             | Use `PAGE_SIZE`; review queue pages; ledger returns `total` |
| `src/server/services/salvage.service.ts`, `src/server/models/outcome.model.ts`, `src/server/validators/outcome.validator.ts`, `src/server/controllers/outcome.controller.ts` | Salvage pages on the server (`?page=`)                      |
| `src/app/(app)/{batches,scans,inventory,inventory/[id],procurement,admin/users,admin/audit}/page.tsx`                                                                        | Old pager replaced by `TablePager`                          |
| `src/app/(app)/{salvage,review,admin/tokens}/page.tsx`                                                                                                                       | Pager added                                                 |
| `src/app/(app)/admin/settings/reference-manager.tsx`, `src/app/(app)/procurement/requesters-panel.tsx`                                                                       | Find box + pager                                            |
| `tests/e2e/admin.spec.ts`, `tests/e2e/procurement.spec.ts`                                                                                                                   | Type into the Find box before looking for the test's row    |
| `tests/unit/pagination.test.ts` (new)                                                                                                                                        | Helper tests                                                |
| `docs/*`, `DESIGN.md`                                                                                                                                                        | D-047, API page sizes, salvage `page`                       |

Database migration in this change: **no**.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up
npm run db:deploy
npm run dev            # http://localhost:3000 (PORT=3001 if 3000 is taken)
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps: none. The dev database already holds many rows from earlier e2e runs (batches,
scans, inventory, users, shoe types, suppliers, constructors), which is what makes page 2 exist.
If a list has 15 rows or fewer, say so in the report and check S12 instead of its paging step.

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/admin.spec.ts tests/e2e/procurement.spec.ts tests/e2e/outcomes.spec.ts tests/e2e/cv.spec.ts tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

## 5. Test scenarios

Viewport 1440 × 900. "Paging check" = the table shows at most 15 rows; the line under it reads
"Showing 1–15 of N … · page 1 of P"; **Next** goes to page 2 ("Showing 16–30 of N"), the URL gains
`page=2`, the rows differ from page 1; **Previous** returns to page 1; on the last page **Next** is
gone; on page 1 **Previous** is gone.

| ID  | Role              | Steps                                                                                                                                                                                          | Expected result                                                                                                                                                                | Priority |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| S1  | Floor Manager     | `/batches`: paging check. Then search a batch code and confirm the filter is kept on page 2 links (`q=` stays in the URL).                                                                     | Paging check passes; filters survive paging.                                                                                                                                   | High     |
| S2  | Floor Manager     | `/scans`: paging check, also with a batch filter.                                                                                                                                              | Paging check passes.                                                                                                                                                           | High     |
| S3  | Floor Manager     | `/inventory`: paging check. Open an item with more than 15 ledger rows (or note none).                                                                                                         | Inventory: paging check. Ledger: **Newer** / **Older** buttons, "Showing 1–15 of N movements".                                                                                 | High     |
| S4  | Floor Manager     | `/procurement?status=all`: paging check; switch tab and confirm it starts on page 1.                                                                                                           | Paging check passes; MR- numbers shown.                                                                                                                                        | High     |
| S5  | System Admin      | `/admin/users`: paging check; search an email: "… accounts that match". `/admin/audit`: paging check with **Newer** / **Older**.                                                               | Both pass.                                                                                                                                                                     | High     |
| S6  | Floor Manager     | `/salvage` on each tab (Available, Reused, Discarded): paging check where N > 15. Add `&batch=<code>` and page.                                                                                | At most 15 rows; tab counts unchanged; batch filter kept when paging.                                                                                                          | High     |
| S7  | Quality Inspector | `/review`: page "Needs a decision" to page 2, then page "Today's automatic…" to page 2.                                                                                                        | Each list pages on its own; paging the second keeps the first on page 2 (`page=2&autoPage=2`). Labels read "… scans waiting, oldest first" and "… calls today".                | High     |
| S8  | Quality Inspector | On `/review` page 2 of "Needs a decision", decide one scan.                                                                                                                                    | The decision saves; the list refreshes without an error (rows may shift by one).                                                                                               | Medium   |
| S9  | System Admin      | `/admin/tokens`: count; if more than 15 tokens, paging check. Create a token.                                                                                                                  | The new token appears on page 1 (newest first).                                                                                                                                | Medium   |
| S10 | System Admin      | `/admin/settings?tab=shoes`, `?tab=suppliers`, `?tab=defects`, `?tab=components`: paging check (buttons, not URL changes: the URL does not gain `page=`). Type part of a name into **Find …**. | Rows narrow as you type, the pager says "… that match" and resets to page 1. A search with no hit shows "No shoe type matches “xyz”. Check the spelling, or clear the search." | High     |
| S11 | Floor Manager     | `/procurement?tab=requesters`: paging check (buttons); type an email in **Find a Shoe Constructor**; **Allow leather rolls** on a match.                                                       | Filter works by name or email; the toggle works on a filtered row and the row stays visible.                                                                                   | High     |
| S12 | Any               | A list with 15 rows or fewer (e.g. a filtered search).                                                                                                                                         | Only the count shows ("3 batches"), no Previous/Next.                                                                                                                          | Medium   |
| S13 | Any               | Every changed page at 1280 × 800.                                                                                                                                                              | No sideways page scroll; the pager wraps neatly under the table.                                                                                                               | Medium   |
| S14 | Any               | Run axe (WCAG 2.1 A/AA) on `/salvage`, `/review`, `/admin/settings?tab=suppliers`, `/procurement?tab=requesters`, `/admin/tokens`.                                                             | No violations (the Find boxes have labels; the pagers are labelled navigation landmarks).                                                                                      | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                       | Expected                                         |
| --- | ------------------------------ | ----------------------------------- | ------------------------------------------------ |
| A1  | Shoe Constructor               | `/salvage?page=2`, `/review?page=2` | Forbidden, as before (paging adds no access)     |
| A2  | Quality Inspector              | `/salvage?page=2`                   | Can view; no Reuse / Discard actions (unchanged) |

## 6. Out of scope / known issues

- A stale link to a page past the end of a server list (e.g. `?page=99`) shows an empty table, as
  before this change.
- After adding a row in Settings, it may land on another page (lists sort by name / sort order);
  the toast confirms it and the Find box locates it. That's the intended behaviour.
- The `next start` with `output: standalone` warning in the e2e server log is known since Phase 9.
