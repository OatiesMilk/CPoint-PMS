# QA handoff: Full-width pages and MR request numbers

| Field           | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| Date            | 2026-10-14                                                                 |
| Feature         | full-width-mr-codes                                                        |
| Branch          | `main` (base commit `e88e7de`, change uncommitted)                         |
| Spec / prompt   | Dylan's follow-up request, 2026-10-14; `docs/DECISIONS.md` D-046           |
| Written by      | Claude                                                                     |
| Previous report | `qa/reports/2026-10-14-phase-13-material-requests-run5.md` (no open fault) |

## 1. What changed

- **Every role, every page:** content is no longer held in a centred 1152 px column. Tables,
  dashboards and reports now fill the space beside the sidebar. Forms keep their own widths, and
  the grey description under a page title stops at a readable line length.
- **Shoe Constructor home:** the "My material requests" card spans the full width.
- **Request numbers read `MR-2026-0001`** (material request) instead of `PR-2026-0001`, for every
  role: the list, the request page, the home cards, toasts ("MR-2026-0007 approved."), the
  "already asks for this" note, "Copied from MR-…", and the Inventory ledger ("Delivery for
  MR-…").
- A data migration renames numbers that already exist. The running number continues (no restart
  at 0001). The **audit log keeps the old PR- numbers** on purpose (it is history).

## 2. Files touched

| File                                                                                                     | Change                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/app/(app)/layout.tsx`                                                                               | Removed the `mx-auto max-w-6xl` cap on the page wrapper            |
| `src/components/features/page-header.tsx`                                                                | Page description capped at `max-w-3xl`                             |
| `src/app/(app)/constructor/page.tsx`                                                                     | "My material requests" card no longer `max-w-3xl`                  |
| `src/lib/procurement-rules.ts`                                                                           | `formatRequestCode` returns `MR-YYYY-NNNN`                         |
| `prisma/migrations/20261014090000_material_request_codes/migration.sql`                                  | Renames stored codes, delivery ledger reasons, "Copied from" notes |
| `prisma/schema.prisma`, `src/server/lib/receipt-sample.ts`, `src/server/services/procurement.service.ts` | Comments only                                                      |
| `tests/unit/*.test.ts` (4 files), `tests/e2e/procurement.spec.ts`                                        | Expect `MR-` instead of `PR-`                                      |
| `README.md`, `DESIGN.md`, `docs/API.md`                                                                  | `MR-` in examples                                                  |
| `docs/DECISIONS.md` (D-046), `docs/STATUS.md`, `docs/SESSION_LOG.md`                                     | Docs                                                               |

Database migration in this change: **yes** (name: `20261014090000_material_request_codes`, data
only, no schema change).

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # apply migrations (this applies material_request_codes)
npm run dev            # app on http://localhost:3000 (use PORT=3001 if 3000 is taken)
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change:

- **Before** `npm run db:deploy`, note how many requests start with `PR-` (Procurement → All as
  the Floor Manager, or `SELECT code FROM purchase_requests ORDER BY code;`). The existing dev
  database already has PR- requests; that is what S5 checks.
- Do not reset the database: the migration must be seen renaming existing data.

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts tests/e2e/reports.spec.ts tests/e2e/admin.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs: the existing dev database with some material requests (at least one with a
recorded delivery and, if present, one copied from another). If it has none, the scenarios that
create a request still apply; note it in the report.

## 5. Test scenarios

Viewport 1440 × 900 unless the row says otherwise.

| ID  | Role             | Steps                                                                                                                                                                  | Expected result                                                                                                                                                                                                                                        | Priority |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| S1  | Floor Manager    | Open `/procurement`, tab **All**. Measure the gap between the sidebar's right edge and the page title, and between the table's right edge and the window's right edge. | Both gaps are the page padding only (about 40 px), not a wide empty margin. The **Status** column and its badges are fully visible, not cut off. No sideways page scroll.                                                                              | High     |
| S2  | Floor Manager    | Repeat S1 at **1920 × 1080**.                                                                                                                                          | Content still fills the width beside the sidebar; the table spans it. The page description under "Procurement" wraps before it gets wider than roughly 770 px.                                                                                         | High     |
| S3  | Each role        | Visit every sidebar link once (FM, QI, Admin, Constructor) at 1440 × 900, then at 1280 × 800.                                                                          | Every page fills the width; nothing overlaps, nothing scrolls the page sideways (`document.documentElement.scrollWidth <= innerWidth`). Forms (New batch, New item, New material request, Settings thresholds) stay their current width, left aligned. | High     |
| S4  | Shoe Constructor | Open `/constructor`.                                                                                                                                                   | "My material requests" card spans the full content width; each row shows `MR-2026-…`.                                                                                                                                                                  | High     |
| S5  | Floor Manager    | After `db:deploy`, open Procurement → **All**.                                                                                                                         | Every request that was `PR-2026-NNNN` now reads `MR-2026-NNNN` with the same number. No `PR-` request remains.                                                                                                                                         | High     |
| S6  | Shoe Constructor | **New material request**, add one item, set Needed by, send.                                                                                                           | The toast and the new request show `MR-2026-NNNN`, the next number after the highest existing one (no restart at 0001).                                                                                                                                | High     |
| S7  | Floor Manager    | Approve the S6 request, mark it ordered, record a delivery with a proof file. Then open that item in **Inventory**.                                                    | Toasts name `MR-…`. The ledger row reads "Delivery for MR-2026-NNNN". Older delivery rows also read "Delivery for MR-…".                                                                                                                               | High     |
| S8  | Shoe Constructor | On a request of yours that is rejected or cancelled, **Copy to a new request**, then send.                                                                             | The form says "Copied from MR-…"; the new request's timeline says "Copied from MR-…".                                                                                                                                                                  | Medium   |
| S9  | Shoe Constructor | Start a new request for an item that already has an open request.                                                                                                      | The note reads "MR-… already asks for this" and does not block sending.                                                                                                                                                                                | Medium   |
| S10 | System Admin     | Open **Admin → Audit log**, find an older procurement entry.                                                                                                           | It still shows the old `PR-…` number (history is not rewritten). Not a failure.                                                                                                                                                                        | Low      |
| S11 | Floor Manager    | At a **1024 × 768** window, open `/procurement` and `/reports`.                                                                                                        | Layout stacks/adapts; the table scrolls inside its card if needed, never the whole page.                                                                                                                                                               | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action  | Expected                                                         |
| --- | ------------------------------ | -------------- | ---------------------------------------------------------------- |
| A1  | Quality Inspector              | `/procurement` | Redirect to forbidden / not in the sidebar (unchanged behaviour) |

## 6. Out of scope / known issues

- The audit log keeps `PR-` numbers on purpose (S10).
- File names of proof files already uploaded (e.g. `receipt-PR-2026-0001.jpg` from an older demo
  seed) are the uploaded names and are not renamed. The picture inside an old sample receipt also
  still says PR-. New demo seeds say MR-.
- URLs (`/procurement`), the FM's "Procurement" title and "purchase request" wording are
  unchanged by design (D-035, D-046).
- The `next start` with `output: standalone` warning in the e2e server log is known since Phase 9.
