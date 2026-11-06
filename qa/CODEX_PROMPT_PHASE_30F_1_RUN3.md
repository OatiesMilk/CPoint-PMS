# Prompt for Codex: Phase 30F-1, run 3 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on main 120205b), Docker Desktop
running for the database only. **Before you start, Dylan** stops `npm run dev`, deletes the dev
cache with `Remove-Item -Recurse -Force .next\dev` in PowerShell (Codex's policy blocks deleting
`.next`), and starts `npm run dev` again. Then copy from the line down.

---

You are the QA tester for CPoint-PMS, Phase 30F-1, run 3. Run 2
(`qa/reports/2026-11-06-phase-30f-1-run2.md`) passed R2 and blocked R1. Three e2e tests failed on
404s: `POST /api/v1/rolls/{id}/start` in two smoke journeys, and the scan-image API for the Admin
(404 where 403 was expected). Handoff: `qa/handoffs/2026-11-06-phase-30f-1.md`.

Claude's reading: 30F-1 changed no API route, service, policy or test (only `src/components`,
`src/styles`, `globals.css` and page `loading`/`error`/`not-found`/`forbidden` files), and the same
three tests passed in run 1 (targeted log lines 11, 29 and 30) on the same code apart from one
class name. The image route checks `scan:read` before it looks up the scan, so a 404 for the Admin
means the dev server ran stale compiled code. Dylan clears the dev cache before this run.

## Rules

- Test and report only (D-092): no changes to application code, tests, migrations, config,
  `package.json` or `.env`; never skip or loosen a test. Create files only under `qa/reports/`.
- No `demo:reset`. Don't change any Windows setting.
- Run against the `npm run dev` URL Dylan started (AGENTS.md). Playwright's Chromium stays
  headless; don't open visible Chrome windows.

## Steps

1. Artifacts in `qa/reports/artifacts/2026-11-06-phase-30f-1-run3/`. Keep the dev server's output
   as `dev-server.log` if you can see it.
2. R1 (F2), with a headless Playwright script of your own saved beside the artifacts (no OS
   setting): sign in as the FM (`manager@cpoint.local`, `DEMO_USER_PASSWORD` from `.env`, never
   written to a file), open `/floor-manager`.
   - `page.emulateMedia({ reducedMotion: "reduce" })`, hover the Today's batches card's **Open**
     link, wait 300 ms, read the arrow `svg`'s computed `transform`: expected `none`.
   - `page.emulateMedia({ reducedMotion: "no-preference" })`, move the mouse away and hover again,
     wait 300 ms: expected a 2 px move (`matrix(1, 0, 0, 1, 2, 0)`).
   - Record both values in the report.
3. The three failed tests alone:
   `npx playwright test tests/e2e/auth.spec.ts:68 tests/e2e/smoke.spec.ts:87 tests/e2e/smoke.spec.ts:151 --workers=1`
4. Then both specs: `npx playwright test tests/e2e/smoke.spec.ts tests/e2e/auth.spec.ts --workers=1`.
   If a test fails with a 404 again, note the request line from the dev server's output.

## Write the report

Save `qa/reports/2026-11-06-phase-30f-1-run3.md` from `qa/templates/report.md`. **PASS** if R1
and steps 3 and 4 pass (R2 passed in run 2). Add one line under "Agent sessions" in today's Daily
note (`C:\dev\capstone-obsidian\Daily\`) linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30F_1_RUN3]]`
and the report. Reply with the verdict, the two arrow values, the e2e counts (passed, failed,
skipped) and the report path.
