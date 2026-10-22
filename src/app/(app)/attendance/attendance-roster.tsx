"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Lock,
  Minus,
  Search,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MATCHING, TablePager } from "@/components/features/table-pager";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { ROLE_LABELS } from "@/lib/domain";
import { formatManilaDateTime } from "@/lib/format";
import { addDays } from "@/lib/report-rules";
import { usePagedRows } from "@/lib/use-paged-rows";
import type { AttendanceView } from "@/server/services/attendance.service";
import { saveAttendanceAction } from "./actions";

type Person = AttendanceView["roster"][number];
type RoleFilter = "all" | "constructors" | "others";

const LEAVE_PROMPT = "Leave without saving attendance? Your ticks on this day will be lost.";

/** Name and email, for the find box. */
function personText(p: Person): string {
  return `${p.name} ${p.email}`;
}

/**
 * One day's roster (D-077 to D-079). Ticks stay on the page while you search, filter or page, and
 * are saved together; leaving with unsaved ticks asks first.
 */
export function AttendanceRoster({ view }: { view: AttendanceView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const initial = useMemo(() => new Map(view.roster.map((p) => [p.id, p.present])), [view.roster]);
  const [present, setPresent] = useState<Map<string, boolean>>(() => new Map(initial));

  const changes = view.roster.filter((p) => present.get(p.id) !== initial.get(p.id)).length;
  const dirty = changes > 0;
  const canSave = view.editable && dirty;

  const filtered = useMemo(
    () =>
      view.roster.filter((p) =>
        roleFilter === "all"
          ? true
          : roleFilter === "constructors"
            ? p.role === "SHOE_CONSTRUCTOR"
            : p.role !== "SHOE_CONSTRUCTOR",
      ),
    [view.roster, roleFilter],
  );
  const list = usePagedRows(filtered, personText);

  // Ask before closing the tab or following a link with unsaved ticks.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm(LEAVE_PROMPT)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  function goTo(day: string) {
    if (!day || day === view.day) return;
    if (dirty && !window.confirm(LEAVE_PROMPT)) return;
    router.push(day === view.today ? "/attendance" : `/attendance?day=${day}`);
  }

  function toggle(id: string, value: boolean) {
    setPresent((m) => new Map(m).set(id, value));
  }

  function markEveryone() {
    setPresent(new Map(view.roster.map((p) => [p.id, true])));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveAttendanceAction(view.day, {
        expectedUpdatedAt: view.updatedAt,
        marks: view.roster.map((p) => ({ userId: p.id, present: present.get(p.id) ?? false })),
      });
      if (!result.ok) return setError(result.error);
      toast.success(
        `Attendance for ${formatAttendanceDay(view.day)} saved: ${result.view.summary}.`,
      );
      router.refresh();
    });
  }

  const everyonePresent = view.roster.every((p) => present.get(p.id));
  const isToday = view.day === view.today;

  return (
    <section aria-labelledby="day-heading" className="mt-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Button variant="secondary" onClick={() => goTo(addDays(view.day, -1))}>
          <ChevronLeft aria-hidden />
          Previous day
        </Button>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-day">Day</Label>
          <Input
            id="attendance-day"
            type="date"
            className="w-44"
            value={view.day}
            max={view.today}
            onChange={(e) => goTo(e.target.value)}
          />
        </div>
        <Button variant="secondary" disabled={isToday} onClick={() => goTo(addDays(view.day, 1))}>
          Next day
          <ChevronRight aria-hidden />
        </Button>
        {!isToday && (
          <Button variant="ghost" onClick={() => goTo(view.today)}>
            Back to today
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card px-5 py-4">
        <h2 id="day-heading" className="text-xl font-semibold">
          {formatAttendanceDay(view.day)}
          {isToday && <span className="font-normal text-muted-foreground"> · today</span>}
        </h2>
        <p className="mt-1 flex items-center gap-2 text-lg" data-testid="attendance-summary">
          <UsersRound aria-hidden className="size-5 text-muted-foreground" />
          {view.summary}
        </p>
        {view.taken && view.takenBy && view.takenAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            Last saved by {view.takenBy}, {formatManilaDateTime(view.takenAt)}.
          </p>
        )}
        {view.lockedReason && (
          <p className="mt-2 flex items-center gap-2 text-muted-foreground">
            <Lock aria-hidden className="size-4" />
            {view.lockedReason}
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-reject/40 bg-reject-soft px-4 py-3 text-reject"
        >
          {error}
        </p>
      )}

      {view.roster.length === 0 ? (
        <p className="rounded-lg border border-dashed px-5 py-10 text-center text-muted-foreground">
          Nobody had an account on this day. The System Admin adds people under Users.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex w-72 flex-col gap-1.5">
                <Label htmlFor="find-person">Find a person</Label>
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="find-person"
                    type="search"
                    className="pl-9"
                    placeholder="Name or email"
                    value={list.query}
                    onChange={(e) => list.setQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex w-56 flex-col gap-1.5">
                <Label htmlFor="role-filter">Show</Label>
                <Select
                  id="role-filter"
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value as RoleFilter);
                    list.setPage(1);
                  }}
                >
                  <option value="all">Everyone</option>
                  <option value="constructors">Shoe Constructors</option>
                  <option value="others">Other roles</option>
                </Select>
              </div>
            </div>
            {view.editable && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={pending || everyonePresent}
                  onClick={markEveryone}
                >
                  <CircleCheck aria-hidden />
                  Mark everyone present
                </Button>
                <Button disabled={pending || !canSave} onClick={save}>
                  {pending
                    ? "Saving…"
                    : changes > 0
                      ? `Save attendance (${changes} ${changes === 1 ? "change" : "changes"})`
                      : "Save attendance"}
                </Button>
              </div>
            )}
          </div>

          {list.total === 0 ? (
            <p className="rounded-lg border border-dashed px-5 py-10 text-center text-muted-foreground">
              {list.query.trim()
                ? `Nobody matches “${list.query.trim()}”. Check the spelling, or clear the search.`
                : "Nobody with this role is on the list for this day."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Attendance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.shown.map((p) => {
                    const isPresent = present.get(p.id) ?? false;
                    return (
                      <TableRow key={p.id} aria-label={p.name}>
                        <TableCell className="font-medium">
                          {p.name}
                          <span className="block text-sm font-normal text-muted-foreground">
                            {p.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge tone={p.role === "SHOE_CONSTRUCTOR" ? "brand" : "neutral"}>
                            {ROLE_LABELS[p.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {view.editable ? (
                            <label className="inline-flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                className="size-4 accent-(--primary)"
                                checked={isPresent}
                                disabled={pending}
                                onChange={(e) => toggle(p.id, e.target.checked)}
                              />
                              <span className="sr-only">{p.name}: </span>
                              Present
                            </label>
                          ) : !view.taken ? (
                            <span className="text-muted-foreground">Not taken</span>
                          ) : isPresent ? (
                            <Badge tone="success">
                              <CircleCheck aria-hidden />
                              Present
                            </Badge>
                          ) : (
                            <Badge>
                              <Minus aria-hidden />
                              Absent
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePager
                page={list.page}
                pageCount={list.pageCount}
                total={list.total}
                noun={["person", "people"]}
                suffix={list.query.trim() ? MATCHING : ""}
                onPage={list.setPage}
              />
            </>
          )}
        </>
      )}
    </section>
  );
}
