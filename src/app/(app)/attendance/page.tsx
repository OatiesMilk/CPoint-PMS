/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the office desk at the start of the shift (the Admin can look).
 * What:  tick who came in today, or fix a day in the past week, then save.
 * Worst: a person singled out (a history, count or streak of their absences), or a day's worker
 *        count silently wrong. So the page shows one day only, and never a per-person figure
 *        (D-008, D-077).
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/features/page-header";
import { requirePermission } from "@/server/policies/guard";
import { getAttendanceDay } from "@/server/services/attendance.service";
import { attendanceQuerySchema } from "@/server/validators/attendance.validator";
import { AttendanceRoster } from "./attendance-roster";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  const user = await requirePermission("attendance:read");
  await connection();
  const query = attendanceQuerySchema.safeParse(await searchParams);
  const view = await getAttendanceDay(query.success ? query.data.day : undefined, user);
  return (
    <>
      <PageHeader
        title="Attendance"
        description="Who came in today. Only Shoe Constructors count toward the line's worker count."
      />
      {!query.success && (
        <p role="alert" className="mt-4 text-reject">
          That link’s date isn’t a real day, so today is shown instead.
        </p>
      )}
      <AttendanceRoster key={`${view.day}-${view.updatedAt ?? "new"}`} view={view} />
    </>
  );
}
