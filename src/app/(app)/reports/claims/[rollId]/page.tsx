/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager raising a quality claim with a leather supplier.
 * What:  one page per roll to print or save as PDF: the roll, its supplier, the counts, and every
 *        rejected section with its photo and defects (Phase 20, D-072).
 * Worst: a claim that names a worker, or a sheet missing the photos the supplier asks for. Per
 *        roll only (D-008); every rejected section is listed with its photo, in section order.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Button } from "@/components/ui/button";
import { formatDayLabel, formatManilaDateTime, formatPercent } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { claimSheet } from "@/server/services/ops-report.service";
import { isRollId } from "@/server/validators/roll.validator";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Claim sheet" };

export default async function ClaimSheetPage({ params }: PageProps<"/reports/claims/[rollId]">) {
  await requirePermission("report:production");
  await connection();
  const { rollId } = await params;
  const sheet = isRollId(rollId) ? await claimSheet(rollId) : null;
  if (!sheet) notFound();
  const t = sheet.totals;

  return (
    <>
      <PageHeader
        title={`Claim sheet: roll ${sheet.rollCode}`}
        description={`Rejected leather sections from roll ${sheet.rollCode}${sheet.tagCode ? ` (tag ${sheet.tagCode})` : ""}, for a claim with ${sheet.supplier?.name ?? "the supplier"}.`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button asChild variant="secondary">
              <Link href={`/reports/rolls/${sheet.rollId}`}>
                <ArrowLeft aria-hidden />
                Back to the roll
              </Link>
            </Button>
            <PrintButton />
          </div>
        }
      />

      <dl
        className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-3"
        data-testid="claim-summary"
      >
        <div>
          <dt className="text-muted-foreground">Supplier</dt>
          <dd className="font-medium">{sheet.supplier?.name ?? "No supplier recorded"}</dd>
          {sheet.supplier?.contactPerson && (
            <dd>
              {sheet.supplier.contactPerson}
              {sheet.supplier.phone ? ` · ${sheet.supplier.phone}` : ""}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-muted-foreground">Roll</dt>
          <dd className="font-mono font-medium">
            {sheet.rollCode}
            {sheet.tagCode ? ` · tag ${sheet.tagCode}` : ""}
          </dd>
          <dd>
            {sheet.receivedAt
              ? `Received ${formatDayLabel(sheet.receivedAt)}`
              : `Captured from ${formatManilaDateTime(sheet.startedAt)}`}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Sections scanned</dt>
          <dd className="font-medium">
            {t.reject} of {t.sections} rejected
            {t.sections > 0 && ` (${formatPercent(t.reject / t.sections)})`}
          </dd>
          <dd>
            {t.pass} passed. The camera’s verdict is final; rejected sections are set aside for
            salvage.
          </dd>
        </div>
      </dl>

      {sheet.rejected.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          This roll has no rejected sections, so there is nothing to claim.
        </p>
      ) : (
        <ol
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          data-testid="claim-sections"
        >
          {sheet.rejected.map((s) => (
            <li
              key={s.scanId}
              className="flex break-inside-avoid flex-col gap-2 rounded-md border bg-card p-3"
            >
              {s.hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated per-scan image
                <img
                  src={`/api/v1/scans/${s.scanId}/image`}
                  alt={`Section #${s.sequence} of roll ${sheet.rollCode}`}
                  className="aspect-[4/3] w-full rounded-sm bg-muted object-cover"
                />
              ) : (
                <span className="flex aspect-[4/3] items-center justify-center rounded-sm bg-muted text-sm text-muted-foreground">
                  No photo saved for this section
                </span>
              )}
              <p className="font-medium">
                Section #{s.sequence}
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {formatManilaDateTime(s.capturedAt)}
                </span>
              </p>
              <p className="text-sm">
                {s.defects.length > 0
                  ? s.defects.map((d) => `${d.label} ${formatPercent(d.confidence)}`).join(", ")
                  : "No defect marked by the camera"}
              </p>
            </li>
          ))}
        </ol>
      )}

      <p className="text-sm text-muted-foreground">
        Per roll only, never per person. Percentages are the camera model’s confidence that the
        defect is there.
      </p>
    </>
  );
}
