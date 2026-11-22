import { repairController } from "@/server/controllers/repair.controller";

export const POST = repairController.inspect;
export const PATCH = repairController.correctInspection;
