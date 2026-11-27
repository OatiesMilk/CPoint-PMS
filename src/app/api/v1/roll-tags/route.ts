import { rollTagController } from "@/server/controllers/roll-tag.controller";

export const GET = rollTagController.index;
export const POST = rollTagController.create;
