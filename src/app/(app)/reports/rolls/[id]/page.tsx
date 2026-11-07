/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the desk.
 * What:  one roll: its leather item, area, supplier and tag, when it was scanned and fully used, its
 *        defect share against the supplier limit (Phase 30C) and every shot with its verdict and
 *        defects. Return it to the supplier or keep it; remove it with a reason; print a claim sheet.
 * Worst: removing the wrong roll (the dialog names it and asks why), or reading it as one
 *        person's work. No person is named here (D-008).
 */
import { formatScanningTime } from "@/lib/roll-timer";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RollFindings } from "@/components/features/rolls/roll-findings";
import { RollStatusBadge } from "@/components/features/rolls/roll-status-badge";
import { ScanThumb } from "@/components/features/scans/scan-thumb";
import { VerdictBadge } from "@/components/features/verdict-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { OUTCOME_LABELS, outcomeFor, readSnapshot } from "@/lib/decision-engine";
import { formatCalendarDate, formatManilaDateTime } from "@/lib/format";
import { formatPct, rollFindings } from "@/lib/roll-findings";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getRollDetail } from "@/server/services/roll.service";
import { isRollId } from "@/server/validators/roll.validator";
import { RemoveRoll } from "@/components/features/rolls/remove-roll";
import { formatArea, isReturnedToSupplier } from "@/lib/roll-rules";
import { removeRollAction } from "../actions";

export const metadata: Metadata = { title: "Roll" };

const percent = (v: number) => `${Math.round(v * 100)}%`;

export default async function RollReportPage({ params }: PageProps<"/reports/rolls/[id]">) {
  const user = await requirePermission("roll:read");
  await connection();
  const { id } = await params;
  if (!isRollId(id)) notFound();
  const roll = await getRollDetail(id);
  if (!roll) notFound();
  const canRemove = roll.canRemove && can(user.role, "roll:manage");
  const fromInventory = !!roll.item;
  const canClaim = can(user.role, "report:production") && roll.scans.length > 0;
  const shots = roll.scans.length;
  const returned = isReturnedToSupplier(roll) && roll.status !== "RETURNED";
  const findings = rollFindings(roll.scans);

  const when = (d: Date | null, none: string) => (d ? formatManilaDateTime(d) : none);
  const details: [string, React.ReactNode][] = [
    [
      "Leather item",
      roll.item ? (
        <Link href={`/inventory/${roll.item.id}`} className="underline-offset-4 hover:underline">
          {roll.item.sku} · {roll.item.name}
        </Link>
      ) : (
        "Before rolls came from Inventory"
      ),
    ],
    ["Area", formatArea(roll.areaSqFt)],
    ["Supplier", roll.supplier?.name ?? "Not recorded"],
    ["Tag number", roll.tagCode ? <span className="font-mono">{roll.tagCode}</span> : "—"],
    ...(roll.receivedAt
      ? ([["Received", formatCalendarDate(roll.receivedAt)]] as [string, React.ReactNode][])
      : []),
    ["Scanning started", when(roll.startedAt, "Not scanned yet")],
    [
      roll.status === "CANCELLED" ? "Removed" : "Scanned",
      roll.status === "CANCELLED"
        ? when(roll.cancelledAt, "—")
        : when(roll.finishedAt, roll.status === "OPEN" ? "Still being scanned" : "Not yet"),
    ],
    ...(roll.scanningMs !== null
      ? ([
          [
            "Scanning time",
            <span key="t" className="tabular-nums">
              {formatScanningTime(roll.scanningMs)}{" "}
              <span className="text-muted-foreground">(lunch left out)</span>
            </span>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    ...(roll.usedAt
      ? ([
          [
            "Fully used",
            roll.usedAt
              ? `${formatManilaDateTime(roll.usedAt)}${roll.usedCheckIn ? ` (ticked at Finish batch)` : ""}`
              : "Not yet",
          ],
        ] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <>
      <PageHeader
        back={{ href: "/reports/rolls", label: "All rolls" }}
        title={<span className="font-mono">{roll.code}</span>}
        titleAddon={<RollStatusBadge roll={roll} />}
        description={
          <>
            {shots} {shots === 1 ? "shot" : "shots"} · {roll.passed} passed · {roll.rejected}{" "}
            rejected
          </>
        }
        actions={
          canClaim && (
            <Button asChild variant="secondary">
              <Link href={`/reports/claims/${roll.id}`}>
                <FileText aria-hidden />
                Claim sheet
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-4">
        {roll.status === "IN_STOCK" && (
          <p className="text-sm text-muted-foreground">
            In stock, not scanned yet. A Shoe Constructor picks it at Capture.
          </p>
        )}
        {roll.status === "OPEN" && (
          <p className="text-sm text-muted-foreground">
            Being scanned at Capture. It is finished there once all of it is scanned.
          </p>
        )}
        {roll.status === "FINISHED" && fromInventory && !returned && (
          <p className="text-sm text-muted-foreground">Scanned and taken off stock.</p>
        )}
        {returned && (
          <p role="status" className="rounded-md bg-caution-soft p-3">
            <span className="font-medium">
              Returned to supplier: defects cover {formatPct(roll.defectSharePct ?? 0)} of this
              roll, over the {formatPct(roll.returnLimitPct ?? 10)} limit.
            </span>{" "}
            The system marked it when it was finished at Capture. The claim sheet lists the findings
            for the supplier.
          </p>
        )}
        {roll.status === "RETURNED" && (
          <Alert tone="info">
            Sent back to the supplier
            {roll.returnedOn ? ` on ${formatCalendarDate(roll.returnedOn)}` : ""}.
          </Alert>
        )}
        {roll.status === "CANCELLED" && (
          <Alert tone="info">
            Removed{roll.cancelledReason ? `: ${roll.cancelledReason}` : "."} Its shots are left out
            of the reports.
          </Alert>
        )}
        {canRemove && (
          <RemoveRoll
            code={roll.code}
            shots={shots}
            fromInventory={fromInventory}
            action={removeRollAction.bind(null, roll.id)}
          />
        )}
      </div>

      <Card aria-label="Roll details">
        <CardContent className="pt-5">
          <dl className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-x-8 gap-y-5">
            {details.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {fromInventory && (
        <RollFindings roll={roll} byType={findings.byType} largest={findings.largest} framed />
      )}

      <Card aria-labelledby="shots-heading">
        <CardHeader>
          <CardTitle id="shots-heading">Shots</CardTitle>
        </CardHeader>
        <CardContent>
          {shots === 0 ? (
            <p className="rounded-lg border border-dashed px-5 py-8 text-center text-muted-foreground">
              No shots yet. Each shot taken at Capture for this roll is listed here.
            </p>
          ) : (
            <Table label="Shots">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Shot</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Verdict</TableHead>
                  <TableHead>Defects</TableHead>
                  <TableHead>Captured</TableHead>
                  <TableActionsHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {roll.scans.map((s) => (
                  <TableRow key={s.id} data-testid="shot-row">
                    <TableCell>
                      <Link
                        href={`/scans/${s.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        #{s.sequence}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ScanThumb scanId={s.id} className="h-12 w-20 object-cover" />
                    </TableCell>
                    <TableCell>
                      <VerdictBadge verdict={s.finalVerdict} />
                    </TableCell>
                    <TableCell className="max-w-96 whitespace-normal">
                      {s.detections.length === 0 ? (
                        <span className="text-muted-foreground">None found</span>
                      ) : (
                        <ul className="flex flex-col gap-0.5 text-sm">
                          {s.detections.map((d, i) => {
                            const rule = readSnapshot(s.thresholdsSnapshot);
                            const outcome = outcomeFor(
                              rule.outcomes[d.rawClassKey] ?? d.defectType?.outcome,
                              rule.lengthLimits?.[d.rawClassKey],
                              d.lengthIn,
                            );
                            return (
                              <li key={`${d.rawClassKey}-${i}`}>
                                {d.defectType?.label ?? d.rawClassKey} {percent(d.confidence)}
                                {d.lengthIn !== null && (
                                  <span className="tabular-nums">
                                    {" "}
                                    · {d.lengthIn.toFixed(1)} in
                                  </span>
                                )}
                                <span className="text-muted-foreground">
                                  {" · "}
                                  {outcome ? OUTCOME_LABELS[outcome] : "Not counted"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell>{formatManilaDateTime(s.capturedAt)}</TableCell>
                    <TableCell className="text-right">
                      <TableViewLink href={`/scans/${s.id}`} what={`shot #${s.sequence}`} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
