"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImageIcon, LoaderCircle, PackageX, X } from "lucide-react";
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
import { FormErrorSummary, type SummaryError } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCalendarDate } from "@/lib/format";
import { formatQuantity } from "@/lib/inventory-rules";
import { POD_ACCEPT, POD_MAX_BYTES, POD_MAX_FILES } from "@/lib/procurement-rules";
import { deliverySchema } from "@/server/validators/procurement.validator";
import { refreshAfterDeliveryAction } from "../actions";

export type DeliveryLine = {
  id: string;
  itemName: string;
  unit: string;
  /** What is still to come of this item. */
  outstanding: number;
  /** False for a typed item: it can be recorded as arrived, but isn't added to stock. */
  inInventory: boolean;
};

type ApiError = {
  error?: {
    code?: string;
    message?: string;
    details?: { path?: PropertyKey[]; message?: string }[];
  };
};

const MB = 1024 * 1024;
const fileSize = (bytes: number) =>
  bytes >= MB ? `${(bytes / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const sameFile = (a: File, b: File) =>
  a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

/**
 * Record a delivery (D-042): what arrived of each approved item, the day it came, and the proof
 * (a photo or PDF of the supplier's receipt). Each quantity starts at what is still outstanding,
 * so a full delivery is one click; a short one leaves the request partly received.
 */
export function DeliveryDialog({
  id,
  code,
  open,
  onOpenChange,
  lines,
  today,
  orderedOn,
}: {
  id: string;
  code: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lines: DeliveryLine[];
  /** Today in Manila (YYYY-MM-DD), from the server. */
  today: string;
  /** The day the order was placed: the earliest a delivery can be dated. */
  orderedOn: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [quantities, setQuantities] = useState(() => lines.map((l) => String(l.outstanding)));
  const [deliveredOn, setDeliveredOn] = useState(today);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const clear = (key: string) =>
    setErrors((all) => {
      if (!all[key]) return all;
      const next = { ...all };
      delete next[key];
      return next;
    });

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    // Copied now: the input's FileList is live and is emptied as soon as the input is cleared,
    // which can happen before React runs the update below (QA report 2026-10-13, F1).
    const picked = [...list];
    setFiles((current) => {
      const next = [...current];
      for (const file of picked) if (!next.some((f) => sameFile(f, file))) next.push(file);
      return next;
    });
    clear("files");
  }

  /** The same rules and words as the server (recordDelivery), checked before the upload. */
  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    const parsed = deliverySchema.safeParse({
      deliveredOn,
      note,
      lines: lines.map((l, i) => ({ lineId: l.id, quantity: quantities[i] })),
    });
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join(".");
        if (key && !found[key]) found[key] = issue.message;
      }
    if (!found.deliveredOn && orderedOn && deliveredOn < orderedOn)
      found.deliveredOn = `Delivered on can't be before the order was placed (${formatCalendarDate(orderedOn)}). Pick that day or a later one.`;
    lines.forEach((line, i) => {
      const key = `lines.${i}.quantity`;
      if (found[key]) return;
      if (Number(quantities[i]) > line.outstanding)
        found[key] =
          line.outstanding === 0
            ? `All of ${line.itemName} has already arrived. Enter 0 for it.`
            : `Received quantity can't be more than the ${formatQuantity(line.outstanding, line.unit)} still outstanding.`;
    });
    const anyLineError = lines.some((_, i) => found[`lines.${i}.quantity`]);
    if (!anyLineError && quantities.every((q) => Number(q) === 0))
      found.lines =
        "Enter what arrived for at least one item. If nothing came, there is no delivery to record.";
    if (files.length === 0)
      found.files =
        "Attach a photo or PDF of the delivery receipt. A delivery can't be recorded without proof.";
    else if (files.length > POD_MAX_FILES)
      found.files = `Attach at most ${POD_MAX_FILES} files here. Remove ${files.length - POD_MAX_FILES} and try again.`;
    else {
      const big = files.find((f) => f.size > POD_MAX_BYTES);
      if (big)
        found.files = `“${big.name}” is larger than ${POD_MAX_BYTES / MB} MB. Attach a smaller photo or PDF.`;
    }
    return found;
  }

  /** Where each message lives, in the order the fields appear. */
  const fieldIdFor = (key: string) =>
    key === "lines"
      ? "delivery-line-0"
      : key.startsWith("lines.")
        ? `delivery-line-${key.split(".")[1]}`
        : `delivery-${key}`;

  function show(found: Record<string, string>) {
    setErrors(found);
    const order = [
      ...lines.map((_, i) => `lines.${i}.quantity`),
      "lines",
      "deliveredOn",
      "files",
      "note",
    ];
    const first = order.find((key) => found[key]);
    if (first) requestAnimationFrame(() => document.getElementById(fieldIdFor(first))?.focus());
  }

  async function submit() {
    setFormError(null);
    const found = validate();
    if (Object.keys(found).length) return show(found);

    setBusy(true);
    try {
      const body = new FormData();
      body.set(
        "data",
        JSON.stringify({
          deliveredOn,
          note,
          lines: lines.map((l, i) => ({ lineId: l.id, quantity: quantities[i] })),
        }),
      );
      for (const file of files) body.append("files", file);
      const response = await fetch(`/api/v1/procurement/requests/${id}/deliveries`, {
        method: "POST",
        body,
      });
      const json = (await response.json().catch(() => ({}))) as ApiError & {
        data?: { message?: string };
      };
      if (response.ok) {
        await refreshAfterDeliveryAction();
        onOpenChange(false);
        toast.success(json.data?.message ?? `Delivery recorded for ${code}.`);
        router.refresh();
        return;
      }
      // The server names the field ("lines.1.quantity", "files"): put each message under it.
      const fromServer: Record<string, string> = {};
      for (const issue of json.error?.details ?? []) {
        const key = (issue.path ?? []).map(String).join(".");
        const known = /^(deliveredOn|note|files|lines|lines\.\d+\.quantity)$/.test(key);
        if (known && issue.message)
          fromServer[key] = fromServer[key] ? `${fromServer[key]} ${issue.message}` : issue.message;
      }
      if (Object.keys(fromServer).length) return show(fromServer);
      onOpenChange(false);
      setFormError(
        json.error?.message ??
          `The delivery for ${code} couldn't be saved and nothing was changed. Refresh the page and try again.`,
      );
      if (json.error?.code === "STALE" || json.error?.code === "CONFLICT") router.refresh();
    } catch {
      setFormError(
        "The upload didn't reach the server, so nothing was saved. Check the connection and try again. What you entered is still here.",
      );
    } finally {
      setBusy(false);
    }
  }

  const summary: SummaryError[] = Object.entries(errors).map(([key, message]) => ({
    fieldId: fieldIdFor(key),
    message: key.startsWith("lines.")
      ? `${lines[Number(key.split(".")[1])]?.itemName ?? "Item"}: ${message}`
      : message,
  }));

  return (
    <>
      {formError && !open && <Alert tone="danger">{formError}</Alert>}
      <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
        <DialogContent className="max-h-screen max-w-2xl overflow-y-auto">
          <form
            noValidate
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <DialogTitle>Record a delivery for {code}</DialogTitle>
            <DialogDescription>
              Enter what actually arrived. Anything short stays open until the next delivery, and
              what arrived is added to stock when you save.
            </DialogDescription>
            {formError && <Alert tone="danger">{formError}</Alert>}
            <FormErrorSummary errors={summary} outcome="saved" />

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-2 text-lg font-semibold">What arrived</legend>
              <ol className="flex flex-col divide-y border-y">
                {lines.map((line, i) => {
                  const key = `lines.${i}.quantity`;
                  const error = errors[key];
                  return (
                    <li
                      key={line.id}
                      className="grid grid-cols-1 items-start gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_11rem]"
                    >
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`delivery-line-${i}`} className="text-base font-medium">
                          {line.itemName}
                        </Label>
                        <span className="text-sm text-muted-foreground">
                          {line.outstanding === 0
                            ? "All of it has arrived."
                            : `${formatQuantity(line.outstanding, line.unit)} still to come.`}
                        </span>
                        {!line.inInventory && (
                          <span className="flex items-start gap-1.5 text-sm text-muted-foreground">
                            <PackageX aria-hidden className="mt-0.5 size-4 shrink-0" />
                            Not in inventory, so it won’t be added to stock. Add this item to
                            inventory to receive it into stock.
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div className="relative">
                          <Input
                            id={`delivery-line-${i}`}
                            inputMode="decimal"
                            autoComplete="off"
                            className="pr-16"
                            value={quantities[i]}
                            disabled={busy || line.outstanding === 0}
                            aria-invalid={!!error}
                            aria-describedby={error ? `delivery-line-${i}-error` : undefined}
                            onChange={(e) => {
                              setQuantities((all) =>
                                all.map((q, at) => (at === i ? e.target.value : q)),
                              );
                              clear(key);
                              clear("lines");
                            }}
                          />
                          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
                            {line.unit}
                          </span>
                        </div>
                      </div>
                      <FieldError
                        id={`delivery-line-${i}-error`}
                        message={error}
                        className="sm:col-span-2"
                      />
                    </li>
                  );
                })}
              </ol>
              <FieldError id="delivery-lines-error" message={errors.lines} />
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-deliveredOn">Delivered on</Label>
              <Input
                id="delivery-deliveredOn"
                type="date"
                className="sm:max-w-56"
                min={orderedOn ?? undefined}
                max={today}
                value={deliveredOn}
                disabled={busy}
                aria-required="true"
                aria-invalid={!!errors.deliveredOn}
                aria-describedby={errors.deliveredOn ? "delivery-deliveredOn-error" : undefined}
                onChange={(e) => {
                  setDeliveredOn(e.target.value);
                  clear("deliveredOn");
                }}
              />
              <FieldError id="delivery-deliveredOn-error" message={errors.deliveredOn} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-files">Proof of delivery</Label>
              <Input
                id="delivery-files"
                type="file"
                multiple
                accept={POD_ACCEPT}
                className="h-auto py-1.5"
                disabled={busy}
                aria-required="true"
                aria-invalid={!!errors.files}
                aria-describedby={errors.files ? "delivery-files-error" : "delivery-files-hint"}
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              {errors.files ? (
                <FieldError id="delivery-files-error" message={errors.files} />
              ) : (
                <p id="delivery-files-hint" className="text-sm text-muted-foreground">
                  A photo or PDF of the supplier’s delivery receipt. Up to {POD_MAX_FILES} files,{" "}
                  {POD_MAX_BYTES / MB} MB each. Files can’t be removed once saved.
                </p>
              )}
              {files.length > 0 && (
                <ul className="flex flex-col gap-1" aria-label="Files to upload">
                  {files.map((file) => (
                    <li
                      key={`${file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      {file.type === "application/pdf" ? (
                        <FileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ImageIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 truncate">{file.name}</span>
                      <span className="shrink-0 text-muted-foreground">{fileSize(file.size)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto shrink-0"
                        aria-label={`Remove ${file.name}`}
                        disabled={busy}
                        onClick={() => {
                          setFiles((all) => all.filter((f) => !sameFile(f, file)));
                          clear("files");
                        }}
                      >
                        <X aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="delivery-note"
                rows={2}
                value={note}
                disabled={busy}
                aria-invalid={!!errors.note}
                aria-describedby={errors.note ? "delivery-note-error" : undefined}
                placeholder="e.g. Two rolls short; the supplier brings them on Friday"
                onChange={(e) => {
                  setNote(e.target.value);
                  clear("note");
                }}
              />
              <FieldError id="delivery-note-error" message={errors.note} />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={busy}>
                  Go back
                </Button>
              </DialogClose>
              <Button type="submit" disabled={busy}>
                {busy && <LoaderCircle aria-hidden className="animate-spin" />}
                {busy ? "Uploading…" : "Record delivery"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
