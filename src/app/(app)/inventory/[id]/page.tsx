/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, checking one material between stock updates.
 * What:  read the item's history like the log book: each entry (Added, Used, Correction) with the
 *        balance after it. Stock changes on the Update stock sheet (Phase 29, D-102).
 * Worst: stock drifts from the shelf without anyone noticing. On hand is the hero number, every
 *        change is an entry with who and why, and corrections say why.
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
} from "@/components/ui/table";
import { formatManilaDateTime } from "@/lib/format";
import {
  CATEGORY_LABELS,
  MOVEMENT_LABELS,
  formatDelta,
  formatQuantity,
} from "@/lib/inventory-rules";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getItemDetail } from "@/server/services/inventory.service";
import { isInventoryId } from "@/server/validators/inventory.validator";
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
  const pageParam = Number((await searchParams).page);
  const page = Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1;
  const detail = await getItemDetail(id, page);
  if (!detail) notFound();
  const { item, movements, total, pageCount } = detail;
  const canManage = can(user.role, "inventory:manage");
  const canReadRolls = can(user.role, "roll:read");
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
        {canManage && <StockActions item={item} />}
      </header>

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
                href={(p) => `/inventory/${id}${p > 1 ? `?page=${p}` : ""}`}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
