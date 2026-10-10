import { z } from "zod";

export const createTokenSchema = z.object({
  name: z
    .string({ error: "Enter a name for the device, e.g. “Preparation phone camera”." })
    .trim()
    .min(3, "Enter a device name of at least 3 characters, e.g. “Preparation phone camera”.")
    .max(60, "Keep the device name under 60 characters."),
});
