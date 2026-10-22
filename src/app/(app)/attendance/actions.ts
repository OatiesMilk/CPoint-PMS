"use server";

import { revalidatePath } from "next/cache";
import { toActionError, type ActionResult } from "@/server/lib/action-result";
import { requirePermission } from "@/server/policies/guard";
import { saveAttendanceDay, type AttendanceView } from "@/server/services/attendance.service";
import {
  attendanceDaySchema,
  saveAttendanceSchema,
} from "@/server/validators/attendance.validator";

/** Save one day's attendance (Floor Manager only, D-079). */
export async function saveAttendanceAction(
  day: string,
  input: unknown,
): Promise<ActionResult<{ view: AttendanceView }>> {
  const user = await requirePermission("attendance:manage");
  try {
    const view = await saveAttendanceDay(
      attendanceDaySchema.parse(day),
      saveAttendanceSchema.parse(input),
      user,
    );
    revalidatePath("/attendance");
    revalidatePath("/floor-manager");
    return { ok: true, view };
  } catch (error) {
    return toActionError(error, "Attendance");
  }
}
