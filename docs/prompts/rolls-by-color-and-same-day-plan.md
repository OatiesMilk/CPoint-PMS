# Brief: leather by color, rolls leave stock at Capture, same-day planning (Phase 30E)

> Written 2026-11-03 by Claude from Dylan's message after Phase 30C (PR green). For a new Claude Code
> session that **starts in plan mode**: read, plan, ask, and write no code until Dylan says go. The
> paste-in prompt is at the end.

## Why

Dylan's follow-up with CPoint changes how leather rolls and batches are run on the floor:

1. The **Quality Inspector** only counts the pairs made in each batch. Nobody on the line knows
   which leather roll went into which batch, so the QI shouldn't tick rolls (D-104's Fully used).
2. **No double check for Return to supplier.** When a Shoe Constructor finishes scanning a roll,
   whatever the result, that roll comes **off the leather stock** at once. Constructors only scan the
   rolls they think the day needs.
3. **Leather is told apart by color, not by roll code.** Each color comes from one supplier
   (Supplier A = all brown, Supplier B = all black). At Capture the constructor picks the **color**
   from a dropdown instead of a specific roll (`LR-MLT-001`).
4. **How often** (Plan batches) loses **every 1 hour** and **every 3 hours**. Every 2 hours, every 4
   hours and once at the end of the day stay.
5. **Same-day planning.** The Floor Manager plans a day's batches **on that day** (for Nov. 4, on Nov.
   4), not the day before. At the start of the day the system tells the FM to plan the batches
   first, before production starts.

## Where it lands today (read these; the repo wins over this list)

| Change | Today                                                                                                                                                                    | Decisions                                | Main code                                                                                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1      | QI ticks **Rolls fully used** at Finish batch (−1 then); rolls show Fully used                                                                                           | D-104, D-097, D-098                      | `src/app/(app)/batches/finish-batch-dialog.tsx`, `src/server/services/{production,roll}.service.ts` (`markRollsUsed`, `rollsToTick`, `usedRollIds`), `production.validator.ts` |
| 2      | Finish roll saves the defect share; over 10% the roll is marked and the FM sends it back or keeps it (D-110); a roll leaves stock only when ticked, sent back or removed | D-104, D-110, D-072                      | `roll.service.ts` (`finishRoll`, `decideReturn`), `reports/rolls/*`, `components/features/rolls/{return-decision,roll-findings,defect-share}.tsx`                              |
| 3      | The FM adds each roll to a leather item with its own **area** (D-103) and code `LR-<supplier>-001`; the constructor picks that roll at Capture                           | D-095, D-103, D-104                      | `camera/capture/{start-roll-form,roll-bar,capture-client}.tsx`, `inventory/[id]`, `roll.service.ts` (`addRolls`, `startRoll`), Settings → Suppliers codes                      |
| 4      | `INTERVAL_MINUTES = [60, 120, 180, 240]` plus once a day                                                                                                                 | D-097                                    | `src/lib/production-rules.ts`, `batches/plan/plan-forms.tsx`, `production.validator.ts`                                                                                        |
| 5      | Schedule, lunch and quota changes apply **from tomorrow** (`effectiveFromFor`); a repeat save is skipped (D-107); Monday to Friday 08:00–17:00 (D-105)                   | D-083, D-085, D-097, D-099, D-105, D-107 | `production-rules.ts` (`effectiveFromFor`), `production.service.ts` (`saveSchedule`, `saveQuota`, `saveLunchBreak`), `batches/plan/*`, the notices and the FM home             |

Also touched: the demo week and `demo:reset`, Reports → Materials (leather used per week), Reports →
Rolls and Supplier quality, the claim sheet, `docs/API.md`, `docs/STATION_SETUP.md`, the CI Docker
job's demo checks, and the e2e specs (`batches`, `capture`, `rolls`, `returns`, `inventory`,
`supplier-quality`). Phase 30D (the team's QA notes, `docs/prompts/plans/groupmates-feedback-plan.md`)
splits leather Used into Fully used, Returned and Removed; this change rewrites that, so the plan
must say how 30D changes.

## Questions the plan must put to Dylan (never guess; log what stays open as ASSUMPTION in STATUS)

1. **What "no double check" removes.** Does a finished roll over the limit still show its defect %
   and a "too many defects" mark for the FM's information, with no Send back or Keep step? Or does
   Return to supplier go away altogether (and the claim sheet with it)?
2. **The 10% needs the roll's area.** If constructors pick a color and the FM no longer adds rolls
   one by one, where does a roll's area come from: entered by the constructor at Capture, one
   standard area per color, or no defect % at all? (D-103 entered it per roll.)
3. **What stock counts by color.** One stock item per color (e.g. "Brown leather, Supplier A",
   counted in rolls), with Finish roll −1? Do individual roll records and codes stay at all (Reports
   → Rolls, claim sheets, Defect % per roll), or does a scan now belong to "a brown roll scanned on
   Nov. 4, 10:15"?
4. **Color ↔ supplier.** Is the color a field of the supplier (one color each), or of the leather
   item? Can two suppliers ever share a color? Who sets it (System Admin in Settings → Suppliers?)
5. **Existing data.** What happens to rolls already in stock, Fully used ticks and the FM's
   decisions from 30C on an existing database (convert, keep as history, or `demo:reset` only)?
6. **Same-day planning.** Does a plan saved on the day apply **today** and stay editable all day,
   or lock once the first batch starts? Do the quota and the lunch break also move to the same day,
   or stay "from tomorrow"? What if the FM never plans: no batches that day, or yesterday's plan?
7. **The start-of-day notice.** Which roles see it (FM only?), where (banner, bell, FM home), from
   what time, and what does the QI see while there's no plan yet?
8. **Order.** Does this go before Phase 30D (recommended, since 30D reads leather used), and is it
   one session or two (rolls and color; planning)?

## What the plan contains

- What changes for each role, in plain words, screen by screen (Shoe Constructor, QI, FM, Admin).
- The data model and the migration (what converts, what stays as history, what is dropped), with
  no person stored or totalled (D-008).
- Every file to change, and which earlier decisions it replaces (new entries start at **D-111**).
- Tests: unit (rules, services, validators, the migration's conversion) and e2e specs written for
  Codex.
- The wrap-up: STATUS, SESSION_LOG, DECISIONS, ROADMAP, `docs/API.md`, `docs/STATION_SETUP.md`, the
  vault, a QA handoff and `qa/CODEX_PROMPT_PHASE_30E.md`.

## Done when (to confirm in the plan)

- The QI's Finish batch asks only for pairs finished and failed; no roll list.
- Finish roll at Capture takes the roll off the leather stock, whatever its verdicts.
- The constructor picks a leather color at Capture; each color names its supplier; no roll code to
  pick.
- How often offers every 2 hours, every 4 hours and once a day only.
- The FM plans a day on that day; until a plan exists the FM is told to plan first, and batches
  start from that plan.
- `npm run check` passes; e2e specs updated (Codex runs them); demo week and `demo:reset` match;
  docs and vault updated; every screen's text short and plain (the users aren't technical).

---

## Paste-in prompt for Claude Code

Paste everything below into a new Claude Code session at `C:\dev\CPoint-PMS` on the laptop, **in plan
mode** (Shift+Tab until it says plan mode).

```text
Role: you are the main developer of CPoint-PMS (see CLAUDE.md). Work in plan mode: read, plan and
ask; don't write code or change files until I say "go".

Task: plan Phase 30E from docs/prompts/rolls-by-color-and-same-day-plan.md: the QI no longer tracks
rolls; a roll leaves stock when its scan is finished; constructors pick a leather color (one color
per supplier) instead of a roll; How often drops every 1 h and every 3 h; the Floor Manager plans
each day on that day and is told to plan first.

Before you plan:
1. Vault first: C:\dev\capstone-obsidian CLAUDE.md, Rules.md, Home.md, Inbox/CPoint commands and
   where to look.md, the latest Daily note and Notes/Phases/Phase 30C - Cuts and roll returns.md.
2. Repo: CLAUDE.md (it loads docs/STATUS.md), the brief above, DESIGN.md and
   .claude/skills/ui-craft/SKILL.md, and in docs/DECISIONS.md the entries the brief names (D-083,
   D-085, D-095, D-097 to D-099, D-103 to D-107, D-110).
3. The newest Codex report in qa/reports (latest date, highest run): confirm nothing is open.
4. Check that main has Phase 30C (PR merged) with git log; if it isn't merged, say so and stop.
5. Read only the code the brief's table points to; search before opening large files.

Then give me one plan (save it as docs/prompts/plans/phase-30e-plan.md) with:
- the brief's 8 questions, each with your recommended answer and why, as a short numbered list
  first, so I can answer by number;
- what changes for each role, screen by screen, in plain words;
- the data model and migration, the files to change, the decisions it replaces (from D-111), the
  tests, and the docs and vault updates;
- what you'll log as ASSUMPTION in STATUS if I don't answer.

Rules: never invent a business rule; no per-person tracking (D-008); defect types and thresholds stay
data; MVC layering, guards, runInTransaction + recordAudit; plain, short screen text (the users
aren't technical); you run only npm run check (Codex runs e2e); no branches, commits or pushes
without my say-so. Keep your replies short.
```
