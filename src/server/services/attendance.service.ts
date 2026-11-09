/**
 * Attendance (Phase 22, D-077 to D-081): who came in on a day, taken by the Floor Manager.
 *
 * A log book, never a score (D-008). Every read here is one day; nothing returns a person's
 * history, absence count or streak. `workforceFor` (attendance-rules) is the only worker count.
 */
import { appNow } from "@/lib/clock";
import type { Role } from "@/generated/prisma/enums";
import {
  attendanceSummary,
  changedMarks,
  editableDay,
  formatShortDay,
  qualityInspectorPresent,
  rosterFor,
  workforceFor,
  type Mark,
  type RosterPerson,
  type Workforce,
} from "@/lib/attendance-rules";
import { manilaToday } from "@/lib/format";
import { addDays } from "@/lib/report-rules";
import { Errors } from "@/server/lib/errors";
import {
  createAttendanceDay,
  findAttendanceDay,
  listAttendanceDays,
  listRosterCandidates,
  replaceAttendanceMarks,
  touchAttendanceDay,
} from "@/server/models/attendance.model";
import { runInTransaction } from "@/server/models/db";
import { can } from "@/server/policies/permissions";
import type { SaveAttendanceInput } from "@/server/validators/attendance.validator";
import { recordAudit } from "./audit.service";

export const STALE_ATTENDANCE = "Someone else saved this day's attendance. Refresh to see it.";

export type AttendanceView = {
  day: string;
  today: string;
  taken: boolean;
  updatedAt: string | null;
  takenAt: string | null;
  takenBy: string | null;
  editable: boolean;
  lockedReason: string | null;
  workforce: Workforce;
  summary: string;
  roster: (RosterPerson & { present: boolean })[];
};

function dayEnd(day: string): Date {
  return new Date(`${addDays(day, 1)}T00:00:00+08:00`);
}

async function loadDay(day: string) {
  const saved = await findAttendanceDay(day);
  const marks: Mark[] | null = saved ? saved.marks : null;
  const markedIds = marks ? marks.map((m) => m.userId) : [];
  const candidates = await listRosterCandidates(dayEnd(day), markedIds);
  const roster = rosterFor(candidates, day, new Set(markedIds));
  return { saved, marks, roster };
}

/** One day's attendance, for the page and `GET /api/v1/attendance`. */
export async function getAttendanceDay(
  day: string | undefined,
  viewer: { role: Role },
  now: Date = appNow(),
): Promise<AttendanceView> {
  const today = manilaToday(now);
  const target = day ?? today;
  const { saved, marks, roster } = await loadDay(target);
  const window = editableDay(target, today);
  const mayEdit = can(viewer.role, "attendance:manage");
  const present = new Set((marks ?? []).filter((m) => m.present).map((m) => m.userId));
  const workforce = workforceFor(roster, marks);
  return {
    day: target,
    today,
    taken: saved !== null,
    updatedAt: saved ? saved.updatedAt.toISOString() : null,
    takenAt: saved ? saved.takenAt.toISOString() : null,
    takenBy: saved ? saved.takenBy.name : null,
    editable: mayEdit && window.ok,
    lockedReason: !mayEdit
      ? "Only the Floor Manager takes attendance."
      : window.ok
        ? null
        : window.reason,
    workforce,
    summary: attendanceSummary(workforce, target),
    roster: roster.map((p) => ({ ...p, present: present.has(p.id) })),
  };
}

/** Today's worker count: the FM home card now, production progression in Phase 23. */
export async function todayWorkforce(now: Date = appNow()) {
  const day = manilaToday(now);
  const { marks, roster } = await loadDay(day);
  const workforce = workforceFor(roster, marks);
  return { day, workforce, summary: attendanceSummary(workforce, day) };
}

/**
 * Whether a Quality Inspector is marked present that day (D-088), or null when attendance wasn't
 * taken. Production asks this before the Floor Manager enters a check-in.
 */
export async function qualityInspectorPresentOn(day: string): Promise<boolean | null> {
  const { marks, roster } = await loadDay(day);
  return qualityInspectorPresent(roster, marks);
}

/**
 * The worker count for each day in a range (D-080), for production progression (Phase 23). Only
 * the day-level counts leave this function, never who was present (D-008).
 */
export async function workforceByDay(days: string[]): Promise<Map<string, Workforce>> {
  const out = new Map<string, Workforce>();
  if (days.length === 0) return out;
  const sorted = [...days].sort();
  const saved = await listAttendanceDays(sorted[0], sorted.at(-1)!);
  const byDay = new Map(saved.map((d) => [d.day.toISOString().slice(0, 10), d.marks]));
  const marked = [...new Set(saved.flatMap((d) => d.marks.map((m) => m.userId)))];
  const candidates = await listRosterCandidates(dayEnd(sorted.at(-1)!), marked);
  for (const day of sorted) {
    const marks = byDay.get(day) ?? null;
    const roster = rosterFor(candidates, day, new Set((marks ?? []).map((m) => m.userId)));
    out.set(day, workforceFor(roster, marks));
  }
  return out;
}

/**
 * Save a day (D-079): today or the 7 days before, by the Floor Manager. One transaction: create or
 * conditionally touch the day (a changed `updatedAt` is 409 STALE), replace its marks, and write
 * one audit row with the before and after counts and who changed. Anyone on the roster the page
 * didn't send is saved as absent, so a saved day is always whole.
 */
export async function saveAttendanceDay(
  day: string,
  input: SaveAttendanceInput,
  actor: { id: string; role: Role },
  now: Date = appNow(),
): Promise<AttendanceView> {
  if (!can(actor.role, "attendance:manage"))
    throw Errors.forbidden("Only the Floor Manager takes attendance.");
  const window = editableDay(day, manilaToday(now));
  if (!window.ok) throw Errors.conflict(window.reason);

  const { saved, marks: before, roster } = await loadDay(day);
  const names = new Map(roster.map((p) => [p.id, p.name]));
  const sent = new Map(input.marks.map((m) => [m.userId, m.present]));
  const stranger = input.marks.find((m) => !names.has(m.userId));
  if (stranger)
    throw Errors.conflict(
      `Someone in this list isn't on the roster for ${formatShortDay(day)}. Refresh the list.`,
    );

  if (saved === null && input.expectedUpdatedAt !== null) throw Errors.stale(STALE_ATTENDANCE);
  if (saved !== null && input.expectedUpdatedAt === null) throw Errors.stale(STALE_ATTENDANCE);

  const after: Mark[] = roster.map((p) => ({ userId: p.id, present: sent.get(p.id) ?? false }));
  const workforceBefore = workforceFor(roster, before);
  const workforceAfter = workforceFor(roster, after);
  const count = (marks: Mark[] | null) =>
    marks === null
      ? null
      : {
          present: marks.filter((m) => m.present).length,
          absent: marks.filter((m) => !m.present).length,
        };

  await runInTransaction(async (tx) => {
    let id: string;
    if (saved === null) {
      try {
        id = (await createAttendanceDay(day, actor.id, now, tx)).id;
      } catch (error) {
        if (isUniqueViolation(error)) throw Errors.stale(STALE_ATTENDANCE);
        throw error;
      }
    } else {
      const changed = await touchAttendanceDay(
        saved.id,
        new Date(input.expectedUpdatedAt as string),
        actor.id,
        now,
        tx,
      );
      if (changed === 0) throw Errors.stale(STALE_ATTENDANCE);
      id = saved.id;
    }
    await replaceAttendanceMarks(id, after, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: saved === null ? "attendance.take" : "attendance.update",
      entity: "AttendanceDay",
      entityId: id,
      before: { day, ...count(before), constructorsPresent: workforceBefore.constructorsPresent },
      after: {
        day,
        ...count(after),
        constructorsPresent: workforceAfter.constructorsPresent,
        ...changedMarks(before ?? [], after, names),
      },
    });
  });
  return getAttendanceDay(day, actor, now);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}
