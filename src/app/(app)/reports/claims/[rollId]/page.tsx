/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager raising a quality claim with a leather supplier.
 * What:  one page per roll to print or save as PDF: the roll, its supplier, the counts, its defect
 *        share against the supplier limit (Phase 30C), and every rejected section with its photo and
 *        defects (Phase 20, D-072).
 * Worst: a claim that names a worker, or a sheet missing the photos the supplier asks for. Per
 *        roll only (D-008); every rejected section is listed with its photo, in section order.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { RollFindings } from "@/components/features/rolls/roll-findings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDayLabel, formatManilaDateTime, formatPercent } from "@/lib/format";
import { rollFindings } from "@/lib/roll-findings";
import { formatArea } from "@/lib/roll-rules";
import { requirePermission } from "@/server/policies/guard";
import { claimSheet } from "@/server/services/ops-report.service";
import { getRollDetail } from "@/server/services/roll.service";
import { isRollId } from "@/server/validators/roll.validator";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Claim sheet" };

export default async function ClaimSheetPage({ params }: PageProps<"/reports/claims/[rollId]">) {
  await requirePermission("report:production");
  await connection();
  const { rollId } = await params;
  const [sheet, roll] = isRollId(rollId)
    ? await Promise.all([claimSheet(rollId), getRollDetail(rollId)])
    : [null, null];
  if (!sheet || !roll) notFound();
  const t = sheet.totals;
  const findings = rollFindings(roll.scans);

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

      <Card aria-label="Claim details">
        <CardContent className="pt-5">
          <dl
            className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-8 gap-y-5"
            data-testid="claim-summary"
          >
            <Detail label="Supplier">
              <span className="font-medium">{sheet.supplier?.name ?? "No supplier recorded"}</span>
              {sheet.supplier?.contactPerson && (
                <span className="text-sm text-muted-foreground">
                  {sheet.supplier.contactPerson}
                  {sheet.supplier.phone ? ` · ${sheet.supplier.phone}` : ""}
                </span>
              )}
            </Detail>
            <Detail label="Roll">
              <span className="font-mono font-medium">{sheet.rollCode}</span>
              {sheet.tagCode && (
                <span className="text-sm text-muted-foreground">
                  Tag <span className="font-mono">{sheet.tagCode}</span>
                </span>
              )}
            </Detail>
            {sheet.areaSqFt !== null && (
              <Detail label="Area">
                <span className="tabular-nums">{formatArea(sheet.areaSqFt)}</span>
              </Detail>
            )}
            <Detail label={sheet.receivedAt ? "Received" : "Captured from"}>
              {sheet.receivedAt
                ? formatDayLabel(sheet.receivedAt)
                : formatManilaDateTime(sheet.startedAt)}
            </Detail>
            <Detail label="Sections scanned">
              <span className="font-medium tabular-nums">
                {t.reject} of {t.sections} rejected
                {t.sections > 0 && ` (${formatPercent(t.reject / t.sections)})`}
              </span>
              <span className="text-sm text-muted-foreground">{t.pass} passed</span>
            </Detail>
          </dl>
        </CardContent>
      </Card>

      {roll.item && (
        <RollFindings
          roll={roll}
          byType={findings.byType}
          largest={findings.largest}
          linkShots={false}
        />
      )}

      {sheet.rejected.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          This roll has no rejected sections, so there is nothing to claim.
        </p>
      ) : (
        <section aria-labelledby="sections-heading" className="flex flex-col gap-4">
          <h2 id="sections-heading" className="text-xl font-semibold">
            Rejected sections
          </h2>
          <ol
            className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4"
            data-testid="claim-sections"
          >
            {sheet.rejected.map((s) => (
              <li
                key={s.scanId}
                className="flex break-inside-avoid flex-col gap-2 rounded-lg border bg-card p-3 shadow-1"
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
                    ? s.defects
                        .map(
                          (d) =>
                            `${d.label}${d.lengthIn !== null ? ` ${d.lengthIn.toFixed(1)} in` : ""} ${formatPercent(d.confidence)}`,
                        )
                        .join(", ")
                    : "No defect marked by the camera"}
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

/** One fact on the claim: a muted label over its value and at most one muted line. */
function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-0.5">{children}</dd>
    </div>
  );
}
