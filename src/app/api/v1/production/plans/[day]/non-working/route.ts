import { productionController } from "@/server/controllers/production.controller";

export const PUT = productionController.markNonWorking;
export const DELETE = productionController.clearNonWorking;
