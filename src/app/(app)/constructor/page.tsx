/*
 * Intent brief (ui-craft §1)
 * Who:   a Shoe Constructor at the office PC, between jobs on the line.
 * What:  ask for materials when they run low, and see where their open requests stand (D-029).
 *        Constructors who aren't designated requesters learn how to become one.
 * Worst: showing personal performance numbers. Never (client request, D-008). Only their own
 *        requests appear here.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Hammer, Plus } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { RequestStatusBadge } from "@/components/features/procurement/request-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManilaDateTime } from "@/lib/format";
import { summarizeItems } from "@/lib/procurement-rules";
import { requireRole } from "@/server/policies/guard";
import { canSubmitPurchaseRequest } from "@/server/policies/permissions";
import { myOpenRequests } from "@/server/services/procurement.service";

export const metadata: Metadata = { title: "Home" };

export default async function ConstructorHome() {
  const user = await requireRole("SHOE_CONSTRUCTOR");
  await connection();
  const firstName = user.name.split(" ")[0];

  if (!canSubmitPurchaseRequest(user)) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <span className="flex size-12 items-center justify-center rounded-lg bg-brand-yellow text-brand-ink">
          <Hammer aria-hidden className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold">Hi {firstName}, you’re signed in</h1>
        <p className="max-w-md text-muted-foreground">
          When materials run low, designated constructors send purchase requests from here. Ask your
          Floor Manager to let you request materials.
        </p>
        <Button asChild variant="secondary">
          <Link href="/procurement">See Procurement</Link>
        </Button>
      </div>
    );
  }

  const open = await myOpenRequests(user.id);
  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description="Ask for materials when they run low. The Floor Manager approves each request."
        actions={
          <Button asChild>
            <Link href="/procurement/new">
              <Plus aria-hidden />
              New request
            </Link>
          </Button>
        }
      />
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>My open requests</CardTitle>
              <CardDescription>
                {open.length === 0
                  ? "Nothing waiting. Requests you send appear here until they’re received."
                  : "Waiting for a decision, or approved and waiting for the delivery."}
              </CardDescription>
            </div>
            <Link
              href="/procurement?status=all"
              className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              All my requests
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
        </CardHeader>
        {open.length > 0 && (
          <CardContent>
            <ul className="flex flex-col divide-y">
              {open.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <div className="min-w-0">
                    <Link
                      href={`/procurement/${r.id}`}
                      className="font-mono font-medium underline-offset-4 hover:underline"
                    >
                      {r.code}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {summarizeItems(r.lines)} · sent {formatManilaDateTime(r.createdAt)}
                    </p>
                  </div>
                  <RequestStatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </>
  );
}
