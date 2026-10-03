import { settingsController } from "@/server/controllers/settings.controller";

export const GET = settingsController.getThresholds;
export const PUT = settingsController.putThresholds;
