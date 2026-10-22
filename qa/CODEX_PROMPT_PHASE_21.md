# Prompt for Codex: Phase 21 QA, run 1 (paste everything below the line)

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running and the laptop webcam free.
Copy from the line down.

---

You are the QA tester for CPoint-PMS. The builder (Claude) finished Phase 21 and has not opened it
in a browser. Phase 21:

- renames the Fixable board to **Repair Station**;
- adds **Floor view**, a full-screen Capture mode that shows the verdict in colour for an operator
  at a fixed camera;
- lets the Floor Manager or Admin allow **Shoe Constructors to capture**;
- removes mkcert and the HTTPS listener on port 3443, because other devices will use a Cloudflare
  Tunnel.

## Rules

- **Do not modify** application code, tests, config, migrations, `package.json`, `.env` or
  `cv/config.toml`. You may only create files under `qa/reports/`.
- Read passwords and tokens from `.env`. Never print them or put them in a report or log.
- **Never run `npm run demo:reset`** and never `docker compose down -v`. Use `docker compose stop`.
- Don't start a Cloudflare Tunnel or anything else that makes the app public.
- Leave anything on port 3000 that isn't CPoint-PMS alone (start this app with `PORT=3001` if
  needed).
- Any change you make to data for a scenario (the demo constructor's capture switch, a test batch)
  must be put back by the end. C6 turns the switch off again.
- Scenarios that need real hardware or Dylan's devices: mark them **BLOCKED: needs Dylan** with
  what's missing. Never mark them PASS.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and
   `qa/handoffs/2026-10-20-phase-21-repair-station-floor-view.md`.
2. Set up, saving each output as UTF-8 text in
   `qa/reports/artifacts/2026-10-20-phase-21-repair-station-floor-view/`:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

   `db:deploy` is M1.

3. Run the full e2e suite once (`npm run test:e2e`) and save it as `e2e.log`. It includes the new
   Floor view and constructor capture tests in `capture.spec.ts`.
4. Start the app (`npm run dev`) and run every scenario in the handoff's section 5 and its access
   checks, in order. Take a screenshot for each High scenario, and one of Floor view in each state
   you reach (ready, checking, each verdict colour, each problem).
5. Run M2 in Docker (`docker compose up --build -d`, then `docker compose stop`).

## What to report

- Each scenario ID with PASS, FAIL or BLOCKED, and what you actually saw.
- **For any FAIL:** the steps, the exact message or error, a screenshot, whether the app or the
  test is wrong, and the smallest fix naming the file and line.
- The e2e passed and failed counts, and for each failing test its title, the failing line and the
  error.
- Any place a user still reads "Cut around or clean", "3443", "mkcert" or "certificate" in the
  app, with its page and a screenshot.

## Write the report

Save it as `qa/reports/2026-10-20-phase-21-repair-station-floor-view.md`, using
`qa/templates/report.md`. The verdict is **PASS** only if M1 and the build pass, the e2e suite has
no failure, and every High scenario you could run passed. BLOCKED scenarios don't fail the run,
but list them in a closing section headed **"Needs Dylan"** as a short checklist he can do by hand.

Finish by replying with the verdict, the e2e counts, the number of BLOCKED scenarios and the
report path.
