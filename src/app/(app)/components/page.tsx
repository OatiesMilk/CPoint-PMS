/*
 * Intent brief (ui-craft §1)
 * Who:   anyone curious about component tracking (the Floor Manager asked for it, survey Q20).
 * What:  know it's planned, and what's already set up for it.
 * Worst: promising a date or a workflow that hasn't been agreed with CPoint. It says neither.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { Layers } from "lucide-react";
import { requireUser } from "@/server/policies/guard";
import { listReferenceRows } from "@/server/services/settings.service";

export const metadata: Metadata = { title: "Component tracking" };

export default async function ComponentsComingSoon() {
  await requireUser();
  await connection();
  const components = (await listReferenceRows("componentType")).filter((c) => c.isActive);
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-lg bg-brand-yellow text-brand-ink">
        <Layers aria-hidden className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold">Component tracking is coming soon</h1>
      <p className="max-w-lg text-muted-foreground">
        The plan is to follow each shoe’s parts through Upper Making. How many components each shoe
        type has is still being confirmed with CPoint, so the workflow isn’t built yet.
      </p>
      <div className="mt-2 text-sm">
        {components.length === 0 ? (
          <p className="text-muted-foreground">No components are listed yet.</p>
        ) : (
          <p>
            <span className="text-muted-foreground">Listed so far: </span>
            {components.map((c) => String(c.name)).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
