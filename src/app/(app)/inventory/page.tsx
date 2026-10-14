/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager (manages) and the System Admin (reads), a few times a day.
 * What:  see what's on the shelf and what needs reordering, then record what came in or went out.
 * Worst: a leather roll runs out unnoticed and stops the line. Low and out-of-stock items carry a
 *        labelled badge, and the Stock filter narrows to them. Items with an open purchase request
 *        say "Requested", so nobody orders twice; a low item without one offers "Request" (D-045).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, Plus, ShoppingCart } from "lucide-react";
import { StockBadge } from "@/components/features/inventory/stock-badge";
import { PageHeader } from "@/components/features/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CATEGORY_LABELS, formatQuantity } from "@/lib/inventory-rules";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { listItems } from "@/server/services/inventory.service";
import { openRequestCodes } from "@/server/services/procurement.service";
import { inventoryListQuerySchema } from "@/server/validators/inventory.validator";
import { InventoryFilters } from "./inventory-filters";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const user = await requirePermission("inventory:read");
  await connection();
  const query = inventoryListQuerySchema.parse(await searchParams);
  const filtered = Boolean(query.category || query.stock || query.q || query.inactive);
  const { rows, total, page, pageCount } = await listItems(query);
  // Items a Shoe Constructor already asked for (D-029), so nobody orders twice.
  const requested = await openRequestCodes(rows.map((r) => r.id));
  const canManage = can(user.role, "inventory:manage");
  // The Floor Manager can raise a restock request straight from a low item (D-045).
  const canRequest = can(user.role, "procurement:request");

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") next.set(k, String(v));
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/inventory?${qs}` : "/inventory";
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Leather rolls and supplies. Stock changes only when something is received, used or counted."
        actions={
          canManage && (
            <Button asChild>
              <Link href="/inventory/new">
                <Plus aria-hidden />
                Add item
              </Link>
            </Button>
          )
        }
      />

      {(total > 0 || filtered) && <InventoryFilters />}

      {total === 0 && !filtered ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No items yet</h2>
          <p className="max-w-md text-muted-foreground">
            {canManage
              ? "Add the materials you track in the log book: leather rolls, nails, adhesive, thread."
              : "The Floor Manager adds the materials they track. They'll appear here."}
          </p>
          {canManage && (
            <Button asChild className="mt-2">
              <Link href="/inventory/new">Add the first item</Link>
            </Button>
          )}
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No items match these filters</h2>
          <p className="text-muted-foreground">
            {query.stock
              ? "Nothing is at or below its reorder level. Clear the filters to see everything."
              : "Try a different category or search, or clear the filters."}
          </p>
          <Button asChild variant="secondary" className="mt-2">
            <Link href="/inventory">Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Code</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead numeric>On hand</TableHead>
                <TableHead numeric>Reorder at</TableHead>
                <TableHead>Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.id} aria-label={`${item.sku} ${item.name}`}>
                  <TableCell className="font-mono">{item.sku}</TableCell>
                  <TableCell>
                    <Link
                      href={`/inventory/${item.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CATEGORY_LABELS[item.category]}
                  </TableCell>
                  <TableCell numeric className="font-medium">
                    {formatQuantity(item.quantityOnHand, item.unit)}
                  </TableCell>
                  <TableCell numeric className="text-muted-foreground">
                    {formatQuantity(item.reorderLevel)}
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <StockBadge level={item.level} inactive={!item.isActive} />
                      {requested.has(item.id) ? (
                        <Link
                          href={`/procurement/${requested.get(item.id)!.id}`}
                          aria-label={`Requested in ${requested.get(item.id)!.code}`}
                        >
                          <Badge tone="info">
                            <ShoppingCart aria-hidden />
                            Requested
                          </Badge>
                        </Link>
                      ) : (
                        canRequest &&
                        item.isActive &&
                        item.level !== "OK" && (
                          <Link
                            href={`/procurement/new?item=${item.id}`}
                            aria-label={`Request ${item.name}`}
                            className="text-sm font-medium underline underline-offset-4"
                          >
                            Request
                          </Link>
                        )
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <nav
            aria-label="Pagination"
            className="flex items-center justify-between text-sm text-muted-foreground"
          >
            <span>
              {total.toLocaleString("en-PH")} item{total === 1 ? "" : "s"} · page {page} of{" "}
              {pageCount}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft aria-hidden />
                    Previous
                  </Link>
                </Button>
              ) : null}
              {page < pageCount ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page + 1)}>
                    Next
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
