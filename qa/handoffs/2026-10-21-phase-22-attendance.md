# QA handoff: Phase 22 Attendance

| Field           | Value                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------- |
| Date            | 2026-10-21                                                                                                           |
| Feature         | phase-22-attendance                                                                                                  |
| Branch          | `main` @ `cc612ee`, uncommitted (Phases 20, 21 and 22 are in the working tree)                                       |
| Spec / prompt   | `docs/prompts/production-progression.md` Phase 22; plan `docs/prompts/plans/phase-22-plan.md` (approved: 1A, 2A, 3A) |
| Written by      | Claude                                                                                                               |
| Previous report | `qa/reports/2026-10-20-phase-21-repair-station-floor-view.md` (PASS)                                                 |

## 1. What changed

- **Floor Manager:** a new **Production → Attendance** page (`/attendance`), first in the
  Production section of the nav.
  - It shows **one day at a time** (today by default, Manila time), with **Previous day**, a
    **Day** date field, **Next day** (disabled on today) and **Back to today**. The URL carries
    `?day=YYYY-MM-DD`.
  - A summary line: "**N of M Shoe Constructors present · K others present**", or "Attendance for
    Wed, 21 Oct hasn't been taken yet." When saved: "Last saved by <name>, <date time>."
  - The roster is every active user who had an account by the end of that day (plus anyone
    already marked that day, even if deactivated since). Each row: name and email, a **role
    badge** (Shoe Constructor in yellow, the other roles grey) and a **Present** checkbox with a
    visible label. Shoe Constructors are listed first, then Floor Manager, Quality Inspector,
    System Admin, each by name.
  - **Find a person** (name or email), **Show** (Everyone / Shoe Constructors / Other roles) and
    the 15-row pager.
  - **Mark everyone present** ticks the whole roster (all pages). **Save attendance** is disabled
    until something changes, then reads "Save attendance (3 changes)". After saving, a toast:
    "Attendance for Wed, 21 Oct saved: 14 of 16 Shoe Constructors present…".
  - Unsaved ticks are kept while searching, filtering and paging. Changing the day, clicking any
    link, or closing / reloading the tab with unsaved ticks asks first ("Leave without saving
    attendance? …").
  - Today and the 7 days before can be edited. Older days are read-only with "Days more than 7
    days ago are locked."; ticks become **Present** / **Absent** badges (or "Not taken" if the day
    was never saved). The date field won't pick a future day; the API refuses one.
  - If someone else saved the same day after the page loaded, saving shows "Someone else saved
    this day's attendance. Refresh to see it." and nothing is saved.
- **Floor Manager home:** a new **Attendance** card: "Not taken yet today." with **Take
  attendance**, or the summary line with **Edit**.
- **System Admin:** sees Attendance in the nav and the same page, **read-only** ("Only the Floor
  Manager takes attendance."), with no Save or Mark buttons.
- **Quality Inspector and Shoe Constructor:** no Attendance in the nav; the page redirects to
  `/forbidden` and the API answers 403.
- **Never anywhere:** a person's attendance history, absence count, percentage or streak (D-008).
- **Demo data:** with `SEED_DEMO_USERS=true`, start-up also creates **12 demo Shoe
  Constructors** (Ana Cruz … Lea Flores, `@cpoint.local`, random passwords, they never sign in).
  The demo week (`SEED_DEMO_WEEK=true` / `npm run demo:seed` / `demo:reset -- --yes`) also takes
  attendance for its working days **before** today, with 1, 5, 0, 3 and 2 constructors absent
  (oldest first, on the five days before today when today isn't Sunday); **today is left "Not
  taken"**. `demo:reset` keeps the demo constructors and removes all attendance.

## 2. Files touched

| Area   | Files                                                                                                                                                                                                                          |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Data   | `prisma/schema.prisma`, migration `20261021031541_attendance` (new)                                                                                                                                                            |
| Rules  | `src/lib/attendance-rules.ts` (new)                                                                                                                                                                                            |
| Server | `src/server/models/attendance.model.ts`, `validators/attendance.validator.ts`, `services/attendance.service.ts`, `controllers/attendance.controller.ts` (all new); `models/user.model.ts`                                      |
| API    | `src/app/api/v1/attendance/route.ts`, `src/app/api/v1/attendance/[day]/route.ts` (new)                                                                                                                                         |
| Access | `src/server/policies/permissions.ts`, `navigation.ts`, `src/components/features/app-shell/sidebar.tsx`                                                                                                                         |
| UI     | `src/app/(app)/attendance/{page.tsx,attendance-roster.tsx,actions.ts}` (new), `src/components/features/attendance/attendance-card.tsx` (new), `src/app/(app)/floor-manager/page.tsx`                                           |
| Seeds  | `services/bootstrap.service.ts`, `services/demo-seed.service.ts`, `services/demo-reset.service.ts`, `models/demo-reset.model.ts`, `scripts/demo-seed.ts`, `scripts/demo-reset.ts`                                              |
| Tests  | `tests/unit/{attendance-rules,attendance.service}.test.ts` (new), `tests/unit/{permissions,validator-messages,bootstrap.service,demo-seed,demo-reset}.test.ts`, `tests/e2e/attendance.spec.ts` (new), `tests/e2e/auth.spec.ts` |
| Docs   | `docs/API.md`, `docs/DECISIONS.md` (D-077 to D-081), `docs/ROADMAP.md`, `docs/STATUS.md`, `docs/SESSION_LOG.md`, `README.md`, `docs/prompts/system-rebuild.md`                                                                 |

Database migration in this change: **yes** (`attendance`: tables `attendance_days` and
`attendance_marks`). It is already applied to the dev database; `db:deploy` should report nothing
pending there.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # apply migrations
npm run build
npm run start          # or npm run dev; use PORT=3001 if port 3000 is taken
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change:

- Dylan's `.env` has `SEED_DEMO_USERS=false`, so the dev database has **no demo constructors**
  and no seeded attendance. Scenarios S1 to S10 and A1 to A4 work on the dev database as it is
  (its roster is the existing accounts; the e2e spec adds its own constructor).
- For **D1 and D2** (the seeded roster and week), use a throwaway Docker stack as in earlier runs,
  never the dev database: e.g. `docker compose -p cpoint-qa` with other `DB_PORT` / `APP_PORT`
  values, `SEED_DEMO_USERS=true` and `SEED_DEMO_WEEK=true`. Remove the stack afterwards.
- Don't run `demo:reset -- --yes` on the dev database without Dylan's word.

Automated tests that cover this area:

```bash
npm run build && npx playwright test tests/e2e/attendance.spec.ts tests/e2e/auth.spec.ts
```

Then the full e2e suite (`npm run test:e2e`) to confirm nothing else moved (the FM home has one
more card; the FM and Admin nav have one more item).

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs:

- Nothing to prepare on the dev database. Today's attendance there starts "Not taken" unless an
  earlier run saved it; that's fine, scenarios say how to read either state.
- In the throwaway stack: the 12 demo constructors (e.g. **Ana Cruz**, **Lea Flores**) and the
  seeded days.

## 5. Test scenarios

| ID  | Role                                   | Steps                                                                                                                                                                                                                                                                                                                      | Expected result                                                                                                                                                                                                                                                                                                                                                    | Priority |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| S1  | FM                                     | Sign in → sidebar → **Production → Attendance**.                                                                                                                                                                                                                                                                           | Attendance is the first item under Production. Page "Attendance" with today's date heading ("· today"), **Next day** disabled, the summary line, and the roster with role badges and Present boxes.                                                                                                                                                                | High     |
| S2  | FM                                     | On today, click **Mark everyone present**, then untick one Shoe Constructor and one other role. Read the Save button, then click it.                                                                                                                                                                                       | Button reads "Save attendance (N changes)" with the right N. After saving: toast "Attendance for … saved: …"; summary "X of Y Shoe Constructors present · Z others present" with X = Y − 1; "Last saved by <the Floor Manager account's name>, …" (on the dev database the account is named Ivy). Reload: ticks are as saved, and **Save attendance** is disabled. | High     |
| S3  | FM                                     | Go to **Overview** (`/floor-manager`).                                                                                                                                                                                                                                                                                     | The **Attendance** card shows the same summary as S2 and an **Edit** link to `/attendance`. Before any save today it shows "Not taken yet today." with **Take attendance**.                                                                                                                                                                                        | High     |
| S4  | FM                                     | On `/attendance`, click **Previous day**. Tick or untick one person and save.                                                                                                                                                                                                                                              | URL has `?day=<yesterday>`. Saving works as in S2. **Back to today** returns to today.                                                                                                                                                                                                                                                                             | High     |
| S5  | FM                                     | Open `/attendance?day=<8 days ago>`.                                                                                                                                                                                                                                                                                       | Read-only: "Days more than 7 days ago are locked." with a lock icon, no checkboxes (Present/Absent badges, or "Not taken"), no Mark or Save buttons. `?day=<7 days ago>` is still editable.                                                                                                                                                                        | High     |
| S6  | FM                                     | On today, tick one box (don't save). Then (a) click **Previous day** and **Cancel** the prompt; (b) click **Batches** in the sidebar and **Cancel**; (c) reload the page.                                                                                                                                                  | (a) and (b) ask "Leave without saving attendance? …"; Cancel keeps the page and the tick. (c) the browser's own leave-page prompt appears. With nothing unsaved, none of these ask.                                                                                                                                                                                | Medium   |
| S7  | FM                                     | Open today in two tabs. Save a change in tab 1. In tab 2 (not reloaded) change a box and save.                                                                                                                                                                                                                             | Tab 2 shows "Someone else saved this day's attendance. Refresh to see it." and nothing is saved; after reload tab 2 shows tab 1's save.                                                                                                                                                                                                                            | High     |
| S8  | FM                                     | Type part of a person's name in **Find a person**; then set **Show** to Shoe Constructors, then Other roles. Tick someone on page 2 of the pager (if the roster has more than 15), go back to page 1.                                                                                                                      | The list narrows; the role filter shows only that group; "Nobody matches …" for a name that doesn't exist. Ticks survive paging, searching and filtering, and the Save count includes them.                                                                                                                                                                        | Medium   |
| S9  | FM                                     | Open `/attendance?day=2026-02-30` and `/attendance?day=nonsense`.                                                                                                                                                                                                                                                          | Today is shown with "That link's date isn't a real day, so today is shown instead."                                                                                                                                                                                                                                                                                | Low      |
| S10 | FM                                     | Using the browser console or an API client signed in as FM: `PUT /api/v1/attendance/<tomorrow>` with `{ "expectedUpdatedAt": null, "marks": [{ "userId": "<any user id>", "present": true }] }`; then the same for 8 days ago; then for today with a random UUID as `userId`; then for today with the same `userId` twice. | 409 "Attendance can't be taken for a future day."; 409 "Days more than 7 days ago are locked."; 409 "Someone in this list isn't on the roster for <d Mon>. Refresh the list."; 422 "The same person is in the list twice. Refresh the page and save again."                                                                                                        | Medium   |
| S11 | FM                                     | Look at Users or Reports for anything about attendance per person.                                                                                                                                                                                                                                                         | Nothing: no per-person attendance history, count, percentage or streak anywhere (D-008).                                                                                                                                                                                                                                                                           | High     |
| D1  | FM (throwaway stack, demo week seeded) | Open `/attendance`, then click **Previous day** through the past week.                                                                                                                                                                                                                                                     | Today: "Not taken". The previous working days (Sunday skipped) are saved by Demo Floor Manager at 07:50 with the 12 demo constructors on the roster (the four demo accounts were created at start-up, so they appear from today only) and 1, 5, 0, 3, 2 constructors absent (oldest first).                                                                        | Medium   |
| D2  | Any (throwaway stack)                  | `npm run demo:reset` (dry run) then `-- --yes`.                                                                                                                                                                                                                                                                            | The dry run lists "days of attendance". After `--yes` the 12 demo constructors still exist; attendance is re-seeded for the new demo week.                                                                                                                                                                                                                         | Low      |
| E1  | —                                      | `npx playwright test tests/e2e/attendance.spec.ts`                                                                                                                                                                                                                                                                         | 7 tests pass (FM today, FM yesterday with the leave prompt, locked/future, Admin read-only, QI and constructor refused, axe).                                                                                                                                                                                                                                      | High     |

### Access checks

| ID  | Role that must NOT have access    | URL or action                                    | Expected                                                                |
| --- | --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| A1  | Quality Inspector                 | Sidebar; `/attendance`; `GET /api/v1/attendance` | No Attendance item; redirect to `/forbidden`; 403                       |
| A2  | Shoe Constructor                  | Sidebar; `/attendance`; `GET /api/v1/attendance` | No Attendance item; redirect to `/forbidden`; 403                       |
| A3  | System Admin (may view, not save) | `/attendance`; `PUT /api/v1/attendance/<today>`  | Page read-only with "Only the Floor Manager takes attendance."; PUT 403 |
| A4  | Signed out                        | `/attendance`; `GET /api/v1/attendance`          | Redirect to sign-in; 401                                                |

## 6. Out of scope / known issues

- Production check-ins, the daily quota, stage monitoring changes and materials are Phases 23 and 24. The FM home still shows "Batches by stage" until Phase 23.
- No absence reasons, half days or hours (Dylan: 3A). No per-person history by design.
- The app never deletes users; if a test hard-deletes a user, their attendance marks go with them
  (by design, so test clean-ups aren't blocked).
- Claude did not run Playwright, axe or any browser test (project rule). Lint, typecheck, 646 unit
  tests and the production build passed.
