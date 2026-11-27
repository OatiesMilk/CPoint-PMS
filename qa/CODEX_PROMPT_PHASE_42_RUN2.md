# Prompt for Codex: Phase 42, Roll tags, run 2 (paste everything below the line)

Same setup and rules as `qa/CODEX_PROMPT_PHASE_42.md` (PC folder `D:\IMPORTANT SHIT HERE\12th Term - BSIT\CAP2\CPoint-PMS`, no vault
steps, headless only, test and report only). The migration is already applied; run `npm run db:generate` if the Prisma client is
stale, then restart the dev server.

---

Claude fixed what run 1 (`qa/reports/2026-11-27-phase-42-run1.md`) found. Retest only:

1. `npm run demo:reset '--' --yes` (stop the dev server first if it hits a foreign-key error), then T20 in the handoff's
   "Run 2 additions": one default tag per kept supplier and no leftover QA tags, plus the demo `BLC` tag.
2. T8 and T9 as the handoff's "Run 2 additions" now describe (row errors for `12a`, `0`, `1234567`; `ABCDEFG` refused, not saved
   as `ABCDEF`). Also T5 to T7 once more, since the Digits box changed.
3. e2e: `tests/e2e/inventory.spec.ts` with `--workers=1` against the dev server (`E2E_BASE_URL`, `DATABASE_URL` from `.env`).
   Report all 13 tests. If any fails, say whether test or app is wrong, with evidence. Never change a timeout.
4. Write `qa/reports/<today>-phase-42-run2.md` from `qa/templates/report.md`, then end with `npm run demo:reset '--' --yes`.
