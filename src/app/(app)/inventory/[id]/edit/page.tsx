/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, correcting an item's name, unit or reorder level.
 * What:  change the item's details. The quantity is not here: it only moves through stock entries.
 * Worst: someone "fixes" stock by editing it. There's no quantity field, and the page says why.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/features/page-header";
import { requirePermission } from "@/server/policies/guard";
import { getItemDetail } from "@/server/services/inventory.service";
import { supplierOptions } from "@/server/services/roll.service";
import { isInventoryId } from "@/server/validators/inventory.validator";
import { ItemForm } from "../../item-form";

export const metadata: Metadata = { title: "Edit item" };

export default async function EditItemPage({ params }: PageProps<"/inventory/[id]/edit">) {
  await requirePermission("inventory:manage");
  const { id } = await params;
  if (!isInventoryId(id)) notFound();
  const detail = await getItemDetail(id);
  if (!detail) notFound();
  const { item } = detail;
  // An item keeps its supplier even after the supplier was deactivated in Settings.
  const active = await supplierOptions();
  const suppliers =
    item.supplier && !active.some((s) => s.id === item.supplier?.id)
      ? [...active, item.supplier]
      : active;
  return (
    <>
      <PageHeader title={`Edit ${item.name}`} description={`Code ${item.sku}`} />
      <ItemForm
        suppliers={suppliers}
        item={{
          id: item.id,
          name: item.name,
          values: {
            sku: item.sku,
            name: item.name,
            category: item.category,
            supplierId: item.supplierId ?? "",
            unit: item.unit,
            reorderLevel: String(item.reorderLevel),
          },
        }}
      />
    </>
  );
}
