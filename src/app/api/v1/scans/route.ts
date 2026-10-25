import { scanController } from "@/server/controllers/scan.controller";

// Camera ingestion only (device token). There is no Scans list since Phase 28 (A-26, D-100).
export const POST = scanController.ingest;
