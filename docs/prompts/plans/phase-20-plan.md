# Phase 20 plan: website-only camera, "Cut around or clean", supplier quality, no components

Status: **approved by Dylan on 2026-10-20: A, B, C, D and E as recommended; no "Ready to capture" line.**
Asked by Dylan on 2026-10-20 (five changes, in his order). After all five are built, one QA
handoff covers them for a single Codex e2e run.

Before building: no Codex report exists for Phases 17, 18 or 19 yet (the newest is
`qa/reports/2026-10-19-phase-16-camera-page-run2.md`, which passed). Step 1 removes what Phase 17
built, so **don't run `qa/CODEX_PROMPT_PHASES_17_19.md`**. The handoff in step 6 replaces it and
re-covers what Phases 18 and 19 still need.

---

## Step 1. Retire the CPoint Camera desktop app

The Capture page (Phase 18) runs the model on the server, so the station PC app is no longer
needed.

**Remove**

- `cv/cpoint_cv/window/` (the Tkinter app), `shortcut.py`, `cv/CPoint Camera.cmd`,
  `cv/station-window.json` handling, and the `window` and `shortcut` CLI commands, plus their tests.
- The station runtime that only the app and `run` used: `run`, `doctor`, `station.py`, `spool.py`,
  `sources.py`, `triggers.py`, `preview.py`, `overlay.py`, `transport.py`, `retry.py`, `client.py`
  and their tests (**decision A**).
- On the Camera page: the "With the camera station" steps, the "Station connected" and "Camera
  station active" badges, and the station check-in wording. The page talks about the Capture page
  and the simulator only.
- `[window]` and `[camera]` sections in `cv/config.example.toml`.

**Keep**

- `cv/` as the **model toolkit**: `predict`, `evaluate` and `export-onnx` (the website's model
  comes from `export-onnx`), plus `npm run cv:parity`.
- The device-token scan API (`POST /api/v1/scans` with a token) and API tokens, because
  `npm run cv:simulate` and the demo use them. `captureId` retries stay.
- Old scans with source `DEDICATED_CAMERA` still display. The enum value stays so no data
  migration is needed. It just isn't produced any more.

**Docs:** `cv/README.md` (rewritten as the model toolkit), README camera section, `docs/API.md`,
DECISIONS (a new entry superseding D-059 to D-063), ROADMAP (Phase 17 marked "retired by Phase 20").

## Step 2. Capture page: a "check before starting" button?

**Recommendation: don't add one.** The desktop app needed "Check this machine" because it depended
on things that could silently be wrong on the station PC: Python packages, the GPU, the device token
and the PC clock. None of those exist on the website.

- The model runs on the server, and a missing model already shows its own alert with Capture off.
- Camera access is checked when the page opens. Blocked, insecure address, in use and not found
  each have their own message and a Try again button.
- A missing batch already shows "No batch is at Preparation" with Capture off.

A button would only repeat these checks, and it adds a click before every shift.

**Optional small improvement (yes or no):** a 3-item "Ready to capture" line above the video, with
Camera ✓, Model ✓ and Batch B-… ✓. It gathers the three states in one place without a button.
It's about half a day of work, and I've left it out unless you want it.

## Step 3. "Rework" becomes "Cut around or clean"

The camera checks raw leather sections before cutting, so nothing is reworked. A flagged section is
either **cleaned** (dirt) or **cut around** (cut, hole, crease, abrasion and so on). This follows
your first mockup.

**Data (defect types stay data, never hardcoded)**

- New field on `DefectType`: `handling` = `CLEAN` or `CUT_AROUND` (default `CUT_AROUND`). One
  migration. Settings → Defect types gets a "How it's handled" choice. `demo:reset` and the
  bootstrap set dirt → Clean, everything else → Cut around.

**Wording (labels only; internal names like `REWORK`, `ReworkTicket` and `/rework` stay to avoid a
risky rename)**

- The verdict label becomes **"Fixable"** everywhere it shows: the verdict badge, chart legend,
  scan filters, scan page, review page, QI home card, settings ("Fixable when found"), reports and
  CSV headers (**decision B** on the word).
- `/rework` page, as in the mockup: eyebrow "Quality · Rework", title "Cut around or clean", and the
  description "Leather sections the camera marked Fixable. Nothing is repaired: clean the section or
  cut around the defect, then mark it done." Columns: **To handle**, **Being handled** and
  **Done, usable** ("N this week"). Each card shows "Section #N", the defect and percentage, and
  the action from the defect type ("Clean before cutting" or "Cut around the marked area"). Done
  cards show "Cleaned, usable" or "Cut around, usable".
- Nav item "Cut around or clean". Batch tag "In repair" becomes "Being handled", and the
  stage-machine message says "still being cleaned or cut around".

**FM reports page:** Operations and Quality both use "Fixable" in KPIs, tables and CSVs.
"Repairs done" becomes "Cleaned or cut around", the repair station card becomes "Cut around or
clean", and "Needed work" becomes "Fixable + reject".

## Step 4. Supplier quality report (your second mockup)

The data already exists: each batch has its roll code and its supplier, and each scan has its
verdict and defects. Today the Operations report has a small "Suppliers" card. This replaces it with
a **Supplier quality** section on the FM's Reports → Operations.

- **Supplier table:** Supplier, Rolls (distinct roll codes), Sections, Fixable %, Reject % and Top
  defect, worst first. A **High** badge appears when a supplier's fixable + reject share is
  above the line by the same rule the "needs attention" list already uses (min sections and gap in
  `ATTENTION`), so the badge and the attention item never disagree.
- **Rolls with the most rejects:** the top 5 rolls in the range, with roll · batch, supplier,
  "Rejected 6 of 40", a defect breakdown ("Hole 4 · Cut 2") and a **Claim sheet** button.
- **Claim sheet** (**decision C**): a printable page at `/reports/claims/[batchId]` with the roll,
  supplier, batch, dates, the counts, and each rejected section with its photo, defects and
  confidence. Its "Save as PDF" button uses the browser's print, so no new library is needed. It is
  FM and Admin only, every image goes through the existing protected image route, and an audit row
  records who printed it.
- CSV: `suppliers.csv` gains the new columns, plus a new `supplier-rolls.csv`.
- The footer reads "Grouped by supplier and roll only, never by person."
- Demo week: rolls spread across the three demo suppliers so the section has something to show.

## Step 5. Remove component tracking

Component tracking is out of scope now.

- Remove the `/components` "coming soon" page and its nav link, the Settings → **Components** tab,
  `api/v1/component-types` (both routes), the controller, service, validator and model code, and the
  audit labels and demo-reset lines for components.
- **Drop the `component_types` table** in a migration (**decision D**). It only ever held optional
  names and nothing else points to it.
- Docs: ROADMAP and STATUS drop "Component tracking, once CPoint gives the counts", DECISIONS gets
  a new entry ("component tracking dropped from scope"), and the master spec marks it out of scope.
  The "components per shoe type" open question is closed.

## Step 6. QA handoff for Codex (one e2e run)

- `qa/handoffs/2026-10-2x-phase-20-website-camera-and-reports.md` from `qa/templates/handoff.md`.
  It covers steps 1 to 5, plus the Phase 18 Capture-page scenarios and Phase 19 Docker checks that
  were never run (Phase 17's are dropped).
- Updated e2e specs that Codex runs: the rework, reports and camera specs for the new wording,
  a new supplier-quality and claim-sheet spec, settings without Components, and axe on the new
  pages.
- `qa/CODEX_PROMPT_PHASE_20.md`, a single paste-ready prompt that replaces
  `qa/CODEX_PROMPT_PHASES_17_19.md`.

## Gates I'll run (no browser or e2e, per the project rules)

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and in `cv/`: ruff, mypy and
pytest. Docs are updated each step: STATUS, SESSION_LOG, DECISIONS, ROADMAP (Phase 20), README,
`cv/README.md`, API.md.

## Order and sessions

Build in the order above, one step per session (project rule), with gates green before the next:
1 → 3 → 4 → 5 → 6. Step 2 adds nothing unless you choose the optional ready line. No branch,
commit or push without your go-ahead.

## Decisions for Dylan

- **A. How much of the station to remove.** I recommend removing the app _and_ its `run`/`doctor`
  runtime and keeping only the model toolkit and the simulator. The alternative is to remove only
  the window and keep `run webcam` as a command-line fallback.
- **B. The verdict word.** I recommend **"Fixable"**. Alternatives are "Clean or cut" or keeping
  "Rework" on badges and only renaming the page.
- **C. Claim sheet.** I recommend a printable page with "Save as PDF". The alternative is a real
  PDF download, which needs a new PDF library.
- **D. Components.** I recommend dropping the table too. The alternative is to hide the UI and leave
  the table.
- **E. Step 2.** I recommend no check button. Separately, choose whether to add the optional
  "Ready to capture" line.
