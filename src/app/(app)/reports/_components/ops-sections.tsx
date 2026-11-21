import Link from "next/link";
import { FileText, TriangleAlert } from "lucide-react";
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
import { FilterForm, FilteredNote } from "@/components/features/reports/filters";
import { SortableHeader } from "@/components/features/reports/sortable-header";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatPercent } from "@/lib/format";
import { sortFor, type SortKey, type SortState } from "@/lib/table-sort";
import { CATEGORY_LABELS, formatQuantity } from "@/lib/inventory-rules";
import type { InventoryCategory } from "@/lib/domain";
import type { OperationsReport } from "@/server/services/ops-report.service";
import { Stat } from "@/components/features/kpi-tile";
import { CardLink } from "@/components/ui/card-link";

const STOCK_ROWS = 8;

type StockRow = OperationsReport["stock"]["atRisk"][number];
const LEVEL_ORDER: Record<string, number> = { OUT: 0, LOW: 1, OK: 2 };
const STOCK_KEYS: Record<string, SortKey<StockRow>> = {
  item: (i) => i.item,
  "on-hand": (i) => i.onHand,
  used: (i) => i.used,
  cover: (i) => i.coverDays,
  status: (i) => LEVEL_ORDER[i.level],
};

type SupplierRow = OperationsReport["suppliers"][number];
const SUPPLIER_KEYS: Record<string, SortKey<SupplierRow>> = {
  supplier: (s) => s.supplier,
  rolls: (s) => s.rolls,
  "scanning-passed": (s) => s.passed,
  returned: (s) => s.returned,
  "returned-share": (s) => s.returnedShare,
  "top-defect": (s) => s.topDefect,
};

type WorstRoll = OperationsReport["mostDefects"][number];
const WORST_KEYS: Record<string, SortKey<WorstRoll>> = {
  roll: (r) => r.rollCode,
  supplier: (r) => r.supplier,
  defect: (r) => r.defectSharePct,
  status: (r) => (r.returned ? 1 : 0),
};

/** Items out, low, or running out at the recent pace, with days of cover. */
export function StockRiskCard({
  stock,
  days,
  sort,
}: {
  stock: OperationsReport["stock"];
  days: number;
  sort: SortState | null;
}) {
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
          <CardLink href="/inventory">Inventory</CardLink>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-4">
          <Stat label="Out of stock" value={stock.out} valueTestId="stock-out" />
          <Stat label="Low (at or below reorder)" value={stock.low} valueTestId="stock-low" />
          <Stat
            label={`Of ${stock.items} active items`}
            value={
              <>
                {stock.items - stock.out - stock.low}
                <span className="ml-1 text-base font-normal text-muted-foreground">fine</span>
              </>
            }
          />
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
                <SortableHeader table="stock" column="item">
                  Item
                </SortableHeader>
                <SortableHeader table="stock" column="on-hand" numeric>
                  On hand
                </SortableHeader>
                <SortableHeader table="stock" column="used" numeric>
                  Used
                </SortableHeader>
                <SortableHeader table="stock" column="cover" numeric>
                  Cover
                </SortableHeader>
                <SortableHeader table="stock" column="status">
                  Status
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortFor(sort, "stock", stock.atRisk, STOCK_KEYS)
                .slice(0, STOCK_ROWS)
                .map((i) => (
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
  sort,
  supplierId,
  supplierChoices,
}: {
  suppliers: OperationsReport["suppliers"];
  sort: SortState | null;
  /** The supplier filter: the card shows this supplier only (A-101). */
  supplierId?: string;
  supplierChoices: { id: string; name: string }[];
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
            <CardLink href={`/api/v1/reports/suppliers.csv?${rangeQuery}`}>Suppliers CSV</CardLink>
            <CardLink href={`/api/v1/reports/supplier-rolls.csv?${rangeQuery}`}>Rolls CSV</CardLink>
          </div>
        </div>
        <FilterForm owns={["supplierId"]} label="Supplier filter" active={Boolean(supplierId)}>
          <div className="flex w-full flex-col gap-1.5 sm:w-64">
            <Label htmlFor="filter-supplier">Supplier</Label>
            <Select id="filter-supplier" name="supplierId" defaultValue={supplierId ?? ""}>
              <option value="">All suppliers</option>
              {supplierChoices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </FilterForm>
        {supplierId && (
          <FilteredNote
            owns={["supplierId"]}
            text={`Supplier: ${supplierChoices.find((c) => c.id === supplierId)?.name ?? "unknown"}`}
          />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {supplierId
              ? "No supplier matches this filter in this range."
              : "No roll was finished at Capture in this range, so there is nothing to compare yet."}
          </p>
        ) : (
          <Table data-testid="supplier-table">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader table="suppliers" column="supplier">
                  Supplier
                </SortableHeader>
                <SortableHeader table="suppliers" column="rolls" numeric>
                  Rolls
                </SortableHeader>
                <SortableHeader table="suppliers" column="scanning-passed" numeric>
                  Scanning passed
                </SortableHeader>
                <SortableHeader table="suppliers" column="returned" numeric>
                  Returned to supplier
                </SortableHeader>
                <SortableHeader table="suppliers" column="returned-share" numeric>
                  Returned %
                </SortableHeader>
                <SortableHeader table="suppliers" column="top-defect">
                  Top defect
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortFor(sort, "suppliers", suppliers, SUPPLIER_KEYS).map((s) => (
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
              {supplierId
                ? "No roll of this supplier finished in this range has a measured Defect % above 0."
                : "No roll finished in this range has a measured Defect % above 0."}
            </p>
          ) : (
            <Table data-testid="most-defects-rolls">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortableHeader table="most-defects" column="roll">
                    Roll · tag
                  </SortableHeader>
                  <SortableHeader table="most-defects" column="supplier">
                    Supplier
                  </SortableHeader>
                  <SortableHeader table="most-defects" column="defect" numeric>
                    Defect %
                  </SortableHeader>
                  <SortableHeader table="most-defects" column="status">
                    Status
                  </SortableHeader>
                  <TableHead>Defects</TableHead>
                  <TableActionsHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortFor(sort, "most-defects", rolls, WORST_KEYS).map((r) => (
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
                      <div className="flex items-center justify-end gap-2 print:hidden">
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
