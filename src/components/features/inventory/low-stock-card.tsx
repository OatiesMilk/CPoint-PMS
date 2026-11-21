import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatQuantity, type StockLevel } from "@/lib/inventory-rules";
import { StockBadge } from "./stock-badge";
import { CardLink } from "@/components/ui/card-link";

type Item = {
  id: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  reorderLevel: number;
  level: StockLevel;
};

/** Materials at or below their reorder level (FM home). Late leather rolls have stopped the line before. */
export function LowStockCard({ count, items }: { count: number; items: Item[] }) {
  return (
    <Card data-testid="low-stock-card" className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Low-stock alerts</CardTitle>
            <CardDescription>
              {count === 0
                ? "All materials are above their reorder level."
                : `${count} item${count === 1 ? " is" : "s are"} at or below the reorder level.`}
            </CardDescription>
          </div>
          <CardLink href={count > 0 ? "/inventory?stock=low" : "/inventory"}>Inventory</CardLink>
        </div>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck aria-hidden className="size-4 text-pass" />
            Nothing to reorder right now.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 first:pt-0">
                <div className="min-w-0">
                  <Link
                    href={`/inventory/${item.id}`}
                    className="block truncate font-medium underline-offset-4 hover:underline"
                  >
                    {item.name}
                  </Link>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatQuantity(item.quantityOnHand, item.unit)} · reorder at{" "}
                    {formatQuantity(item.reorderLevel)}
                  </p>
                </div>
                <StockBadge level={item.level} />
              </li>
            ))}
            {count > items.length && (
              <li className="pt-2 text-sm">
                <Link href="/inventory?stock=low" className="underline underline-offset-4">
                  {count - items.length} more
                </Link>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
