# Prompt for Codex: Phase 28 QA, run 2 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 (`qa/reports/2026-10-25-phase-28-roles-and-demo-tools.md`)
failed on six findings. Claude fixed them; check each fix, then run the full suite once more.

## What changed since run 1

| Finding                                                                          | Fix                                                                                                                                                | File                                                                |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| F1: the notice's Finish batch on `/batches` changed the URL but opened no dialog | The dialog opens whenever `?finish=` asks, not only on first load; closing it drops `?finish=`                                                     | `src/app/(app)/batches/finish-batch-dialog.tsx`                     |
| F2: axe threw "Please use browser.newContext()" in the smoke test                | The FM page gets its own `browser.newContext()`                                                                                                    | `tests/e2e/smoke.spec.ts`                                           |
| F3, F4, F6: the first click on a demo button or Reset demo data was lost         | With the demo tools on, Email isn't auto-focused, and leaving a field towards the demo tools doesn't validate it, so nothing moves under the click | `src/app/(auth)/login/login-form.tsx`, `page.tsx`, `demo-tools.tsx` |
| F5: the audit log after a reset started with `production.lunch.default`          | `system.demo_reset` is written straight after the delete, before the default lunch                                                                 | `src/server/services/demo-reset.service.ts`                         |

## Rules (same as run 1)

- **Test and report only (D-092).** Don't modify application code, tests, config, migrations,
  `package.json` or `.env`. Create files only under `qa/reports/`, and add your line to the
  vault's Daily note.
- Read passwords from `.env`. Never print them or put them in a report or log.
- Leave `DEMO_LOGIN_TOOLS` off in `.env`. **Never press Reset demo data or call
  `/api/v1/demo/reset` against the dev database**; the demo-tool checks run in the throwaway
  `cpoint-qa` stack only.
- Never `docker compose down -v` on the `cpoint-pms` project. Leave anything on port 3000 that
  isn't CPoint-PMS alone (`PORT=3001`).
- Browser checks stay headless.

## Steps

Save every output as UTF-8 text in `qa/reports/artifacts/2026-10-25-phase-28-run2/`.

1. `npm run db:up`, then `npm run build` (`build.log`).
2. **R1 (F1, F2):** on the dev database, run these alone with one worker:
   `npx playwright test tests/e2e/batches.spec.ts tests/e2e/smoke.spec.ts --workers=1`
   (`r1.log`). Both must pass. Then by hand on `npm run start` (`PORT=3001`): as the QI on a
   working day with a due batch, open `/batches`, press the banner's **Finish batch**: the dialog
   opens at once; press **Not now**: the URL is `/batches` again; press the banner's Finish batch
   again: it opens again. If no batch is due on the dev database today, mark the manual part
   BLOCKED and say why (the e2e test covers it).
3. **R2 (F3 to F6) in the throwaway stack:**

   ```powershell
   # PowerShell, in C:\dev\CPoint-PMS
   $env:DB_PORT="5434"; $env:APP_PORT="3002"; $env:SEED_DEMO_USERS="true"; $env:SEED_DEMO_WEEK="true"; $env:DEMO_LOGIN_TOOLS="true"
   docker compose -p cpoint-qa up --build -d
   ```

   Wait about a minute for the demo week, then on `http://localhost:3002`:
   - **D2 again:** load `/login` fresh for each of the four demo buttons and click it **once**.
     Each lands on its home first time (constructor `/camera/capture`, QI `/batches`, FM
     `/floor-manager`, Admin `/admin`). Email is not focused on load and no "Enter your email."
     appears.
   - **D3 again:** fresh `/login`, click Reset demo data **once**: the dialog opens. Type `reset`
     and submit: "Type RESET in capitals to reset the demo data." and nothing runs.
   - **D4 again:** submit `RESET`, wait for "Fresh demo week loaded…", then read the audit log
     ordered by `createdAt, id`: the **first** row is `system.demo_reset` with `after.origin`
     `login page` (`d4-audit-order.log`).
   - **D5 again:** fresh `/login`, open the dialog with **one** click, submit `RESET`, and POST
     `{"confirm":"RESET"}` to `/api/v1/demo/reset` while it runs: HTTP 409 "A reset is already
     running…"; the first finishes.
   - With the flag still off on the dev app (`http://localhost:3001/login`), Email **is** focused
     on load as before (S-check for the normal sign-in).
   - The e2e demo tests with the flag on (`e2e-demo.log`):

     ```powershell
     $env:E2E_BASE_URL="http://localhost:3002"
     npx playwright test tests/e2e/auth.spec.ts -g "demo tools"
     ```

   Then remove the stack and the variables:

   ```powershell
   docker compose -p cpoint-qa down -v
   Remove-Item Env:DB_PORT, Env:APP_PORT, Env:SEED_DEMO_USERS, Env:SEED_DEMO_WEEK, Env:DEMO_LOGIN_TOOLS, Env:E2E_BASE_URL
   ```

4. **R3:** the full e2e suite once on the dev database, flag off (`npm run test:e2e`, `e2e.log`).
   If a test fails, re-run that file alone with `--workers=1` (`e2e-rerun.log`).
5. **R4:** axe (WCAG 2.1 A/AA) on `/login` with the flag on (the throwaway stack, before step 3's
   `down -v`) and off (dev).
6. Put back anything you changed on the dev database.

## What to report

- R1 to R4 and each re-checked D scenario with PASS, FAIL or BLOCKED, and what you saw.
- **For any FAIL:** the steps, the exact message, a screenshot, whether the app or the test is
  wrong, and the file and line you suspect. Don't fix it; Claude does.
- The e2e counts (`r1.log`, `e2e-demo.log`, `e2e.log`) and, for each failing test, its title, the
  failing line and the error.

## Write the report

Save it as `qa/reports/2026-10-25-phase-28-run2.md`, using `qa/templates/report.md`. The verdict
is **PASS** only if the build passes, R1 and the demo e2e pass, the full suite has no failure (one
that passes in `e2e-rerun.log` counts as a test-isolation note), axe finds no serious or critical
violation, and D2 to D5 passed on the first click. List BLOCKED checks under **"Needs Dylan"**.

Then add one line under "Agent sessions" in the vault's `Daily/2026-10-25.md` (or today's note),
linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_28_RUN2]]` and the report.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED checks and the report
path.
