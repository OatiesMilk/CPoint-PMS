import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/features/page-header";
import { manilaToday } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { getBatchDetail, getBatchFormOptions } from "@/server/services/batch.service";
import { isBatchId } from "@/server/validators/batch.validator";
import { BatchForm } from "../../batch-form";

export const metadata: Metadata = { title: "Edit batch" };

export default async function EditBatchPage({ params }: PageProps<"/batches/[id]/edit">) {
  await requirePermission("batch:manage");
  const { id } = await params;
  if (!isBatchId(id)) notFound();
  const [detail, { shoeTypes, suppliers }] = await Promise.all([
    getBatchDetail(id),
    getBatchFormOptions(),
  ]);
  if (!detail) notFound();
  const { batch, actions } = detail;
  if (!actions.edit.allowed) redirect(`/batches/${id}`);

  // Keep the current shoe type/supplier selectable even if an admin has since deactivated it.
  const withCurrent = (
    list: { id: string; name: string }[],
    current: { id: string; name: string } | null,
  ) => (current && !list.some((o) => o.id === current.id) ? [...list, current] : list);

  return (
    <>
      <PageHeader title={`Edit ${batch.code}`} description={`Roll ${batch.rollCode}`} />
      <BatchForm
        shoeTypes={withCurrent(shoeTypes, batch.shoeType)}
        suppliers={withCurrent(suppliers, batch.supplier)}
        today={manilaToday()}
        batch={{
          id: batch.id,
          code: batch.code,
          shoeTypeLockedReason: actions.changeShoeType.allowed
            ? undefined
            : actions.changeShoeType.reason,
          values: {
            rollCode: batch.rollCode,
            shoeTypeId: batch.shoeTypeId,
            supplierId: batch.supplierId ?? "",
            receivedAt: batch.receivedAt.toISOString().slice(0, 10),
            targetQuotaPairs: batch.targetQuotaPairs?.toString() ?? "",
            notes: batch.notes ?? "",
          },
        }}
      />
    </>
  );
}
