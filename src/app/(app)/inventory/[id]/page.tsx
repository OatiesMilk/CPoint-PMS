/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, checking one material between stock updates.
 * What:  read the item's history like the log book: each entry (Added, Used, Correction) with the
 *        balance after it. Stock changes on the Update stock sheet (Phase 29, D-102).
 * Worst: stock drifts from the shelf without anyone noticing. On hand is the hero number, every
 *        change is an entry with who and why, and corrections say why.
 * Leather (Phase 30A, D-104): the item lists its rolls, each with its own area; the count follows
 *        them (Add rolls +1, Fully used or Remove −1), so its stock isn't on the Update stock sheet.
 */
import type { Metadata } from "next";
import { TablePager } from "@/components/features/table-pager";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { StockBadge } from "@/components/features/inventory/stock-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableActionsHead,
  TableViewLink,
} from "@/components/ui/table";
import { RemoveRoll } from "@/components/features/rolls/remove-roll";
import { DefectShare } from "@/components/features/rolls/defect-share";
import { RollStatusBadge } from "@/components/features/rolls/roll-status-badge";
import { ROLL_STATUS_LABELS, RollStatus } from "@/lib/domain";
import { formatCalendarDate, formatManilaDateTime } from "@/lib/format";
import { formatArea } from "@/lib/roll-rules";
import {
  CATEGORY_LABELS,
  MOVEMENT_LABELS,
  formatDelta,
  formatQuantity,
} from "@/lib/inventory-rules";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getItemDetail } from "@/server/services/inventory.service";
import { listItemRolls } from "@/server/services/roll.service";
import { isInventoryId } from "@/server/validators/inventory.validator";
import { itemRollsQuerySchema } from "@/server/validators/roll.validator";
import { removeRollAction } from "../../reports/rolls/actions";
import { AddRollsDialog } from "./add-rolls-dialog";
import { StockActions } from "./stock-actions";

export const metadata: Metadata = { title: "Inventory item" };

const MOVEMENT_TONE = { IN: "success", OUT: "neutral", ADJUST: "info" } as const;

export default async function InventoryItemPage({
  params,
  searchParams,
}: PageProps<"/inventory/[id]">) {
  const user = await requirePermission("inventory:read");
  await connection();
  const { id } = await params;
  if (!isInventoryId(id)) notFound();
  const sp = await searchParams;
  const pageParam = Number(sp.page);
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1;
  const rollQuery = itemRollsQuerySchema.parse(sp);
  const detail = await getItemDetail(id, page);
  if (!detail) notFound();
  const { item, movements, total, pageCount } = detail;
  const canManage = can(user.role, "inventory:manage");
  const canReadRolls = can(user.role, "roll:read");
  const canRemoveRolls = can(user.role, "roll:manage");
  const isLeather = item.category === "LEATHER_ROLL";
  const rolls = isLeather
    ? await listItemRolls(id, { status: rollQuery.rollStatus, page: rollQuery.rollPage })
    : null;
  // Both tables page on their own; each link keeps the other's place and the roll filter.
  const hrefWith = (next: { page?: number; rollPage?: number; rollStatus?: string | null }) => {
    const q = new URLSearchParams();
    const p = next.page ?? page;
    const rp = next.rollPage ?? rollQuery.rollPage ?? 1;
    const rs = next.rollStatus === undefined ? rollQuery.rollStatus : next.rollStatus;
    if (p > 1) q.set("page", String(p));
    if (rs) q.set("rollStatus", rs);
    if (rp > 1) q.set("rollPage", String(rp));
    const qs = q.toString();
    return `/inventory/${id}${qs ? `?${qs}` : ""}`;
  };
  // Only stock used before Phase 26 names a roll (D-095), so the column shows only when one does.
  const showRoll = movements.some((m) => m.roll);

  return (
    <>
      <div>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All items
        </Link>
      </div>

      <header className="flex flex-col gap-5 border-b pb-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{item.name}</h1>
              <StockBadge level={item.level} inactive={!item.isActive} />
            </div>
            <p className="mt-1 text-lg text-muted-foreground">
              <span className="font-mono">{item.sku}</span> · {CATEGORY_LABELS[item.category]}
              {item.supplier && <> · {item.supplier.name}</>}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">On hand</p>
            <p className="text-3xl font-semibold tabular-nums" data-testid="on-hand">
              {formatQuantity(item.quantityOnHand, item.unit)}
            </p>
            <p className="text-sm text-muted-foreground">
              reorder at {formatQuantity(item.reorderLevel, item.unit)}
            </p>
          </div>
        </div>
        {canManage && <StockActions item={item} countedFromRolls={isLeather} />}
      </header>

      {rolls && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Rolls</CardTitle>
              <CardDescription>
                Each roll with its own area. A roll leaves stock when it is ticked Fully used at
                Finish batch, or removed. Never who scanned it.
              </CardDescription>
            </div>
            {canManage && item.isActive && (
              <div className="flex flex-col items-end gap-1">
                <AddRollsDialog
                  item={{ id: item.id, name: item.name }}
                  supplierCode={item.supplier?.code ?? null}
                />
                {!item.supplier && (
                  <p className="text-sm text-muted-foreground">
                    Choose the item’s supplier first (Edit).
                  </p>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <nav aria-label="Roll status" className="flex flex-wrap gap-2">
              {([null, ...Object.values(RollStatus)] as (RollStatus | null)[]).map((st) => {
                const current = (rollQuery.rollStatus ?? null) === st;
                return (
                  <Link
                    key={st ?? "all"}
                    href={hrefWith({ rollStatus: st, rollPage: 1 })}
                    aria-current={current ? "page" : undefined}
                    className={
                      current
                        ? "rounded-full border border-foreground bg-accent px-3 py-1 text-sm font-medium"
                        : "rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
                    }
                  >
                    {st ? ROLL_STATUS_LABELS[st] : "All"}
                  </Link>
                );
              })}
            </nav>
            {rolls.total === 0 ? (
              <p className="text-sm text-muted-foreground">
                {rollQuery.rollStatus
                  ? `No rolls are ${ROLL_STATUS_LABELS[rollQuery.rollStatus].toLowerCase()}.`
                  : canManage
                    ? "No rolls yet. Use Add rolls when a delivery arrives."
                    : "No rolls yet. The Floor Manager adds them when a delivery arrives."}
              </p>
            ) : (
              <>
                <Table label="Rolls">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Roll</TableHead>
                      <TableHead numeric>Area</TableHead>
                      <TableHead>Arrived</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead numeric>Shots</TableHead>
                      <TableHead numeric>Rejected</TableHead>
                      <TableHead>Defects found</TableHead>
                      <TableHead numeric>Defect %</TableHead>
                      {(canReadRolls || canRemoveRolls) && <TableActionsHead />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rolls.rows.map((r) => (
                      <TableRow key={r.id} data-testid="item-roll-row">
                        <TableCell>
                          {canReadRolls ? (
                            <Link
                              href={`/reports/rolls/${r.id}`}
                              className="font-mono font-medium underline-offset-4 hover:underline"
                            >
                              {r.code}
                            </Link>
                          ) : (
                            <span className="font-mono font-medium">{r.code}</span>
                          )}
                          {r.tagCode && (
                            <span className="block font-mono text-sm text-muted-foreground">
                              Tag {r.tagCode}
                            </span>
                          )}
                        </TableCell>
                        <TableCell numeric>{formatArea(r.areaSqFt)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.receivedAt ? formatCalendarDate(r.receivedAt) : "—"}
                        </TableCell>
                        <TableCell>
                          <RollStatusBadge roll={r} />
                        </TableCell>
                        <TableCell numeric>{r._count.scans}</TableCell>
                        <TableCell numeric>{r.rejected}</TableCell>
                        <TableCell className="max-w-64 whitespace-normal">
                          {r.defectsFound || (
                            <span className="text-muted-foreground">
                              {r._count.scans > 0 ? "None" : "—"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell numeric>
                          <DefectShare roll={r} />
                        </TableCell>
                        {(canReadRolls || canRemoveRolls) && (
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              {canReadRolls && (
                                <TableViewLink
                                  href={`/reports/rolls/${r.id}`}
                                  what={`roll ${r.code}`}
                                />
                              )}
                              {canRemoveRolls && r.canRemove && (
                                <RemoveRoll
                                  size="sm"
                                  code={r.code}
                                  shots={r._count.scans}
                                  fromInventory
                                  action={removeRollAction.bind(null, r.id)}
                                />
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePager
                  page={rolls.page}
                  pageCount={rolls.pageCount}
                  total={rolls.total}
                  noun={["roll", "rolls"]}
                  label="Roll pages"
                  href={(p) => hrefWith({ rollPage: p })}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Stock history</CardTitle>
          <CardDescription>
            Every change to the stock, newest first. Entries are never edited: a mistake is fixed
            with a Correction on the Update stock sheet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stock recorded yet.{" "}
              {canManage
                ? "Use Update stock to record what was added or used."
                : "Entries appear when the Floor Manager updates stock."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>When</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead numeric>Change</TableHead>
                    <TableHead numeric>Balance</TableHead>
                    <TableHead>Note</TableHead>
                    {showRoll && <TableHead>Roll</TableHead>}
                    <TableHead>Recorded by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id} data-testid="movement-row">
                      <TableCell className="whitespace-nowrap">
                        {formatManilaDateTime(m.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge tone={MOVEMENT_TONE[m.type]}>{MOVEMENT_LABELS[m.type]}</Badge>
                      </TableCell>
                      <TableCell numeric className="font-medium">
                        {formatDelta(m.quantityDelta)}
                      </TableCell>
                      <TableCell numeric>{formatQuantity(m.balanceAfter)}</TableCell>
                      <TableCell className="max-w-72 truncate" title={m.reason}>
                        {m.reason}
                      </TableCell>
                      {showRoll && (
                        <TableCell>
                          {m.roll && canReadRolls ? (
                            <Link
                              href={`/reports/rolls/${m.roll.id}`}
                              className="font-mono underline-offset-4 hover:underline"
                            >
                              {m.roll.code}
                            </Link>
                          ) : m.roll ? (
                            <span className="font-mono">{m.roll.code}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground">{m.createdBy.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                page={page}
                pageCount={pageCount}
                total={total}
                noun={["movement", "movements"]}
                label="History pages"
                previousLabel="Newer"
                nextLabel="Older"
                href={(p) => hrefWith({ page: p })}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
