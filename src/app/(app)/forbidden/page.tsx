import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_HOME, ROLE_LABELS } from "@/lib/domain";
import { requireUser } from "@/server/policies/guard";

export const metadata: Metadata = { title: "No access" };

// 403: signed in, but this role can't open the page. (401 → /login, 404 → not-found.tsx.)
export default async function Forbidden() {
  const user = await requireUser();
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <ShieldX aria-hidden className="size-7 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium text-muted-foreground">Error 403</p>
      <h1 className="text-2xl font-semibold tracking-tight">You don’t have access to that page</h1>
      <p className="max-w-md text-muted-foreground">
        Your role ({ROLE_LABELS[user.role]}) can’t open it.
        {user.role === "SYSTEM_ADMIN"
          ? " It belongs to another role’s workspace."
          : " If you need it for your work, ask a System Admin."}
      </p>
      <Button asChild className="mt-2">
        <Link href={ROLE_HOME[user.role]}>Go to your overview</Link>
      </Button>
    </div>
  );
}
