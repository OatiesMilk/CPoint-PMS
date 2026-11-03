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

const SALVAGE_ROWS = 8;

/**
 * Rejected sections, reported "for salvage" (A-11): how many in this range and the main defect of
 * each. Per roll and per supplier are in Supplier quality, per day in the Daily summary. The report
 * moves no leather (C-20).
 */
export function ForSalvageCard({
  salvage,
  scanned,
}: {
  salvage: OperationsReport["forSalvage"];
  scanned: number;
}) {
  return (
    <Card data-testid="for-salvage">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>For salvage</CardTitle>
            <CardDescription>
              Sections the camera rejected in this range, by the main defect of each. They are set
              aside for salvage; per roll and per supplier are in Supplier quality below.
            </CardDescription>
          </div>
          <SectionLink href="/reports/rolls">Rolls</SectionLink>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr]">
        <dl className="text-sm">
          <dt className="text-muted-foreground">Rejected sections</dt>
          <dd className="text-2xl font-semibold tabular-nums" data-testid="salvage-total">
            {salvage.total}
          </dd>
          <dd className="text-muted-foreground tabular-nums">
            {formatPercent(scanned > 0 ? salvage.total / scanned : null)} of {scanned} scanned
          </dd>
        </dl>
        {salvage.byDefect.length === 0 ? (
          <p className="text-sm text-muted-foreground">No section was rejected in this range.</p>
        ) : (
          <Table data-testid="salvage-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Main defect</TableHead>
                <TableHead numeric>Sections</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salvage.byDefect.slice(0, SALVAGE_ROWS).map((d) => (
                <TableRow key={d.key}>
                  <TableCell>{d.label}</TableCell>
                  <TableCell numeric>{d.sections}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
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
  lineRejectShare,
  rangeQuery,
}: {
  suppliers: OperationsReport["suppliers"];
  rolls: OperationsReport["rejectedRolls"];
  lineRejectShare: number | null;
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
              Shots captured in this range, grouped by the supplier of each roll. Defect area,
              Marked (Return to supplier) and Returned count the rolls finished in this range. Use
              it as evidence when raising a claim.
              {lineRejectShare !== null &&
                ` Across all suppliers, ${formatPercent(lineRejectShare)} were rejected.`}
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
            No sections were scanned in this range, so there is nothing to compare yet.
          </p>
        ) : (
          <Table data-testid="supplier-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Supplier</TableHead>
                <TableHead numeric>Rolls</TableHead>
                <TableHead numeric>Sections</TableHead>
                <TableHead numeric>Pass</TableHead>
                <TableHead numeric>Reject</TableHead>
                <TableHead>Top defect</TableHead>
                <TableHead numeric>Defect area</TableHead>
                <TableHead numeric>Marked</TableHead>
                <TableHead numeric>Returned</TableHead>
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
                          title="Rejected sections are well above the other suppliers'."
                        >
                          <TriangleAlert aria-hidden />
                          High
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell numeric>{s.rolls}</TableCell>
                  <TableCell numeric>{s.sections}</TableCell>
                  <TableCell numeric>{formatPercent(s.passShare)}</TableCell>
                  <TableCell numeric>{formatPercent(s.rejectShare)}</TableCell>
                  <TableCell>{s.topDefect ?? "None"}</TableCell>
                  <TableCell numeric>
                    {s.defectSharePct === null ? (
                      <span className="text-muted-foreground">Not measured</span>
                    ) : (
                      `${s.defectSharePct.toLocaleString("en-PH", { maximumFractionDigits: 1 })}%`
                    )}
                  </TableCell>
                  <TableCell numeric>{s.rollsMarked}</TableCell>
                  <TableCell numeric>{s.rollsReturned}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">Rolls with the most rejects</h3>
          {rolls.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No roll had a rejected section in this range.
            </p>
          ) : (
            <Table data-testid="rejected-rolls">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Roll · tag</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead numeric>Rejected</TableHead>
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
                      {r.rejected} of {r.sections}
                    </TableCell>
                    <TableCell>
                      {r.defects.map((d) => `${d.label} ${d.sections}`).join(" · ") || "None"}
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
