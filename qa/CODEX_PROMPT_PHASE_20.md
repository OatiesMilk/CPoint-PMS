# Prompt for Codex: Phase 20 QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running and the laptop webcam free.
This replaces `qa/CODEX_PROMPT_PHASES_17_19.md`; don't run that one. Copy from the line down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 20 and has not opened it
in a browser. Phase 20 retired the CPoint Camera desktop app (capture is on the website only),
renamed the "Rework" verdict to **Fixable** with a **Cut around or clean** board, added **Supplier
quality** with a printable **claim sheet** to the Floor Manager's reports, and removed component
tracking. This run also covers the Phase 18 and Phase 19 checks that were never run. Phase 17's
handoff is retired: don't run it.

## Rules

- **Do not modify** application code, tests, config, migrations, `package.json`, `.env` or
  `cv/config.toml`. You may only create files under `qa/reports/`. The one exception is a
  scenario that tells you to rename something (Phase 18 S10): put it back straight after and say
  so in the report.
- Read passwords and tokens from `.env`. Never print them or put them in a report or log.
- **Never run `npm run demo:reset`** and never `docker compose down -v`: both destroy Dylan's data.
  Use `docker compose stop`.
- Leave anything on port 3000 that isn't CPoint-PMS alone (start this app with `PORT=3001` if
  needed).
- Scenarios that need a person's hands (the iPhone, holding leather under the camera, a second
  PC): if you can't do one, mark it **BLOCKED: needs Dylan** with what's missing. Never mark it
  PASS.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and
   `qa/handoffs/2026-10-20-phase-20-website-camera-and-reports.md`. Its "Carried over" section
   points into `qa/handoffs/2026-10-19-phase-18-capture-page.md` and
   `qa/handoffs/2026-10-20-phase-19-cleanup.md`; read those too.
2. Set up, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-20-phase-20-website-camera-and-reports/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

   `db:deploy` is scenario M1: it must apply the two new migrations.

3. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. It includes the new
   `supplier-quality.spec.ts` and `cut-around-or-clean.spec.ts`, and Phase 18's `capture.spec.ts`.
4. Start the app (`npm run dev`) and run every scenario in the handoff's section 5 and its access
   checks, in order. Take a screenshot for each High scenario. For Q5, attach the saved claim
   sheet PDF.
5. Run P18 and P19 from the older handoffs as that section says, including the Docker checks.
   Stop the Docker stack with `docker compose stop` afterwards.

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you actually saw.
- **For any FAIL:** the steps, the exact message or error, a screenshot, whether the app or the
  test is wrong, and the smallest fix naming the file and line.
- The e2e passed and failed counts, and for each failing test its title, the failing line and the
  error.
- Any place a user still reads "Rework", "repair station", "In repair", "camera station" or
  "Components" in the app. List each with its page and a screenshot.

## Write the report

Save it as `qa/reports/2026-10-20-phase-20-website-camera-and-reports.md`, using
`qa/templates/report.md`. The verdict is **PASS** only if M1 and the build pass, the e2e suite
has no failure, and every High scenario you could run passed. BLOCKED scenarios don't fail the
run, but list them in a closing section headed **"Needs Dylan"** as a short checklist he can do by
hand.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the
report path.
