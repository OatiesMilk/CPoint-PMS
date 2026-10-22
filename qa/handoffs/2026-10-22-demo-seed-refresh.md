# QA handoff: demo seed refresh

| Field           | Value                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Date            | 2026-10-22                                                               |
| Feature         | demo-seed-refresh                                                        |
| Branch          | uncommitted, on top of `main` (`0e8e06f`)                                |
| Spec / prompt   | Dylan's ask in the project thread, 2026-10-22; `docs/DECISIONS.md` D-090 |
| Written by      | Claude                                                                   |
| Previous report | `qa/reports/2026-10-22-phase-23-qa-run2.md`                              |

## 1. What changed

Demo data only; no app screen or rule changed.

- The demo week's scans look like Capture page captures: source Webcam, model `yolo-v1-1d729fb0`,
  no device token. The Camera page's Model card names the real model, not "demo-seed".
- 10 sections a roll, so about 120 scans instead of about 290.
- The demo accounts have names: Rodel Pascual (FM), Maricel Dizon (QI), Jerome Salazar (Admin),
  Noel Manalo (Shoe Constructor; may request leather rolls and capture). Emails are unchanged.
- 12 constructors with a mixed list of names (Arnel Bautista, Jocelyn Reyes, …) replace the A-to-L
  list (Ana Cruz, Ben Santos, …).
- Suppliers: Marikina Leather Trading, Meycauayan Tannery, JM Leather Supply (Divisoria) for
  leather; San Roque Shoe Supplies for thread, tacks, cement and soles.
- On one past day (the third attendance day with no constructor absent) the QI is marked absent;
  that day's scans are captured by Rodel Pascual, he enters its check-ins, and its flagged scans
  are reviewed by the QI the next morning.
- `demo:reset` puts the demo names back and removes the old A-to-L constructors.

## 2. Files touched

| File                                                                                 | Change                                                                                        |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `src/server/services/demo-seed.service.ts`                                           | Website captures, 10 a roll, suppliers, the QI-absent day, capture access for the constructor |
| `src/server/services/bootstrap.service.ts`                                           | Named demo accounts dated 30 days back; new constructor list                                  |
| `src/server/services/demo-reset.service.ts`, `src/server/models/demo-reset.model.ts` | `setDemoAccountNames`                                                                         |
| `src/server/lib/demo-suppliers.ts`                                                   | Four suppliers with notes                                                                     |
| `.github/workflows/ci.yml`                                                           | Demo-week check: at least 40 scans (was 150)                                                  |
| `tests/unit/demo-seed.test.ts`, `tests/unit/demo-reset.test.ts`                      | Updated and new tests                                                                         |

Database migration in this change: **no**

## 3. How to run the app locally

Use a throwaway stack so the dev database isn't touched:

```bash
docker compose -p cpoint-qa up --build -d   # with DB_PORT=5434, APP_PORT=3002, SEED_DEMO_USERS=true, SEED_DEMO_WEEK=true
```

Wait for "Demo week seeded" in `docker compose -p cpoint-qa logs app`, then open
http://localhost:3002. Health: `/api/health`.

Existing automated tests that cover this area: the full e2e suite (`npm run test:e2e`) against
the dev database, to confirm no test depended on the old names or the simulator source.

## 4. Test accounts and data

All demo accounts use the stack's `DEMO_USER_PASSWORD`. Emails as in the template
(`manager@`, `inspector@`, `admin@`, `constructor@cpoint.local`).

## 5. Test scenarios

| ID  | Role | Steps                                                                  | Expected result                                                                                                            | Priority |
| --- | ---- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| D1  | FM   | Sign in, open the user menu / home                                     | Name reads "Rodel Pascual", not "Demo Floor Manager"                                                                       | High     |
| D2  | FM   | Scans; open any scan                                                   | Source "Webcam" (no "Simulator"); model `yolo-v1-1d729fb0`; about 10 scans per roll on Batches                             | High     |
| D3  | FM   | Camera                                                                 | Model card shows the yolo-v1 model; no "Simulator active" badge                                                            | High     |
| D4  | FM   | Production → Attendance; go back day by day                            | Five past days taken; one day has only Maricel Dizon absent; constructor names are the new list                            | High     |
| D5  | FM   | Production; the 14-day table/check-ins for that day                    | That day's check-ins were entered by Rodel Pascual                                                                         | High     |
| D6  | FM   | Reports → Operations → Supplier quality                                | Marikina Leather Trading, Meycauayan Tannery, JM Leather Supply (Divisoria); Marikina is worst                             | Medium   |
| D7  | FM   | Procurement                                                            | 9 requests; ordered ones name Marikina Leather Trading (leather) or San Roque Shoe Supplies (thread, tacks, cement, soles) | Medium   |
| D8  | FM   | Camera → Camera operators                                              | Noel Manalo can capture                                                                                                    | Medium   |
| D9  | QI   | Review queue                                                           | Two flagged sections waiting on the newest roll                                                                            | Medium   |
| D10 | any  | Search every page seen above for "Demo ", "Test", "lorem", "Simulator" | None in seeded data                                                                                                        | Low      |

### Access checks

None changed.

## 6. Out of scope / known issues

- The bootstrap "Sample Leather Supplier" still exists (reference data); it just has no demo rolls.
- `npm run demo:reset` on the dev database is Dylan's call; don't run it there.
