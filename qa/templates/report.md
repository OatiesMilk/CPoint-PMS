# QA report: <feature name>

<!-- Save as qa/reports/YYYY-MM-DD-<feature>.md (same base name as the handoff).
     Put screenshots, traces and logs in qa/reports/artifacts/YYYY-MM-DD-<feature>/. -->

| Field     | Value                                                    |
| --------- | -------------------------------------------------------- |
| Date      | YYYY-MM-DD HH:MM (local time)                            |
| Handoff   | `qa/handoffs/<file>.md`                                  |
| Tested by | Codex                                                    |
| Verdict   | **PASS** / **PASS WITH ISSUES** / **FAIL** / **BLOCKED** |

## 1. Summary

<!-- Two or three sentences: what was tested, the verdict, and the most important problem. -->

Scenarios: <n> passed, <n> failed, <n> blocked, <n> total.

## 2. Environment

| Item            | Value                                               |
| --------------- | --------------------------------------------------- |
| OS              |                                                     |
| Node / npm      |                                                     |
| Branch / commit | `<branch>` @ `<sha>` (`git status` clean? yes / no) |
| How the app ran | `npm run dev` / `npm run start` / Docker            |
| Base URL        | `http://localhost:3000`                             |
| Database        | Docker `db`, seeded with: demo users / demo week    |
| Browser         | Playwright Chromium <version>, headless / headed    |
| Viewport        | 1440 × 900                                          |

## 3. Scenario results

| ID  | Scenario | Result                | Notes / evidence |
| --- | -------- | --------------------- | ---------------- |
| S1  |          | PASS / FAIL / BLOCKED |                  |
| A1  |          |                       |                  |

Existing automated tests run:

| Command                                        | Result                 |
| ---------------------------------------------- | ---------------------- |
| `npx playwright test tests/e2e/<spec>.spec.ts` | <n> passed, <n> failed |

## 4. Failures

<!-- One block per FAIL or BLOCKED scenario. Copy the block as needed. -->

### F1 — <scenario ID>: <one-line title>

- **Severity:** Critical / High / Medium / Low
- **Role / page:**
- **Steps to reproduce:** 1. 2.
- **Expected:**
- **Actual:**
- **Evidence:** `qa/reports/artifacts/<base>/<file>.png`, console or server log lines:

  ```text

  ```

- **Suggested fix:** <where in the code it likely lives and what to change; say "unsure" if so>

Severity guide:

| Severity | Meaning                                                                                   |
| -------- | ----------------------------------------------------------------------------------------- |
| Critical | Data loss, wrong stock or verdict saved, a role can do something it must not, app crashes |
| High     | A scenario's main goal can't be completed                                                 |
| Medium   | Works, but wrong message, wrong number shown, or confusing flow                           |
| Low      | Cosmetic: spacing, wording, alignment                                                     |

## 5. Other observations

<!-- Things outside the scenarios: console errors, slow pages, accessibility, copy problems. -->

-

## 6. Suggested fixes (priority order)

1.
