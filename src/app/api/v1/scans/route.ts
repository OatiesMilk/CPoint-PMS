import { scanController } from "@/server/controllers/scan.controller";

export const GET = scanController.index;
export const POST = scanController.ingest;
