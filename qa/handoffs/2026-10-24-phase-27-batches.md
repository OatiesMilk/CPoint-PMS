# QA handoff: Phase 27, batches are the check-in intervals

| Field           | Value                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| Date            | 2026-10-24                                                                                   |
| Feature         | phase-27-batches                                                                             |
| Branch          | uncommitted in `C:\dev\CPoint-PMS` (on top of `main` `33fe2b3`)                              |
| Spec / prompt   | `docs/prompts/factory-visit-changes.md` Phase 27; plan `docs/prompts/plans/phase-27-plan.md` |
| Written by      | Claude                                                                                       |
| Previous report | `qa/reports/2026-10-24-phase-26-run2.md` (PASS)                                              |

## 1. What changed

- **Production is now Batches** (`/batches`; `/production` is 404). A batch is one check-in
  interval of the working day. With the defaults (08:00 to 17:00, every 4 hours, lunch 11:00 to
  12:00) the batches are **Batch 1 08:00–13:00** ("Lunch 11:00–12:00, not counted") and **Batch 2
  13:00–17:00**. Lunch is left out of working time; a batch whose working time runs out at lunch's
  start ends when lunch ends; the last batch ends at the shift end.
- **Status** of each batch, as an icon and a word: Upcoming, In progress (Paused for lunch during
  lunch), Due (at its end), Late (30 minutes after; "Late by 40 minutes"), Finished (Finished late,
  Corrected), Missed (after midnight).
- **Finish batch** (Quality Inspector; the Floor Manager only on a day attendance shows no QI
  present, D-088). It opens **10 minutes before the batch's end** ("Can be finished from 12:50.")
  and stays open until midnight. The dialog asks "Pairs finished in Batch 1 (08:00–13:00, lunch
  11:00–12:00)" and "Of these, failed inspection" (starts at 0, can't be more than finished), with
  notes. On a phone it is a sheet at the bottom. A finished batch shows "40 pairs, 3 failed
  inspection · Finished 13:04 by Maricel Dizon". **Correct** the same day needs a reason.
- **Notices** for whoever may finish (QI, or the FM covering), on every page: a banner at 10
  minutes before the end ("Batch 1 ends at 13:00. Get ready to count the finished pairs.") and at
  the end ("Batch 1 is due. Finish it now." with **Finish batch 1** and **Not now**); a **bell**
  beside the logo ("Batch notices: 1 batch due") listing the due batches; the tab title starts
  with "(1)". No sound, push or browser notification.
- **Phone layout** of Batches at 390 × 844: one column, the batch that can be finished now fixed at
  the bottom with "Batch 1 · 08:00–13:00" above **Finish batch 1**, no sideways scroll.
- **The QI sees today only**; the FM also sees **Recent days** (chart and table: Finished, Failed
  inspection, Passed, Of quota, Batches, Constructors present, Pairs per constructor, Note).
- **Plan batches and quota** (FM, `/batches/plan`): **How often** = every 1, 2, 3 or 4 hours, or
  **Once at the end of the day**; a preview "Tomorrow: Batch 1 08:00–13:00, lunch 11:00–12:00;
  Batch 2 13:00–17:00. Applies from tomorrow, …"; **one daily quota** for the whole line ("Pairs
  per day for the whole line") with its suggestion (the average passed pairs per full working
  day over the last 10) and **Use suggestion**; history of both.
- **Settings → Lunch break** (System Admin): Lunch starts, Lunch ends, "No lunch break", applies
  from tomorrow, a history table. The lunch must be inside tomorrow's shift.
- **The quota counts passed pairs only** (finished − failed): the progress ("86 of 128 pairs
  passed"), the pace, the short-day sentence, Operations and the CSV.
- **Shoe types are gone**: no Settings tab, no `/api/v1/shoe-types`, no field or column anywhere.
- **Homes:** FM **Today's batches** card; QI **Next batch** card with **Finish batch N** when one
  can be finished.
- **Reports → Operations:** KPI tiles **Pairs finished**, **Failed inspection**, **Of quota**
  (passed), Rolls finished; the Production table as in Recent days. **Production CSV** is one row
  a day: `Date (Manila),Pairs finished,Failed inspection,% failed,Pairs passed,Daily quota,% of
quota (passed),Batches finished,Batches scheduled,Shoe Constructors present,Shoe Constructors on
the roster,Pairs per constructor present (line average),Day below quota`.

## 2. Files touched

| File                                                                                                                | Change                                                                                             |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`, `prisma/migrations/20261026090000_batches_are_intervals/`                                   | `LunchBreak`; nullable interval; `pairs`, `failedPairs`; one quota; shoe types dropped             |
| `src/lib/production-rules.ts`                                                                                       | Batches with lunch, states, finish window, notices, passed-pair pace and suggestion                |
| `src/lib/{ops-rules,report-rules}.ts`                                                                               | Attention link `/batches`; comments                                                                |
| `src/server/models/{production,reference-data,demo-reset}.model.ts`                                                 | Lunch breaks; shoe types out; reset clears lunch rows                                              |
| `src/server/services/production.service.ts`                                                                         | Today, days, plan, finish, correct, schedule, quota, lunch, report, CSV                            |
| `src/server/services/{settings,bootstrap,ops-report,demo-seed,demo-reset,audit-query}.service.ts`                   | Shoe types out; default lunch; Failed inspection KPI; demo week on batches                         |
| `src/server/controllers/{production,settings,report}.controller.ts`, `src/app/api/v1/settings/lunch-break/route.ts` | Quota `{ pairs }`; lunch-break PUT                                                                 |
| `src/server/validators/{production,settings}.validator.ts`                                                          | Batch counts, one quota, lunch break; shoe type schema out                                         |
| `src/server/policies/{navigation,permissions}.ts`                                                                   | Batches nav item; "finish the batches" messages                                                    |
| `src/app/(app)/batches/**` (moved from `production/**`)                                                             | Batches page, Finish batch dialog, plan page and forms                                             |
| `src/app/(app)/admin/settings/{page,actions,lunch-break-form}.tsx`                                                  | Lunch break tab; Shoe types tab out                                                                |
| `src/app/(app)/{layout,floor-manager/page,quality-inspector/page}.tsx`                                              | Notice banner; home cards                                                                          |
| `src/components/features/batches/batch-notices.tsx`, `app-shell/sidebar.tsx`                                        | Banner, bell, tab title                                                                            |
| `src/components/features/production/*`, `charts/production-chart.tsx`, `reports/_components/operations-view.tsx`    | Cards, parts, chart on passed pairs; Operations                                                    |
| `src/app/api/v1/shoe-types/**`, `tests/e2e/production.spec.ts`                                                      | Deleted                                                                                            |
| `scripts/demo-reset.ts`, `.github/workflows/ci.yml`                                                                 | Reset labels; CI checks lunch, one quota, failed pairs, no shoe tables                             |
| `tests/unit/**`, `tests/e2e/batches.spec.ts` (new), `tests/e2e/{admin,reports,rolls}.spec.ts`                       | Updated                                                                                            |
| Docs                                                                                                                | CLAUDE, DESIGN, README, API, STATUS, SESSION_LOG, DECISIONS (D-097 to D-099), ROADMAP, master spec |

Database migration in this change: **yes** (`batches_are_intervals`). It is **not** applied to the
dev database yet: Dylan backs up first, then runs `npm.cmd run db:deploy`, `npm.cmd run
db:generate` and `npm.cmd run demo:reset -- --yes`. Claude ran the migration on scratch data: a
check-in with 30 + 12 per-type pairs became 42; quotas of 85 + 43 and 90 + 43 became 128 and 133;
a fresh deploy showed no drift.

## 3. How to run the app locally

Prerequisites: Docker Desktop running, `npm install` done, `.env` filled in (`AUTH_SECRET`,
`BOOTSTRAP_ADMIN_PASSWORD`, `DEMO_USER_PASSWORD`, `SEED_DEMO_USERS=true`), and **Dylan's backup
taken, `batches_are_intervals` applied and the demo week reset** (prompt step 2 checks this).

```bash
npm run db:up
npm run db:generate
npm run build
npm run start          # http://localhost:3000 (PORT=3001 if 3000 is taken)
```

**Finish batch opens 10 minutes before a batch's end**, so the scenarios that finish a batch need
a batch that is open now. Use the **test schedule** below (hourly from 00:00 to 23:59, every day,
no lunch, in force today only), so a batch is always due after 01:00 Manila. Run it in
`docker exec -it cpoint-pms-db-1 psql -U cpoint -d cpoint_pms`, note both ids, and remove them
and what you saved at the end (prompt step 8):

```sql
INSERT INTO production_schedules (id, "shiftStart", "shiftEnd", "intervalMinutes", "workingDays", "effectiveFrom", "createdAt")
VALUES (gen_random_uuid(), '00:00', '23:59', 60, '{1,2,3,4,5,6,7}', (now() AT TIME ZONE 'Asia/Manila')::date, now())
RETURNING id;
INSERT INTO lunch_breaks (id, "startTime", "endTime", "effectiveFrom", "createdAt")
VALUES (gen_random_uuid(), NULL, NULL, (now() AT TIME ZONE 'Asia/Manila')::date, now())
RETURNING id;
```

With it, Batch N runs from (N−1):00 to N:00, and every earlier unfinished batch is Due or Late.
The **default schedule** scenarios (S2, S9) need it **removed** (or not added yet).

**The notice at 10 minutes before the end (S9)** uses Playwright's browser clock, because the
notices are worked out in the browser: `await page.clock.install({ time })` before `goto`, then
`await page.clock.fastForward("09:30")`. The server keeps the real time, so Finish batch itself
still follows the real clock.

Phone width: Playwright `viewport: { width: 390, height: 844 }` or Chrome DevTools device mode.

E2E (all of it): `npm run test:e2e`. The new `tests/e2e/batches.spec.ts` adds and removes its own
hourly schedule and "no lunch" row, and changes today's attendance and puts it back; run it after
01:00 Manila time.

## 4. Test accounts and data

All demo accounts use `DEMO_USER_PASSWORD` from `.env`.

| Role              | Email                      | Home page            |
| ----------------- | -------------------------- | -------------------- |
| Floor Manager     | `manager@cpoint.local`     | `/floor-manager`     |
| Quality Inspector | `inspector@cpoint.local`   | `/quality-inspector` |
| System Admin      | `admin@cpoint.local`       | `/admin`             |
| Shoe Constructor  | `constructor@cpoint.local` | `/camera/capture`    |

After `demo:reset`: one daily quota of **128** passed pairs; the QI finished both batches of each
past working day with one or two failed pairs each; one batch finished 50 minutes late ("Counted
late: the sole press was down."); one batch missed; the FM finished the batches on the day the QI
was absent; three past days below quota, each with its sentence. Today's batches finished more
than 30 minutes ago are saved; attendance for today is not taken.

## 5. Test scenarios

| ID  | Role        | Steps                                                                                                                                                                                          | Expected result                                                                                                                                                                                                                                                                                                                                                              | Priority |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| S1  | every role  | Sign in as each and read the sidebar.                                                                                                                                                          | FM: Overview, **Batches**, Attendance, Inventory, Camera, Scans, Reports. QI: Overview, **Batches**, Camera, Scans, Reports. Admin: Batches among its items. Constructor: Capture only. No "Production" item.                                                                                                                                                                | High     |
| S2  | FM          | No test schedule. Open Batches at desktop width.                                                                                                                                               | "Today, …" with "08:00 to 17:00, every 4 hours, Mon to Sat. Lunch: 11:00 to 12:00."; **Batch 1 08:00–13:00** with "Lunch 11:00–12:00, not counted" and **Batch 2 13:00–17:00**, each with a status badge; Recent days chart and table, three short days with their sentence; no shoe type anywhere.                                                                          | High     |
| S3  | FM          | Plan batches and quota. Set How often to each option in turn; then **Once at the end of the day** and Save schedule.                                                                           | The preview follows each choice ("Tomorrow: Batch 1 08:00–10:00; Batch 2 10:00–13:00, lunch 11:00–12:00; …" for every 2 hours); end of day gives one batch 08:00–17:00. Toast "Schedule saved. It applies from …"; the history row says "once at the end of the day". Put back every 4 hours afterwards.                                                                     | High     |
| S4  | FM          | Shift start 17:00, end 08:00, Save schedule.                                                                                                                                                   | "Shift end must be after shift start." under Shift end, focus there; nothing saved.                                                                                                                                                                                                                                                                                          | Medium   |
| S5  | FM          | Quota: enter 0 and Save quota; then Use suggestion (if shown) and Save quota; Save quota again unchanged.                                                                                      | "Enter the daily quota as a whole number of pairs, at least 1." under the field; then "Daily quota saved. It applies from …" and a history row; unchanged gives "Nothing changed, so nothing was saved." The suggestion box shows "Suggested: N pairs" with its sentence, or "No suggestion yet".                                                                            | High     |
| S6  | Admin       | Settings → Lunch break: 11:30 to 12:30, Save lunch break. Then as the FM open Plan batches and quota.                                                                                          | Toast "Lunch 11:30 to 12:30 saved. It applies from …"; the history lists it with the Admin's name; today still reads 11:00 to 12:00 on Batches; the FM's preview for tomorrow shows the new lunch. Put 11:00 to 12:00 back afterwards.                                                                                                                                       | High     |
| S7  | Admin       | Lunch break: 12:00 to 11:00; then 06:00 to 07:00; then tick No lunch break and save (put the lunch back after).                                                                                | "Lunch must end after it starts."; "Lunch must be inside the shift (08:00 to 17:00)."; then "No lunch break from …".                                                                                                                                                                                                                                                         | Medium   |
| S8  | QI          | Add the test schedule. Sign in at 390 × 844.                                                                                                                                                   | On the home and on every page: the banner "Batch N is due. Finish it now." with **Finish batch N** and Not now; the bell's name "Batch notices: K batches due"; the tab title starts "(K) ". Not now hides that notice; it stays in the bell.                                                                                                                                | High     |
| S9  | QI          | No test schedule. Take the first of today's batches without a finish (`GET /api/v1/production/today`). Browser clock at its end − 9 minutes 30, open the home, then fast-forward 9 minutes 30. | Before: "Batch N ends at HH:MM. Get ready to count the finished pairs." (no Finish button, no "(n)"). After: "Batch N is due. Finish it now.", the bell counts 1, the title starts "(1) ". BLOCKED if every batch today is finished.                                                                                                                                         | High     |
| S10 | QI          | With the test schedule at 390 × 844: banner → Finish batch N. Press Finish with Pairs empty; then 3 pairs and 4 failed; then 12 and 2 with a note.                                             | The sheet opens at the bottom with "Pairs finished in Batch N (…)", failed at 0, numeric keypad fields. Messages: "Enter the pairs finished in Batch N as a whole number, like 24. Enter 0 if none." then "Failed inspection can't be more than the pairs finished (3)." Then "Batch N finished.", the card reads "12 pairs, 2 failed inspection", Finished HH:MM by the QI. | High     |
| S11 | QI          | At 390 × 844 on Batches with the test schedule.                                                                                                                                                | One column; no sideways scroll; the first batch that can be finished is fixed at the bottom ("Batch N · …" over a full-width Finish batch N, ≥ 44 px); the QI sees no Recent days. axe: no serious or critical violation.                                                                                                                                                    | High     |
| S12 | QI          | Open the same due batch's Finish dialog in two tabs. Finish it in tab 1, then in tab 2.                                                                                                        | Tab 2: the dialog closes and "Maricel Dizon already finished Batch N at HH:MM. Refresh to see it." with Refresh. Only one row is saved.                                                                                                                                                                                                                                      | High     |
| S13 | QI          | `POST /api/v1/production/check-ins` for an Upcoming batch more than 10 minutes from its end, `{ slotAt, pairs: 1 }`.                                                                           | `409`, "Batch M can be finished from HH:MM." (the end − 10 minutes).                                                                                                                                                                                                                                                                                                         | Medium   |
| S14 | QI          | Correct the batch from S10: change pairs, save with no reason; then with "Counted one rack twice". Then as the Admin open the Audit log.                                                       | "Say why you're correcting this batch, at least 5 characters."; then the card shows the new count and "Corrected by … at …: Counted one rack twice" with a Corrected tag. The audit row `production.checkin.correct` has both counts before and after.                                                                                                                       | High     |
| S15 | FM          | Attendance today with every QI present; open Batches. Then every QI absent; open Batches and finish a due batch (test schedule). Put attendance back.                                          | Present: no Finish batch, no banner or bell, "A Quality Inspector is present today, so they finish the batches." Absent: "No Quality Inspector is present today, so you can finish the batches. …", the banner appears, the finish saves under the FM.                                                                                                                       | High     |
| S16 | FM, QI      | Open each home.                                                                                                                                                                                | FM: **Today's batches** with "N of 128 pairs passed", the batch under way and any late or missed. QI: **Next batch** with the due batch and **Finish batch N** when one can be finished (opens the dialog on Batches).                                                                                                                                                       | Medium   |
| S17 | FM          | Reports → Operations (Last 7 days); download Production CSV.                                                                                                                                   | Tiles Pairs finished, **Failed inspection**, Of quota, Rolls finished; the Production table on passed pairs; "N of the last 5 working days were below quota" under attention links to Batches. The CSV header is exactly as §1, one row a day.                                                                                                                               | High     |
| S18 | Admin       | Open Batches.                                                                                                                                                                                  | Read only: no Plan batches and quota, no Finish batch, no banner or bell.                                                                                                                                                                                                                                                                                                    | Medium   |
| S19 | any         | Look for leftovers on every page each role opens: "Shoe type", "School Shoe", "Topsider" as a field, "check-in" as a button, "Production" as a page title, "Enter count".                      | None ("Production" stays only as the Operations section and the CSV name).                                                                                                                                                                                                                                                                                                   | Medium   |
| U1  | (throwaway) | Docker stack with the demo week (prompt step 7): the database checks there.                                                                                                                    | One lunch row 11:00–12:00; one quota of 128; every past day has at most 2 finished batches with `failedPairs` ≥ 1; no `shoe_types` or `production_counts` table; Batches and Operations as on the dev database.                                                                                                                                                              | High     |
| U2  | (throwaway) | `demo:reset` dry run, then `-- --yes`, on the throwaway stack.                                                                                                                                 | The dry run lists lunch breaks among what it clears; afterwards one lunch row (11:00–12:00, from 2000-01-01), one quota, a fresh week.                                                                                                                                                                                                                                       | Medium   |

### Access checks

| ID  | Role that must NOT have access | URL or action                                                    | Expected            |
| --- | ------------------------------ | ---------------------------------------------------------------- | ------------------- |
| A1  | Shoe Constructor               | `/batches`, `GET /api/v1/production/today`                       | `/forbidden`; `403` |
| A2  | Floor Manager                  | `PUT /api/v1/settings/lunch-break` `{ startTime, endTime }`      | `403`               |
| A3  | Quality Inspector              | `/batches/plan`; `PUT /api/v1/production/quotas` `{ pairs: 10 }` | `/forbidden`; `403` |
| A4  | System Admin                   | `/batches/plan`; `POST /api/v1/production/check-ins`             | `/forbidden`; `403` |
| A5  | everyone                       | `/production`, `/production/plan`, `/api/v1/shoe-types`          | `404`               |
| A6  | Quality Inspector              | `/admin/settings?tab=lunch`                                      | `/forbidden`        |

## 6. Out of scope / known issues

- **Paused for lunch** shows only while the server's clock is inside lunch; it is covered by unit
  tests. Check it only if the run happens between 11:00 and 12:00 Manila (no test schedule).
- The e2e spec uses an hourly test schedule in the database instead of Playwright's clock (the
  plan said the clock), because Finish batch is checked on the server, which keeps the real time.
- The FM's sidebar still has Camera and Scans, and the QI's home is still the Overview: Phase 28
  (Dylan).
- Old audit rows mention shoe types and per-type counts; that is history.
- Notices don't reach a closed browser or a locked phone (C-31, by design).
