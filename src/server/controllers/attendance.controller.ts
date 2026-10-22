import { handle, json, readJsonBody } from "@/server/lib/http";
import { requireApiPermission } from "@/server/policies/guard";
import { getAttendanceDay, saveAttendanceDay } from "@/server/services/attendance.service";
import {
  attendanceDaySchema,
  attendanceQuerySchema,
  saveAttendanceSchema,
} from "@/server/validators/attendance.validator";

type DayContext = { params: Promise<{ day: string }> };

export const attendanceController = {
  /** GET /api/v1/attendance?day=YYYY-MM-DD (default today, Manila) → one day's roster and count */
  show: handle(async (request: Request) => {
    const user = await requireApiPermission("attendance:read");
    const { day } = attendanceQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return json({ data: await getAttendanceDay(day, user) });
  }),

  /** PUT /api/v1/attendance/{day}  { expectedUpdatedAt, marks: [{ userId, present }] } */
  save: handle(async (request: Request, ctx: DayContext) => {
    const user = await requireApiPermission("attendance:manage");
    const day = attendanceDaySchema.parse((await ctx.params).day);
    const input = saveAttendanceSchema.parse(await readJsonBody(request));
    return json({ data: await saveAttendanceDay(day, input, user) });
  }),
};
