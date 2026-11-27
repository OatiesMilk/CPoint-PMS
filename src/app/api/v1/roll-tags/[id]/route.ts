import { rollTagController } from "@/server/controllers/roll-tag.controller";

export const GET = rollTagController.show;
export const PATCH = rollTagController.update;
export const DELETE = rollTagController.remove;
