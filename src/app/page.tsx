import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/domain";
import { requireUser } from "@/server/policies/guard";

// "/" has no content of its own: send each user to their role's home.
export default async function Root() {
  const user = await requireUser();
  redirect(ROLE_HOME[user.role]);
}
