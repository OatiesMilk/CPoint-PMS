/**
 * Attendance rules (Phase 22, D-077 to D-080). Pure: no database, no clock of their own.
 *
 * Attendance is a log book of who came in on a day, never a score (D-008): nothing here counts a
 * person's absences across days, and every number is for the whole line on one day.
 */
import type { Role } from "@/generated/prisma/enums";
import { addDays } from "./report-rules";

/** Today and this many days before it can be edited (D-079). */
export const EDITABLE_DAYS_BACK = 7;

export type RosterCandidate = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
};

export type RosterPerson = { id: string; name: string; email: string; role: Role };

export type Mark = { userId: string; present: boolean };

export type Workforce =
  | { taken: false; constructorsPresent: null; constructorsOnRoster: number; othersPresent: null }
  | {
      taken: true;
      constructorsPresent: number;
      constructorsOnRoster: number;
      othersPresent: number;
    };

/** Shoe Constructors first (they are the workers), then the office roles, then by name. */
const ROLE_ORDER: Record<Role, number> = {
  SHOE_CONSTRUCTOR: 0,
  FLOOR_MANAGER: 1,
  QUALITY_INSPECTOR: 2,
  SYSTEM_ADMIN: 3,
};

/** The UTC instant a Manila calendar day ends (the next day's start). */
function manilaDayEnd(day: string): Date {
  return new Date(`${addDays(day, 1)}T00:00:00+08:00`);
}

/**
 * Who is on the roster for a day (D-078): every active user created by the end of that Manila day,
 * plus anyone already marked on it, so deactivating a person later never rewrites a past day.
 */
export function rosterFor(
  users: RosterCandidate[],
  day: string,
  markedUserIds: ReadonlySet<string> = new Set(),
): RosterPerson[] {
  const end = manilaDayEnd(day).getTime();
  return users
    .filter((u) => markedUserIds.has(u.id) || (u.isActive && u.createdAt.getTime() < end))
    .map(({ id, name, email, role }) => ({ id, name, email, role }))
    .sort(
      (a, b) =>
        ROLE_ORDER[a.role] - ROLE_ORDER[b.role] ||
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
}

export type Editable = { ok: true } | { ok: false; reason: string };

/** Today and the 7 days before it; never the future (D-079). Days are Manila YYYY-MM-DD. */
export function editableDay(day: string, today: string): Editable {
  if (day > today) return { ok: false, reason: "Attendance can't be taken for a future day." };
  if (day < addDays(today, -EDITABLE_DAYS_BACK))
    return { ok: false, reason: `Days more than ${EDITABLE_DAYS_BACK} days ago are locked.` };
  return { ok: true };
}

/**
 * The worker count for a day (D-080), and the only one in the system. Only Shoe Constructors count
 * as workers; the other roles are on the roster and ticked, but counted apart. `marks` is null
 * when the day was never saved: then the count is "not taken", never 0.
 */
export function workforceFor(roster: RosterPerson[], marks: Mark[] | null): Workforce {
  const constructors = roster.filter((p) => p.role === "SHOE_CONSTRUCTOR");
  if (marks === null)
    return {
      taken: false,
      constructorsPresent: null,
      constructorsOnRoster: constructors.length,
      othersPresent: null,
    };
  const present = new Set(marks.filter((m) => m.present).map((m) => m.userId));
  return {
    taken: true,
    constructorsPresent: constructors.filter((p) => present.has(p.id)).length,
    constructorsOnRoster: constructors.length,
    othersPresent: roster.filter((p) => p.role !== "SHOE_CONSTRUCTOR" && present.has(p.id)).length,
  };
}

/** "Tue, 21 Oct" for a YYYY-MM-DD calendar day (no time zone shift). */
export function formatAttendanceDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const part = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...o }).format(date);
  return `${part({ weekday: "short" })}, ${part({ day: "numeric" })} ${part({ month: "short" })}`;
}

/** "21 Oct", for messages that name a day. */
export function formatShortDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** The day's one-line summary, shared by the page and the Floor Manager's home card. */
export function attendanceSummary(workforce: Workforce, day: string): string {
  if (!workforce.taken) return `Attendance for ${formatAttendanceDay(day)} hasn't been taken yet.`;
  const constructors = `${workforce.constructorsPresent} of ${workforce.constructorsOnRoster} Shoe ${
    workforce.constructorsOnRoster === 1 ? "Constructor" : "Constructors"
  } present`;
  return `${constructors} · ${workforce.othersPresent} ${
    workforce.othersPresent === 1 ? "other" : "others"
  } present`;
}

/**
 * Who changed between two saves of a day, by name, for the audit row. A person new to the roster
 * counts as a change only when marked present (absent is the starting state).
 */
export function changedMarks(
  before: Mark[],
  after: Mark[],
  names: ReadonlyMap<string, string>,
): { nowPresent: string[]; nowAbsent: string[] } {
  const was = new Map(before.map((m) => [m.userId, m.present]));
  const nowPresent: string[] = [];
  const nowAbsent: string[] = [];
  for (const m of after) {
    const previous = was.get(m.userId) ?? false;
    if (m.present === previous) continue;
    (m.present ? nowPresent : nowAbsent).push(names.get(m.userId) ?? m.userId);
  }
  return { nowPresent: nowPresent.sort(), nowAbsent: nowAbsent.sort() };
}

/**
 * Whether any Quality Inspector is marked present on a day (D-088), or null when attendance wasn't
 * taken. It decides whether the Floor Manager may cover the check-ins; it is a yes or no for the
 * role, never a count or a name.
 */
export function qualityInspectorPresent(
  roster: RosterPerson[],
  marks: Mark[] | null,
): boolean | null {
  if (marks === null) return null;
  const present = new Set(marks.filter((m) => m.present).map((m) => m.userId));
  return roster.some((p) => p.role === "QUALITY_INSPECTOR" && present.has(p.id));
}
