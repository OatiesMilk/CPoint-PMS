import { z } from "zod";
import { ReworkStatus, SalvageStatus } from "@/lib/domain";
import { optionalText, OUT_OF_DATE } from "./shared";

export const reworkMoveSchema = z.object({
  move: z.enum(["start", "done", "reopen", "unstart"], { error: OUT_OF_DATE }),
  expectedStatus: z.enum(ReworkStatus, { error: OUT_OF_DATE }),
  note: optionalText(300, "note"),
});

export const salvageAssignSchema = z.object({
  batchId: z.uuid("Choose the batch that will use this section."),
  expectedStatus: z.enum(SalvageStatus, { error: OUT_OF_DATE }),
  note: optionalText(300, "note"),
});

export const salvageUnassignSchema = z.object({
  expectedStatus: z.enum(SalvageStatus, { error: OUT_OF_DATE }),
});

export const salvageDiscardSchema = z.object({
  reason: z
    .string({ error: "Enter a reason for discarding this section, e.g. “Too small to cut.”" })
    .trim()
    .min(3, "Enter a reason of at least 3 characters for discarding this section.")
    .max(300, "Keep the reason under 300 characters."),
  expectedStatus: z.enum(SalvageStatus, { error: OUT_OF_DATE }),
});

export const salvageListQuerySchema = z.object({
  status: z.enum(["AVAILABLE", "ASSIGNED", "DISCARDED"]).catch("AVAILABLE").default("AVAILABLE"),
  batch: z.string().trim().max(30).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export const reworkListQuerySchema = z.object({
  batch: z.string().trim().max(30).optional().catch(undefined),
});

export const isOutcomeId = (value: string) => z.uuid().safeParse(value).success;
