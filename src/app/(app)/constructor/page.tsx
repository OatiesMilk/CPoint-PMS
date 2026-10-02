/*
 * Intent brief (ui-craft §1)
 * Who:   a Shoe Constructor. Their view hasn't been defined with CPoint yet (docs/STATUS.md).
 * What:  confirm they're signed in, and be honest that there's nothing to do here yet.
 * Worst: showing personal performance numbers. Never (client request, D-008).
 */
import type { Metadata } from "next";
import { Hammer } from "lucide-react";
import { requireRole } from "@/server/policies/guard";

export const metadata: Metadata = { title: "Home" };

export default async function ConstructorHome() {
  const user = await requireRole("SHOE_CONSTRUCTOR");
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <span className="flex size-12 items-center justify-center rounded-lg bg-brand-yellow text-brand-ink">
        <Hammer aria-hidden className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold">Your tasks are coming soon</h1>
      <p className="max-w-md text-muted-foreground">
        Hi {user.name.split(" ")[0]}, you’re signed in. What you’ll see here is still being planned
        with CPoint. Nothing needs doing on this page for now.
      </p>
    </div>
  );
}
