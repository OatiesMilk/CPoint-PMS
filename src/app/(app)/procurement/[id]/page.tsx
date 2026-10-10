/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager deciding a request; the Shoe Constructor who sent it, following it up;
 *        the System Admin reading it.
 * What:  see what's asked for and by when, with the stock then and now, decide it, and talk it
 *        over in the remarks (the requester's reason, if any, is the first remark, D-036).
 * Worst: approving something already on the shelf, or the requester never learning why it was
 *        rejected. Stock at request time sits next to current stock; a rejection needs a reason
 *        and shows on the request and its timeline.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, Info, PackageX } from "lucide-react";
import { RequestStatusBadge, UrgencyBadge } from "@/components/features/procurement/request-badges";
import { StockBadge } from "@/components/features/inventory/stock-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCalendarDate, formatManilaDateTime } from "@/lib/format";
import { formatQuantity, stockLevel } from "@/lib/inventory-rules";
import { requestLabelsFor, STATUS_LABELS } from "@/lib/procurement-rules";
import { getCurrentUser, requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getRequest } from "@/server/services/procurement.service";
import { isRequestId } from "@/server/validators/procurement.validator";
import { RemarkForm } from "./remark-form";
import { RequestActions } from "./request-actions";

/** "Material request" for a Shoe Constructor, "Purchase request" for everyone else (D-035). */
export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  return { title: user ? requestLabelsFor(user.role).detail : "Request" };
}

export default async function RequestDetailPage({ params }: PageProps<"/procurement/[id]">) {
  const user = await requirePermission("procurement:read");
  const { id } = await params;
  if (!isRequestId(id)) notFound();
  const request = await getRequest(id, user);
  if (!request) notFound();

  const seesInventory = can(user.role, "inventory:read");
  const received = request.status === "RECEIVED";
  const stocked = request.lines
    .filter((l) => l.item)
    .map((l) => `${l.itemName}: +${formatQuantity(l.quantity, l.unit)}`);
  const notStocked = request.lines
    .filter((l) => !l.item)
    .map((l) => `${l.itemName}: ${formatQuantity(l.quantity, l.unit)}`);

  return (
    <>
      <div className="flex flex-col gap-3 border-b pb-5">
        <Link
          href="/procurement"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {user.role === "SHOE_CONSTRUCTOR" ? "All my material requests" : "All requests"}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-3xl font-semibold tracking-tight">{request.code}</h1>
          <RequestStatusBadge status={request.status} />
          {request.urgency && (
            <UrgencyBadge urgency={request.urgency} daysLeft={request.daysLeft} />
          )}
        </div>
        <p className="text-lg text-muted-foreground">
          Requested by {request.requestedBy.name} · sent {formatManilaDateTime(request.createdAt)} ·
          needed by {formatCalendarDate(request.neededBy)}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Badges sit under the item name, so the table fits at 1280 px (DESIGN.md → Don't). */}
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Item</TableHead>
                    <TableHead numeric>Quantity</TableHead>
                    <TableHead numeric>Stock when asked</TableHead>
                    <TableHead numeric>Stock now</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.lines.map((line) => (
                    <TableRow key={line.id} aria-label={line.itemName}>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1 py-1">
                          {line.item && seesInventory ? (
                            <Link
                              href={`/inventory/${line.item.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {line.itemName}
                            </Link>
                          ) : (
                            <span className="font-medium">{line.itemName}</span>
                          )}
                          {line.note && (
                            <span className="text-sm text-muted-foreground">{line.note}</span>
                          )}
                          {!line.item ? (
                            <Badge>
                              <PackageX aria-hidden />
                              Not in inventory
                            </Badge>
                          ) : received && line.movementId ? (
                            <Badge tone="success">
                              <CircleCheck aria-hidden />
                              Added to stock on receipt
                            </Badge>
                          ) : (
                            <StockBadge
                              level={stockLevel(line.item.quantityOnHand, line.item.reorderLevel)}
                              inactive={!line.item.isActive}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell numeric>{formatQuantity(line.quantity, line.unit)}</TableCell>
                      <TableCell numeric className="text-muted-foreground">
                        {line.onHandAtRequest === null ? (
                          "—"
                        ) : (
                          <span className="flex flex-col items-end">
                            {formatQuantity(line.onHandAtRequest, line.unit)}
                            <span className="text-sm">
                              reorder at {formatQuantity(line.reorderLevelAtRequest ?? 0)}
                            </span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell numeric>
                        {line.item ? formatQuantity(line.item.quantityOnHand, line.item.unit) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {received && notStocked.length > 0 && (
                <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Items not in inventory weren’t added to stock. Add them under Inventory, then
                  record the delivery there.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Remarks</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {request.remarks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No remarks yet.</p>
              ) : (
                <ol className="flex flex-col divide-y">
                  {request.remarks.map((r) => (
                    <li key={r.id} className="flex flex-col gap-1 py-3 first:pt-0">
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{r.author.name}</span> ·{" "}
                        {formatManilaDateTime(r.createdAt)}
                      </p>
                      <p className="whitespace-pre-line">{r.body}</p>
                    </li>
                  ))}
                </ol>
              )}
              {request.canRemark && <RemarkForm id={request.id} />}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Status</dt>
                <dd>{STATUS_LABELS[request.status]}</dd>
                {request.decidedBy && request.decidedAt && (
                  <>
                    <dt className="text-muted-foreground">
                      {request.status === "REJECTED" ? "Rejected by" : "Approved by"}
                    </dt>
                    <dd>
                      {request.decidedBy.name}, {formatManilaDateTime(request.decidedAt)}
                    </dd>
                  </>
                )}
                {request.rejectionReason && (
                  <>
                    <dt className="text-muted-foreground">Reason</dt>
                    <dd>{request.rejectionReason}</dd>
                  </>
                )}
                {request.approvalNote && (
                  <>
                    <dt className="text-muted-foreground">Note</dt>
                    <dd>{request.approvalNote}</dd>
                  </>
                )}
                {request.receivedAt && (
                  <>
                    <dt className="text-muted-foreground">Received</dt>
                    <dd>{formatManilaDateTime(request.receivedAt)}</dd>
                  </>
                )}
              </dl>
              <RequestActions
                id={request.id}
                code={request.code}
                actions={request.actions}
                stocked={stocked}
                notStocked={notStocked}
              />
              {request.actions.length === 0 && request.status === "PENDING" && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Waiting for the Floor Manager to approve or reject it.
                </p>
              )}
              {request.actions.length === 0 && request.status === "APPROVED" && (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                  Approved. The Floor Manager marks it received when the delivery arrives.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {request.events.map((e) => (
                  <li key={e.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <RequestStatusBadge status={e.toStatus} />
                      <span className="text-sm text-muted-foreground">
                        {e.fromStatus === null ? "Sent" : ""} by {e.actor.name}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatManilaDateTime(e.createdAt)}
                    </p>
                    {e.note && <p className="text-sm">{e.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
