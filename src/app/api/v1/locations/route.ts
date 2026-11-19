import { locationController } from "@/server/controllers/location.controller";

export const GET = locationController.index;
export const POST = locationController.create;
