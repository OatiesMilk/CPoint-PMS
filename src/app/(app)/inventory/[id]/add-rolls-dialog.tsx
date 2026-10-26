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
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { manilaToday } from "@/lib/format";
import { ADD_ROLLS_MAX, ROLL_MESSAGES } from "@/lib/roll-rules";
import { addRollsSchema } from "@/server/validators/roll.validator";
import { addRollsAction } from "../actions";

type Row = { key: number; areaSqFt: string; tagCode: string };

/** Each row's React key, unique for the page's life. */
let rowKeys = 0;
const blank = (): Row => ({ key: ++rowKeys, areaSqFt: "", tagCode: "" });

const fieldId = (path: string) => `add-rolls-${path.replaceAll(".", "-")}`;

/**
 * Add rolls (Phase 30A, D-103): the day they arrived, then one row per roll with its area in
 * square feet (from the stamp or the receipt) and the supplier's tag (optional). Every message
 * names the roll and the fix; nothing is saved unless every row is fine.
 */
export function AddRollsDialog({
  item,
  supplierCode,
}: {
  item: { id: string; name: string };
  /** The supplier's short code, for "Codes run LR-MLT-…". Null when the item has no supplier. */
  supplierCode: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [receivedOn, setReceivedOn] = useState(manilaToday());
  const [rows, setRows] = useState<Row[]>(() => [blank()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function reset() {
    setReceivedOn(manilaToday());
    setRows([blank()]);
    setErrors({});
    setFormError(null);
  }

  function validate(): Record<string, string> {
    const out: Record<string, string> = {};
    const parsed = addRollsSchema.safeParse({
      receivedOn,
      rolls: rows.map(({ areaSqFt, tagCode }) => ({ areaSqFt, tagCode })),
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".");
        if (!out[key]) out[key] = issue.message;
      }
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
        rolls: rows.map(({ areaSqFt, tagCode }) => ({ areaSqFt, tagCode })),
      });
      if (result.ok) {
        const n = result.codes.length;
        toast.success(
          n === 1
            ? `${result.codes[0]} added to ${item.name}.`
            : `${n} rolls added to ${item.name}: ${result.codes[0]} to ${result.codes[n - 1]}.`,
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

  return (
    <>
      <Button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        disabled={!supplierCode}
      >
        <Plus aria-hidden />
        Add rolls
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogTitle>Add rolls to {item.name}</DialogTitle>
          <DialogDescription>
            One row per roll, with its area from the stamp or the receipt. Codes run{" "}
            <span className="font-mono">LR-{supplierCode}-…</span> and are given when you save.
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
            <ol className="flex flex-col gap-3">
              {rows.map((row, i) => {
                const areaKey = `rolls.${i}.areaSqFt`;
                const tagKey = `rolls.${i}.tagCode`;
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
                        <Label htmlFor={fieldId(tagKey)}>
                          Supplier’s tag{" "}
                          <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id={fieldId(tagKey)}
                          autoComplete="off"
                          value={row.tagCode}
                          aria-invalid={!!errors[tagKey]}
                          aria-describedby={errors[tagKey] ? `${fieldId(tagKey)}-error` : undefined}
                          onChange={(e) => setRow(row.key, { tagCode: e.target.value })}
                        />
                        <FieldError id={`${fieldId(tagKey)}-error`} message={errors[tagKey]} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={count >= ADD_ROLLS_MAX}
                onClick={() => setRows((list) => [...list, blank()])}
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
