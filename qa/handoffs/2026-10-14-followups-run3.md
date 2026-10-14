# QA handoff: Follow-ups, run 3 (e2e only)

| Field           | Value                                              |
| --------------- | -------------------------------------------------- |
| Date            | 2026-10-14                                         |
| Feature         | followups-run3                                     |
| Branch          | `main` (base commit `e88e7de`, change uncommitted) |
| Spec / prompt   | D-046, D-047                                       |
| Written by      | Claude                                             |
| Previous report | `qa/reports/2026-10-14-followups-run2.md`          |

## 1. What changed

Tests only; no app code changed since run 2, whose eight browser scenarios all passed.

- `tests/e2e/cv.spec.ts` (run 2 F1): after revoking a token, the test checks the toast
  "“E2E camera …” revoked." and that the camera API now refuses the token (401). It no longer looks
  for the row, which moves past page 1 once more than 15 tokens exist (revoked tokens sort last).
- `tests/e2e/inventory.spec.ts` (run 2 F2): choosing the Thread category is retried until the Unit
  shows "spool", for up to 15 s. A choice made before React hydrates the form is lost.

## 2. Files touched

| File                                    | Change                                           |
| --------------------------------------- | ------------------------------------------------ |
| `tests/e2e/cv.spec.ts`                  | Revoke check via toast + 401                     |
| `tests/e2e/inventory.spec.ts`           | Retry the category choice until the unit follows |
| `docs/STATUS.md`, `docs/SESSION_LOG.md` | Docs                                             |

Database migration in this change: **no**.

## 3. How to run

Make sure nothing listens on port 3100, then:

```bash
npm run db:up
npm run db:deploy
npm run build && npx playwright test tests/e2e/admin.spec.ts tests/e2e/procurement.spec.ts tests/e2e/outcomes.spec.ts tests/e2e/cv.spec.ts tests/e2e/batches.spec.ts tests/e2e/inventory.spec.ts tests/e2e/smoke.spec.ts
```

Then run the whole suite once: `npx playwright test` (every spec, including `auth`, `reports`,
`rework-columns` and `theme`).

## 4. Test accounts and data

Demo accounts with `DEMO_USER_PASSWORD` from `.env`. No manual data needed.

## 5. Test scenarios

| ID  | Role | Steps                                                   | Expected result                                                                    | Priority |
| --- | ---- | ------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| E1  | —    | Run the seven-spec command above, three times in a row. | All green each time. For any failure: the test, its error, and whether it repeats. | High     |
| E2  | —    | Run `npx playwright test` (all specs) once.             | All green.                                                                         | High     |

## 6. Out of scope / known issues

- `The destination stream closed early` and the `next start` / standalone warning in the server
  log are known and harmless.
- If a QA helper script lives in a folder TypeScript includes, name it `.cts` so `npm run build`
  doesn't pick it up (as in run 2).
