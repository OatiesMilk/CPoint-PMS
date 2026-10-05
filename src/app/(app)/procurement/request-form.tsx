"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Info, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { StockBadge } from "@/components/features/inventory/stock-badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryCategory } from "@/lib/domain";
import { CATEGORY_LABELS, formatQuantity, stockLevel } from "@/lib/inventory-rules";
import { MAX_LINES, PRIORITY_LABELS } from "@/lib/procurement-rules";
import {
  purchaseRequestSchema,
  type PurchaseRequestInput,
} from "@/server/validators/procurement.validator";
import { createRequestAction } from "./actions";

export type PickerItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  low: boolean;
  /** False for leather rolls when this constructor isn't allowed to request them (D-031). */
  allowed: boolean;
  openRequestCode: string | null;
};

/** The picker value for "something that isn't in inventory yet". */
const OTHER = "other";

type LineValues = {
  inventoryItemId: string;
  itemName: string;
  category: string;
  unit: string;
  quantity: string;
  note: string;
};
type FormValues = {
  priority: "NORMAL" | "URGENT";
  neededBy: string;
  justification: string;
  lines: LineValues[];
};

const emptyLine = (inventoryItemId = ""): LineValues => ({
  inventoryItemId,
  itemName: "",
  category: "",
  unit: "",
  quantity: "",
  note: "",
});

/** The form keeps "other" as a picker choice; the shared schema wants a typed name instead. */
function toInput(values: FormValues): PurchaseRequestInput {
  return {
    ...values,
    lines: values.lines.map((l) => {
      const other = l.inventoryItemId === OTHER;
      return {
        inventoryItemId: other ? undefined : l.inventoryItemId,
        itemName: other ? l.itemName : undefined,
        category: other ? l.category : undefined,
        unit: other ? l.unit : undefined,
        quantity: l.quantity,
        note: l.note,
      };
    }),
  };
}

// Validate with the same schema as the server and the API, after mapping the picker value.
const schemaResolver = zodResolver(purchaseRequestSchema);
const resolver: Resolver<FormValues> = async (values, context, options) => {
  const result = await schemaResolver(toInput(values), context, options as never);
  return Object.keys(result.errors).length
    ? { values: {}, errors: result.errors as never }
    : { values, errors: {} };
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-reject">
      {message}
    </p>
  );
}

export function RequestForm({
  items,
  prefillItemId,
  canRequestLeatherRolls,
}: {
  items: PickerItem[];
  prefillItemId?: string;
  /** Leather rolls need the Floor Manager's OK (D-031); the server checks again. */
  canRequestLeatherRolls: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));
  const categories = [...new Set(items.map((i) => i.category))] as InventoryCategory[];

  const form = useForm<FormValues>({
    resolver,
    mode: "onTouched",
    shouldFocusError: true,
    defaultValues: {
      priority: "NORMAL",
      neededBy: "",
      justification: "",
      lines: [emptyLine(prefillItemId && byId.get(prefillItemId)?.allowed ? prefillItemId : "")],
    },
  });
  const { errors } = form.formState;
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = useWatch({ control: form.control, name: "lines" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createRequestAction(toInput(values));
      if (result.ok) {
        toast.success(`${result.code} sent to the Floor Manager.`);
        for (const dup of result.alreadyRequested)
          toast.info(`${dup.code} already asks for ${dup.itemName}.`, { duration: 8000 });
        router.push(`/procurement/${result.id}`);
        return;
      }
      setFormError(
        result.fieldErrors?.lines
          ? `${result.fieldErrors.lines} Your entries are kept.`
          : `${result.error} Your entries are kept.`,
      );
      for (const field of ["justification", "neededBy", "priority"] as const) {
        const message = result.fieldErrors?.[field];
        if (message) form.setError(field, { message }, { shouldFocus: true });
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-6">
      {formError && <Alert tone="danger">{formError}</Alert>}

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-3 text-lg font-semibold">What you need</legend>
        {!canRequestLeatherRolls && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            Leather rolls are greyed out: ask your Floor Manager to let you request them.
          </p>
        )}
        {errors.lines?.root?.message || errors.lines?.message ? (
          <FieldError
            id="lines-error"
            message={errors.lines?.root?.message ?? errors.lines?.message}
          />
        ) : null}

        <ol className="flex flex-col gap-4">
          {fields.map((field, i) => {
            const line = lines?.[i];
            const item = line?.inventoryItemId ? byId.get(line.inventoryItemId) : undefined;
            const isOther = line?.inventoryItemId === OTHER;
            const e = errors.lines?.[i];
            const id = (name: string) => `lines-${i}-${name}`;
            return (
              <li
                key={field.id}
                aria-label={`Item ${i + 1}`}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_10rem_auto] items-start gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={id("item")}>Item</Label>
                    <Select
                      id={id("item")}
                      aria-invalid={!!e?.inventoryItemId || !!e?.itemName}
                      aria-describedby={e?.itemName ? id("itemName-error") : undefined}
                      {...form.register(`lines.${i}.inventoryItemId`)}
                    >
                      <option value="">Choose an item…</option>
                      {categories.map((c) => (
                        <optgroup key={c} label={CATEGORY_LABELS[c]}>
                          {items
                            .filter((it) => it.category === c)
                            .map((it) => (
                              <option key={it.id} value={it.id} disabled={!it.allowed}>
                                {it.name} · {formatQuantity(it.onHand, it.unit)} on hand
                                {it.low ? " (low)" : ""}
                                {it.allowed ? "" : " (needs your Floor Manager’s OK)"}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                      <option value={OTHER}>Something not in inventory yet…</option>
                    </Select>
                    <FieldError id={id("item-error")} message={e?.inventoryItemId?.message} />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={id("quantity")}>Quantity</Label>
                    <div className="relative">
                      <Input
                        id={id("quantity")}
                        inputMode="decimal"
                        autoComplete="off"
                        className="pr-16"
                        aria-invalid={!!e?.quantity}
                        aria-describedby={e?.quantity ? id("quantity-error") : undefined}
                        {...form.register(`lines.${i}.quantity`)}
                      />
                      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                        {item?.unit ?? (isOther ? line?.unit : "")}
                      </span>
                    </div>
                    <FieldError id={id("quantity-error")} message={e?.quantity?.message} />
                  </div>

                  <div className="pt-6">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove item ${i + 1}`}
                      disabled={fields.length === 1}
                      onClick={() => remove(i)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </div>

                {item && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground tabular-nums">
                    <StockBadge level={stockLevel(item.onHand, item.reorderLevel)} />
                    {formatQuantity(item.onHand, item.unit)} on hand · reorder at{" "}
                    {formatQuantity(item.reorderLevel, item.unit)}
                  </p>
                )}
                {item?.openRequestCode && (
                  <p className="flex items-center gap-2 text-sm text-rework" role="note">
                    <TriangleAlert aria-hidden className="size-4 shrink-0" />
                    {item.openRequestCode} already asks for this. You can still send yours.
                  </p>
                )}

                {isOther && (
                  <div className="grid grid-cols-[minmax(0,1fr)_11rem_10rem] gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={id("itemName")}>Item name</Label>
                      <Input
                        id={id("itemName")}
                        autoComplete="off"
                        placeholder="e.g. Brass eyelets, 5 mm"
                        aria-invalid={!!e?.itemName}
                        aria-describedby={e?.itemName ? id("itemName-error") : undefined}
                        {...form.register(`lines.${i}.itemName`)}
                      />
                      <FieldError id={id("itemName-error")} message={e?.itemName?.message} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={id("category")}>Kind</Label>
                      <Select
                        id={id("category")}
                        aria-invalid={!!e?.category}
                        aria-describedby={e?.category ? id("category-error") : undefined}
                        {...form.register(`lines.${i}.category`)}
                      >
                        <option value="">Choose…</option>
                        {(Object.keys(CATEGORY_LABELS) as InventoryCategory[]).map((c) => (
                          <option
                            key={c}
                            value={c}
                            disabled={c === "LEATHER_ROLL" && !canRequestLeatherRolls}
                          >
                            {CATEGORY_LABELS[c]}
                            {c === "LEATHER_ROLL" && !canRequestLeatherRolls
                              ? " (needs your Floor Manager’s OK)"
                              : ""}
                          </option>
                        ))}
                      </Select>
                      <FieldError id={id("category-error")} message={e?.category?.message} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={id("unit")}>Unit</Label>
                      <Input
                        id={id("unit")}
                        autoComplete="off"
                        placeholder="box, pack…"
                        aria-invalid={!!e?.unit}
                        aria-describedby={e?.unit ? id("unit-error") : undefined}
                        {...form.register(`lines.${i}.unit`)}
                      />
                      <FieldError id={id("unit-error")} message={e?.unit?.message} />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={id("note")}>
                    Note <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id={id("note")}
                    autoComplete="off"
                    placeholder="Size, colour, brand…"
                    aria-invalid={!!e?.note}
                    {...form.register(`lines.${i}.note`)}
                  />
                  <FieldError id={id("note-error")} message={e?.note?.message} />
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={fields.length >= MAX_LINES}
            onClick={() => append(emptyLine())}
          >
            <Plus aria-hidden />
            Add another item
          </Button>
          <span className="text-sm text-muted-foreground">
            {fields.length >= MAX_LINES
              ? `That's the most for one request (${MAX_LINES}). Send another for the rest.`
              : `Up to ${MAX_LINES} items per request.`}
          </span>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg font-semibold">Why and when</legend>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="priority">Priority</Label>
            <Select id="priority" {...form.register("priority")}>
              <option value="NORMAL">{PRIORITY_LABELS.NORMAL}</option>
              <option value="URGENT">{PRIORITY_LABELS.URGENT}: the line stops without it</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="neededBy">
              Needed by <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="neededBy"
              type="date"
              aria-invalid={!!errors.neededBy}
              aria-describedby={errors.neededBy ? "neededBy-error" : undefined}
              {...form.register("neededBy")}
            />
            <FieldError id="neededBy-error" message={errors.neededBy?.message} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="justification">Why it’s needed</Label>
          <Textarea
            id="justification"
            placeholder="e.g. Nails for Friday’s topsider batch; we have half a box left."
            aria-invalid={!!errors.justification}
            aria-describedby={errors.justification ? "justification-error" : undefined}
            {...form.register("justification")}
          />
          <FieldError id="justification-error" message={errors.justification?.message} />
        </div>
      </fieldset>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Requests can’t be edited after you send them. To change one, cancel it and send a new one.
      </p>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          {pending ? "Sending…" : "Send request"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/procurement">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
