"use client";

import { FieldError } from "@/components/ui/field-error";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatQuantity } from "@/lib/inventory-rules";
import {
  batchFormSchema,
  type BatchFormInput,
  type BatchFormValues,
} from "@/server/validators/batch.validator";
import { createBatchAction, updateBatchAction } from "./actions";

type Option = { id: string; name: string };

type Props = {
  shoeTypes: Option[];
  suppliers: Option[];
  /** Create only: leather-roll inventory items with stock (D-023). */
  rollItems?: { id: string; sku: string; name: string; unit: string; quantityOnHand: number }[];
  today: string;
  /** Edit mode: the batch id, its current values, and whether the shoe type can still change. */
  batch?: { id: string; code: string; values: BatchFormInput; shoeTypeLockedReason?: string };
};

const FIELDS = [
  "rollCode",
  "shoeTypeId",
  "supplierId",
  "receivedAt",
  "targetQuotaPairs",
  "notes",
  "rollItemId",
] as const;

export function BatchForm({ shoeTypes, suppliers, rollItems = [], today, batch }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<BatchFormInput, unknown, BatchFormValues>({
    resolver: zodResolver(batchFormSchema),
    mode: "onTouched",
    shouldFocusError: true,
    defaultValues: batch?.values ?? {
      rollCode: "",
      shoeTypeId: shoeTypes.length === 1 ? shoeTypes[0].id : "",
      supplierId: "",
      receivedAt: today,
      targetQuotaPairs: "",
      notes: "",
      rollItemId: "",
    },
  });
  const { errors } = form.formState;
  const describedBy = (field: string) =>
    errors[field as keyof typeof errors] ? `${field}-error` : undefined;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      let result;
      if (batch) {
        result = await updateBatchAction(batch.id, values);
        if (result.ok) {
          toast.success(`Batch ${batch.code} saved.`);
          router.push(`/batches/${batch.id}`);
          return;
        }
      } else {
        result = await createBatchAction(values);
        if (result.ok) {
          toast.success(`Batch ${result.code} created.`);
          router.push(`/batches/${result.id}`);
          return;
        }
      }
      setFormError(result.error);
      // Server-side field errors (e.g. a supplier that was deactivated meanwhile) go next to the field.
      let focused = false;
      for (const field of FIELDS) {
        const message = result.fieldErrors?.[field];
        if (message) {
          form.setError(field, { message }, { shouldFocus: !focused });
          focused = true;
        }
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      {formError && <Alert tone="danger">{formError} Your entries are kept.</Alert>}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg font-semibold">Leather roll</legend>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rollCode">Roll code</Label>
          <Input
            id="rollCode"
            autoComplete="off"
            placeholder="e.g. LR-2026-118"
            aria-invalid={!!errors.rollCode}
            aria-describedby={describedBy("rollCode") ?? "rollCode-hint"}
            {...form.register("rollCode")}
          />
          {errors.rollCode ? (
            <FieldError id="rollCode-error" message={errors.rollCode.message} />
          ) : (
            <p id="rollCode-hint" className="text-sm text-muted-foreground">
              As printed on the roll’s tag, so the batch can be traced back to it.
            </p>
          )}
        </div>

        {!batch && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rollItemId">
              Take a roll from inventory{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Select
              id="rollItemId"
              aria-invalid={!!errors.rollItemId}
              aria-describedby={describedBy("rollItemId") ?? "rollItemId-hint"}
              {...form.register("rollItemId")}
            >
              <option value="">Don’t record</option>
              {rollItems.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.sku} · {r.name} ({formatQuantity(r.quantityOnHand, r.unit)} in stock)
                </option>
              ))}
            </Select>
            {errors.rollItemId ? (
              <FieldError id="rollItemId-error" message={errors.rollItemId.message} />
            ) : (
              <p id="rollItemId-hint" className="text-sm text-muted-foreground">
                {rollItems.length > 0
                  ? "Records one roll as used for this batch, so inventory stays right."
                  : "No leather rolls in stock in Inventory. You can still create the batch."}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplierId">
              Supplier <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Select
              id="supplierId"
              aria-invalid={!!errors.supplierId}
              aria-describedby={describedBy("supplierId")}
              {...form.register("supplierId")}
            >
              <option value="">Not recorded</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <FieldError id="supplierId-error" message={errors.supplierId?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receivedAt">Date received</Label>
            <Input
              id="receivedAt"
              type="date"
              max={today}
              aria-invalid={!!errors.receivedAt}
              aria-describedby={describedBy("receivedAt")}
              {...form.register("receivedAt")}
            />
            <FieldError id="receivedAt-error" message={errors.receivedAt?.message} />
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg font-semibold">Production</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shoeTypeId">Shoe type</Label>
            <Select
              id="shoeTypeId"
              disabled={!!batch?.shoeTypeLockedReason}
              aria-invalid={!!errors.shoeTypeId}
              aria-describedby={
                describedBy("shoeTypeId") ??
                (batch?.shoeTypeLockedReason ? "shoeTypeId-hint" : undefined)
              }
              {...form.register("shoeTypeId")}
            >
              <option value="" disabled>
                Choose…
              </option>
              {shoeTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {errors.shoeTypeId ? (
              <FieldError id="shoeTypeId-error" message={errors.shoeTypeId.message} />
            ) : (
              batch?.shoeTypeLockedReason && (
                <p id="shoeTypeId-hint" className="text-sm text-muted-foreground">
                  {batch.shoeTypeLockedReason}
                </p>
              )
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="targetQuotaPairs">
              Target quota <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative">
              <Input
                id="targetQuotaPairs"
                inputMode="numeric"
                autoComplete="off"
                className="pr-14"
                aria-invalid={!!errors.targetQuotaPairs}
                aria-describedby={describedBy("targetQuotaPairs")}
                {...form.register("targetQuotaPairs")}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                pairs
              </span>
            </div>
            <FieldError id="targetQuotaPairs-error" message={errors.targetQuotaPairs?.message} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="notes">
            Notes <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            rows={3}
            aria-invalid={!!errors.notes}
            aria-describedby={describedBy("notes")}
            {...form.register("notes")}
          />
          <FieldError id="notes-error" message={errors.notes?.message} />
        </div>
      </fieldset>

      <div className="flex items-center gap-3 border-t pt-5">
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          {batch ? (pending ? "Saving…" : "Save changes") : pending ? "Creating…" : "Create batch"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={batch ? `/batches/${batch.id}` : "/batches"}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
