# Prompt for Codex: Overview clean-up (D-131), run 2 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only. Any day works.
Run 1 (`qa/reports/2026-11-21-overview-cleanup-run1.md`): O4, O9 and A1 passed (targeted 34 of 34, full
suite 121 passed, 0 failed); O1, O2, O3, O5, O6, O7 and O8 were blocked because the demo clock didn't move.

---

You are the QA tester for CPoint-PMS: the Overview clean-up (D-131). Handoff:
`qa/handoffs/2026-11-21-overview-cleanup.md` (O7 now says the System Admin has no Batches page, so only the
Admin's home is checked). Run only what run 1 blocked: **O1, O2, O3, O5, O6, O7, O8**, plus screenshots of
O1, O2 and O4. Don't repeat O9 (no code changed since run 1).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` and your line in the vault's Daily note.
  Put the demo clock and attendance back when done.
- **Why run 1 was blocked, and what to do:** the clock form's date and time boxes are React-controlled, and
  the in-app browser tool's fill did not reach their state (Phase 34 run 3 had the same fault; typing with
  the keyboard worked). So **set the clock and take every screenshot with a headless Playwright script of
  your own** (`page.screenshot({ path })` writes the file, which the in-app browser tool could not do):
  1. Start `npm run dev` (Docker app stopped), `npm run demo:reset '--' --yes`.
  2. Sign in as `manager@cpoint.local` (`DEMO_USER_PASSWORD` from `.env`), click **Change time** in the Demo
     mode band, `fill` the date `2026-11-25` and time `09:00` (a Wednesday, nothing planned that day), click
     **Set clock**, then **check the band shows Wed 25 Nov and `GET /api/v1/production/today` returns
     `day:"2026-11-25"`**. If it still doesn't move, as the same signed-in context send
     `POST /api/v1/demo/clock` with `{"date":"2026-11-25","time":"09:00"}` and read the response body, then
     reload. If that also fails, report the request and the full response: that is a real fault.
  3. A visible check in the in-app browser is welcome after the clock is set (reload; the clock is stored in
     the database, so it holds), but the script's screenshots are the evidence.
- E2E not needed. Don't open visible Chrome windows.

## Do

1. Read the vault first (`C:\dev\capstone-obsidian\CLAUDE.md`, `Rules.md`, the newest `Daily/` note).
2. Run O1 (clock 2026-11-25 09:00), O3 (the same day is a Wednesday, so the stock row should also show), O5,
   O7 (QI's Batches → Today and the Admin's home on that day) and O8 (dark theme, 768 px, Tab order, and an
   axe scan with `@axe-core/playwright`) on that one clock setting. Then O2 at the real date if it's a
   weekday with a plan, else with the clock on a planned past weekday of the demo week at 09:00 (those have
   plans and saved stock updates, so Needs attention should be absent). Then O6: clock to 17:05 on a planned
   weekday of the demo week, QI marked absent in Attendance, Overview shows "B-… is due" with Finish and no
   plan banner; QI marked present again after. If no batch is due at 17:05, say blocked and why.
3. **The bell** (O1): it exists only when the user can finish batches or a plan or stock update is due, so on
   a Saturday with nothing due it is correctly absent. With the clock on 2026-11-25 look for the button named
   "Notices: today has no plan, stock update due" (`data-testid="batch-bell"`), open it and quote its items.
4. Save screenshots (1280 px, light) of O1, O2 and O4 as PNG files in
   `qa/reports/artifacts/2026-11-21-overview-cleanup/` and name them in the report.
5. Write `qa/reports/2026-11-21-overview-cleanup-run2.md` from `qa/templates/report.md`, even on a full pass:
   PASS, PASS WITH ISSUES or FAIL, a row for every scenario, and each failure with steps, expected, actual and
   a screenshot or log. Leave the clock on **Real time**, and run `npm run demo:reset '--' --yes` last.
6. Add one line under "Agent sessions" in the vault's `Daily/` note linking this prompt and the report.
