# Prompt for Codex: Phase 30B QA (paste everything below the line)

Run Codex on **Dylan's PC** in `D:\IMPORTANT SHIT HERE\12th Term - BSIT\CAP2\CPoint-PMS` (the
three test photos and the uncommitted changes are only there), with Docker Desktop running. No
browser. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Phase 30B adds no app screen: it adds two model-toolkit
commands, `calibrate` and `measure`, and a read-only export script, `npm run cv:roll-photos`.
The handoff is `qa/handoffs/2026-11-02-phase-30b-measuring.md`. Read it first; it lists every
scenario (C1 to C8) with the exact commands and expected results.

## Rules

- **Test and report only (D-092).** Don't modify application code, `cv/` code, tests, config,
  migrations, `package.json`, `.env` or `cv/config.toml`, and don't touch `cv/out/30b-letter/`
  or `cv/reports/`. Create files only under `qa/reports/` (the report and its artifacts).
- No browser and no Playwright: nothing in the app's pages changed.
- Never run `demo:reset`, `db:migrate` or `docker compose down -v`. Database access is read-only
  (the C8 query only).
- In PowerShell, quote npm's separator: `npm run cv:roll-photos '--' <code> <folder>`.

## Steps

1. Put every artifact in `qa/reports/artifacts/2026-11-02-phase-30b/` (call it `<artifacts>`):
   each command's output as UTF-8 text, the C3 overlays, the C5 report and the C6/C7/C8 folders.
2. Run C1 to C8 from the handoff, in order. For C3, open each overlay and say where the green
   outline is. For C5, compare every number with `cv/reports/2026-11-02-LETTER-TEST-measure.md`.
3. If a scenario can't run, write NOT POSSIBLE with the reason (C8 needs an `LR-` roll with shots).

## Write the report

Save it as `qa/reports/2026-11-02-phase-30b.md` (or the date you run it), using
`qa/templates/report.md`. The verdict is **PASS** only if C1 to C7 passed and C8 passed or was NOT
POSSIBLE with a reason. For any FAIL: the exact command, its output, and the file and line if you
can tell. Don't fix it.

Then add one line under "Agent sessions" in the vault's Daily note for today, linking
`[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30B]]` and the report (the vault is on the laptop: if you
can't reach it, say so in the report instead).

Finish by replying with the verdict, the pytest and unit test counts, and the report path.
