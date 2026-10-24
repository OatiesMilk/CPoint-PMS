# Prompt for Codex: Phase 26 QA, run 2 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running, on the checkout with
Claude's run 1 fixes. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 of Phase 26 (phone capture) is
`qa/reports/2026-10-24-phase-26-phone-capture.md`: FAIL, 25 of 29, e2e 57 passed, 18 failed.
Claude fixed what it found. Re-check only those items.

| ID  | Run 1 finding                                                          | What Claude changed                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | Desktop sidebar `display:none` at 1440 px (13 e2e failures)            | `sidebar.tsx`: the desktop sidebar shows from 640 px up (`sm:flex`); the phone bar stays below 640 px                                                                                |
| F2  | FM and QI got the generic 403 on `PUT /api/v1/camera/operators/{id}`   | The route now answers 403 "Only the System Admin chooses who can capture."                                                                                                           |
| F3  | Inventory history's Roll column was all dashes                         | A fresh demo week links no stock to a roll (Phase 26 dropped "For roll"), so the column now shows only when a row on the page names a roll. The handoff expected links; it was wrong |
| F4  | No link from a scan's page to its roll's scans                         | A scan's page shows "Scans of this roll" next to the roll code, linking to `/scans?roll=<code>` for every role that sees scans                                                       |
| T1  | `capture.spec.ts`: `getByLabel('Roll')` matched the section and select | The tests use the Roll combobox                                                                                                                                                      |
| T2  | `rolls.spec.ts`: no table named "Shots"                                | A roll's shot rows carry `data-testid="shot-row"`; the tests use it                                                                                                                  |
| T3  | `supplier-quality.spec.ts`: CSV header started with a BOM              | The assertion allows the UTF-8 byte-order mark the app writes for Excel                                                                                                              |
| D1  | Dev database: only `constructor@` had camera access                    | Not changed yet; R6 collects what Claude needs to find why                                                                                                                           |

## Rules

- **Test and report only (D-092).** Create files only under `qa/reports/`, plus your line in the
  vault's Daily note. Don't change code, tests, config, migrations, `package.json` or `.env`.
- Never print passwords or tokens. Never `demo:reset` the dev database. Leave port 3000 alone
  (use `PORT=3001`).
- Put back what you change: finish or cancel (FM, reason "QA run") every roll you or the e2e
  suite leave open; give back any camera access you change.

## Steps

1. Read `qa/README.md` and the run 1 report.
2. `npm run db:up`, `npx prisma migrate status` (must be up to date), `npm run db:generate`,
   `npm run build`. Save outputs in `qa/reports/artifacts/2026-10-24-phase-26-run2/`.
3. **R1 (F1, T1 to T3):** the full suite once, `npm run test:e2e`. No failure (a failure that
   passes alone with `--workers=1` is a test-isolation note).
4. **R2 (F1):** at 1440 × 900 sign in as the FM, the QI, the Admin and a constructor with camera
   access: the sidebar is visible with that role's items (as handoff S1) and the account menu
   opens. At 640 × 900 the sidebar is the narrow icon rail; at 390 × 844 the phone bar shows and
   the sidebar doesn't. Screenshot each.
5. **R3 (F2):** as the FM and as the QI, `PUT /api/v1/camera/operators/<constructor id>` with
   `{"canCapture": true}`: 403 with "Only the System Admin chooses who can capture."
6. **R4 (F3):** as the FM, Inventory → a leather roll item: no Roll column, no "For roll" field in
   Use stock, and the page loads without error.
7. **R5 (F4):** as the QI, open a scan from Scans: "Scans of this roll" opens Scans filtered by
   that roll (`?roll=<code>`) with only that roll's scans. Repeat as the FM. Screenshot.
8. **R6 (D1):** save the output of

   ```bash
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "SELECT email, \"isActive\", \"canCapture\", \"mustChangePassword\" FROM users WHERE email IN ('constructor@cpoint.local','arnel.bautista@cpoint.local','jocelyn.reyes@cpoint.local','rommel.delacruz@cpoint.local') ORDER BY email"
   docker exec cpoint-pms-db-1 psql -U cpoint -d cpoint_pms -c "SELECT action, \"createdAt\", after FROM audit_logs WHERE action LIKE 'camera.capture_access%' ORDER BY \"createdAt\" LIMIT 20"
   ```

   Report it as information, not PASS or FAIL.

## Write the report

Save `qa/reports/2026-10-24-phase-26-run2.md` from `qa/templates/report.md`: R1 to R5 with PASS,
FAIL or BLOCKED and what you saw, the e2e counts, and R6's output. **PASS** only if the build
passes, R1 has no failure and R2 to R5 pass. Add one line under "Agent sessions" in the vault's
`Daily/2026-10-24.md` linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_26_RUN2]]` and the report.
Reply with the verdict, the e2e counts and the report path.
