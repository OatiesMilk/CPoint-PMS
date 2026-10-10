import Link from "next/link";
import { ArrowRight, Check, Hourglass } from "lucide-react";
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
import { formatDuration, formatPercent } from "@/lib/format";
import { CATEGORY_LABELS, formatQuantity } from "@/lib/inventory-rules";
import { cn } from "@/lib/utils";
import type { InventoryCategory } from "@/lib/domain";
import type { OperationsReport, RepairStation } from "@/server/services/ops-report.service";

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

const STEPS = ["Waiting", "Being repaired", "Repaired"] as const;

/** Where a section is in its repair: three steps, the current one marked in words and style. */
function RepairProgress({ status }: { status: "OPEN" | "IN_PROGRESS" }) {
  const current = status === "OPEN" ? 0 : 1;
  return (
    <ol className="flex items-center gap-1 text-xs" aria-label="Repair progress">
      {STEPS.map((step, i) => (
        <li
          key={step}
          aria-current={i === current ? "step" : undefined}
          className={cn(
            "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 whitespace-nowrap",
            i === current && "bg-accent font-semibold text-accent-foreground",
            i < current && "text-foreground",
            i > current && "text-muted-foreground",
          )}
        >
          {i < current && <Check aria-hidden className="size-3" />}
          {step}
        </li>
      ))}
    </ol>
  );
}

const REPAIR_ROWS = 10;

/** Sections at the repair station right now and how far each has got. Same for FM and QI. */
export function RepairStationCard({ repairs, days }: { repairs: RepairStation; days: number }) {
  return (
    <Card data-testid="repair-station">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Repair station</CardTitle>
            <CardDescription>
              Leather sections that need rework, with how far each has got. Updated live, not by the
              range.
            </CardDescription>
          </div>
          <SectionLink href="/rework">Open the board</SectionLink>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Waiting</dt>
            <dd className="text-2xl font-semibold tabular-nums" data-testid="repairs-waiting">
              {repairs.waiting}
            </dd>
            <dd className="text-xs text-muted-foreground">
              {repairs.oldestWaitingMs === null
                ? "none waiting"
                : `oldest ${formatDuration(repairs.oldestWaitingMs)}`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Being repaired</dt>
            <dd className="text-2xl font-semibold tabular-nums" data-testid="repairs-active">
              {repairs.beingRepaired}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              Repaired, last {days === 1 ? "day" : `${days} days`}
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">{repairs.doneInRange}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Typical time to repair</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {repairs.medianTurnaroundMs === null
                ? "—"
                : formatDuration(repairs.medianTurnaroundMs)}
            </dd>
            <dd className="text-xs text-muted-foreground">from found to repaired</dd>
          </div>
        </dl>
        {repairs.total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing is at the repair station. Sections the camera marks for rework appear here.
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Batch</TableHead>
                  <TableHead numeric>Section</TableHead>
                  <TableHead>Defect</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead numeric>Time so far</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repairs.rows.slice(0, REPAIR_ROWS).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono">
                      <Link
                        href={`/batches/${r.batchId}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {r.batchCode}
                      </Link>
                    </TableCell>
                    <TableCell numeric>#{r.sequence}</TableCell>
                    <TableCell>{r.defect ?? "—"}</TableCell>
                    <TableCell>
                      <RepairProgress status={r.status} />
                    </TableCell>
                    <TableCell numeric>
                      {r.status === "OPEN"
                        ? `waiting ${formatDuration(r.waitingMs)}`
                        : `repairing ${formatDuration(r.repairingMs ?? 0)}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {repairs.total > REPAIR_ROWS && (
              <p className="text-sm text-muted-foreground">
                Showing the {REPAIR_ROWS} that have waited longest of {repairs.total}. The rest are
                on the board.
              </p>
            )}
          </>
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
                    <span className="flex flex-wrap gap-1">
                      <StockBadge level={i.level} />
                      {i.requested && (
                        <Badge tone="info">
                          <Hourglass aria-hidden />
                          Requested
                        </Badge>
                      )}
                    </span>
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

/** Purchasing: what waits for a decision or a delivery, and how fast requests move. */
export function ProcurementFlowCard({ p }: { p: OperationsReport["procurement"] }) {
  const sent = Object.values(p.byStatus).reduce((t, v) => t + v, 0);
  return (
    <Card data-testid="procurement-flow">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Purchasing</CardTitle>
            <CardDescription>
              {sent} request{sent === 1 ? "" : "s"} sent in this range. Waiting counts are live.
            </CardDescription>
          </div>
          <SectionLink href="/procurement">Procurement</SectionLink>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Waiting for a decision</dt>
            <dd className="text-2xl font-semibold tabular-nums">{p.pending}</dd>
            <dd className="text-xs text-muted-foreground">
              {p.highPending > 0 ? `${p.highPending} high urgency` : "none high urgency"}
              {p.oldestPendingMs !== null && ` · oldest ${formatDuration(p.oldestPendingMs)}`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Approved, not received</dt>
            <dd className="text-2xl font-semibold tabular-nums">{p.awaitingDelivery}</dd>
            <dd className="text-xs text-muted-foreground">
              {p.lateAwaitingDelivery > 0 ? `${p.lateAwaitingDelivery} over a week` : "none late"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Typical time to decide</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {p.medianDecideMs === null ? "—" : formatDuration(p.medianDecideMs)}
            </dd>
            <dd className="text-xs text-muted-foreground">sent to approved or rejected</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Typical time to receive</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {p.medianReceiveMs === null ? "—" : formatDuration(p.medianReceiveMs)}
            </dd>
            <dd className="text-xs text-muted-foreground">approved to in stock</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

/** Leather quality by supplier, from the camera's final verdicts (suppliers, not people). */
export function SupplierCard({
  suppliers,
  lineProblemShare,
}: {
  suppliers: OperationsReport["suppliers"];
  lineProblemShare: number | null;
}) {
  return (
    <Card id="suppliers" data-testid="suppliers">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Suppliers</CardTitle>
            <CardDescription>
              How each supplier’s leather scanned in this range. “Needed work” is rework plus
              reject.
              {lineProblemShare !== null &&
                ` Across all suppliers: ${formatPercent(lineProblemShare)}.`}
            </CardDescription>
          </div>
          <SectionLink href="/api/v1/reports/suppliers.csv">CSV</SectionLink>
        </div>
      </CardHeader>
      <CardContent>
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sections were scanned in this range, so there is nothing to compare yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Supplier</TableHead>
                <TableHead numeric>Batches</TableHead>
                <TableHead numeric>Sections</TableHead>
                <TableHead numeric>Pass</TableHead>
                <TableHead numeric>Needed work</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id ?? "none"}>
                  <TableCell className="font-medium">{s.supplier}</TableCell>
                  <TableCell numeric>{s.batches}</TableCell>
                  <TableCell numeric>{s.sections}</TableCell>
                  <TableCell numeric>{formatPercent(s.cleanShare)}</TableCell>
                  <TableCell numeric>
                    {formatPercent(s.problemShare)}
                    <span className="text-muted-foreground"> ({s.rework + s.reject})</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
