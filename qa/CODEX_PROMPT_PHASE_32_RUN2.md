# Prompt for Codex: Phase 32 roll locations, run 2 (paste everything below the line)

Run Codex on the laptop (`C:\dev\CPoint-PMS`), Docker Desktop running for the database only, the
`20261117090000_roll_locations` migration applied (it is, from run 1), and the working-tree app
running with `npm run dev` (run 1 used `npm run dev -- --hostname 127.0.0.1` on port 3001 because
an older Docker build held 3000; do the same if 3000 is still the Docker app).

---

You are the QA tester for CPoint-PMS: Phase 32, run 2. Handoff:
`qa/handoffs/2026-11-17-roll-locations.md`. Run 1's report: `qa/reports/2026-11-19-phase-32-run1.md`
(FAIL: L4, L10, L12). Retest only what is listed here; the 14 scenarios that passed in run 1 carry
forward.

## What Claude changed after run 1

- **F1 (L4):** the label sheet's print page has no margin of its own now (`@page { size: A4;
margin: 0 }`) and starts 0.45 mm down, so the seven 42.3 mm rows fit one A4 page
  (`src/app/globals.css`).
- **F2 (L10):** the `roll.move` audit row now has a Before: each moved roll's code and where it was
  (`src/server/services/roll.service.ts`).
- **F3 (L12):** `returns.spec.ts`'s claim-sheet check now reads "Over the 10% limit" exactly (the
  Returned to supplier line above it also says "over the 10% limit"). The other failures were
  30-second time-outs and sign-ins that stayed on `/login` while six workers shared one dev server;
  no code fault found for them.
- **Run 1 observation:** the single-roll button's accessible name now follows its word: "Set aside
  LR-…", "Place LR-…", "Move LR-…".

## Rules

- Test and report only (D-092): change no application code, tests, docs, migrations, config,
  `package.json` or `.env`. Create files only under `qa/reports/` and your line in the vault's
  Daily note.
- E2E: set `$env:E2E_BASE_URL` to the dev server's URL first. A failure on a time-out, a sign-in
  that stays on `/login`, `net::ERR_ABORTED`, `ECONNRESET` or a closed page/context: rerun that
  spec alone once and report both results. Never change a timeout or the worker count in config.

## Do

1. **L4 again:** open roll labels for 21 rolls in stock (an item's **Print labels**, or
   `/inventory/labels?rolls=<21 ids>`) and save as an A4 PDF at 100%. Expected: **one page**, 3 × 7,
   all 21 QR codes decode (jsQR) to their codes. Also the 2-location sheet and a 14-roll sheet:
   one page each.
2. **L10 again:** as Floor Manager move 2 rolls from different bins to another bin; as Admin open
   that `roll.move` row. Expected: Before lists each roll with its old location; After has `to`.
3. **The observation:** on a roll Returned to supplier and not set aside, the button reads **Set
   aside** and its accessible name is "Set aside LR-…" (read it from the accessibility tree).
4. **L12 again:** `npx playwright test tests/e2e/returns.spec.ts tests/e2e/rolls.spec.ts
tests/e2e/inventory.spec.ts tests/e2e/reports.spec.ts tests/e2e/admin.spec.ts
tests/e2e/capture-no-card.spec.ts`, then `npm run test:e2e`. Rerun any failing spec alone once
   per the rule above and give both results.
5. Write `qa/reports/2026-11-19-phase-32-run2.md` (or today's date) from `qa/templates/report.md`
   (PASS, PASS WITH ISSUES or FAIL), and add one line under "Agent sessions" in the vault's
   `Daily/` note for today linking this prompt and the report.
