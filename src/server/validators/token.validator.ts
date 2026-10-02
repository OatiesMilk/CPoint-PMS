import { z } from "zod";

export const createTokenSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Name the device, e.g. “Preparation phone camera”.")
    .max(60, "Keep the name under 60 characters."),
});
