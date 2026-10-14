# QA handoff: Phase 13 material requests, run 3 (e2e only)

| Field           | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Date            | 2026-10-14                                                 |
| Feature         | phase-13-material-requests (run 3)                         |
| Branch          | `main` checkout at `c044511`, **uncommitted** changes      |
| Spec / prompt   | `material-requests.md` (project root), Phase 13            |
| Written by      | Claude                                                     |
| Previous report | `qa/reports/2026-10-14-phase-13-material-requests-run2.md` |

Run 2 passed all 13 manual scenarios and found no fault in the app. Its only failures were three
faults in the e2e tests. This run has **no manual scenarios**: it only reruns the e2e specs.

Claude ran lint, typecheck, the 494 unit tests and the production build after these changes.
Claude did **not** run any e2e test.

## 1. What changed

Only `tests/e2e/procurement.spec.ts`. No application code changed since run 2.

- **E1:** the short-delivery test filled `getByLabel("Note")`, which also matched the
  "Remove delivery-note.pdf" button. It now fills `#delivery-note`.
- **E2:** the `signedIn` helper opened its page with `browser.newPage()`, which axe refuses. It now
  opens a context first, and closing the page closes that context.
- **E3:** the copy test used `check()` and `uncheck()` on a checkbox the form controls, which
  failed in the serial run although the page ended up correct. It now clicks and asserts the
  result (the item row and the checkbox state).

## 2. Files touched

| File                            | Change                     |
| ------------------------------- | -------------------------- |
| `tests/e2e/procurement.spec.ts` | the three test corrections |

Database migration in this change: **no**.

## 3. How to run

Prerequisites: Docker Desktop running, `.env` filled in. No dev server is needed; stop it if it is
running, because the build and `npm run dev` both write to `.next`.

```bash
npm run db:up
npm run db:deploy      # should say nothing is pending
npm run build
npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts
npx playwright test tests/e2e/procurement.spec.ts --workers=1
```

Run 2 results: 43 passed, 2 failed of 45 (parallel); 12 passed, 3 failed of 15 (serial).

**Two tests have never run past their failing line**, so new faults may appear further down:

- "order, a short delivery with proof, then close short…": everything after the delivery note is
  filled (the partial delivery, the proof file's response headers, who may open it, close short,
  the requester's view).
- "the Floor Manager cancels an ordered request with a reason; the requester copies it to a new
  one": the axe check on the copied form, sending the copy, and the links between the two
  requests.

## 4. Test accounts and data

None to prepare. The specs create their own items, requests and Shoe Constructor accounts.

## 5. Test scenarios

| ID  | Role | Steps                                    | Expected result     | Priority |
| --- | ---- | ---------------------------------------- | ------------------- | -------- |
| T1  | —    | `npm run build`                          | Exit 0              | High     |
| T2  | —    | The five-spec command above (parallel)   | 45 passed, 0 failed | High     |
| T3  | —    | `procurement.spec.ts` with `--workers=1` | 15 passed, 0 failed | High     |

For every failing test, report the title, the failing line, the exact error, what the page showed,
whether the **app** or the **test** is wrong (one sentence of evidence), and the smallest fix
naming the line. An axe finding (the "axe on …" soft assertions) is an **app** finding: list the
rule id and the element.

### Access checks

None in this run.

## 6. Out of scope / known issues

- All manual scenarios from runs 1 and 2. Do not re-test.
- The "destination stream closed early" lines and the `next start` with `output: standalone`
  warning: mention them only if their number or wording changed.
