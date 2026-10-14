/*
 * Intent brief (ui-craft §1)
 * Who:   a Shoe Constructor at the office PC, between jobs on the line.
 * What:  ask for materials when they run low, and see where their open requests stand (D-029).
 *        Leather rolls only for constructors the Floor Manager allows (D-031).
 * Worst: showing personal performance numbers. Never (client request, D-008). Only their own
 *        requests appear here.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { RequestStatusBadge, UrgencyBadge } from "@/components/features/procurement/request-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManilaDateTime } from "@/lib/format";
import { requestLabelsFor, summarizeItems } from "@/lib/procurement-rules";
import { requireRole } from "@/server/policies/guard";
import { canRequestLeatherRollsFor } from "@/server/policies/permissions";
import { myOpenRequests } from "@/server/services/procurement.service";

export const metadata: Metadata = { title: "Home" };

export default async function ConstructorHome() {
  const user = await requireRole("SHOE_CONSTRUCTOR");
  await connection();
  const firstName = user.name.split(" ")[0];

  const labels = requestLabelsFor(user.role);
  const open = await myOpenRequests(user.id);
  return (
    <>
      <PageHeader
        title={`Good day, ${firstName}`}
        description={
          canRequestLeatherRollsFor(user)
            ? "Ask for materials, leather rolls included, when they run low. The Floor Manager approves each request."
            : "Ask for materials when they run low. The Floor Manager approves each request. Leather rolls need your Floor Manager’s OK first."
        }
        actions={
          <Button asChild>
            <Link href="/procurement/new">
              <Plus aria-hidden />
              {labels.create}
            </Link>
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>My {labels.many}</CardTitle>
              <CardDescription>
                {open.length === 0
                  ? "Nothing open. Requests you send appear here until they’re received."
                  : "Waiting for a decision, or approved and waiting for the delivery."}
              </CardDescription>
            </div>
            <Link
              href="/procurement?status=all"
              className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
            >
              All my {labels.many}
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
                      {r.partlyApproved ? ` · ${r.partlyApproved}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <UrgencyBadge urgency={r.urgency} daysLeft={r.daysLeft} />
                    <RequestStatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </>
  );
}
