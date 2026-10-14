"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EXPECTED_DELIVERY_MAX_DAYS, type PurchaseAction } from "@/lib/procurement-rules";
import { addDays } from "@/lib/report-rules";
import {
  cancelAfterApprovalSchema,
  closeShortSchema,
  orderSchema,
  rejectSchema,
} from "@/server/validators/procurement.validator";
import {
  cancelAfterApprovalAction,
  cancelRequestAction,
  closeShortAction,
  orderRequestAction,
  rejectRequestAction,
} from "../actions";
import { DeliveryDialog, type DeliveryLine } from "./delivery-dialog";

type Kind = "reject" | "cancel" | "order" | "close_short";
type Result = {
  ok: boolean;
  error?: string;
  code?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

type Props = {
  id: string;
  code: string;
  actions: PurchaseAction[];
  /** True while the request is pending: its own sender cancels it, and a note is optional. */
  pending: boolean;
  /** Today in Manila (YYYY-MM-DD), from the server. */
  today: string;
  /** Active suppliers, for "Mark as ordered". */
  suppliers: { id: string; name: string }[];
  /** Approved items with what is still to come, for "Record delivery". */
  deliveryLines: DeliveryLine[];
  /** The day the order was placed (YYYY-MM-DD): a delivery can't be dated before it. */
  orderedOn: string | null;
  /** What never arrived, for the "Close short" dialog. */
  shortfall: string;
  /** Why this request can't be cancelled right now, when the Floor Manager would expect to. */
  cancelBlocked: string | null;
};

const TITLE: Record<Kind, (code: string) => string> = {
  reject: (code) => `Reject ${code}?`,
  cancel: (code) => `Cancel ${code}?`,
  order: (code) => `Mark ${code} as ordered`,
  close_short: (code) => `Close ${code} short?`,
};
const CONFIRM: Record<Kind, string> = {
  reject: "Reject request",
  cancel: "Cancel request",
  order: "Mark as ordered",
  close_short: "Close short",
};

/**
 * The request-level actions (D-029, D-041 to D-043). Items are approved or rejected one by one in
 * the Items card (`LineDecisions`, D-039). Here: reject everything, mark as ordered, record a
 * delivery, close short, and cancel. Each is confirmed in a dialog that names the request, and
 * every refusal says which field to fix.
 */
export function RequestActions({
  id,
  code,
  actions,
  pending: isPendingRequest,
  today,
  suppliers,
  deliveryLines,
  orderedOn,
  shortfall,
  cancelBlocked,
}: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Kind | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [text, setText] = useState("");
  const [order, setOrder] = useState({ supplierId: "", reference: "", expectedDeliveryOn: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const can = (action: PurchaseAction) => actions.includes(action);
  // After approval, cancelling stops an order other people wait on: it needs a reason (D-043).
  const cancelNeedsReason = !isPendingRequest;

  function open(kind: Kind) {
    setText("");
    setOrder({ supplierId: "", reference: "", expectedDeliveryOn: "" });
    setFieldErrors({});
    setError(null);
    setDialog(kind);
  }

  function showErrors(found: Record<string, string>) {
    setFieldErrors(found);
    const first = ["supplierId", "reference", "expectedDeliveryOn", "reason", "note"].find(
      (f) => found[f],
    );
    if (first) requestAnimationFrame(() => document.getElementById(`request-${first}`)?.focus());
  }

  /** The first message for each field, from the same schema the server uses. */
  function check(
    schema: {
      safeParse: (v: unknown) => {
        success: boolean;
        error?: { issues: { path: PropertyKey[]; message: string }[] };
      };
    },
    value: unknown,
  ): boolean {
    const parsed = schema.safeParse(value);
    if (parsed.success) return true;
    const found: Record<string, string> = {};
    for (const issue of parsed.error?.issues ?? []) {
      const key = String(issue.path[0] ?? "");
      if (key && !found[key]) found[key] = issue.message;
    }
    showErrors(found);
    return false;
  }

  function finish(result: Result, fallback: string) {
    if (result.ok) {
      setDialog(null);
      toast.success(result.message ?? fallback);
      router.refresh();
      return;
    }
    const known = Object.fromEntries(
      Object.entries(result.fieldErrors ?? {}).filter(([key]) =>
        ["supplierId", "reference", "expectedDeliveryOn", "reason", "note"].includes(key),
      ),
    );
    if (Object.keys(known).length) return showErrors(known);
    setDialog(null);
    setError(
      result.error ??
        `${code} couldn't be updated and nothing was changed. Refresh the page and try again.`,
    );
    if (result.code === "STALE" || result.code === "CONFLICT") router.refresh();
  }

  function submit() {
    setFieldErrors({});
    if (dialog === "reject") {
      if (!check(rejectSchema, { reason: text })) return;
      startTransition(async () =>
        finish(await rejectRequestAction(id, { reason: text }), `${code} rejected.`),
      );
    } else if (dialog === "cancel" && cancelNeedsReason) {
      if (!check(cancelAfterApprovalSchema, { reason: text })) return;
      startTransition(async () =>
        finish(await cancelAfterApprovalAction(id, { reason: text }), `${code} cancelled.`),
      );
    } else if (dialog === "cancel") {
      startTransition(async () =>
        finish(await cancelRequestAction(id, { note: text }), `${code} cancelled.`),
      );
    } else if (dialog === "order") {
      const input = { ...order, note: text };
      if (!check(orderSchema, input)) return;
      startTransition(async () =>
        finish(await orderRequestAction(id, input), `${code} marked as ordered.`),
      );
    } else if (dialog === "close_short") {
      if (!check(closeShortSchema, { reason: text })) return;
      startTransition(async () =>
        finish(await closeShortAction(id, { reason: text }), `${code} closed short.`),
      );
    }
  }

  if (actions.length === 0 && !cancelBlocked) return null;

  const textIsReason = dialog === "reject" || dialog === "close_short" || cancelNeedsReason;
  const textField = dialog === "order" || !textIsReason ? "note" : "reason";
  const textError = fieldErrors[textField];

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{error}</Alert>}

      {/* Each item is decided under Items (D-039). This is the shortcut for turning it all down,
          kept apart from that panel's primary button (DESIGN.md → Hierarchy). */}
      {can("reject") && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            Decide each item under Items, then save. To turn down everything with one reason:
          </p>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={() => open("reject")}
          >
            Reject whole request…
          </Button>
        </div>
      )}

      {can("order") && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground">
            Place the order with the supplier as you usually do, then record it here.
          </p>
          <Button disabled={busy} onClick={() => open("order")}>
            Mark as ordered…
          </Button>
        </div>
      )}

      {can("receive") && (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={busy} onClick={() => setDelivering(true)}>
            Record delivery…
          </Button>
          {can("close_short") && (
            <Button variant="secondary" disabled={busy} onClick={() => open("close_short")}>
              Close short…
            </Button>
          )}
        </div>
      )}

      {can("cancel") && (
        <Button
          variant="destructive"
          className="mt-2 w-fit"
          disabled={busy}
          onClick={() => open("cancel")}
        >
          Cancel request…
        </Button>
      )}
      {cancelBlocked && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {cancelBlocked}
        </p>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          {dialog && (
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <DialogTitle>{TITLE[dialog](code)}</DialogTitle>
              <DialogDescription>
                {dialog === "reject"
                  ? "Every item on it is rejected with this one reason. The requester sees it on the request and can copy it to a new one."
                  : dialog === "order"
                    ? "This records the order you placed. Nothing is sent to the supplier from here."
                    : dialog === "close_short"
                      ? `Use this when the rest won't come. The request ends as received, and the history keeps what never arrived: ${shortfall}.`
                      : cancelNeedsReason
                        ? "Use this when the order is off, for example the supplier can't deliver. The requester sees your reason and can copy the request to a new one."
                        : "The Floor Manager won't act on it any more. You can copy a cancelled request to a new one later."}
              </DialogDescription>

              {dialog === "order" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="request-supplierId">Supplier</Label>
                    <Select
                      id="request-supplierId"
                      value={order.supplierId}
                      disabled={busy || suppliers.length === 0}
                      aria-required="true"
                      aria-invalid={!!fieldErrors.supplierId}
                      aria-describedby={
                        fieldErrors.supplierId
                          ? "request-supplierId-error"
                          : suppliers.length === 0
                            ? "request-supplierId-hint"
                            : undefined
                      }
                      onChange={(e) => setOrder((o) => ({ ...o, supplierId: e.target.value }))}
                    >
                      <option value="">Choose a supplier…</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                    <FieldError id="request-supplierId-error" message={fieldErrors.supplierId} />
                    {suppliers.length === 0 && (
                      <p id="request-supplierId-hint" className="text-sm text-muted-foreground">
                        There are no active suppliers yet. Ask the System Admin to add one under
                        Settings, then come back.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="request-reference">
                      Order or reference number{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="request-reference"
                      autoComplete="off"
                      value={order.reference}
                      disabled={busy}
                      aria-invalid={!!fieldErrors.reference}
                      aria-describedby={
                        fieldErrors.reference ? "request-reference-error" : undefined
                      }
                      placeholder="e.g. PO-1042, or the supplier's invoice number"
                      onChange={(e) => setOrder((o) => ({ ...o, reference: e.target.value }))}
                    />
                    <FieldError id="request-reference-error" message={fieldErrors.reference} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="request-expectedDeliveryOn">Expected delivery</Label>
                    <Input
                      id="request-expectedDeliveryOn"
                      type="date"
                      className="sm:max-w-56"
                      min={today}
                      max={addDays(today, EXPECTED_DELIVERY_MAX_DAYS)}
                      value={order.expectedDeliveryOn}
                      disabled={busy}
                      aria-required="true"
                      aria-invalid={!!fieldErrors.expectedDeliveryOn}
                      aria-describedby={
                        fieldErrors.expectedDeliveryOn
                          ? "request-expectedDeliveryOn-error"
                          : "request-expectedDeliveryOn-hint"
                      }
                      onChange={(e) =>
                        setOrder((o) => ({ ...o, expectedDeliveryOn: e.target.value }))
                      }
                    />
                    {fieldErrors.expectedDeliveryOn ? (
                      <FieldError
                        id="request-expectedDeliveryOn-error"
                        message={fieldErrors.expectedDeliveryOn}
                      />
                    ) : (
                      <p
                        id="request-expectedDeliveryOn-hint"
                        className="text-sm text-muted-foreground"
                      >
                        The request shows “Delivery late” if it hasn’t fully arrived after this
                        date.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`request-${textField}`}>
                  {textField === "reason" ? (
                    "Reason"
                  ) : (
                    <>
                      Note <span className="font-normal text-muted-foreground">(optional)</span>
                    </>
                  )}
                </Label>
                <Textarea
                  id={`request-${textField}`}
                  rows={2}
                  value={text}
                  disabled={busy}
                  aria-required={textField === "reason" ? "true" : undefined}
                  aria-invalid={!!textError}
                  aria-describedby={textError ? `request-${textField}-error` : undefined}
                  placeholder={
                    dialog === "reject"
                      ? "e.g. We still have 3 boxes in the back room"
                      : dialog === "order"
                        ? "e.g. Paid half up front; the rest on delivery"
                        : dialog === "close_short"
                          ? "e.g. The supplier is out of stock until next month"
                          : cancelNeedsReason
                            ? "e.g. The supplier can't deliver this month"
                            : "e.g. Found some in storage"
                  }
                  onChange={(e) => setText(e.target.value)}
                />
                <FieldError id={`request-${textField}-error`} message={textError} />
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    {dialog === "cancel" ? "Keep it" : "Go back"}
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  variant={dialog === "order" ? "primary" : "destructive"}
                  disabled={busy || (dialog === "order" && suppliers.length === 0)}
                >
                  {busy && <LoaderCircle aria-hidden className="animate-spin" />}
                  {CONFIRM[dialog]}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {can("receive") && (
        <DeliveryDialog
          // What is still to come changes after every delivery: start the form afresh.
          key={deliveryLines.map((l) => l.outstanding).join("|")}
          id={id}
          code={code}
          open={delivering}
          onOpenChange={setDelivering}
          lines={deliveryLines}
          today={today}
          orderedOn={orderedOn}
        />
      )}
    </div>
  );
}

/** The link shown once a request is rejected or cancelled (D-044). */
export function CopyRequestLink({ id }: { id: string }) {
  return (
    <Button asChild variant="secondary" className="w-fit">
      <Link href={`/procurement/new?copy=${id}`}>Copy to a new request</Link>
    </Button>
  );
}
