"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { LocationOption } from "@/components/features/rolls/move-rolls-dialog";
import { locationText } from "@/lib/location-rules";
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { manilaToday } from "@/lib/format";
import { ADD_ROLLS_MAX, previewRollCodes, ROLL_MESSAGES } from "@/lib/roll-rules";
import {
  groupTagsForSupplier,
  ROLL_TAG_MESSAGES,
  type RollTagOption,
  tagLabel,
} from "@/lib/roll-tag-rules";
import { addRollsSchema } from "@/server/validators/roll.validator";
import { addRollsAction } from "../actions";

type Row = { key: number; areaSqFt: string; tagId: string; number: string };

/** Each row's React key, unique for the page's life. */
let rowKeys = 0;
const blank = (tagId = ""): Row => ({ key: ++rowKeys, areaSqFt: "", tagId, number: "" });

const fieldId = (path: string) => `add-rolls-${path.replaceAll(".", "-")}`;

/** The location last used in this browser, to prefill the next delivery (Phase 32). */
const LAST_LOCATION_KEY = "cpoint.addRolls.locationId";
function lastLocation(locations: LocationOption[]): string {
  try {
    const id = window.localStorage.getItem(LAST_LOCATION_KEY) ?? "";
    return locations.some((l) => l.id === id) ? id : "";
  } catch {
    return "";
  }
}
function rememberLocation(id: string) {
  try {
    if (id) window.localStorage.setItem(LAST_LOCATION_KEY, id);
  } catch {
    // Private mode or blocked storage: nothing to remember, the field just starts empty.
  }
}

/**
 * Add rolls (Phase 30A, D-103): the day they arrived, then one row per roll with its area in
 * square feet (from the stamp or the receipt), its roll tag (the supplier's default is chosen
 * first) and the digits after it, so the code reads LR-BLC-001 (Phase 42, D-139). Digits left empty
 * take the next free number. Every message names the roll and the fix; nothing is saved unless
 * every row is fine.
 */
/** Digits typed that can't be a roll number (1 to 6 digits, above 0); empty is fine (next free). */
function digitsInvalid(raw: string): boolean {
  const digits = raw.trim();
  return digits !== "" && !(/^\d{1,6}$/.test(digits) && Number(digits) > 0);
}

export function AddRollsDialog({
  item,
  supplier,
  tags,
  highest,
  locations = [],
}: {
  item: { id: string; name: string };
  /** Active storage locations (Phase 32); the rolls can be placed in one as they are added. */
  locations?: LocationOption[];
  /** The item's supplier, whose tags are listed first. Null when the item has none. */
  supplier: { id: string; name: string } | null;
  /** The active roll tags (Phase 42). */
  tags: RollTagOption[];
  /** Each tag code's highest roll number now, for the live code line under each row. */
  highest: Record<string, number>;
}) {
  const groups = groupTagsForSupplier(tags, supplier?.id ?? null);
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [receivedOn, setReceivedOn] = useState(manilaToday());
  const [rows, setRows] = useState<Row[]>(() => [blank(groups.defaultId)]);
  const [locationId, setLocationId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    setReceivedOn(manilaToday());
    setRows([blank(groups.defaultId)]);
    setLocationId(lastLocation(locations));
    setErrors({});
    setFormError(null);
  }

  function validate(): Record<string, string> {
    const out: Record<string, string> = {};
    const parsed = addRollsSchema.safeParse({
      receivedOn,
      rolls: rows.map(({ areaSqFt, tagId, number }) => ({ areaSqFt, tagId, number })),
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".");
        if (!out[key]) out[key] = issue.message;
      }
    // The server falls back to the supplier's default for a blank tag, but this box always says which.
    rows.forEach((row, i) => {
      const key = `rolls.${i}.tagId`;
      if (!row.tagId && !out[key]) out[key] = `Roll ${i + 1}: ${ROLL_TAG_MESSAGES.chooseTag}`;
    });
    if (!out.receivedOn && receivedOn > manilaToday())
      out.receivedOn = ROLL_MESSAGES.receivedInFuture;
    return out;
  }

  function submit() {
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return focusFirstInvalid(formRef.current);
    startTransition(async () => {
      const result = await addRollsAction(item.id, {
        receivedOn,
        rolls: rows.map(({ areaSqFt, tagId, number }) => ({ areaSqFt, tagId, number })),
        locationId: locationId || null,
      });
      if (result.ok) {
        const n = result.codes.length;
        const place = locations.find((l) => l.id === locationId);
        rememberLocation(locationId);
        toast.success(
          (n === 1
            ? `${result.codes[0]} added to ${item.name}`
            : `${n} rolls added to ${item.name}: ${result.codes[0]} to ${result.codes[n - 1]}`) +
            (place ? `, in ${place.code}.` : "."),
          {
            duration: 10000,
            action: {
              label: n === 1 ? "Print its label" : "Print their labels",
              onClick: () => router.push(`/inventory/labels?rolls=${result.ids.join(",")}`),
            },
          },
        );
        setOpen(false);
        reset();
        router.refresh();
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
        setErrors(result.fieldErrors);
        focusFirstInvalid(formRef.current);
        return;
      }
      setFormError(result.error);
    });
  }

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const summary = Object.entries(errors).map(([path, message]) => ({
    fieldId: fieldId(path),
    message,
  }));
  const count = rows.length;
  const previews = previewRollCodes(
    rows.map((row) => {
      const digits = row.number.trim();
      const valid = !digitsInvalid(digits);
      return {
        // Digits that can't be a number show no code; saving says why on that row.
        tagCode: valid ? (tagById.get(row.tagId)?.code ?? null) : null,
        number: digits === "" || !valid ? null : Number(digits),
      };
    }),
    highest,
  );
  const firstTag = tagById.get(rows[0]?.tagId ?? "");

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        disabled={!supplier || tags.length === 0}
      >
        <Plus aria-hidden />
        Add rolls
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size="lg" className="max-h-[90dvh] overflow-x-hidden overflow-y-auto">
          <DialogTitle>Add rolls to {item.name}</DialogTitle>
          <DialogDescription>
            One row per roll: its area from the stamp or the receipt, its tag and the digits after
            it. Codes run <span className="font-mono">LR-{firstTag?.code ?? "TAG"}-…</span>; digits
            left empty take the next free number when you save.
          </DialogDescription>
          <form
            ref={formRef}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <FormErrorSummary errors={summary} outcome="saved" />
            <div className="flex flex-col gap-1.5 sm:max-w-48">
              <Label htmlFor={fieldId("receivedOn")}>Arrived on</Label>
              <Input
                id={fieldId("receivedOn")}
                type="date"
                value={receivedOn}
                max={manilaToday()}
                aria-invalid={!!errors.receivedOn}
                aria-describedby={errors.receivedOn ? `${fieldId("receivedOn")}-error` : undefined}
                onChange={(e) => setReceivedOn(e.target.value)}
              />
              <FieldError id={`${fieldId("receivedOn")}-error`} message={errors.receivedOn} />
            </div>
            {locations.length > 0 && (
              <div className="flex flex-col gap-1.5 sm:max-w-80">
                <Label htmlFor={fieldId("locationId")}>
                  Kept in <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Select
                  id={fieldId("locationId")}
                  value={locationId}
                  aria-invalid={!!errors.locationId}
                  aria-describedby={
                    errors.locationId ? `${fieldId("locationId")}-error` : undefined
                  }
                  onChange={(e) => setLocationId(e.target.value)}
                >
                  <option value="">Not placed yet</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {locationText(l)}
                    </option>
                  ))}
                </Select>
                <FieldError id={`${fieldId("locationId")}-error`} message={errors.locationId} />
              </div>
            )}
            <ol className="flex flex-col gap-3">
              {rows.map((row, i) => {
                const areaKey = `rolls.${i}.areaSqFt`;
                const tagKey = `rolls.${i}.tagId`;
                const numberKey = `rolls.${i}.number`;
                const preview = previews[i];
                return (
                  <li key={row.key} className="flex flex-col gap-2 rounded-md border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Roll {i + 1}</span>
                      {count > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove roll ${i + 1} from this list`}
                          onClick={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={fieldId(areaKey)}>Area</Label>
                        <div className="relative">
                          <Input
                            id={fieldId(areaKey)}
                            inputMode="decimal"
                            autoComplete="off"
                            className="pr-14 tabular-nums"
                            value={row.areaSqFt}
                            placeholder="24.5"
                            aria-invalid={!!errors[areaKey]}
                            aria-describedby={
                              errors[areaKey] ? `${fieldId(areaKey)}-error` : undefined
                            }
                            onChange={(e) => setRow(row.key, { areaSqFt: e.target.value })}
                          />
                          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                            sq ft
                          </span>
                        </div>
                        <FieldError id={`${fieldId(areaKey)}-error`} message={errors[areaKey]} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={fieldId(tagKey)}>Tag</Label>
                        <Select
                          id={fieldId(tagKey)}
                          value={row.tagId}
                          aria-invalid={!!errors[tagKey]}
                          aria-describedby={errors[tagKey] ? `${fieldId(tagKey)}-error` : undefined}
                          onChange={(e) => setRow(row.key, { tagId: e.target.value })}
                        >
                          <option value="" disabled>
                            Choose a tag
                          </option>
                          {groups.mine.length > 0 && (
                            <optgroup label={supplier ? `${supplier.name}’s tags` : "Tags"}>
                              {groups.mine.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.code}
                                  {t.isDefault ? " (default)" : ""}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {groups.other.length > 0 && (
                            <optgroup label={groups.mine.length > 0 ? "Other tags" : "Tags"}>
                              {groups.other.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {tagLabel(t)}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </Select>
                        <FieldError id={`${fieldId(tagKey)}-error`} message={errors[tagKey]} />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={fieldId(numberKey)}>
                          Digits{" "}
                          <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id={fieldId(numberKey)}
                          inputMode="numeric"
                          autoComplete="off"
                          className="font-mono tabular-nums"
                          value={row.number}
                          placeholder="001"
                          aria-invalid={!!errors[numberKey]}
                          aria-describedby={
                            errors[numberKey] ? `${fieldId(numberKey)}-error` : undefined
                          }
                          onChange={(e) => setRow(row.key, { number: e.target.value })}
                        />
                        <FieldError
                          id={`${fieldId(numberKey)}-error`}
                          message={errors[numberKey]}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid="roll-code-preview">
                      {preview ? (
                        <>
                          Code: <span className="font-mono text-foreground">{preview}</span>
                          {!row.number.trim() && " (next free)"}
                        </>
                      ) : digitsInvalid(row.number) ? (
                        "Fix the digits to see the code."
                      ) : (
                        "Choose a tag to see the code."
                      )}
                    </p>
                  </li>
                );
              })}
            </ol>
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={count >= ADD_ROLLS_MAX}
                onClick={() =>
                  setRows((list) => [...list, blank(list[list.length - 1]?.tagId ?? "")])
                }
              >
                <Plus aria-hidden />
                Add another roll
              </Button>
            </div>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Not now
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                {count === 1 ? "Save 1 roll" : `Save ${count} rolls`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
