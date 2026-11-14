"use client";

import { FieldError } from "@/components/ui/field-error";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { InventoryCategory } from "@/lib/domain";
import { CATEGORY_LABELS } from "@/lib/inventory-rules";
import {
  inventoryItemFormSchema,
  type InventoryItemFormInput,
  type InventoryItemFormValues,
} from "@/server/validators/inventory.validator";
import { createItemAction, suggestCodeAction, updateItemAction } from "./actions";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as InventoryCategory[];
const DEFAULT_UNIT: Record<InventoryCategory, string> = {
  LEATHER_ROLL: "roll",
  NAILS: "box",
  ADHESIVE: "can",
  THREAD: "spool",
  EQUIPMENT: "piece",
  OTHER: "",
};
const FIELDS = [
  "sku",
  "name",
  "category",
  "supplierId",
  "unit",
  "reorderLevel",
  "openingStock",
] as const;

type Props = {
  /** Active suppliers, for a leather roll's Supplier (Phase 29, D-102). */
  suppliers: { id: string; name: string }[];
  /** Create mode: the code suggested for the default category. */
  suggestedCode?: string;
  /** Edit mode: the item id, name and current values. */
  item?: { id: string; name: string; values: InventoryItemFormInput };
};

export function ItemForm({ suppliers, suggestedCode = "", item }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<InventoryItemFormInput, unknown, InventoryItemFormValues>({
    resolver: zodResolver(inventoryItemFormSchema),
    mode: "onTouched",
    shouldFocusError: true,
    defaultValues: item?.values ?? {
      sku: suggestedCode,
      name: "",
      category: "LEATHER_ROLL",
      supplierId: "",
      unit: DEFAULT_UNIT.LEATHER_ROLL,
      reorderLevel: "",
      openingStock: "",
    },
  });
  const { errors } = form.formState;
  const describedBy = (field: string, hint?: string) =>
    errors[field as keyof typeof errors] ? `${field}-error` : hint;
  const unit = useWatch({ control: form.control, name: "unit" });
  const category = useWatch({ control: form.control, name: "category" });

  // Keep suggesting codes and units on create until the user types their own (setValue
  // doesn't mark a field dirty, so only typing does).
  async function onCategoryChange(category: InventoryCategory) {
    if (item) return;
    if (!form.getFieldState("unit").isDirty) form.setValue("unit", DEFAULT_UNIT[category]);
    if (category === "LEATHER_ROLL") form.setValue("openingStock", "");
    if (!form.getFieldState("sku").isDirty) {
      const code = await suggestCodeAction(category);
      if (code && !form.getFieldState("sku").isDirty) form.setValue("sku", code);
    }
  }

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = item
        ? { ...(await updateItemAction(item.id, values)), id: item.id }
        : await createItemAction(values);
      if (result.ok) {
        toast.success(item ? `${values.name} saved.` : `${values.name} added.`);
        router.push(`/inventory/${result.id}`);
        return;
      }
      setFormError(result.error);
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

  const categoryField = form.register("category");

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-6">
      {formError && <Alert tone="danger">{formError} Your entries are kept.</Alert>}

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg font-semibold">Item</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              aria-invalid={!!errors.category}
              aria-describedby={describedBy("category")}
              {...categoryField}
              onChange={(e) => {
                void categoryField.onChange(e);
                void onCategoryChange(e.target.value as InventoryCategory);
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
            <FieldError id="category-error" message={errors.category?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sku">Code</Label>
            <Input
              id="sku"
              autoComplete="off"
              className="font-mono uppercase"
              aria-invalid={!!errors.sku}
              aria-describedby={describedBy("sku", "sku-hint")}
              {...form.register("sku")}
            />
            {errors.sku ? (
              <FieldError id="sku-error" message={errors.sku.message} />
            ) : (
              <p id="sku-hint" className="text-sm text-muted-foreground">
                Use the code from the log book, or keep the suggested one.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            autoComplete="off"
            placeholder="e.g. Black cowhide, 1.4 mm"
            aria-invalid={!!errors.name}
            aria-describedby={describedBy("name")}
            {...form.register("name")}
          />
          <FieldError id="name-error" message={errors.name?.message} />
        </div>

        {category === "LEATHER_ROLL" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplierId">Supplier</Label>
            <Select
              id="supplierId"
              aria-invalid={!!errors.supplierId}
              aria-describedby={describedBy("supplierId", "supplierId-hint")}
              {...form.register("supplierId")}
            >
              <option value="">Choose a supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            {errors.supplierId ? (
              <FieldError id="supplierId-error" message={errors.supplierId.message} />
            ) : (
              <p id="supplierId-hint" className="text-sm text-muted-foreground">
                Who CPoint buys this leather from. A roll from another supplier is its own item.
                Suppliers are set up in Settings by the System Admin.
              </p>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-5">
        <legend className="mb-3 text-lg font-semibold">Stock</legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              autoComplete="off"
              placeholder="roll, box, kg…"
              aria-invalid={!!errors.unit}
              aria-describedby={describedBy("unit")}
              {...form.register("unit")}
            />
            <FieldError id="unit-error" message={errors.unit?.message} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reorderLevel">Reorder at</Label>
            <div className="relative">
              <Input
                id="reorderLevel"
                inputMode="decimal"
                autoComplete="off"
                className="pr-16"
                aria-invalid={!!errors.reorderLevel}
                aria-describedby={describedBy("reorderLevel", "reorderLevel-hint")}
                {...form.register("reorderLevel")}
              />
              <span className="pointer-events-none absolute top-1/2 right-3 max-w-14 -translate-y-1/2 truncate text-sm text-muted-foreground">
                {unit}
              </span>
            </div>
            {errors.reorderLevel ? (
              <FieldError id="reorderLevel-error" message={errors.reorderLevel.message} />
            ) : (
              <p id="reorderLevel-hint" className="text-sm text-muted-foreground">
                Flagged as low at or below this.
              </p>
            )}
          </div>

          {!item && category === "LEATHER_ROLL" && (
            <p className="text-sm text-muted-foreground">
              A leather roll item starts at 0. After saving, use Add rolls on its page with each
              roll’s area.
            </p>
          )}
          {!item && category !== "LEATHER_ROLL" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="openingStock">
                Opening stock <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="openingStock"
                  inputMode="decimal"
                  autoComplete="off"
                  className="pr-16"
                  aria-invalid={!!errors.openingStock}
                  aria-describedby={describedBy("openingStock", "openingStock-hint")}
                  {...form.register("openingStock")}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 max-w-14 -translate-y-1/2 truncate text-sm text-muted-foreground">
                  {unit}
                </span>
              </div>
              {errors.openingStock ? (
                <FieldError id="openingStock-error" message={errors.openingStock.message} />
              ) : (
                <p id="openingStock-hint" className="text-sm text-muted-foreground">
                  What’s on the shelf today.
                </p>
              )}
            </div>
          )}
        </div>
        {item && (
          <p className="text-sm text-muted-foreground">
            {item.values.category === "LEATHER_ROLL"
              ? "The quantity on hand follows the item’s rolls: Add rolls, Finish roll at Capture or Remove."
              : "The quantity on hand changes only on the Update stock sheet: what was added, used or corrected."}
          </p>
        )}
      </fieldset>

      <div className="flex items-center gap-3 border-t pt-5">
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          {item ? (pending ? "Saving…" : "Save changes") : pending ? "Adding…" : "Add item"}
        </Button>
        <Button asChild variant="ghost">
          <Link href={item ? `/inventory/${item.id}` : "/inventory"}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
