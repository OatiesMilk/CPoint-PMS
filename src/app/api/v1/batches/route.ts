import { batchController } from "@/server/controllers/batch.controller";

export const GET = batchController.index;
export const POST = batchController.create;
