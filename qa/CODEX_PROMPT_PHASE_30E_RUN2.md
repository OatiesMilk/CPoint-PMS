# Prompt for Codex: Phase 30E-1, run 2 (paste everything below the line)

Run Codex on **the laptop** in `C:\dev\CPoint-PMS` (uncommitted on `main` at 9bfd10e), Docker
Desktop running for the database only. Copy from the line down.

---

You are the QA tester for CPoint-PMS. Run 1 (`qa/reports/2026-11-04-phase-30e-run1.md`) was
BLOCKED at `npm run demo:reset`. **This run does not reset.** Dylan keeps his own data: the active
leathers are **Black Leather** (LR-GELO-01, Supplier A, 0 rolls) and **Brown Leather**
(LR-MELO-01, Supplier B, 1 roll in stock); the demo leathers and suppliers are deactivated on
purpose. (The reset itself was also fixed: it now turns the demo suppliers back on before seeding.)

Use `qa/CODEX_PROMPT_PHASE_30E.md` and the handoff `qa/handoffs/2026-11-04-phase-30e-rolls-by-color.md`
(S1 to S11, A1 to A3), with these changes:

1. Back up the database to `storage/backups/before-30e-qa-run2.dump` as in run 1. **Don't run
   `npm run demo:reset`**, and don't reactivate or delete anything.
2. Do **S8 first**, as the Floor Manager: Inventory → Black Leather → **Add rolls**, 2 rolls (areas
   24.5 and 31.75), today's date. Then S1 to S7 and S9 to S11 use Black Leather and Brown Leather.
3. S6 needs a roll with Too many defects. The database has older ones on deactivated demo items:
   use one of those from Reports → Rolls (any roll with "Too many defects"). If none shows, mark S6
   NOT POSSIBLE and say why; `returns.spec.ts` covers it.
4. S4 and S5 may be NOT POSSIBLE (no camera; no batch due): say why.
5. Then the five e2e specs and the full suite against the dev server, as in the main prompt. The
   e2e tests make their own leather items and rolls; that's fine.
6. Check the ledger at the end (0 mismatches).
7. Save the report as `qa/reports/2026-11-04-phase-30e-run2.md`, add your line to today's vault Daily
   note linking `[[CPoint-PMS/qa/CODEX_PROMPT_PHASE_30E_RUN2]]` and the report, and reply with the
   verdict, the e2e counts and the report path.

The rules stay the same: test and report only; change no code, tests, migrations, config or `.env`.
The rolls you add in S8 and the ones you start or finish may stay.
