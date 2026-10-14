# QA handoff: Phase 13 material requests, run 4 (one e2e finding)

| Field           | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| Date            | 2026-10-14                                                 |
| Feature         | phase-13-material-requests (run 4)                         |
| Branch          | `main` checkout at `c044511`, **uncommitted** changes      |
| Spec / prompt   | `material-requests.md` (project root), Phase 13            |
| Written by      | Claude                                                     |
| Previous report | `qa/reports/2026-10-14-phase-13-material-requests-run3.md` |

Run 3 had one failure (F1): axe reported a serious `color-contrast` finding on three pieces of grey
text in the **Record delivery** dialog. This run finds out whether that is a fault in the app or
in how the test measures it. There are **no manual scenarios**.

Claude ran lint, typecheck, the 494 unit tests and the production build. Claude did **not** run
any e2e test.

## 1. What changed

Only the `expectAccessible` helper in `tests/e2e/procurement.spec.ts`. **No application code
changed**, on purpose: the cause is not known yet.

- **It now waits for entrance animations to finish before running axe.** The dialog fades in over
  0.2 s, and the test used to run axe the moment the dialog opened. Text measured while half
  transparent, over the page behind it, would read as low contrast.
- **A contrast finding now prints what axe measured**, per element:
  `selector [text colour on background colour, ratio:1, needs N:1, font size]`, for up to 8
  elements.

Why the app was not changed: the same grey (`text-muted-foreground`) on the same white background
passes axe on every page and on other text in this same dialog, and works out at about 6.8:1
against the 4.5:1 required. Claude's judgement is that run 3 measured mid-animation, but that is
not proven: the same three elements failed in all three runs.

## 2. Files touched

| File                            | Change                                       |
| ------------------------------- | -------------------------------------------- |
| `tests/e2e/procurement.spec.ts` | `expectAccessible` waits, and prints colours |

Database migration in this change: **no**.

## 3. How to run

Docker Desktop running, `.env` filled in, no CPoint-PMS dev server running.

```bash
npm run db:up
npm run db:deploy
npm run build
npx playwright test tests/e2e/procurement.spec.ts --grep "order, a short delivery with proof"
npx playwright test tests/e2e/procurement.spec.ts tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts
npx playwright test tests/e2e/procurement.spec.ts --workers=1
```

## 4. Test accounts and data

None to prepare.

## 5. Test scenarios

| ID  | Role | Steps                                                          | Expected result        | Priority |
| --- | ---- | -------------------------------------------------------------- | ---------------------- | -------- |
| T1  | —    | `npm run build`                                                | Exit 0                 | High     |
| T2  | —    | The single short-delivery test (`--grep`), run **three times** | Passes all three times | High     |
| T3  | —    | The five-spec command (parallel)                               | 45 passed, 0 failed    | High     |
| T4  | —    | `procurement.spec.ts` with `--workers=1`                       | 15 passed, 0 failed    | High     |

**If T2 fails with a `color-contrast` finding**, copy the full line into the report exactly as
printed, including the part in square brackets for every element. Those numbers are the point of
this run. Then answer, from the numbers:

- Is the text colour the same for every failing element, and is it `#5c…`-like dark grey or a
  lighter, washed-out grey?
- Is the background pure white (`#ffffff`) or something darker?
- Is the ratio the same in all three runs, or does it change between runs?

A ratio that changes between runs, or a background that is not white, points to the animation or
the page behind the dialog. The same low ratio on white every time points to the app's colours.

**If T2 passes three times**, say so plainly: the run 3 finding was caused by measuring during the
dialog's fade-in, and no app change is needed.

For any other failing test, report the title, the failing line, the exact error, what the page
showed, whether the app or the test is wrong, and the smallest fix.

### Access checks

None in this run.

## 6. Out of scope / known issues

- All manual scenarios from runs 1 and 2.
- The "destination stream closed early" lines (25 in run 3's parallel run, same wording and
  digest) and the `next start` with `output: standalone` warning: give the count, nothing more.
