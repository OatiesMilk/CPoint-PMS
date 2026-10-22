import { z } from "zod";
import { OUT_OF_DATE } from "./shared";

/** "Pick a real date" for anything that isn't a real YYYY-MM-DD calendar day. */
export const DAY_MESSAGE = "Pick a real date, like 2026-10-21.";

function isRealDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const attendanceDaySchema = z
  .string({ error: DAY_MESSAGE })
  .trim()
  .refine(isRealDay, DAY_MESSAGE);

/** `?day=` on the page and the API; blank means today. */
export const attendanceQuerySchema = z.object({ day: attendanceDaySchema.optional() });

/**
 * One save of a day (D-079). `expectedUpdatedAt` is the `updatedAt` the Floor Manager saw, or null
 * when the day hadn't been saved yet. Whether each person is on that day's roster needs the
 * database, so the service checks it.
 */
export const saveAttendanceSchema = z
  .object({
    expectedUpdatedAt: z.iso.datetime({ error: OUT_OF_DATE }).nullable(),
    marks: z
      .array(
        z.object({
          userId: z.uuid({ error: OUT_OF_DATE }),
          present: z.boolean({ error: "Tick Present or leave it empty for each person." }),
        }),
        { error: OUT_OF_DATE },
      )
      .min(1, "There's nobody on the list to save. Refresh the page."),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const [index, mark] of value.marks.entries()) {
      if (seen.has(mark.userId))
        ctx.addIssue({
          code: "custom",
          path: ["marks", index, "userId"],
          message: "The same person is in the list twice. Refresh the page and save again.",
        });
      seen.add(mark.userId);
    }
  });

export type SaveAttendanceInput = z.infer<typeof saveAttendanceSchema>;
