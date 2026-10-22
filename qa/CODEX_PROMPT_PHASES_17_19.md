# Prompt for Codex: QA for Phases 17, 18 and 19 (paste everything below the line)

> **Superseded on 2026-10-20 by `qa/CODEX_PROMPT_PHASE_20.md`. Do not run this one:** Phase 17 was
> retired (D-069), and the Phase 20 prompt covers what Phases 18 and 19 still need.

Run Codex locally in `C:\dev\CPoint-PMS`, with Docker Desktop running and the laptop webcam free.
Copy from the line down.

---

You are the QA tester for CPoint-PMS. Three changes are waiting for their first test run, and the
builder (Claude) has not opened any of them in a browser or a window:

| Order | Handoff                                            | Report to write                                   |
| ----- | -------------------------------------------------- | ------------------------------------------------- |
| 1     | `qa/handoffs/2026-10-20-phase-19-cleanup.md`       | `qa/reports/2026-10-20-phase-19-cleanup.md`       |
| 2     | `qa/handoffs/2026-10-19-phase-18-capture-page.md`  | `qa/reports/2026-10-19-phase-18-capture-page.md`  |
| 3     | `qa/handoffs/2026-10-19-phase-17-camera-window.md` | `qa/reports/2026-10-19-phase-17-camera-window.md` |

Phase 19 goes first because its full e2e run is the baseline for the other two.

**The project folder moved.** It is now `C:\dev\CPoint-PMS`, not the old OneDrive Desktop folder.
Use the new path everywhere. The sample photos are still at
`C:/Users/micro/OneDrive/Pictures/Sample Photos (CAP2)`, as the Phase 18 handoff says. The desktop
shortcut "CPoint Camera" already points at `C:\dev\CPoint-PMS\cv`.

## Rules

- **Do not modify** application code, tests, config, migrations, `package.json`, `.env` or
  `cv/.env`. You may only create files under `qa/reports/`. The one exception is a scenario that
  tells you to rename or blank something (Phase 17 L2 and C5, Phase 18 S10): put it back straight
  after, and say in the report that you did.
- Read passwords and tokens from `.env` and `cv/.env`. Never print them, and never put them in a
  report or log.
- Never run `docker compose down -v`, because it deletes the database. Use `docker compose stop`.
- Leave anything on port 3000 that isn't CPoint-PMS alone.
- Some scenarios need a person's hands: the iPhone and DroidCam (17 K1 to K5, P5 to P7; 18 S12
  to S15, S18), holding leather under the camera, unplugging a camera, or changing Windows display
  scaling (17 L4). If you can't do one yourself, mark it **BLOCKED: needs Dylan** with what's
  missing. Never mark it PASS.

## Steps

1. Read `qa/README.md`, `qa/templates/report.md` and the three handoffs.
2. Set up once:

   ```bash
   npm run db:up
   npm run db:deploy
   npm run build
   ```

3. **Phase 19.** Run its section 5. Its S1 is the full e2e suite (`npm run test:e2e`), and it
   already includes the Phase 18 specs (`capture.spec.ts`, `cv.spec.ts`). Save the output to
   `qa/reports/artifacts/2026-10-20-phase-19-cleanup/e2e.log` and don't run those specs again for
   Phase 18. Stop the Docker stack with `docker compose stop` when you're done with S3 to S5.
4. **Phase 18.** Run its section 5 and access checks on the dev server (`npm run dev`), plus S20 in
   Docker. For S16, use the parity commands in its section 3, step 5.
5. **Phase 17.** Start the app, put a batch at Preparation and make sure `cv/.env` has a working
   `CV_DEVICE_TOKEN`. Then run its section 5 from the "CPoint Camera" desktop shortcut, taking a
   screenshot of the window for each High scenario. Run every command-line scenario (L3, C2, C8,
   G1, G2) yourself. For P4, if you revoke the token, make a new one, put it in `cv/.env` and say
   which token name you used.
6. Save screenshots, traces and logs under `qa/reports/artifacts/<report name>/`.

## What to report

For each phase, use `qa/templates/report.md`:

- Each scenario ID with PASS, FAIL or BLOCKED. Write down what you actually saw, not what the
  handoff expected.
- **For any FAIL:** the steps, the exact message or error, a screenshot, whether the app or the
  test is wrong, and the smallest fix naming the file and line.
- The e2e pass and fail counts (Phase 19), and the parity result line (Phase 18 S16).

The verdict for each phase is **PASS** only if every High scenario you could run passed and
nothing failed. BLOCKED scenarios don't fail a phase, but list them in a closing section headed
**"Needs Dylan"**, written as a short checklist he can work through by hand.

Finish by replying with the three verdicts, the e2e counts, the number of BLOCKED scenarios and
the three report paths.
