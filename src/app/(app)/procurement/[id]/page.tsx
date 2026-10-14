/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager deciding, ordering and receiving a request; the Shoe Constructor who
 *        sent it, following it up; the System Admin reading it.
 * What:  see what's asked for and by when, with the stock then and now, decide each item
 *        (D-039), then follow it to the shelf: who it was ordered from and when it's due (D-041),
 *        what has arrived and the proof for each delivery (D-042).
 * Worst: approving something already on the shelf; the requester never learning why an item was
 *        rejected or an order cancelled; stock counted for goods that never came. Stock at request
 *        time sits next to current stock; every rejection, cancellation and short close needs a
 *        reason that shows here; a delivery can't be saved without proof, and only what actually
 *        arrived goes into stock.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, CircleCheck, CircleX, Info, PackageX } from "lucide-react";
import {
  ClosedShortBadge,
  LateBadge,
  RaisedByFloorManagerBadge,
  RequestStatusBadge,
  UrgencyBadge,
} from "@/components/features/procurement/request-badges";
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
import { formatCalendarDate, formatManilaDateTime, manilaToday } from "@/lib/format";
import { formatQuantity, stockLevel } from "@/lib/inventory-rules";
import { requestLabelsFor, shortfallNote, STATUS_LABELS } from "@/lib/procurement-rules";
import { getCurrentUser, requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getRequest, orderSuppliers } from "@/server/services/procurement.service";
import { isRequestId } from "@/server/validators/procurement.validator";
import { LineDecisions } from "./line-decisions";
import { AddProof, ProofFiles } from "./proof-files";
import { RemarkForm } from "./remark-form";
import { CopyRequestLink, RequestActions } from "./request-actions";

/** "Material request" for a Shoe Constructor, "Purchase request" for everyone else (D-035). */
export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  return { title: user ? requestLabelsFor(user.role).detail : "Request" };
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

export default async function RequestDetailPage({ params }: PageProps<"/procurement/[id]">) {
  const user = await requirePermission("procurement:read");
  const { id } = await params;
  if (!isRequestId(id)) notFound();
  const request = await getRequest(id, user);
  if (!request) notFound();

  const seesInventory = can(user.role, "inventory:read");
  const deciding = request.actions.includes("approve");
  const suppliers = request.actions.includes("order") ? await orderSuppliers() : [];
  const decided = request.decided;
  const mixed = !!decided && decided.approved > 0 && decided.rejected > 0;
  const { status } = request;
  // Once it's ordered, the table also says how much of each item has arrived.
  const tracking = status === "ORDERED" || status === "PARTIALLY_RECEIVED" || status === "RECEIVED";
  const approved = request.lines.filter((l) => l.decision === "APPROVED");
  const shortfall = shortfallNote(approved);
  const typedArrived = approved.some((l) => !l.item && l.receivedQuantity > 0);
  const waiting = request.actions.length === 0 && !request.cancelBlocked;
  const proofShown = new Set<string>();

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
          <RequestStatusBadge status={status} />
          {request.closedShortAt && <ClosedShortBadge />}
          {request.late && <LateBadge />}
          {request.urgency && (
            <UrgencyBadge urgency={request.urgency} daysLeft={request.daysLeft} />
          )}
          {request.raisedByFloorManager && <RaisedByFloorManagerBadge />}
        </div>
        <p className="text-lg text-muted-foreground">
          Requested by {request.requestedBy.name} · sent {formatManilaDateTime(request.createdAt)} ·
          needed by {formatCalendarDate(request.neededBy)}
          {request.copiedFrom && (
            <>
              {" "}
              · copied from{" "}
              <Link
                href={`/procurement/${request.copiedFrom.id}`}
                className="font-mono text-foreground underline underline-offset-4"
              >
                {request.copiedFrom.code}
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              {deciding ? (
                <LineDecisions
                  id={request.id}
                  code={request.code}
                  seesInventory={seesInventory}
                  lines={request.lines.map((l) => ({
                    id: l.id,
                    itemName: l.itemName,
                    quantity: l.quantity,
                    unit: l.unit,
                    note: l.note,
                    onHandAtRequest: l.onHandAtRequest,
                    item: l.item && {
                      id: l.item.id,
                      unit: l.item.unit,
                      quantityOnHand: l.item.quantityOnHand,
                      reorderLevel: l.item.reorderLevel,
                      isActive: l.item.isActive,
                    },
                    wellStocked: l.wellStocked,
                    suggestedDecision: l.suggestedDecision,
                    suggestedReason: l.suggestedReason,
                  }))}
                />
              ) : (
                <>
                  {/* Badges sit under the item name, so the table fits at 1280 px (DESIGN.md → Don't). */}
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Item</TableHead>
                        <TableHead numeric>Quantity</TableHead>
                        {tracking ? (
                          <TableHead numeric>Arrived</TableHead>
                        ) : (
                          <TableHead numeric>Stock when asked</TableHead>
                        )}
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
                              {line.decision === "APPROVED" && (
                                <Badge tone="info">
                                  <Check aria-hidden />
                                  Approved
                                </Badge>
                              )}
                              {line.decision === "REJECTED" && (
                                <>
                                  <Badge tone="danger">
                                    <CircleX aria-hidden />
                                    Rejected
                                  </Badge>
                                  {line.rejectionReason && (
                                    <span className="text-sm whitespace-normal">
                                      Reason: {line.rejectionReason}
                                    </span>
                                  )}
                                </>
                              )}
                              {!line.item ? (
                                <Badge>
                                  <PackageX aria-hidden />
                                  Not in inventory
                                </Badge>
                              ) : line.receivedQuantity > 0 ? (
                                <Badge tone="success">
                                  <CircleCheck aria-hidden />
                                  {line.outstanding === 0
                                    ? "Added to stock"
                                    : "Arrived part added to stock"}
                                </Badge>
                              ) : (
                                <StockBadge
                                  level={stockLevel(
                                    line.item.quantityOnHand,
                                    line.item.reorderLevel,
                                  )}
                                  inactive={!line.item.isActive}
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell numeric>{formatQuantity(line.quantity, line.unit)}</TableCell>
                          {tracking ? (
                            <TableCell numeric>
                              {line.decision !== "APPROVED" ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className="flex flex-col items-end">
                                  {formatQuantity(line.receivedQuantity, line.unit)}
                                  <span className="text-sm text-muted-foreground">
                                    {line.outstanding === 0
                                      ? "all here"
                                      : request.closedShortAt
                                        ? `${formatQuantity(line.outstanding)} never arrived`
                                        : `${formatQuantity(line.outstanding)} still to come`}
                                  </span>
                                </span>
                              )}
                            </TableCell>
                          ) : (
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
                          )}
                          <TableCell numeric>
                            {line.item
                              ? formatQuantity(line.item.quantityOnHand, line.item.unit)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {typedArrived && (
                    <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                      Items not in inventory weren’t added to stock. Add them under Inventory, then
                      record what arrived there.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {(request.deliveries.length > 0 || status === "ORDERED") && (
            <Card data-testid="deliveries-card">
              <CardHeader>
                <CardTitle>Deliveries</CardTitle>
              </CardHeader>
              <CardContent>
                {request.deliveries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing has arrived yet.
                    {request.expectedDeliveryOn
                      ? ` The supplier expects to deliver on ${formatCalendarDate(request.expectedDeliveryOn)}.`
                      : ""}
                  </p>
                ) : (
                  <ol className="flex flex-col divide-y">
                    {request.deliveries.map((d, i) => (
                      <li
                        key={d.id}
                        aria-label={`Delivery ${i + 1}`}
                        className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0"
                      >
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Delivered {formatCalendarDate(d.deliveredOn)}
                          </span>{" "}
                          · recorded by {d.recordedBy.name}, {formatManilaDateTime(d.createdAt)}
                        </p>
                        <ul className="list-disc pl-5">
                          {d.lines.map((dl) => (
                            <li key={dl.lineId}>
                              {formatQuantity(dl.quantity, dl.unit)} of {dl.itemName}
                              {!dl.movementId && (
                                <span className="text-sm text-muted-foreground">
                                  {" "}
                                  (not in inventory, so not added to stock)
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                        {d.note && <p className="text-sm whitespace-pre-line">{d.note}</p>}
                        <ProofFiles files={d.attachments} />
                        {request.canAddProof && (
                          <AddProof
                            deliveryId={d.id}
                            label={`Add a proof file to the delivery of ${formatCalendarDate(d.deliveredOn)}`}
                          />
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {request.canAddProof && request.deliveries.length > 0 && (
                  <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                    <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                    Proof files are never removed. If one is wrong, add the right one and say so in
                    a remark.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

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
                <dd>
                  {STATUS_LABELS[status]}
                  {request.closedShortAt ? ", closed short" : ""}
                </dd>
                {request.decidedBy && request.decidedAt && (
                  <>
                    <dt className="text-muted-foreground">
                      {status === "REJECTED" ? "Rejected by" : mixed ? "Decided by" : "Approved by"}
                    </dt>
                    <dd>
                      {request.decidedBy.name}, {formatManilaDateTime(request.decidedAt)}
                    </dd>
                  </>
                )}
                {decided && decided.total > 1 && (
                  <>
                    <dt className="text-muted-foreground">Items</dt>
                    <dd>
                      {decided.label}
                      {decided.rejected > 0 && decided.approved > 0
                        ? ". Each rejected item shows its reason under Items."
                        : ""}
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
                {status === "CANCELLED" && request.cancelReason && (
                  <>
                    <dt className="text-muted-foreground">Cancelled because</dt>
                    <dd>{request.cancelReason}</dd>
                  </>
                )}
                {request.receivedAt && (
                  <>
                    <dt className="text-muted-foreground">
                      {request.closedShortAt ? "Closed" : "Received"}
                    </dt>
                    <dd>{formatManilaDateTime(request.receivedAt)}</dd>
                  </>
                )}
                {request.closedShortReason && (
                  <>
                    <dt className="text-muted-foreground">Closed short because</dt>
                    <dd>{request.closedShortReason}</dd>
                  </>
                )}
                {request.closedShortAt && shortfall && (
                  <>
                    <dt className="text-muted-foreground">Never arrived</dt>
                    <dd>{shortfall}</dd>
                  </>
                )}
              </dl>
              <RequestActions
                id={request.id}
                code={request.code}
                actions={request.actions}
                pending={status === "PENDING"}
                today={manilaToday()}
                suppliers={suppliers}
                orderedOn={request.orderedAt ? manilaToday(request.orderedAt) : null}
                shortfall={shortfall}
                cancelBlocked={request.cancelBlocked}
                deliveryLines={approved.map((l) => ({
                  id: l.id,
                  itemName: l.itemName,
                  unit: l.unit,
                  outstanding: l.outstanding,
                  inInventory: !!l.item,
                }))}
              />
              {waiting && status === "PENDING" && (
                <Hint>Waiting for the Floor Manager to approve or reject each item.</Hint>
              )}
              {waiting && status === "APPROVED" && (
                <Hint>
                  {mixed ? "Decided." : "Approved."} The Floor Manager orders the approved items
                  next.
                </Hint>
              )}
              {waiting && status === "ORDERED" && (
                <Hint>Ordered. The Floor Manager records the delivery when it arrives.</Hint>
              )}
              {waiting && status === "PARTIALLY_RECEIVED" && (
                <Hint>Part of the order has arrived. The rest is still expected: {shortfall}.</Hint>
              )}
              {request.canCopy && (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-muted-foreground">
                    Still need these? Start a new request with the same items.
                  </p>
                  <CopyRequestLink id={request.id} />
                </div>
              )}
            </CardContent>
          </Card>

          {request.orderedAt && request.supplier && (
            <Card data-testid="order-card">
              <CardHeader>
                <CardTitle>Order</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Supplier</dt>
                  <dd className="flex flex-col">
                    {request.supplier.name}
                    {(request.supplier.contactPerson || request.supplier.phone) && (
                      <span className="text-muted-foreground">
                        {[request.supplier.contactPerson, request.supplier.phone]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </dd>
                  {request.orderReference && (
                    <>
                      <dt className="text-muted-foreground">Reference</dt>
                      <dd className="font-mono">{request.orderReference}</dd>
                    </>
                  )}
                  {request.expectedDeliveryOn && (
                    <>
                      <dt className="text-muted-foreground">Expected</dt>
                      <dd className="flex flex-wrap items-center gap-2">
                        {formatCalendarDate(request.expectedDeliveryOn)}
                        {request.late && <LateBadge />}
                      </dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Ordered by</dt>
                  <dd>
                    {request.orderedBy?.name ?? "—"}, {formatManilaDateTime(request.orderedAt)}
                  </dd>
                  {request.orderNote && (
                    <>
                      <dt className="text-muted-foreground">Note</dt>
                      <dd className="whitespace-pre-line">{request.orderNote}</dd>
                    </>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {request.events.map((e) => {
                  // A delivery's proof shows once, on the event that recorded it.
                  const delivery =
                    e.deliveryId && !proofShown.has(e.deliveryId)
                      ? request.deliveries.find((d) => d.id === e.deliveryId)
                      : undefined;
                  if (delivery) proofShown.add(delivery.id);
                  return (
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
                      {e.note && <p className="text-sm whitespace-pre-line">{e.note}</p>}
                      {delivery && delivery.attachments.length > 0 && (
                        <ProofFiles files={delivery.attachments} />
                      )}
                    </li>
                  );
                })}
                {request.copies.map((copy) => (
                  <li key={copy.id} className="text-sm">
                    Copied to a new request:{" "}
                    <Link
                      href={`/procurement/${copy.id}`}
                      className="font-mono underline underline-offset-4"
                    >
                      {copy.code}
                    </Link>
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
