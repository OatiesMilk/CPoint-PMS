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
