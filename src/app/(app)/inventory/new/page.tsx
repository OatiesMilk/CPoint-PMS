/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, moving an item from the paper log book into the system.
 * What:  add a material with its unit, reorder level and today's stock in under a minute.
 * Worst: a wrong reorder level hides a shortage. It's explained right under the field.
 */
import type { Metadata } from "next";
import { PageHeader } from "@/components/features/page-header";
import { requirePermission } from "@/server/policies/guard";
import { suggestItemCode } from "@/server/services/inventory.service";
import { supplierOptions } from "@/server/services/roll.service";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Add item" };

export default async function NewItemPage() {
  await requirePermission("inventory:manage");
  return (
    <>
      <PageHeader
        title="Add item"
        description="A material you keep on the shelf. Opening stock is recorded as the first entry."
      />
      <ItemForm
        suppliers={await supplierOptions()}
        suggestedCode={await suggestItemCode("LEATHER_ROLL")}
      />
    </>
  );
}
