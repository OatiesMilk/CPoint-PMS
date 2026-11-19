/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, after a delivery, at the office printer (Phase 32, D-128).
 * What:  print a sticker for each roll: its code big enough to read across the store, and a QR
 *        that Find roll and Capture read (A-80).
 * Worst: a label on the wrong roll. Each label repeats the leather, supplier, area and tag, so a
 *        mix-up shows when it is stuck on.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { LabelSheet } from "@/components/features/labels/label-sheet";
import { PrintLabelsButton } from "@/components/features/labels/print-labels-button";
import { PageHeader } from "@/components/features/page-header";
import { Alert } from "@/components/ui/alert";
import { requirePermission } from "@/server/policies/guard";
import { inStockRollLabels, LABELS_MAX, rollLabels } from "@/server/services/label.service";
import { isInventoryId } from "@/server/validators/inventory.validator";
import { isRollId } from "@/server/validators/roll.validator";

export const metadata: Metadata = { title: "Roll labels" };

export default async function RollLabelsPage({ searchParams }: PageProps<"/inventory/labels">) {
  await requirePermission("inventory:manage");
  await connection();
  const sp = await searchParams;
  const item = typeof sp.item === "string" && isInventoryId(sp.item) ? sp.item : null;
  const ids =
    typeof sp.rolls === "string" ? sp.rolls.split(",").filter(isRollId).slice(0, LABELS_MAX) : [];
  const labels = item ? await inStockRollLabels(item) : await rollLabels(ids);
  const back = item ? `/inventory/${item}` : "/inventory";

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          back={{ href: back, label: item ? "Back to the item" : "Inventory" }}
          title="Roll labels"
          description="An A4 sheet of 3 × 7 stickers. Print at actual size (100%), then stick each label on its roll."
          actions={<PrintLabelsButton count={labels.length} />}
        />
      </div>
      {labels.length === 0 ? (
        <Alert tone="info">
          No rolls to label. Open a leather item and choose Print labels, or add rolls first.
        </Alert>
      ) : (
        <LabelSheet
          kind="rolls"
          labels={labels.map((l) => ({
            id: l.id,
            code: l.code,
            qrSvg: l.qrSvg,
            qrText: l.qrText,
            lines: [
              l.item ?? "Leather roll",
              l.supplier ?? "",
              [l.area, l.receivedOn ? `arrived ${l.receivedOn}` : null].filter(Boolean).join(" · "),
              l.tagCode ? `Tag ${l.tagCode}` : "",
            ].filter(Boolean),
          }))}
        />
      )}
    </>
  );
}
