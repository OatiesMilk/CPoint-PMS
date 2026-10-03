/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, when a leather roll arrives or is about to be cut.
 * What:  register the roll as a batch in under a minute.
 * Worst: a typo in the roll code breaks traceability. The roll code is first and explained.
 */
import type { Metadata } from "next";
import { PageHeader } from "@/components/features/page-header";
import { manilaToday } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { getBatchFormOptions } from "@/server/services/batch.service";
import { BatchForm } from "../batch-form";

export const metadata: Metadata = { title: "New batch" };

export default async function NewBatchPage() {
  await requirePermission("batch:manage");
  const { shoeTypes, suppliers, rollItems } = await getBatchFormOptions();
  return (
    <>
      <PageHeader
        title="New batch"
        description="One leather roll is one batch. It starts as Planned."
      />
      <BatchForm
        shoeTypes={shoeTypes}
        suppliers={suppliers}
        rollItems={rollItems}
        today={manilaToday()}
      />
    </>
  );
}
