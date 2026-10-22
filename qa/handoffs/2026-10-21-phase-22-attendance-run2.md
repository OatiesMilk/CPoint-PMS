# QA handoff: Phase 22 Attendance, run 2

| Field           | Value                                                                          |
| --------------- | ------------------------------------------------------------------------------ |
| Date            | 2026-10-21                                                                     |
| Feature         | phase-22-attendance-run2                                                       |
| Branch          | `main` @ `cc612ee`, uncommitted (Phases 20, 21 and 22 are in the working tree) |
| Spec / prompt   | `qa/handoffs/2026-10-21-phase-22-attendance.md` (run 1)                        |
| Written by      | Claude                                                                         |
| Previous report | `qa/reports/2026-10-21-phase-22-attendance.md` (FAIL: S1, S2, two e2e tests)   |

## 1. What changed

- **F1 (S1), Floor Manager and Admin:** the attendance summary now always names the other roles,
  zero included: "1 of 18 Shoe Constructors present · 0 others present". The FM home card uses
  the same line.
- **F2 (S2):** no app change. The handoff now expects "Last saved by <the Floor Manager account's
  name>"; on the dev database that account is named **Ivy**.
- **F3, F4 (e2e, stale tests):** `auth.spec.ts` no longer depends on how the dev accounts are set
  up:
  - the constructor's nav test expects **Capture** too when that account is allowed to capture
    (on the dev database it is);
  - the sign-out test opens the account menu by its role label ("… System Admin"), so a renamed
    admin account still works.

## 2. Files touched

| File                                            | Change                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/attendance-rules.ts`                   | `attendanceSummary` always adds "· N others present"               |
| `tests/unit/attendance-rules.test.ts`           | expects "· 0 others present"                                       |
| `tests/e2e/auth.spec.ts`                        | constructor nav reads `canCapture`; sign-out locator by role label |
| `qa/handoffs/2026-10-21-phase-22-attendance.md` | S2 expects the account's own name                                  |

Database migration in this change: **no**.

## 3. How to run the app locally

```bash
npm run db:up
npm run db:deploy
npm run build
npm run dev            # PORT=3001 if port 3000 is taken
```

Lint, typecheck, 646 unit tests and the build pass (Claude ran them).

## 4. Test accounts and data

The demo accounts from `.env` (`DEMO_USER_PASSWORD`). On the dev database the Floor Manager is
named **Ivy**, the admin **System Admin**, and the demo constructor may capture. Nothing to seed.

## 5. Test scenarios

| ID  | Role | Steps                                                                      | Expected result                                                                                      | Priority |
| --- | ---- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| R1  | FM   | `/attendance` today: tick only Shoe Constructors (no other role) and save. | Summary "X of Y Shoe Constructors present · 0 others present"; the FM home card shows the same line. | High     |
| R2  | FM   | Run run 1's S2 again.                                                      | As in the handoff, with "Last saved by Ivy, …".                                                      | High     |
| R3  | —    | `npx playwright test tests/e2e/auth.spec.ts tests/e2e/attendance.spec.ts`  | All pass.                                                                                            | High     |
| R4  | —    | The full suite: `npm run test:e2e`.                                        | 0 failed (1 skip is expected: the capture test that needs missing model files).                      | High     |

### Access checks

None changed since run 1 (A1 to A4 passed).

## 6. Out of scope / known issues

- Run 1's passing scenarios aren't repeated.
- Put the dev database's attendance back afterwards, as in run 1.
