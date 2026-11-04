# Plan: Phase 30E, leather picked at Capture, rolls leave stock there, a planning calendar

> Written 2026-11-03 by Claude from `docs/prompts/rolls-by-color-and-same-day-plan.md`; updated
> 2026-11-04 with Dylan's answers. Two sessions: **30E-1** (rolls and leather) is **built**, Codex
> run 1 next; **30E-2** (the planning calendar) is next.

## What Dylan decided

1. **No double check (D-112).** A finished roll still shows its Defect %, and over 10% it reads
   **Too many defects**, for the Floor Manager's information only. There is no Send back or Keep;
   the claim sheet stays. (My recommendation; Dylan said go.)
2. **The area and the pick (D-113, 4 Nov, choice a).** Each roll keeps **its own area**, entered
   by the Floor Manager with **Add rolls** when it arrives (as in Phase 30A). At Capture the
   constructor picks the **leather**, then the **roll on the table** by the code on its label, and
   types nothing.
3. **Stock (D-112).** A leather item's count follows its rolls (+1 when added). **Finish roll**
   takes the roll off stock (−1). Remove works on a roll in stock or being scanned.
4. **No color.** The YOLO model can't tell colors: it only knows defects, and it sees a roll after
   the first shot. The leather's name says what it is.
5. **Old data (D-113).** Old rolls stay as history; rolls in stock stay pickable; scanned rolls not
   yet ticked came off stock.
6. **Planning (30E-2, 4 Nov).** The Floor Manager plans any day, today or later, from a
   **calendar** that also shows the saved plans. A day's plan is the **rolls to be used** (one
   total, an estimate), the **quota** and the **check-in interval**: **every 4 hours** or **once at
   the end of the day** only (Dylan, 4 Nov: every 1, 2 and 3 hours go). No working-days ticks: the
   calendar's Saturdays and Sundays can't be planned (like a month grid of days, Dylan's example). Constructors can start more rolls than planned; the system
   records planned against scanned so the reports can compare them.
7. **The start-of-day notice (30E-2).** My recommendation, not yet settled: the FM only, from 00:00
   on a working day with no plan, as a banner, in the bell and on the FM home. The QI reads "No
   batches yet today. The Floor Manager plans them first."
8. **Order.** 30E before 30D, in two sessions.

## 30E-1, as built (Codex run 1 next)

**Shoe Constructor, Capture:** **Start a roll** has **Leather** ("Brown suede (topsiders) ·
Marikina Leather Trading · 3 rolls"), then **Roll on the table** ("LR-MLT-012 · 24.5 sq ft · tag
88-14"), and **Start scanning**. **Finish roll** says "… It is taken off the Brown suede
(topsiders) stock." An empty roll picked by mistake is put back.

**Quality Inspector, Finish batch:** only pairs finished, failed inspection and notes. No roll
list.

**Floor Manager:**

- **Inventory:** unchanged from 30A: **Add rolls** with each roll's area; the count follows the
  rolls.
- **Reports → Rolls:** Defect % and **Too many defects** as information. There is no To return
  band, Send back or Keep. **Remove** works on a roll in stock or being scanned. The claim sheet
  stays.

**System Admin:** Settings → Thresholds reads "A roll has too many defects when they cover more than
__%".

**Data:** one data-only migration, `rolls_leave_stock_at_capture` (scanned rolls off stock). The
laptop database needs a restore from this morning's backup first: it holds two earlier tries of
this phase's migrations.

**Decisions:** D-111 (the QI counts pairs only), D-112 (off stock at Finish roll; Too many defects
is information), D-113 (the leather, then the roll; each roll keeps its own area).

**Checks:** `npm run check` passed (651 unit tests). The demo week was checked on a scratch
database. The e2e specs are updated for Codex.

## 30E-2, the planning calendar (next session)

**Floor Manager, Batches → Plan:**

- A **month calendar**. Each day with a plan shows its rolls, quota and interval in short. Clicking
  a day, today or later, opens its plan: **Rolls to be used**, **Quota** (pairs) and **Check-in
  interval** (every 4 hours, or once at the end of the day), with that day's batches
  previewed. Saturdays, Sundays and past days can't be planned (D-105). The working-days ticks
  on the plan form go.
- **Today's plan** can change until its first batch is finished; after that it is read-only
  (ASSUMPTION A-36).

**The day itself:**

- Batches follow that day's plan. Lunch stays the Admin's, from tomorrow.
- With no plan for a day, there are no batches and the FM gets the start-of-day notice (A-37).

**Reports:** planned against scanned rolls per day, so the reports can compare them.

**Data:** a **day plan** per date: rolls, quota and interval, with an audit trail. No person is
totalled (D-008). Saved plans of every 1, 2 or 3 hours become every 4 hours (A-39).

**Decisions:** D-114 (the planning calendar and day plans; replaces "from tomorrow" for the
schedule and quota) and D-115 (How often is every 4 hours or once at the end of the day).

**Open for the 30E-2 plan (I'll ask before building):**

- Where planned against scanned shows: Batches, Reports → Operations or Materials.
- Whether a day without a plan copies the last plan or stays empty.
- Whether the shift hours stay one setting or join the day's plan.

## Assumptions in STATUS

A-31 (Too many defects is information), A-33 (Remove for a roll in stock or being scanned), A-35
(old rolls as history), A-36 and A-37 (30E-2, above), A-38 (order), A-39 (1 h and 3 h plans moved).

## Decided for 30E-2 (Dylan, 2026-11-04)

- **Every working day must have a plan.** No copying the last plan: until the FM plans the day,
  it has no batches and the start-of-day notice shows. Assume at least one FM is always at the
  factory to plan.
- **Non-working day / Holiday:** the FM can mark a weekday on the calendar as a non-working day or
  holiday instead of planning it. That day has no batches, no notice and no reminder. It shows on
  the calendar, and the reports leave it out of working days.
- No name on a holiday (Dylan): just the mark "Non-working / Holiday", which the FM can undo.
- Still recommended (A-36): a day's plan can change until its first batch is finished.
