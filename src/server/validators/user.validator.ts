import { z } from "zod";
import { Role } from "@/lib/domain";

/** Create/edit account form, shared by the dialog (client) and the API. */
export const userFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter the person's name as colleagues know it.")
    .max(80, "Keep the name under 80 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter an email to sign in with.")
    .email("Enter a valid email, like name@cpoint.local.")
    .max(120, "Keep the email under 120 characters."),
  role: z.enum(Role, { error: "Choose a role." }),
});

export type UserFormInput = z.input<typeof userFormSchema>;
export type UserFormValues = z.output<typeof userFormSchema>;

export const userActiveSchema = z.object({ isActive: z.boolean() });

export const userListQuerySchema = z.object({
  role: z.enum(Role).optional().catch(undefined),
  status: z.enum(["active", "deactivated", "locked"]).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;

export function isUserId(value: string): boolean {
  return z.uuid().safeParse(value).success;
}
