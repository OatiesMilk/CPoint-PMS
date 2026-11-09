import { z } from "zod";

/** POST /api/v1/demo/sign-in: which demo account (D-101). */
export const demoSignInSchema = z.object({
  role: z.enum(["FLOOR_MANAGER", "QUALITY_INSPECTOR", "SYSTEM_ADMIN", "SHOE_CONSTRUCTOR"], {
    error: "Choose one of the four demo accounts.",
  }),
});

/** POST /api/v1/demo/reset: the word typed in the dialog. */
export const demoResetSchema = z.object({
  confirm: z.literal("RESET", { error: "Type RESET in capitals to reset the demo data." }),
});

/**
 * POST /api/v1/demo/clock (D-125): the Manila date and time to set the demo clock to, or
 * `{ realTime: true }` to go back to the real time.
 */
export const demoClockSchema = z.union([
  z.object({ realTime: z.literal(true) }),
  z.object({
    date: z.iso.date({ error: "Enter the date as YYYY-MM-DD, for example 2026-11-13." }),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Enter the time as HH:MM, for example 15:00." }),
  }),
]);
export type DemoClockInput = z.infer<typeof demoClockSchema>;
