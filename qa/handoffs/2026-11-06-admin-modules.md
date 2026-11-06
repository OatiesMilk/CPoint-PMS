# QA handoff: the System Admin reaches only the administration modules

| Field           | Value                                                                   |
| --------------- | ----------------------------------------------------------------------- |
| Date            | 2026-11-06                                                              |
| Feature         | admin-modules (D-119)                                                   |
| Branch          | `main` 12448b5, uncommitted                                             |
| Spec / prompt   | `docs/ROADMAP.md` → "Follow-up (Dylan, 2026-11-04): the System Admin …" |
| Written by      | Claude                                                                  |
| Previous report | none                                                                    |

## 1. What changed

- **System Admin:** the sidebar is Overview, Users, Settings, API tokens, Audit log. **Camera** is
  gone, and so is the Camera card on the Admin home. `/camera` answers 404 for everyone.
- The Admin keeps the camera's administration only: Users → More actions → May capture, Settings
  (defect types, thresholds, the early-model notice) and API tokens (the Audit log card still
  links "Camera API tokens").
- `GET /api/v1/scans/{id}/image` takes `scan:read` only (the Floor Manager). The Admin gets `403`.
- The `camera:view` permission is removed from the matrix. No other role changes.

## 2. Files touched

| File                                            | Change                                                   |
| ----------------------------------------------- | -------------------------------------------------------- |
| `src/server/policies/permissions.ts`            | `camera:view` removed                                    |
| `src/server/policies/navigation.ts`             | Camera item and its icon removed from the Admin's menu   |
| `src/components/features/app-shell/sidebar.tsx` | the unused camera icon removed                           |
| `src/app/(app)/camera/page.tsx`                 | deleted (the Camera page)                                |
| `src/app/(app)/admin/page.tsx`                  | Camera card removed                                      |
| `src/app/(app)/admin/settings/actions.ts`       | no longer refreshes `/camera`                            |
| `src/server/controllers/scan.controller.ts`     | image route: `requireApiPermission("scan:read")`         |
| `tests/unit/permissions.test.ts`                | matrix and Admin nav without Camera                      |
| `tests/e2e/auth.spec.ts`                        | Admin nav; `/camera` 404, no card, image `403` for Admin |
| `docs/API.md`, `docs/prompts/system-rebuild.md` | the image route's permission; the Admin's modules        |

Database migration in this change: **no**

## 3. How to run the app locally

As in `qa/templates/handoff.md` §3 (`npm run db:up`, `npm run db:deploy`, `npm run dev`). No
reset needed: any database with at least one roll that has a captured shot (the demo week has).

Existing automated tests that cover this area:

```bash
npx playwright test tests/e2e/auth.spec.ts --workers=1
```

## 4. Test accounts and data

Demo accounts with `DEMO_USER_PASSWORD`: `admin@cpoint.local` (`/admin`), `manager@cpoint.local`
(`/floor-manager`), a Shoe Constructor with camera access (`/camera/capture`).

Data: one finished roll in Reports → Rolls with at least one shot that has a photo.

## 5. Test scenarios

| ID  | Role  | Steps                                                                                | Expected result                                                                                          | Priority |
| --- | ----- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | -------- |
| S1  | Admin | Sign in; read the sidebar                                                            | Exactly Overview, Users, Settings, API tokens, Audit log (no Camera), at 1440 px and at 390 px (top bar) | High     |
| S2  | Admin | On `/admin` read the cards                                                           | System health, Users, Lunch break, Audit log; no Camera card; "Camera API tokens" opens `/admin/tokens`  | High     |
| S3  | Admin | Type `/camera` in the address bar                                                    | The 404 page                                                                                             | High     |
| S4  | Admin | Users → a Shoe Constructor → More actions → turn May capture off, then on again      | Both saves succeed with a toast; the constructor's access ends as it started                             | High     |
| S5  | Admin | Settings → Thresholds → change the early-model notice switch, save, then put it back | Both saves succeed with a toast                                                                          | Medium   |
| S6  | FM    | Reports → Rolls → a finished roll → a shot's section page; then its claim sheet      | The photo loads on both (image route still works for the FM)                                             | High     |
| S7  | Admin | Run axe on `/admin`                                                                  | 0 violations                                                                                             | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                                                        | Expected     |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------ |
| A1  | Admin                          | `GET /api/v1/scans/<id>/image` with the id from S6's section URL (`/scans/<id>`), signed in as Admin | `403`        |
| A2  | Admin                          | `/camera/capture`                                                                                    | `/forbidden` |
| A3  | FM, constructor                | `/camera`                                                                                            | 404 page     |

## 6. Out of scope / known issues

- Capture itself is unchanged (constructors only).
- `batches.spec.ts` fails between 00:00 and 01:00 Manila (STATUS → Known test observations); run
  the suite after 01:00.
