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
