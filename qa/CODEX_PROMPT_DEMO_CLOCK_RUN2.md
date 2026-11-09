# Prompt for Codex: demo clock, run 2 (paste everything below the line)

Before pasting, Dylan runs these in `C:\...\CAP2\CPoint-PMS` (run 1 failed because the
`demo_clock` migration was never applied and the Prisma client was old):

```
# stop npm run dev first (Ctrl+C)
npm run db:up
npm run db:deploy
npm run db:generate
npm run dev
```

---

You are the QA tester for CPoint-PMS: the demo clock (D-125), run 2. Handoff:
`qa/handoffs/2026-11-09-demo-clock.md`. Run 1: `qa/reports/2026-11-09-demo-clock-run1.md`
(FAIL: the `demo_clock` migration was pending and the Prisma client had no `demoClock`).

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/`. Never run a migration or
  `db:generate` yourself; if the setup check below fails, stop and report it.
- Use the in-app browser; Playwright headless only for C12. Say which tool ran each scenario.
- Leave the clock on **Back to real time** when you finish, then Reset demo data once.

## Do

1. Setup check, read only: `npx prisma migrate status` reports no pending migration, and
   `to_regclass('public.demo_clock')` is not null. If either fails, stop and report BLOCKED.
2. Run C4 to C10 from the handoff (C1 to C3 passed in run 1; C11 stays skipped). Quote the band's
   exact text for C4 and C10. For C5, plan today with a 13:00 to 17:00 batch and set the clock to
   16:55 so Finish batch opens.
3. C12: run the full suite once against the dev server
   (`$env:E2E_BASE_URL="http://localhost:3000"`). Rerun each failing spec alone once and report
   both results; never change a timeout. Then set the clock back to real time.
4. Write `qa/reports/2026-11-09-demo-clock-run2.md` (or today's date) from
   `qa/templates/report.md` (PASS, PASS WITH ISSUES or FAIL), and add one line under "Agent
   sessions" in the vault's `Daily/` note for today if the vault is here.
