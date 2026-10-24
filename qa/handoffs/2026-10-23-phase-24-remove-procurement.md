# QA handoff: Phase 24, remove Material Requests and Procurement

| Field           | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Date            | 2026-10-23                                                                                                |
| Feature         | phase-24-remove-procurement                                                                               |
| Branch          | `main` checkout in `C:\dev\CPoint-PMS` at #18, **uncommitted** (with the D-092 workflow docs)             |
| Spec / prompt   | `docs/prompts/factory-visit-changes.md` → `<phase_24>`; plan `docs/prompts/plans/phase-24-plan.md`; D-091 |
| Written by      | Claude                                                                                                    |
| Previous report | `qa/reports/2026-10-22-phase-23-qa-run2.md` (PASS)                                                        |

CPoint asked on the 23 October factory visit to remove Material Requests and Procurement (C-1).
Dylan approved the plan as written. Nothing new is added; this run checks that the module is gone
and that everything around it still works.

## 1. What changed

- **Everyone:** no **Procurement** or **Material requests** item in the sidebar. `/procurement`,
  `/procurement/new`, `/procurement/<any id>` and every `/api/v1/procurement/**` path answer
  **404**.
- **Floor Manager home:** the Pending requests card is gone (7 cards remain).
- **Inventory:** no "Requested" badge and no **Request** link on a low item; the Stock cell shows
  only the stock badge.
- **Reports → Operations:** no Purchasing section and no request attention items (pending, late,
  high urgency). The low-stock attention item reads "Restock them before they run out." The
  Requested badge on stock rows is gone. `stock.csv` has no "Open request" column; its header ends
  "Days of cover,Status".
- **Shoe Constructor home:** "Good day, <first name>". A constructor allowed to capture (D-075)
  sees the **Capture sections** card with **Open Capture**; one who isn't sees **No camera access
  yet** and "Your work in the system is at the camera. Ask the System Admin for camera access." The
  constructor's nav is **Home** only, plus **Capture** when allowed.
- **System Admin → Users:** no "Leather rolls" badge and no leather-roll item under More actions.
  Camera access is unchanged.
- **Data:** migration `drop_procurement` drops the eight purchase tables, both enums and
  `users.canRequestLeatherRolls`. Stock movements that deliveries posted stay ("Delivery for
  MR-…" reasons on the dev database). The demo week makes no requests; its two deliveries are
  plain stock IN ("Delivery from …").
- **Files on disk:** the migration doesn't touch the proof-of-delivery files. `npm run demo:reset
-- --yes` clears `UPLOADS_DIR/pod` with the scan images, as before.

## 2. Files touched

| File                                                                                                     | Change                                                                            |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261023090000_drop_procurement/`                             | Purchase models, enums and the leather-roll flag removed                          |
| `src/app/(app)/procurement/**`, `src/app/api/v1/procurement/**` (31 files)                               | Deleted                                                                           |
| `src/components/features/procurement/`                                                                   | Deleted                                                                           |
| `src/server/{controllers,services,models,validators}/procurement.*`                                      | Deleted                                                                           |
| `src/lib/procurement-rules.ts`, `src/server/lib/{attachment-type,receipt-sample}.ts`                     | Deleted                                                                           |
| `src/server/policies/{permissions,navigation}.ts`, `src/components/features/app-shell/sidebar.tsx`       | Five permissions, the nav item, the label map and the icon removed                |
| `src/app/(app)/{constructor,floor-manager,inventory}/page.tsx`                                           | New constructor home; no requests card; no Requested badge or Request link        |
| `src/app/(app)/admin/users/{page,user-dialogs}.tsx`                                                      | Leather-roll badge and menu item removed                                          |
| `src/app/(app)/reports/_components/{operations-view,ops-parts,ops-sections}.tsx`, `src/lib/ops-rules.ts` | Purchasing card and request attention items removed; new low-stock wording        |
| `src/server/services/{ops-report,bootstrap,demo-seed,demo-reset,auth,user-admin}.service.ts`             | No procurement data, flag or requests                                             |
| `src/server/models/{ops-report,inventory,user,demo-reset}.model.ts`, `src/lib/domain.ts`                 | Same                                                                              |
| `scripts/demo-seed.ts`, `scripts/demo-reset.ts`                                                          | No request counts in the output                                                   |
| `tests/unit/**`                                                                                          | Three procurement test files deleted; nine updated                                |
| `tests/e2e/procurement.spec.ts`                                                                          | Deleted                                                                           |
| `tests/e2e/{auth,smoke,capture,inventory,reports}.spec.ts`, `tests/e2e/cv-helpers.ts`                    | Nav lists, constructor home, no Request link, no Purchasing, `stock.csv`          |
| Docs                                                                                                     | API, README, master spec, DESIGN, ROADMAP, STATUS, DECISIONS (D-091), SESSION_LOG |

Database migration in this change: **yes** (name: `drop_procurement`). It was applied to the dev
database before this handoff, after a backup in `storage/backups/` (see the session report).

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # nothing pending: drop_procurement is already applied
npm run db:generate
npm run build
npm run start          # app on http://localhost:3000 (PORT=3001 if 3000 is taken)
```

Health check: `http://localhost:3000/api/health` returns OK.

Existing automated tests that cover this area (the full suite; the e2e specs never name the removed
module, so the 404 checks are manual, A1 to A3):

```bash
npm run test:e2e
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data:

- The dev database has at least one low-stock item (Contact cement in the demo inventory).
- The demo constructor is allowed to capture after a demo week or `demo:reset`; on the dev
  database check the switch under Admin → Users → More actions before S5 and S6, and put it back.
- The throwaway stack (U1 to U3) seeds its own demo week. The app container runs with
  `NODE_ENV=production`, so `demo:reset` refuses inside it; run it from the host against the
  stack's database, with `UPLOADS_DIR` set to a new empty folder so the dev scan images are never
  touched.

## 5. Test scenarios

| ID  | Role                          | Steps                                                                                                                                                                                     | Expected result                                                                                                                                                                        | Priority |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Floor Manager                 | Sign in. Read the sidebar.                                                                                                                                                                | No Procurement or Material requests item. Every other item (Production, Attendance, Batches, Quality, Inventory, Reports …) is there and opens.                                        | High     |
| S2  | Quality Inspector, Admin      | Sign in as each. Read the sidebar.                                                                                                                                                        | No Procurement or Material requests item; everything else as before Phase 24.                                                                                                          | High     |
| S3  | Floor Manager                 | Open Home.                                                                                                                                                                                | Seven cards, no Pending requests card; the page loads without an error.                                                                                                                | High     |
| S4  | Floor Manager                 | Open Inventory. Find a low item (Contact cement).                                                                                                                                         | The Stock cell shows the low badge only: no "Requested" badge, no Request link. Receive, Use and Stock count still work on that item.                                                  | High     |
| S5  | Shoe Constructor, allowed     | With the camera switch on, sign in.                                                                                                                                                       | "Good day, <first name>" and the Capture sections card; Open Capture goes to `/camera/capture`. Sidebar: Home and Capture.                                                             | High     |
| S6  | Shoe Constructor, not allowed | Turn the switch off (Admin → Users → More actions), sign in again.                                                                                                                        | **No camera access yet** and "Your work in the system is at the camera. Ask the System Admin for camera access." Sidebar: Home only.                                                   | High     |
| S7  | Floor Manager                 | Reports → Operations.                                                                                                                                                                     | No Purchasing section; no attention item about requests; the low-stock item reads "Restock them before they run out."; stock rows have no Requested badge.                             | High     |
| S8  | Floor Manager                 | Reports → Operations → download Stock CSV. Open it.                                                                                                                                       | Header ends "Days of cover,Status"; no "Open request" column. Other CSVs (operations, suppliers, production) still download.                                                           | Medium   |
| S9  | Floor Manager                 | Reports → Operations → Supplier quality; open a claim sheet.                                                                                                                              | Suppliers and the claim sheet still work (Phase 20).                                                                                                                                   | Medium   |
| S10 | System Admin                  | Users: open a constructor's More actions; edit a user's name and save.                                                                                                                    | No leather-roll badge or menu item; camera access is still there; the save works and the audit row has name, email and role only.                                                      | Medium   |
| S11 | Floor Manager                 | Inventory → an item that received a delivery before Phase 24 → its movements.                                                                                                             | The old "Delivery for MR-…" IN movements are still listed; on hand equals the ledger.                                                                                                  | Medium   |
| U1  | (throwaway stack)             | Start the stack with the demo week (prompt step 6). Sign in as the FM; open Home, Inventory and Operations.                                                                               | Demo week loaded; no request anywhere; Inventory shows "Delivery from …" IN movements in the week.                                                                                     | High     |
| U2  | (throwaway stack)             | From the host, pointed at the throwaway stack only (prompt step 6: its `DATABASE_URL` on port 5434 and an empty `UPLOADS_DIR`): `npm run demo:reset`, then `npm run demo:reset -- --yes`. | The dry run has no requests line and ends with "and the scan images and old proof-of-delivery files under UPLOADS_DIR."; the reset finishes and seeds a fresh demo week with no error. | High     |
| U3  | (throwaway stack)             | After U2, sign in as the demo constructor.                                                                                                                                                | The Capture sections card (the reset allows the demo constructor to capture).                                                                                                          | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                                   | Expected                                      |
| --- | ------------------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------- |
| A1  | Everyone (sign in as the FM)   | Open `/procurement`, `/procurement/new` and `/procurement/00000000-0000-0000-0000-000000000000` | The app's 404 page for each                   |
| A2  | Everyone (signed in as the FM) | `GET /api/v1/procurement/requests` and `GET /api/v1/procurement/items` in the browser           | 404                                           |
| A3  | Signed out                     | `/procurement`                                                                                  | Sign-in page or 404, never a procurement page |
| A4  | Shoe Constructor               | `/batches`, `/inventory`                                                                        | `/forbidden`                                  |

## 6. Out of scope / known issues

- The Review Queue, Repair Station and Salvage are still there; Phase 25 removes them.
- "Delivery for MR-…" in old stock movements on the dev database is history, not a fault.
- The device checks at the real station (F3, P18 S3, P18 S18, R4) stay with Dylan.
- `docs/UI_AUDIT.md`, `docs/SESSION_LOG.md` and old decisions still mention procurement as
  history.
