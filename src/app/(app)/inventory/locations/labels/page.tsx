/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, labelling the racks, bins and areas (Phase 32, D-128).
 * What:  a big code and a QR (LOC:<code>, A-80) that Find roll reads to list what is there.
 * Worst: a label that can't be read from the aisle. The code is the largest text on the sheet.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { LabelSheet } from "@/components/features/labels/label-sheet";
import { PrintLabelsButton } from "@/components/features/labels/print-labels-button";
import { PageHeader } from "@/components/features/page-header";
import { Alert } from "@/components/ui/alert";
import { requirePermission } from "@/server/policies/guard";
import { LABELS_MAX, locationLabels } from "@/server/services/label.service";
import { isLocationId } from "@/server/validators/location.validator";

export const metadata: Metadata = { title: "Location labels" };

export default async function LocationLabelsPage({
  searchParams,
}: PageProps<"/inventory/locations/labels">) {
  await requirePermission("location:manage");
  await connection();
  const sp = await searchParams;
  const ids =
    typeof sp.ids === "string" ? sp.ids.split(",").filter(isLocationId).slice(0, LABELS_MAX) : [];
  const labels = await locationLabels(ids);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          back={{ href: "/inventory/locations", label: "Storage locations" }}
          title="Location labels"
          description="An A4 sheet of 3 × 7 stickers. Print at actual size (100%), then stick each one on its rack, bin or area."
          actions={<PrintLabelsButton count={labels.length} />}
        />
      </div>
      {labels.length === 0 ? (
        <Alert tone="info">
          No locations chosen. Go back to Storage locations and tick the ones to print.
        </Alert>
      ) : (
        <LabelSheet
          kind="locations"
          labels={labels.map((l) => ({
            id: l.id,
            code: l.code,
            qrSvg: l.qrSvg,
            qrText: l.qrText,
            lines: [l.name ?? "", l.kind].filter(Boolean),
          }))}
        />
      )}
    </>
  );
}
