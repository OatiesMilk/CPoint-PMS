# Prompt for Codex: re-check a CI fix (paste everything below the line)

Run Codex locally (Codex CLI or the IDE extension) in the CPoint-PMS folder (`C:\dev\CPoint-PMS`),
on the PR's branch with Claude's fix in the working tree. Copy from the line down.

---

You are re-checking a fix for a failing GitHub CI check on a pull request for CPoint-PMS, a
Next.js 16 + PostgreSQL (Docker) + Prisma 7 web app with a Python model toolkit in `cv/`. Claude
is the main developer: Claude fixed the failure and wrote this prompt. Your job is to rerun the
failing jobs locally and report what happened. **You don't fix anything.**

## 1. Read first (vault first, then the repo)

1. The vault: `C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, and
   `Inbox/CPoint commands and where to look.md`. Use them to find files instead of exploring the
   whole repo.
2. The repo: `AGENTS.md` (Codex rules) and `qa/README.md` → "CI fix loop".
3. `.github/workflows/ci.yml`, only the `e2e` job.

## 2. The failure and Claude's fix

| Field          | Value                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| PR             | #25: Phase 27, batches are the check-in intervals (https://github.com/OatiesMilk/CPoint-PMS/pull/25) |
| Branch         | `feature/phase-27-batches` (head commit `a668994`)                                                   |
| Failing run    | https://github.com/OatiesMilk/CPoint-PMS/actions/runs/40154348825                                    |
| Failing job(s) | `e2e`, step "npm run test:e2e" (1 failed, 1 flaky, 74 passed, 1 skipped; one worker)                 |
| Passing jobs   | `check`, `station`, `docker`                                                                         |
| Fails on main? | no (both tests passed on main's Phase 26 CI)                                                         |

### Error lines (copied from the log)

```
[chromium] › tests/e2e/capture.spec.ts:255:7 › Capture page on a desktop › the QI and the Floor Manager no longer capture (C-18)
  Error: locator.fill: Test timeout of 30000ms exceeded.  - waiting for getByLabel('Email')  at helpers.ts:13
  (failed, and failed again on retry)
[chromium] › tests/e2e/rolls.spec.ts:131:7 › who sees rolls › only the Floor Manager has Reports → Rolls
  Error: locator.fill: Test timeout of 30000ms exceeded.  - waiting for getByLabel('Email')  at helpers.ts:13
  (flaky: passed on retry)
```

### What Claude changed

Both tests sign in as the Quality Inspector first, then clear the cookies and open `/login` for
the next role. Since Phase 27 the QI's pages fetch the batch notices in the background; a request
still in flight when the cookies are cleared can set the session cookie again, so `/login`
redirects to the home page and there is no Email field. The tests now leave the app (`about:blank`)
before clearing the cookies. The app is unchanged.

- `tests/e2e/capture.spec.ts`: `about:blank` before `clearCookies()` in the C-18 test.
- `tests/e2e/rolls.spec.ts`: the same in "only the Floor Manager has Reports → Rolls".

## 3. Rules

- Don't change any file except your report and its artifacts under `qa/reports/`: no application
  code, tests, migrations, config, `package.json`, `.env` or CI files, not even to get green
  (D-092).
- If a job still fails, record the exact error lines and the file you suspect. Claude fixes it.
- Never skip, disable or loosen a test or a check, and never write PASS for a job you didn't run.
- No commits, pushes or PRs. Dylan commits.
- Leave port 3000 alone; never `demo:reset` the dev database; put back what the e2e suite leaves
  behind, as in the Phase 27 QA runs.

## 4. Rerun the failing job locally

1. The two tests alone, with one worker as in CI:
   `npm run db:up && npm run db:deploy && npm run build && npm run test:e2e -- tests/e2e/capture.spec.ts tests/e2e/rolls.spec.ts --workers=1`
2. The full suite with one worker, as CI runs it: `npm run test:e2e -- --workers=1`.

## 5. Report and record

1. Write `qa/reports/2026-10-25-ci-recheck-feature-phase-27-batches.md` (short): each run with its
   real result and counts, and for a failure the error lines and the file you suspect.
2. Add one line to the vault note `C:\dev\capstone-obsidian\Daily\2026-10-25.md` under "Agent
   sessions": `CI re-check (feature/phase-27-batches): prompt [[CPoint-PMS/qa/CODEX_PROMPT_CI_RECHECK_feature-phase-27-batches]]
→ report [[CPoint-PMS/qa/reports/2026-10-25-ci-recheck-feature-phase-27-batches]] (<result>)`.
3. Finish by replying with each run and its result, and the report path.
