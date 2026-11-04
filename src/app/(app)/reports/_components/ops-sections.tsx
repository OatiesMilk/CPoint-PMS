import Link from "next/link";
import { ArrowRight, FileText, TriangleAlert } from "lucide-react";
import { StockBadge } from "@/components/features/inventory/stock-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { formatPercent } from "@/lib/format";
import { CATEGORY_LABELS, formatQuantity } from "@/lib/inventory-rules";
import type { InventoryCategory } from "@/lib/domain";
import type { OperationsReport } from "@/server/services/ops-report.service";

function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
    >
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}

const STOCK_ROWS = 8;

/** Items out, low, or running out at the recent pace, with days of cover. */
export function StockRiskCard({ stock, days }: { stock: OperationsReport["stock"]; days: number }) {
  return (
    <Card data-testid="stock-risk">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Materials at risk</CardTitle>
            <CardDescription>
              Days of cover is stock on hand divided by the daily use over these {days} day
              {days === 1 ? "" : "s"}.
            </CardDescription>
          </div>
          <SectionLink href="/inventory">Inventory</SectionLink>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Out of stock</dt>
            <dd className="text-2xl font-semibold tabular-nums" data-testid="stock-out">
              {stock.out}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Low (at or below reorder)</dt>
            <dd className="text-2xl font-semibold tabular-nums" data-testid="stock-low">
              {stock.low}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Of {stock.items} active items</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {stock.items - stock.out - stock.low}
              <span className="ml-1 text-base font-normal text-muted-foreground">fine</span>
            </dd>
          </div>
        </dl>
        {stock.atRisk.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Every item is above its reorder level and will last longer than 3 days at the recent
            pace.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Item</TableHead>
                <TableHead numeric>On hand</TableHead>
                <TableHead numeric>Used</TableHead>
                <TableHead numeric>Cover</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stock.atRisk.slice(0, STOCK_ROWS).map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <span className="font-medium">{i.item}</span>
                    <span className="block text-xs text-muted-foreground">
                      {CATEGORY_LABELS[i.category as InventoryCategory]}
                    </span>
                  </TableCell>
                  <TableCell numeric>
                    {formatQuantity(i.onHand, i.unit)}
                    <span className="block text-xs text-muted-foreground">
                      reorder at {formatQuantity(i.reorderLevel)}
                    </span>
                  </TableCell>
                  <TableCell numeric>{formatQuantity(i.used)}</TableCell>
                  <TableCell numeric>
                    {i.coverDays === null ? "—" : `${Math.round(i.coverDays * 10) / 10} d`}
                  </TableCell>
                  <TableCell>
                    <StockBadge level={i.level} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {stock.atRisk.length > STOCK_ROWS && (
          <p className="text-sm text-muted-foreground">
            {stock.atRisk.length - STOCK_ROWS} more in the Stock CSV.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Supplier quality (Phase 20): how each supplier's leather scanned before cutting, worst first, and
 * the rolls with the most rejects, each with a claim sheet. Grouped by supplier and roll, never by
 * person (D-008).
 */
export function SupplierQualityCard({
  suppliers,
  rolls,
  lineReturnedShare,
  rangeQuery,
}: {
  suppliers: OperationsReport["suppliers"];
  rolls: OperationsReport["mostDefects"];
  lineReturnedShare: number | null;
  /** `from=…&to=…`, so the CSVs cover the range on screen. */
  rangeQuery: string;
}) {
  return (
    <Card id="supplier-quality" data-testid="supplier-quality">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Supplier quality</CardTitle>
            <CardDescription>
              The leather rolls finished at Capture in this range, grouped by supplier: how many
              passed and how many were returned to supplier. Use it as evidence when raising a
              claim.
              {lineReturnedShare !== null &&
                ` Across all suppliers, ${formatPercent(lineReturnedShare)} of rolls were returned.`}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <SectionLink href={`/api/v1/reports/suppliers.csv?${rangeQuery}`}>
              Suppliers CSV
            </SectionLink>
            <SectionLink href={`/api/v1/reports/supplier-rolls.csv?${rangeQuery}`}>
              Rolls CSV
            </SectionLink>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No roll was finished at Capture in this range, so there is nothing to compare yet.
          </p>
        ) : (
          <Table data-testid="supplier-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Supplier</TableHead>
                <TableHead numeric>Rolls</TableHead>
                <TableHead numeric>Scanning passed</TableHead>
                <TableHead numeric>Returned to supplier</TableHead>
                <TableHead numeric>Returned %</TableHead>
                <TableHead>Top defect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id ?? "none"}>
                  <TableCell className="font-medium">
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {s.supplier}
                      {s.high && (
                        <Badge
                          tone="danger"
                          title="Its rolls are returned well more often than the other suppliers'."
                        >
                          <TriangleAlert aria-hidden />
                          High
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell numeric>{s.rolls}</TableCell>
                  <TableCell numeric>{s.passed}</TableCell>
                  <TableCell numeric>{s.returned}</TableCell>
                  <TableCell numeric>{formatPercent(s.returnedShare)}</TableCell>
                  <TableCell>{s.topDefect ?? "None"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">Rolls with the most defects</h3>
          {rolls.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No roll finished in this range has a measured Defect % above 0.
            </p>
          ) : (
            <Table data-testid="most-defects-rolls">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Roll · tag</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead numeric>Defect %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Defects</TableHead>
                  <TableActionsHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolls.map((r) => (
                  <TableRow key={r.rollId}>
                    <TableCell className="font-mono whitespace-nowrap">
                      {r.rollCode}
                      {r.tagCode && ` · ${r.tagCode}`}
                    </TableCell>
                    <TableCell>{r.supplier}</TableCell>
                    <TableCell numeric className="whitespace-nowrap">
                      {`${r.defectSharePct.toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.returned ? "Returned to supplier" : "Scanning passed"}
                    </TableCell>
                    <TableCell>
                      {r.defects.map((d) => `${d.label} ${d.detections}`).join(" · ") || "None"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <TableViewLink
                          href={`/reports/rolls/${r.rollId}`}
                          what={`roll ${r.rollCode}`}
                        />
                        <Button asChild size="sm" variant="secondary">
                          <Link
                            href={`/reports/claims/${r.rollId}`}
                            aria-label={`Claim sheet for roll ${r.rollCode}`}
                          >
                            <FileText aria-hidden />
                            Claim sheet
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Grouped by supplier and roll only, never by person. A claim sheet lists the roll, its
          rejected sections and their photos, ready to save as PDF.
        </p>
      </CardContent>
    </Card>
  );
}
