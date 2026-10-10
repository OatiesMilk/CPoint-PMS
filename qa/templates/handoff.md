# QA handoff: <feature name>

<!-- Save as qa/handoffs/YYYY-MM-DD-<feature>.md. Delete these comments when filling in. -->

| Field           | Value                                                            |
| --------------- | ---------------------------------------------------------------- |
| Date            | YYYY-MM-DD                                                       |
| Feature         | <short name, matches the file name>                              |
| Branch          | `<branch>` (commit `<short sha>`, or "uncommitted")              |
| Spec / prompt   | e.g. `material-requests.md` Step N, or `docs/ROADMAP.md` Phase N |
| Written by      | Claude                                                           |
| Previous report | `qa/reports/<file>.md`, or "none"                                |

## 1. What changed

<!-- Plain language, from a user's point of view. Which role sees what difference? -->

-

## 2. Files touched

| File | Change |
| ---- | ------ |
|      |        |

Database migration in this change: **yes / no** (name: `<migration>`)

## 3. How to run the app locally

Prerequisites: Docker Desktop running, Node.js installed, `npm install` done, `.env` filled in
(`AUTH_SECRET`, `BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`).

```bash
npm run db:up          # PostgreSQL in Docker
npm run db:deploy      # apply migrations
npm run demo:seed      # optional: a past week of data (empty DB only)
npm run dev            # app on http://localhost:3000
```

Health check: `http://localhost:3000/api/health` returns OK.

Extra steps for this change (delete if none):

-

Existing automated tests that cover this area (run these too):

```bash
npm run build && npx playwright test tests/e2e/<spec>.spec.ts
```

## 4. Test accounts and data

All demo accounts use the `DEMO_USER_PASSWORD` value from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/constructor`       |

Data this test needs (seeded records, batch codes, items, flags to set first):

-

## 5. Test scenarios

<!-- One row per scenario. Steps must be clickable by someone who has never seen the app.
     Expected = one observable result (text on screen, a status, a number, a redirect).
     Include at least one negative case (invalid input, wrong role) per feature. -->

| ID  | Role | Steps | Expected result | Priority |
| --- | ---- | ----- | --------------- | -------- |
| S1  |      |       |                 | High     |
| S2  |      |       |                 | Medium   |
| S3  |      |       |                 | Low      |

### Access checks

| ID  | Role that must NOT have access | URL or action | Expected                |
| --- | ------------------------------ | ------------- | ----------------------- |
| A1  |                                |               | Redirect / 403 / hidden |

## 6. Out of scope / known issues

<!-- What Codex should not report, and why. -->

-
