# QA handoff: Phase 28, each role sees only its modules, and the demo tools

| Field           | Value                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Date            | 2026-10-25                                                                                   |
| Feature         | phase-28-roles-and-demo-tools                                                                |
| Branch          | `main` + uncommitted Phase 28 changes in `C:\dev\CPoint-PMS`                                 |
| Spec / prompt   | `docs/prompts/factory-visit-changes.md` Phase 28; plan `docs/prompts/plans/phase-28-plan.md` |
| Written by      | Claude                                                                                       |
| Previous report | `qa/reports/2026-10-24-phase-27-run5.md` (PASS)                                              |

## 1. What changed

- **Each role sees only its own pages (D-100, C-18).** One sidebar per role, no headings:
  - Shoe Constructor: **Capture**
  - Quality Inspector: **Batches** (now the QI's home; `/quality-inspector` is gone)
  - Floor Manager: **Overview, Batches, Attendance, Reports, Inventory**
  - System Admin: **Overview, Users, Settings, Camera, API tokens, Audit log**
    Every other page answers the 403 page ("You don’t have access to that page").
- **Removed:** the Scans list `/scans` and `GET /api/v1/scans` (the device `POST` stays), the
  Latest scans widget, the QI's Reports, the Admin's Batches, Attendance and Inventory, the FM's
  and QI's Camera page. A section's page `/scans/{id}` stays for the FM, reached from its roll
  (Reports → Rolls → a roll → a shot); its back link reads "Roll R-…".
- **FM home:** Today's batches, Attendance, **Rolls today** (Sections checked, Rejected (for
  salvage), Rolls still open; link "Rolls"), Low stock, Daily summary.
- **Admin home:** System health, Users, **Camera** (state, last capture, rolls open; link "Camera
  status"), Unknown defect classes, **Lunch break** (today, and from a later day if one is saved;
  link to Settings → Lunch break), Audit log. The Admin's Camera page still shows the last
  capture's photo, without an "Open scan" link.
- **Reports** (FM): Operations and Quality tabs; the Quality defects table has no links (the Scans
  list is gone); For salvage links to **Rolls**.
- **Demo tools (D-101, C-17):** only with `DEMO_LOGIN_TOOLS=true` **and** `SEED_DEMO_USERS=true`:
  - under the login form, **Demo sign-in** with four buttons ("Floor Manager · Rodel Pascual",
    "Quality Inspector · Maricel Dizon", "System Admin · Jerome Salazar", "Shoe Constructor · Noel
    Manalo"), each signing in without a password and landing on that role's home;
  - **Reset demo data…**: a dialog listing what it deletes and keeps, "Type RESET to confirm",
    a progress line "Resetting… N s (about a minute). Keep this page open.", and "Fresh demo week
    loaded. Sign in with one of the demo buttons.";
  - a thin **Demo mode** band at the top of every page (login, password page, every app page);
  - with the flag off, nothing shows and `POST /api/v1/demo/sign-in` and `/api/v1/demo/reset`
    answer **404**.

## 2. Files touched

| File                                                                                                                                                          | Change                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/server/policies/permissions.ts`, `navigation.ts`, `src/lib/domain.ts`                                                                                    | the matrix, one sidebar per role, QI home `/batches`                                            |
| `src/app/(app)/quality-inspector/page.tsx`, `scans/page.tsx`, `scans/scan-filters.tsx`, `src/components/features/scans/latest-scans-widget.tsx`               | deleted                                                                                         |
| `src/app/(app)/{floor-manager,admin,camera,reports,scans/[id],batches,layout}`                                                                                | homes, Camera links, Reports for the FM only, back link, band                                   |
| `src/components/features/reports/home-cards.tsx`, `production/production-cards.tsx`                                                                           | Rolls today; QI-only cards gone                                                                 |
| `src/server/{controllers/scan.controller,services/scan-query.service,models/scan.model,validators/scan.validator}.ts`, `src/app/api/v1/scans/route.ts`        | no `GET /scans`; image for `scan:read` or `camera:view`                                         |
| `src/server/services/{roll,report}.service.ts`                                                                                                                | `openRollCount`; `defectsToday` gone                                                            |
| `src/server/services/demo-tools.service.ts`, `controllers/demo.controller.ts`, `validators/demo.validator.ts`, `src/app/api/v1/demo/{sign-in,reset}/route.ts` | new: the demo endpoints                                                                         |
| `src/app/(auth)/login/{page,actions,demo-tools}.tsx`, `src/components/features/demo-band.tsx`, `src/app/(account)/account/password/page.tsx`                  | demo tools and band                                                                             |
| `src/server/lib/{env,auth}.ts`, `src/server/services/{auth,demo-reset}.service.ts`                                                                            | `DEMO_LOGIN_TOOLS`, `CV_DEVICE_TOKEN`; `method: "demo"`; reset `origin` and `allowInProduction` |
| `.env.example`, `docker-compose.yml`                                                                                                                          | `DEMO_LOGIN_TOOLS` (default off), `CV_DEVICE_TOKEN` passed to `app`                             |
| `tests/unit/{permissions,auth.service,demo-reset,demo-tools}.test.ts`                                                                                         | updated and new (548 unit tests)                                                                |
| `tests/e2e/{auth,admin,attendance,batches,capture,cv,helpers,inventory,reports,smoke}.spec.ts`                                                                | updated for the new access; demo tools tests (not run)                                          |

Database migration in this change: **no**.

## 3. How to run the app locally

Prerequisites as usual (`.env` with `AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`,
`SEED_DEMO_USERS=true`). Leave `DEMO_LOGIN_TOOLS` off in `.env` for the dev database.

```bash
npm run db:up
npm run build
npm run start          # PORT=3001 if 3000 is taken
```

The demo tools are tested in a **throwaway Docker stack only** (the Codex prompt, step 6), with
`DEMO_LOGIN_TOOLS=true`. Reset demo data deletes data: never on the dev database.

Existing automated tests that cover this area:

```bash
npm run build && npx playwright test tests/e2e/auth.spec.ts tests/e2e/smoke.spec.ts
```

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD`.

| Role              | Email                      | Home page         |
| ----------------- | -------------------------- | ----------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`  |
| Quality Inspector | `inspector@cpoint.local`   | `/batches`        |
| System Admin      | `admin@cpoint.local`       | `/admin`          |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture` |

Data: the dev database's demo week (at least one finished roll with shots).

## 5. Test scenarios

| ID  | Role        | Steps                                                                                                                      | Expected result                                                                                                                                                                                       | Priority |
| --- | ----------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Constructor | Sign in                                                                                                                    | Lands on `/camera/capture`; sidebar (and phone bar at 390 px) shows only **Capture**                                                                                                                  | High     |
| S2  | QI          | Sign in at 1440 × 900 and at 390 × 844                                                                                     | Lands on `/batches`; the sidebar or phone bar shows only **Batches**; the notices still work                                                                                                          | High     |
| S3  | FM          | Sign in                                                                                                                    | Lands on `/floor-manager`; sidebar exactly Overview, Batches, Attendance, Reports, Inventory; no headings                                                                                             | High     |
| S4  | Admin       | Sign in                                                                                                                    | Lands on `/admin`; sidebar exactly Overview, Users, Settings, Camera, API tokens, Audit log                                                                                                           | High     |
| S5  | FM          | Overview                                                                                                                   | Cards: Today's batches, Attendance, **Rolls today** (three numbers; "Rolls" link opens Reports → Rolls), Low stock, Daily summary; no "Latest scans", no "Today’s inspection split"                   | High     |
| S6  | Admin       | Overview                                                                                                                   | Cards: System health, Users, **Camera** ("Camera status" opens `/camera`), Unknown defect classes, **Lunch break** (today's lunch, link to Settings → Lunch break), Audit log                         | High     |
| S7  | Admin       | Camera                                                                                                                     | Status badge, model card, the last capture's photo with its boxes (if any capture); no "Open scan" or "See open rolls" link                                                                           | Medium   |
| S8  | FM          | Reports → Rolls → a finished roll → a shot                                                                                 | The section page opens; the back link reads "Roll R-…" (or B-…) and returns to the roll; no "Scans of this roll" link                                                                                 | High     |
| S9  | FM          | Reports → Operations → For salvage                                                                                         | Its link reads **Rolls** and opens Reports → Rolls; Quality → Defects by type has no links                                                                                                            | Medium   |
| S10 | FM          | Reports                                                                                                                    | Operations and Quality tabs both work; the CSV buttons download                                                                                                                                       | Medium   |
| S11 | any         | Open `/quality-inspector` and `/scans`                                                                                     | 404 page ("This page doesn’t exist")                                                                                                                                                                  | High     |
| S12 | FM          | `GET /api/v1/scans` in the browser                                                                                         | 405; `GET /api/v1/scans/{id}` of a real scan is 200                                                                                                                                                   | Medium   |
| S13 | —           | Dev app (flag off): `/login`                                                                                               | No Demo sign-in, no Reset demo data, no Demo mode band                                                                                                                                                | High     |
| S14 | —           | Dev app (flag off): `POST /api/v1/demo/sign-in {"role":"FLOOR_MANAGER"}` and `POST /api/v1/demo/reset {"confirm":"RESET"}` | Both 404; nothing reset (the demo week's roll count unchanged)                                                                                                                                        | High     |
| D1  | —           | Throwaway stack with `DEMO_LOGIN_TOOLS=true`: `/login`                                                                     | Demo mode band at the top; under the form the four buttons in the order above and **Reset demo data…**                                                                                                | High     |
| D2  | —           | D1: click each of the four buttons (sign out between)                                                                      | Each lands on its role's home (S1 to S4's homes) with the band shown; the audit log has `user.login` with `method: "demo"`                                                                            | High     |
| D3  | —           | D1: Reset demo data…, type `reset`, press Reset demo data                                                                  | "Type RESET in capitals to reset the demo data." under the field; nothing runs                                                                                                                        | High     |
| D4  | —           | D1: type `RESET`, press Reset demo data                                                                                    | Progress with seconds; within about two minutes "Fresh demo week loaded."; the audit log starts with `system.demo_reset` whose `after.origin` is `login page`; the demo week is back (rolls, batches) | High     |
| D5  | —           | D1: start a reset, and while it runs post `{"confirm":"RESET"}` to `/api/v1/demo/reset`                                    | The second answers 409 "A reset is already running…"                                                                                                                                                  | Medium   |
| D6  | —           | D1 with `SEED_DEMO_USERS=false` (restart the stack's app)                                                                  | No tools, no band; both endpoints 404                                                                                                                                                                 | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                                                                                                                    | Expected                                                 |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| A1  | QI                             | `/reports`, `/camera`, `/attendance`, `/inventory`, `/floor-manager`, `/admin`, `GET /api/v1/reports/quality`                                                                    | 403 page; API 403                                        |
| A2  | Admin                          | `/batches`, `/batches/plan`, `/attendance`, `/inventory`, `/reports`, `/reports/rolls`, `/scans/{id}`; `GET /api/v1/production/today`, `/api/v1/inventory`, `/api/v1/attendance` | 403 page; API 403                                        |
| A3  | FM                             | `/camera`, `/camera/capture`, `/admin`, `/admin/users`                                                                                                                           | 403 page                                                 |
| A4  | Constructor                    | `/batches`, `/reports`, `/camera`, `/admin`                                                                                                                                      | 403 page                                                 |
| A5  | QI, Admin                      | `GET /api/v1/scans/{id}`                                                                                                                                                         | 403 (the Admin may load `/api/v1/scans/{id}/image`: 200) |

## 6. Out of scope / known issues

- The README demo script still mentions the Repair Station, Salvage and the Review queue in a few
  steps, and other docs are behind; Phase 31 brings all documentation up to date.
- The attendance page keeps its read-only text for non-FM roles in code, but no other role reaches
  it now.
- The reset lock is in memory: the app runs as one process (one `app` container).
