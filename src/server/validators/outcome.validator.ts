import { z } from "zod";
import { ReworkStatus, SalvageStatus } from "@/lib/domain";

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().trim().max(max, `Keep it under ${max} characters.`).optional(),
  );

export const reworkMoveSchema = z.object({
  move: z.enum(["start", "done", "reopen", "unstart"]),
  expectedStatus: z.enum(ReworkStatus),
  note: optionalText(300),
});

export const salvageAssignSchema = z.object({
  batchId: z.uuid("Choose the batch that will use this section."),
  expectedStatus: z.enum(SalvageStatus),
  note: optionalText(300),
});

export const salvageUnassignSchema = z.object({ expectedStatus: z.enum(SalvageStatus) });

export const salvageDiscardSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Say why this section is discarded (at least 3 characters).")
    .max(300),
  expectedStatus: z.enum(SalvageStatus),
});

export const salvageListQuerySchema = z.object({
  status: z.enum(["AVAILABLE", "ASSIGNED", "DISCARDED"]).catch("AVAILABLE").default("AVAILABLE"),
  batch: z.string().trim().max(30).optional().catch(undefined),
});

export const reworkListQuerySchema = z.object({
  batch: z.string().trim().max(30).optional().catch(undefined),
});

export const isOutcomeId = (value: string) => z.uuid().safeParse(value).success;
