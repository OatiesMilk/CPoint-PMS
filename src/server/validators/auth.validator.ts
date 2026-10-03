import { z } from "zod";

// Shared by the login form (client-side validation) and the credentials provider.
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email.")
    .email("Enter a valid email, like name@cpoint.local."),
  password: z.string().min(1, "Enter your password."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const PASSWORD_MIN = 10;

/** A password someone chooses (own change). Long beats complex: no character-class rules. */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters. A short phrase works well.`)
  .max(128, "Keep it under 128 characters.");

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current (or temporary) password."),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "Type the new password again."),
  })
  .superRefine((v, ctx) => {
    if (v.confirmPassword && v.newPassword !== v.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "This doesn't match the new password.",
      });
    }
    if (v.currentPassword && v.newPassword === v.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Choose a password different from the current one.",
      });
    }
  });

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
