import { userController } from "@/server/controllers/user.controller";

export const GET = userController.index;
export const POST = userController.create;
