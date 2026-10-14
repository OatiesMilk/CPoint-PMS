"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleX, Info, LoaderCircle, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { StockBadge } from "@/components/features/inventory/stock-badge";
import { UrgencyBadge } from "@/components/features/procurement/request-badges";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { FormErrorSummary, type SummaryError } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { InventoryCategory } from "@/lib/domain";
import { CATEGORY_LABELS, formatQuantity, stockLevel } from "@/lib/inventory-rules";
import {
  daysLeftLabel,
  MAX_LINES,
  NEEDED_BY_MAX_DAYS,
  URGENCY_BANDS,
  urgencyFor,
} from "@/lib/procurement-rules";
import { addDays } from "@/lib/report-rules";
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

/** One item of the request being copied (D-044). */
export type CopyLine = {
  /** Null for a typed item, or one that has since been deactivated. */
  inventoryItemId: string | null;
  itemName: string;
  category: string;
  unit: string;
  quantity: number;
  note: string | null;
  /** Why it was rejected last time; null for an item that wasn't. */
  rejectionReason: string | null;
};
export type CopyFrom = { id: string; code: string; lines: CopyLine[] };

/** The picker value for "something that isn't in inventory yet". */
const OTHER = "other";

type LineValues = {
  inventoryItemId: string;
  itemName: string;
  category: string;
  unit: string;
  quantity: string;
  note: string;
  /** Which rejected item of the copied request this line brings back; "" for any other line. */
  copyKey: string;
};
type FormValues = {
  neededBy: string;
  remarks: string;
  lines: LineValues[];
};

const LINE_FIELDS = [
  "inventoryItemId",
  "quantity",
  "itemName",
  "category",
  "unit",
  "note",
] as const;
/** The input each line error belongs to. The item picker is `lines-0-item`. */
const lineFieldId = (i: number, field: (typeof LINE_FIELDS)[number]) =>
  `lines-${i}-${field === "inventoryItemId" ? "item" : field}`;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

const emptyLine = (inventoryItemId = ""): LineValues => ({
  inventoryItemId,
  itemName: "",
  category: "",
  unit: "",
  quantity: "",
  note: "",
  copyKey: "",
});

/** A row nobody has touched: no item, nothing typed. */
const isBlankLine = (l: LineValues) =>
  !l.inventoryItemId && !l.itemName && !l.quantity && !l.note && !l.copyKey;

/** The form keeps "other" as a picker choice; the shared schema wants a typed name instead. */
function toInput(values: FormValues, copiedFromId?: string): PurchaseRequestInput {
  return {
    neededBy: values.neededBy,
    remarks: values.remarks,
    copiedFromId,
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
  // With no item picked, the typed-item fields aren't on screen. Their messages would point at
  // nothing, so the line gets one message on the picker instead.
  const lineErrors = (result.errors as { lines?: Record<string, unknown>[] }).lines;
  values.lines.forEach((line, i) => {
    const e = lineErrors?.[i];
    if (!e || line.inventoryItemId === OTHER) return;
    if (e.itemName || e.category || e.unit) {
      e.inventoryItemId ??= {
        type: "custom",
        message:
          "Choose an item from the list. If it isn't there, pick “Something not in inventory yet”.",
      };
    }
    delete e.itemName;
    delete e.category;
    delete e.unit;
  });
  return Object.keys(result.errors).length
    ? { values: {}, errors: result.errors as never }
    : { values, errors: {} };
};

export function RequestForm({
  items,
  prefillItemId,
  canRequestLeatherRolls,
  today,
  copy,
  byFloorManager = false,
}: {
  items: PickerItem[];
  prefillItemId?: string;
  /** Leather rolls need the Floor Manager's OK (D-031); the server checks again. */
  canRequestLeatherRolls: boolean;
  /** Today in Manila (YYYY-MM-DD), from the server, so the urgency preview matches the list. */
  today: string;
  /** The rejected or cancelled request this one starts from (D-044). */
  copy?: CopyFrom;
  /** The Floor Manager raising a restock request themselves (D-045). */
  byFloorManager?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const byId = new Map(items.map((i) => [i.id, i]));
  const categories = [...new Set(items.map((i) => i.category))] as InventoryCategory[];

  /** A copied item as a form line. An item that can't be picked any more becomes a typed one. */
  const fromCopy = (line: CopyLine, copyKey = ""): LineValues => {
    const picked = line.inventoryItemId ? byId.get(line.inventoryItemId) : undefined;
    const base = { quantity: String(line.quantity), note: line.note ?? "", copyKey };
    if (picked?.allowed)
      return { ...base, inventoryItemId: picked.id, itemName: "", category: "", unit: "" };
    // Leather rolls this person may no longer request are left for them to choose again.
    const blocked = line.category === "LEATHER_ROLL" && !canRequestLeatherRolls;
    return {
      ...base,
      inventoryItemId: blocked ? "" : OTHER,
      itemName: blocked ? "" : line.itemName,
      category: blocked ? "" : line.category,
      unit: blocked ? "" : line.unit,
    };
  };
  // Rejected items start left out, each with its reason; ticking one brings it back (D-044).
  const rejected = (copy?.lines ?? []).flatMap((line, i) =>
    line.rejectionReason === null ? [] : [{ key: `copy-${i}`, line }],
  );
  const carried = (copy?.lines ?? [])
    .filter((l) => l.rejectionReason === null)
    .map((l) => fromCopy(l));

  const form = useForm<FormValues>({
    resolver,
    mode: "onTouched",
    shouldFocusError: true,
    defaultValues: {
      neededBy: "",
      remarks: "",
      lines: carried.length
        ? carried
        : [emptyLine(prefillItemId && byId.get(prefillItemId)?.allowed ? prefillItemId : "")],
    },
  });
  const { errors } = form.formState;
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lines" });
  const lines = useWatch({ control: form.control, name: "lines" });
  const neededBy = useWatch({ control: form.control, name: "neededBy" });
  // Shown before sending, so the urgency is never a surprise. Only for a date the form accepts.
  const previewable =
    ISO_DAY.test(neededBy ?? "") &&
    neededBy >= today &&
    neededBy <= addDays(today, NEEDED_BY_MAX_DAYS);

  // Every message with the input it belongs to, in the order the fields appear on the page.
  const summary: SummaryError[] = [];
  const listError = errors.lines?.root?.message ?? errors.lines?.message;
  if (listError) summary.push({ fieldId: "lines-0-item", message: listError });
  fields.forEach((_, i) => {
    for (const field of LINE_FIELDS) {
      const message = errors.lines?.[i]?.[field]?.message;
      if (message)
        summary.push({ fieldId: lineFieldId(i, field), message: `Item ${i + 1}: ${message}` });
    }
  });
  if (errors.neededBy?.message)
    summary.push({ fieldId: "neededBy", message: errors.neededBy.message });
  if (errors.remarks?.message)
    summary.push({ fieldId: "remarks", message: errors.remarks.message });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await createRequestAction(toInput(values, copy?.id));
      if (result.ok) {
        toast.success(
          byFloorManager
            ? `${result.code} raised. Decide its items next.`
            : `${result.code} sent to the Floor Manager.`,
        );
        for (const dup of result.alreadyRequested)
          toast.info(`${dup.code} already asks for ${dup.itemName}.`, { duration: 8000 });
        router.push(`/procurement/${result.id}`);
        return;
      }
      // The server names the exact field ("lines.2.quantity", "neededBy"): put each message under
      // its input and focus the first one. Anything it can't place goes in the alert on top.
      let placed = 0;
      for (const [path, message] of Object.entries(result.fieldErrors ?? {})) {
        const known =
          path === "neededBy" ||
          path === "remarks" ||
          /^lines\.\d+\.(inventoryItemId|quantity|itemName|category|unit|note)$/.test(path);
        if (!known) continue;
        form.setError(path as never, { message }, { shouldFocus: placed === 0 });
        placed += 1;
      }
      if (placed === 0) {
        setFormError(`${result.fieldErrors?.lines ?? result.error} What you typed is still here.`);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-3xl flex-col gap-6">
      {formError && <Alert tone="danger">{formError}</Alert>}
      {form.formState.submitCount > 0 && <FormErrorSummary errors={summary} />}
      {copy && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            Copied from{" "}
            <Link
              href={`/procurement/${copy.id}`}
              className="font-mono text-foreground underline underline-offset-4"
            >
              {copy.code}
            </Link>
            . Change anything you need, pick a new date, then send it as a new request.
          </span>
        </p>
      )}

      {rejected.length > 0 && (
        <fieldset className="flex flex-col gap-2 rounded-lg border bg-card p-4">
          <legend className="px-1 text-lg font-semibold">Rejected last time</legend>
          <p className="text-sm text-muted-foreground">
            These are left out. Tick one to ask for it again, if the reason no longer applies.
          </p>
          <ul className="flex flex-col divide-y">
            {rejected.map(({ key, line }) => {
              const at = (lines ?? []).findIndex((l) => l.copyKey === key);
              const checked = at >= 0;
              const full = !checked && fields.length >= MAX_LINES;
              return (
                <li key={key} className="flex flex-col gap-1 py-2">
                  <label className="inline-flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={checked}
                      disabled={pending || full}
                      aria-describedby={`${key}-reason`}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // Fill the untouched starter row rather than leaving it empty above.
                          const blank = form.getValues("lines").findIndex(isBlankLine);
                          if (blank >= 0) form.setValue(`lines.${blank}`, fromCopy(line, key));
                          else append(fromCopy(line, key));
                        } else if (at >= 0 && fields.length > 1) remove(at);
                        else if (at >= 0) form.setValue(`lines.${at}`, emptyLine());
                      }}
                    />
                    {line.itemName} · {formatQuantity(line.quantity, line.unit)}
                  </label>
                  <p
                    id={`${key}-reason`}
                    className="flex items-start gap-1.5 pl-6 text-sm text-muted-foreground"
                  >
                    <CircleX aria-hidden className="mt-0.5 size-4 shrink-0 text-reject" />
                    <span>
                      Rejected: {line.rejectionReason || "no reason was recorded"}
                      {full
                        ? ` This request already has ${MAX_LINES} items, the most it can hold.`
                        : ""}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

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
                <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={id("item")}>Item</Label>
                    <Select
                      id={id("item")}
                      aria-invalid={!!e?.inventoryItemId}
                      aria-describedby={e?.inventoryItemId ? id("item-error") : undefined}
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
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_10rem]">
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
                    aria-describedby={e?.note ? id("note-error") : undefined}
                    {...form.register(`lines.${i}.note`)}
                  />
                  <FieldError id={id("note-error")} message={e?.note?.message} />
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-3">
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
        <legend className="mb-3 text-lg font-semibold">When you need it</legend>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="neededBy">Needed by</Label>
          <Input
            id="neededBy"
            type="date"
            className="sm:max-w-56"
            min={today}
            max={addDays(today, NEEDED_BY_MAX_DAYS)}
            aria-required="true"
            aria-invalid={!!errors.neededBy}
            aria-describedby={errors.neededBy ? "neededBy-error" : "neededBy-hint"}
            {...form.register("neededBy")}
          />
          {errors.neededBy ? (
            <FieldError id="neededBy-error" message={errors.neededBy.message} />
          ) : previewable ? (
            <p
              id="neededBy-hint"
              className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
            >
              {byFloorManager ? "This request will show as" : "The Floor Manager will see this as"}
              <UrgencyBadge
                urgency={urgencyFor(neededBy, today)}
                daysLeft={daysLeftLabel(neededBy, today)}
              />
            </p>
          ) : (
            <p id="neededBy-hint" className="text-sm text-muted-foreground">
              The date sets the urgency: High within {URGENCY_BANDS.highMaxDays} working days,
              Medium within {URGENCY_BANDS.mediumMaxDays}, Low after that. Weekends don’t count.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="remarks">
            Remarks <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="remarks"
            placeholder="e.g. Nails for Friday’s topsider batch; we have half a box left."
            aria-invalid={!!errors.remarks}
            aria-describedby={errors.remarks ? "remarks-error" : "remarks-hint"}
            {...form.register("remarks")}
          />
          {errors.remarks ? (
            <FieldError id="remarks-error" message={errors.remarks.message} />
          ) : (
            <p id="remarks-hint" className="text-sm text-muted-foreground">
              {byFloorManager
                ? "Why it’s needed, for the record. It shows as the first remark on the request."
                : "Anything that helps the Floor Manager decide. It shows as the first remark on the request."}
            </p>
          )}
        </div>
      </fieldset>

      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        Requests can’t be edited after you send them. To change one, cancel it and copy it to a new
        one.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          {pending ? "Sending…" : byFloorManager ? "Raise request" : "Send request"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/procurement">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
