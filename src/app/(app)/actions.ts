"use server";

import { headers } from "next/headers";
import { signOut } from "@/server/lib/auth";
import { getCurrentUser } from "@/server/policies/guard";
import { recordSignOut } from "@/server/services/auth.service";

export async function signOutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    const h = await headers();
    await recordSignOut(user.id, {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    });
  }
  await signOut({ redirectTo: "/login?reason=signed-out" });
}
