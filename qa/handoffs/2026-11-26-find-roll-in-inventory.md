# QA handoff: Phase 41, Find roll is a button on Inventory

| Field           | Value                                                                                  |
| --------------- | -------------------------------------------------------------------------------------- |
| Date            | 2026-11-26                                                                             |
| Feature         | find-roll-in-inventory                                                                 |
| Branch          | uncommitted (working tree on `main` fe5ca83; Phase 40 is also in this tree, see below) |
| Spec / prompt   | `docs/prompts/plans/phase-41-find-roll-in-inventory-plan.md` (option 1), D-138, A-118  |
| Written by      | Claude                                                                                 |
| Previous report | none for Phase 41                                                                      |

## 1. What changed

Dylan asked to take Find roll out of the navigation bar and make it a button on Inventory. Constructors with camera
access use Find roll on their phones but can't open Inventory, so only the Floor Manager's menu changes.

- **Floor Manager:** the menu is now **Overview, Batches, Attendance, Reports, Inventory** (no Find roll). The Inventory
  page header has a **Find roll** button (search icon, secondary style) after **Storage locations**. On a phone-sized
  window (below 640 px) the button comes first and is 44 px tall. It goes to `/find`, where the sidebar keeps
  **Inventory** marked, the phone bar's title reads "Inventory", and the page header has a back link **Inventory**.
- **Shoe Constructor with camera access:** unchanged. The menu is still **Capture, Find roll**; `/find` has no back
  link; `/inventory` still sends them to the Forbidden page.
- **Everyone else:** unchanged. A constructor without camera access, the Quality Inspector and the System Admin have no
  Find roll and are refused `/find`.
- Unchanged on purpose: the route `/find`, who may open it, `GET /api/v1/rolls/find`, the QR scan, and the Storage
  locations page's roll count link (`/find?q=LOC:<code>`).

## 2. Files touched

| File                                                                              | Change                                                                              |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/server/policies/navigation.ts`                                               | `FIND_ROLL` removed from the Floor Manager; optional `alsoActive` on nav items      |
| `src/components/features/app-shell/sidebar.tsx`                                   | the active item also matches `alsoActive` paths (longest match kept)                |
| `src/app/(app)/inventory/page.tsx`                                                | **Find roll** button, first and `h-11` below `sm`, shown with `location:read`       |
| `src/app/(app)/find/page.tsx`                                                     | back link to Inventory for people who can read inventory                            |
| `tests/unit/permissions.test.ts`                                                  | Floor Manager's menu has no Find roll; `alsoActive` only on their Inventory         |
| `tests/e2e/auth.spec.ts`                                                          | manager nav loses "Find roll"; `/inventory` added to the constructor's refused list |
| `tests/e2e/inventory.spec.ts`                                                     | new block "Find roll from Inventory (Phase 41, D-138)", three tests                 |
| `docs/prompts/system-rebuild.md`, `README.md`, `docs/USER_MANUAL.md`, `DESIGN.md` | feature docs                                                                        |
| `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/STATUS.md`, `docs/SESSION_LOG.md`   | wrap-up docs                                                                        |

Database migration in this change: **no**.

**Phase 40 shares this working tree** (Preparation counted in pieces: `src/lib/repair-rules.ts`, `stage.service.ts`, the
board, My stage, the count form, `stage-wip.spec.ts` and others). Ignore those files for this run; the Phase 41 files are
the table above. README.md, USER_MANUAL.md, `system-rebuild.md` and the wrap-up docs carry edits from both phases.

## 3. How to run the app locally

Prerequisites: Docker Desktop running (database only), `npm install` done, `.env` filled in (`AUTH_SECRET`,
`BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up
npm run db:deploy
npm run demo:reset '--' --yes     # the demo week: rolls in storage, locations, the constructor with camera access
npm run dev                       # note the port
```

Health check: `http://localhost:<port>/api/health` returns OK.

Existing automated tests that cover this area (run these too, with `E2E_BASE_URL` set to the dev server):

```bash
npx playwright test tests/e2e/auth.spec.ts tests/e2e/inventory.spec.ts
npx playwright test tests/e2e/capture.spec.ts
```

`inventory.spec.ts` also holds the storage locations and Find roll tests from Phase 32; `capture.spec.ts` checks the
constructor's Pages menu (unchanged, must still pass).

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page         |
| ----------------- | -------------------------- | ----------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`  |
| Quality Inspector | `inspector@cpoint.local`   | `/batches`        |
| System Admin      | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture` |

Data this test needs:

- The demo week gives `constructor@cpoint.local` camera access.
- A constructor **without** camera access for F7: create one under Admin → Users (Shoe Constructor, camera access off),
  or use one the demo week seeded without it.
- A roll in storage (any `LR-…` code from Inventory → Storage locations) and a location with rolls (e.g. `R1-B1`).

## 5. Test scenarios

| ID  | Role                                      | Steps                                                                                                                                  | Expected result                                                                                                                                             | Priority |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F1  | Floor Manager (1366 px)                   | Sign in. Read the sidebar.                                                                                                             | Menu is Overview, Batches, Attendance, Reports, Inventory. No Find roll.                                                                                    | High     |
| F2  | Floor Manager (1366 px)                   | Open Inventory. Read the header buttons.                                                                                               | A **Find roll** button after **Storage locations**. It stays when the list is filtered to nothing.                                                          | High     |
| F3  | Floor Manager (1366 px)                   | Click **Find roll**. Read the sidebar and the page header. Type a roll's code, click **Find**. Then click the **Inventory** back link. | URL `/find`; heading "Find roll"; **Inventory** is marked in the sidebar (`aria-current="page"`); the roll is found; the back link returns to `/inventory`. | High     |
| F4  | Floor Manager (390 × 844)                 | Open `/inventory`. Look at the first screen. Measure the button. Check sideways scroll.                                                | **Find roll** is the first action, on the first screen, at least 44 px tall; `scrollWidth` ≤ 390.                                                           | High     |
| F5  | Floor Manager (390 × 844)                 | Tap **Find roll**. Read the phone bar. Check sideways scroll. Find a roll.                                                             | URL `/find`; the phone bar's title reads "Inventory"; `scrollWidth` ≤ 390; the roll is found.                                                               | High     |
| F6  | Shoe Constructor with camera access (390) | Sign in. Open the Pages menu. Open Find roll from it.                                                                                  | Menu is Capture, Find roll (unchanged); `/find` opens with no **Inventory** back link.                                                                      | High     |
| F7  | Shoe Constructor without camera access    | Sign in. Open the Pages menu.                                                                                                          | Only Capture; no Find roll.                                                                                                                                 | Medium   |
| F8  | Floor Manager                             | Inventory → Storage locations. Click a location's roll count (e.g. `R1-B1`).                                                           | `/find?q=LOC:<code>` opens and lists the rolls kept there, as before.                                                                                       | Medium   |
| F9  | Floor Manager                             | Open `/find` directly (bookmark).                                                                                                      | Works; Inventory marked; back link present.                                                                                                                 | Low      |

### Access checks

| ID  | Role that must NOT have access         | URL or action                          | Expected                   |
| --- | -------------------------------------- | -------------------------------------- | -------------------------- |
| A1  | Shoe Constructor with camera access    | `/inventory`                           | Redirect to `/forbidden`   |
| A2  | Shoe Constructor without camera access | `/find`, `GET /api/v1/rolls/find?q=LR` | `/forbidden`; API 403      |
| A3  | Quality Inspector                      | menu; `/find`                          | No Find roll; `/forbidden` |
| A4  | System Admin                           | menu; `/find`                          | No Find roll; `/forbidden` |

## 6. Out of scope / known issues

- `docs/USER_MANUAL.pdf` hasn't been rebuilt (its text changed; Claude rebuilds it after the pass). No manual screenshot
  shows the change.
- The phone bar on `/find` reads "Inventory" while the page title says "Find roll": on purpose, as on Storage locations.
- The Floor Manager on a phone takes one more tap (Pages → Inventory → Find roll): on purpose (D-138).
- Phase 40's changes (pieces at Preparation) are in the same tree; they have their own prompt.
- Corrections and Reports specs have timed out at sign-in in the six-worker full run before (STATUS, Known test
  observations); rerun alone once and report both.
- `npm run check` is Claude's: lint, typecheck, 1021 unit tests and the build passed on 2026-11-26 on Dylan's PC.
