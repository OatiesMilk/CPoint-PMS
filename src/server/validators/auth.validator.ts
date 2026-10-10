import { z } from "zod";

// Shared by the login form (client-side validation) and the credentials provider.
export const loginSchema = z.object({
  email: z
    .string({ error: "Enter your email." })
    .trim()
    .min(1, "Enter your email.")
    .email("Enter your email in full, like name@cpoint.local."),
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const PASSWORD_MIN = 10;

/** A password someone chooses (own change). Long beats complex: no character-class rules. */
export const newPasswordSchema = z
  .string({ error: `Enter a new password of at least ${PASSWORD_MIN} characters.` })
  .min(
    PASSWORD_MIN,
    `The new password needs at least ${PASSWORD_MIN} characters. A short phrase works well.`,
  )
  .max(128, "Keep the new password under 128 characters.");

export const passwordChangeSchema = z
  .object({
    currentPassword: z
      .string({ error: "Enter your current (or temporary) password." })
      .min(1, "Enter your current (or temporary) password."),
    newPassword: newPasswordSchema,
    confirmPassword: z
      .string({ error: "Type the new password again to confirm it." })
      .min(1, "Type the new password again to confirm it."),
  })
  .superRefine((v, ctx) => {
    if (v.confirmPassword && v.newPassword !== v.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two new passwords don't match. Type the same password in both boxes.",
      });
    }
    if (v.currentPassword && v.newPassword === v.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "The new password is the same as the current one. Choose a different password.",
      });
    }
  });

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
