# QA handoff: small demo rolls

| Field           | Value                                                  |
| --------------- | ------------------------------------------------------ |
| Date            | 2026-11-09                                             |
| Feature         | small-demo-rolls                                       |
| Branch          | `main` at c7d404f, uncommitted (the PC copy)           |
| Spec / prompt   | Dylan's request, 2026-11-09; `docs/DECISIONS.md` D-123 |
| Written by      | Claude                                                 |
| Previous report | none for this change                                   |

## 1. What changed

Demo data only. The demo week (`npm run demo:seed`, `demo:reset`, `SEED_DEMO_WEEK=true`) now
looks like the 4.75 sq ft pieces Dylan uses for the live demo:

- every demo leather roll is **4 to 7 sq ft** (Inventory, Capture's roll picker, Reports → Rolls);
- each roll's **Scanning time is 1 to 3 minutes** (Reports → Rolls);
- a roll has **3 to 6 shots** (16.0 in across, so 16 × 12 in a shot), enough for its area;
- **three rolls are Returned to supplier** (Too many defects, 12% to 16%), the rest stay near 1%.

Nothing else changes: quota 128, batches, attendance, stock updates, the removed roll.

## 2. Files touched

| File                                               | Change                                         |
| -------------------------------------------------- | ---------------------------------------------- |
| `src/server/services/demo-seed.service.ts`         | areas 4–7 sq ft, 1–3 min, shots by area, cuts  |
| `tests/unit/demo-seed.test.ts`                     | the new ranges, shots per roll, three over 10% |
| `README.md`                                        | the demo week paragraph                        |
| `docs/DECISIONS.md`, `STATUS.md`, `SESSION_LOG.md` | D-123 and the wrap-up                          |

Database migration in this change: **no**

## 3. How to run the app locally

```bash
npm run db:up
npm run db:deploy
npm run demo:reset '--' --yes   # PowerShell; wipes test data and seeds a fresh week
npm run dev
```

## 4. Scenarios

| #   | Role          | Steps                                                                     | Expected                                                                                                                                               |
| --- | ------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1  | Floor Manager | Reports → Rolls, the demo week's range                                    | Every roll's area 4 to 7 sq ft; every finished roll's Scanning time 1 to 3 min; 3 to 6 shots                                                           |
| S2  | Floor Manager | Same list                                                                 | Exactly three rolls Returned to supplier (Too many defects); the others Scanning passed                                                                |
| S3  | Floor Manager | Inventory → each leather item                                             | Rolls in stock 4 to 7 sq ft; one roll removed for water damage                                                                                         |
| S4  | Constructor   | Capture → Leather → Roll on the table                                     | The newest roll is still being scanned; the picker lists rolls of 4 to 7 sq ft                                                                         |
| S5  | All           | `npx playwright test` (full suite)                                        | Passes as before (the e2e tests don't use the demo week)                                                                                               |
| S6  | Floor Manager | Reports → Rolls and Settings → Suppliers                                  | The demo suppliers are Marikina Supplier A and B, Bulacan Supplier A and B (codes MSA, MSB, BSA, BSB); no old names                                    |
| S7  | Floor Manager | Reports → Rolls → each Returned to supplier roll, and the one at 7% to 9% | Three rolls over 10% (11% to 16%), each with a mix of holes, scratches, creases and cuts (not mostly cuts); one roll at 7% to 9% reads Scanning passed |
