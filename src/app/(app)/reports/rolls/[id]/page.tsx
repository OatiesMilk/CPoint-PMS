/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the desk.
 * What:  one roll: its leather item, area, supplier and tag, when it was scanned and fully used, and
 *        every shot with its verdict and defects. Remove a roll with a reason; print a claim sheet.
 * Worst: removing the wrong roll (the dialog names it and asks why), or reading it as one
 *        person's work. No person is named here (D-008).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft, FileText } from "lucide-react";
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
import { OUTCOME_LABELS } from "@/lib/decision-engine";
import { formatCalendarDate, formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getRollDetail } from "@/server/services/roll.service";
import { isRollId } from "@/server/validators/roll.validator";
import { RemoveRoll } from "@/components/features/rolls/remove-roll";
import { formatArea } from "@/lib/roll-rules";
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
    ...(fromInventory
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
      <div>
        <Link
          href="/reports/rolls"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All rolls
        </Link>
      </div>

      <header className="flex flex-col gap-5 border-b pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-3xl font-semibold tracking-tight">{roll.code}</h1>
              <RollStatusBadge status={roll.status} />
            </div>
            <p className="mt-1 text-lg text-muted-foreground">
              {shots} {shots === 1 ? "shot" : "shots"} · {roll.passed} passed · {roll.rejected}{" "}
              rejected (for salvage)
            </p>
          </div>
          {canClaim && (
            <Button asChild variant="secondary">
              <Link href={`/reports/claims/${roll.id}`}>
                <FileText aria-hidden />
                Claim sheet
              </Link>
            </Button>
          )}
        </div>
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
        {roll.status === "FINISHED" && fromInventory && (
          <p className="text-sm text-muted-foreground">
            Scanned. It leaves stock when the Quality Inspector ticks it Fully used at Finish batch.
          </p>
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
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(12rem,1fr))] gap-x-8 gap-y-4">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <section aria-labelledby="shots-heading" className="flex flex-col gap-4">
        <h2 id="shots-heading" className="text-xl font-semibold">
          Shots
        </h2>
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
                        {s.detections.map((d, i) => (
                          <li key={`${d.rawClassKey}-${i}`}>
                            {d.defectType?.label ?? d.rawClassKey} {percent(d.confidence)}
                            <span className="text-muted-foreground">
                              {" · "}
                              {d.isUnknownClass || !d.defectType
                                ? "Unknown class"
                                : d.defectType.outcome
                                  ? OUTCOME_LABELS[d.defectType.outcome]
                                  : "Not counted"}
                            </span>
                          </li>
                        ))}
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
      </section>
    </>
  );
}
