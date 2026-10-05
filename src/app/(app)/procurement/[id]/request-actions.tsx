"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PurchaseAction } from "@/lib/procurement-rules";
import {
  approveRequestAction,
  cancelRequestAction,
  receiveRequestAction,
  rejectRequestAction,
} from "../actions";

type Props = {
  id: string;
  code: string;
  actions: PurchaseAction[];
  /** Lines that would be added to stock on receipt, and those that wouldn't. */
  stocked: string[];
  notStocked: string[];
};

/**
 * The decision panel (D-029). Approve is one click with an optional note. Reject, receive and
 * cancel are confirmed in a dialog that names the request: reject needs a reason, and receive says
 * exactly what goes into stock.
 */
export function RequestActions({ id, code, actions, stocked, notStocked }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<"reject" | "receive" | "cancel" | null>(null);
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function finish(
    result: { ok: boolean; error?: string; code?: string; fieldErrors?: Record<string, string> },
    message: string,
  ) {
    if (result.ok) {
      setDialog(null);
      toast.success(message);
      router.refresh();
      return;
    }
    const field = result.fieldErrors?.reason;
    if (field) return setFieldError(field);
    setDialog(null);
    setError(result.error ?? "That didn't work. Nothing was changed.");
    if (result.code === "STALE" || result.code === "CONFLICT") router.refresh();
  }

  function open(kind: "reject" | "receive" | "cancel") {
    setText("");
    setFieldError(null);
    setError(null);
    setDialog(kind);
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{error}</Alert>}

      {actions.includes("approve") && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () =>
              finish(await approveRequestAction(id, { note }), `${code} approved.`),
            );
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="approve-note">
              Note to the requester{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="approve-note"
              value={note}
              autoComplete="off"
              placeholder="e.g. Ordering from the usual supplier today"
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {/* Destructive set apart from the primary (DESIGN.md → Hierarchy). */}
          <div className="flex items-center justify-between gap-6">
            <Button type="submit" disabled={pending}>
              {pending && !dialog && <LoaderCircle aria-hidden className="animate-spin" />}
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => open("reject")}
            >
              Reject…
            </Button>
          </div>
        </form>
      )}

      {actions.includes("receive") && (
        <Button disabled={pending} onClick={() => open("receive")}>
          Mark received…
        </Button>
      )}

      {actions.includes("cancel") && (
        <Button variant="destructive" disabled={pending} onClick={() => open("cancel")}>
          Cancel request…
        </Button>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFieldError(null);
              if (dialog === "reject") {
                if (text.trim().length < 3)
                  return setFieldError("Say why it's rejected (at least 3 characters).");
                startTransition(async () =>
                  finish(await rejectRequestAction(id, { reason: text }), `${code} rejected.`),
                );
              } else if (dialog === "receive") {
                startTransition(async () =>
                  finish(await receiveRequestAction(id), `${code} received. Stock updated.`),
                );
              } else if (dialog === "cancel") {
                startTransition(async () =>
                  finish(await cancelRequestAction(id, { note: text }), `${code} cancelled.`),
                );
              }
            }}
          >
            <DialogTitle>
              {dialog === "reject"
                ? `Reject ${code}?`
                : dialog === "receive"
                  ? `Mark ${code} received?`
                  : `Cancel ${code}?`}
            </DialogTitle>
            <DialogDescription>
              {dialog === "reject"
                ? "The requester sees your reason on the request. They can send a new one."
                : dialog === "receive"
                  ? "Use this when the delivery is on the shelf. The quantities are added to inventory as a delivery."
                  : "The Floor Manager won't act on it any more. To change a request, cancel it and send a new one."}
            </DialogDescription>

            {dialog === "receive" && (
              <div className="flex flex-col gap-2 text-sm">
                {stocked.length > 0 && (
                  <div>
                    <p className="font-medium">Added to stock</p>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {stocked.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {notStocked.length > 0 && (
                  <div>
                    <p className="font-medium">Not in inventory, so not added</p>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {notStocked.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <p className="mt-1 text-muted-foreground">
                      Add these items under Inventory, then record the delivery there.
                    </p>
                  </div>
                )}
              </div>
            )}

            {(dialog === "reject" || dialog === "cancel") && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="request-text">
                  {dialog === "reject" ? (
                    "Reason"
                  ) : (
                    <>
                      Note <span className="font-normal text-muted-foreground">(optional)</span>
                    </>
                  )}
                </Label>
                <Textarea
                  id="request-text"
                  rows={2}
                  value={text}
                  aria-invalid={!!fieldError}
                  aria-describedby={fieldError ? "request-text-error" : undefined}
                  placeholder={
                    dialog === "reject"
                      ? "e.g. We still have 3 boxes in the back room"
                      : "e.g. Found some in storage"
                  }
                  onChange={(e) => setText(e.target.value)}
                />
                {fieldError && (
                  <p id="request-text-error" className="text-sm text-reject">
                    {fieldError}
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {dialog === "cancel" ? "Keep it" : "Go back"}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                variant={dialog === "receive" ? "primary" : "destructive"}
                disabled={pending}
              >
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                {dialog === "reject"
                  ? "Reject request"
                  : dialog === "receive"
                    ? "Mark received"
                    : "Cancel request"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
