"use server";

import { headers } from "next/headers";
import { auth, signOut } from "@/server/lib/auth";
import { recordSignOut } from "@/server/services/auth.service";

export async function signOutAction(): Promise<void> {
  // The raw session, not the guard: even an already-ended session gets its sid revoked.
  const user = (await auth())?.user;
  if (user?.id) {
    const h = await headers();
    await recordSignOut(
      user.id,
      {
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent"),
      },
      user.sid,
    );
  }
  await signOut({ redirectTo: "/login?reason=signed-out" });
}
