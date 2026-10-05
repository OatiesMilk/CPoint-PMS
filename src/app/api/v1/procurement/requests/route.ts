import { procurementController } from "@/server/controllers/procurement.controller";

export const GET = procurementController.index;
export const POST = procurementController.create;
