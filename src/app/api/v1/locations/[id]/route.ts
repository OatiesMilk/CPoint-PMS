import { locationController } from "@/server/controllers/location.controller";

export const GET = locationController.show;
export const PATCH = locationController.update;
