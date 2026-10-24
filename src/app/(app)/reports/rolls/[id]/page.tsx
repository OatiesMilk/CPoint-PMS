/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the desk.
 * What:  one roll: its supplier and tag, when it was captured, and every shot with its verdict and
 *        defects. Cancel an open roll that should not count, with a reason; print a claim sheet.
 * Worst: cancelling the wrong roll (the dialog names it and asks why), or reading it as one
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
} from "@/components/ui/table";
import { OUTCOME_LABELS } from "@/lib/decision-engine";
import { formatCalendarDate, formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { getRollDetail } from "@/server/services/roll.service";
import { isRollId } from "@/server/validators/roll.validator";
import { CancelRoll } from "./cancel-roll";

export const metadata: Metadata = { title: "Roll" };

const percent = (v: number) => `${Math.round(v * 100)}%`;

export default async function RollReportPage({ params }: PageProps<"/reports/rolls/[id]">) {
  const user = await requirePermission("roll:read");
  await connection();
  const { id } = await params;
  if (!isRollId(id)) notFound();
  const roll = await getRollDetail(id);
  if (!roll) notFound();
  const canCancel = roll.canCancel && can(user.role, "roll:manage");
  const canClaim = can(user.role, "report:production") && roll.scans.length > 0;
  const shots = roll.scans.length;

  const details: [string, React.ReactNode][] = [
    ["Supplier", roll.supplier?.name ?? "Not recorded"],
    ["Tag number", roll.tagCode ? <span className="font-mono">{roll.tagCode}</span> : "—"],
    ["Started", formatManilaDateTime(roll.startedAt)],
    [
      roll.status === "CANCELLED" ? "Cancelled" : "Finished",
      roll.finishedAt
        ? formatManilaDateTime(roll.finishedAt)
        : roll.cancelledAt
          ? formatManilaDateTime(roll.cancelledAt)
          : "Still being captured",
    ],
    ...(roll.receivedAt
      ? ([["Received", formatCalendarDate(roll.receivedAt)]] as [string, React.ReactNode][])
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
        {roll.status === "OPEN" && (
          <p className="text-sm text-muted-foreground">
            Being captured at Capture. It is finished there once all of it is scanned.
          </p>
        )}
        {roll.status === "CANCELLED" && (
          <Alert tone="info">
            Cancelled{roll.cancelledReason ? `: ${roll.cancelledReason}` : "."} Its shots are left
            out of the reports.
          </Alert>
        )}
        {canCancel && <CancelRoll id={roll.id} code={roll.code} shots={shots} />}
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
