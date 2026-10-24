"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Minus, Pencil, Plus, RefreshCw, ClipboardCheck } from "lucide-react";
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
import type { MovementType } from "@/lib/domain";
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import {
  DEFAULT_REASON,
  formatDelta,
  formatQuantity,
  type StockLevel,
} from "@/lib/inventory-rules";
import { movementSchema } from "@/server/validators/inventory.validator";
import {
  recordMovementAction,
  setItemActiveAction,
  undoMovementAction,
  type ActionResult,
} from "../actions";

type Props = {
  item: {
    id: string;
    name: string;
    unit: string;
    quantityOnHand: number;
    isActive: boolean;
    level: StockLevel;
  };
};

const TITLE: Record<MovementType, string> = {
  IN: "Receive stock",
  OUT: "Use stock",
  ADJUST: "Stock count",
};
const SUBMIT: Record<MovementType, string> = {
  IN: "Record delivery",
  OUT: "Record usage",
  ADJUST: "Save count",
};

export function StockActions({ item }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<MovementType | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stale, setStale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const counted = Number(amount);
  const countDiff =
    dialog === "ADJUST" && amount.trim() !== "" && Number.isFinite(counted)
      ? Math.round((counted - item.quantityOnHand) * 100) / 100
      : null;

  function open(kind: MovementType) {
    setAmount("");
    setNote(DEFAULT_REASON[kind] ?? "");
    setErrors({});
    setError(null);
    setDialog(kind);
  }

  function undo(movementId: string) {
    startTransition(async () => {
      const result = await undoMovementAction(item.id, movementId);
      if (result.ok) toast.success("Undone. The stock is back to what it was.");
      else toast.error(result.error);
    });
  }

  function afterResult(result: ActionResult<{ movementId?: string; message?: string }>) {
    if (result.ok) {
      const kind = dialog;
      setDialog(null);
      const movementId = result.movementId;
      toast.success(result.message ?? "Saved.", {
        duration: 6000,
        action:
          kind !== "ADJUST" && movementId
            ? { label: "Undo", onClick: () => undo(movementId) }
            : undefined,
      });
      return;
    }
    if (result.code === "STALE") {
      setDialog(null);
      setStale(result.error);
      return;
    }
    if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
      return focusFirstInvalid(formRef.current);
    }
    // Not enough stock and similar: keep the dialog open so the number can be fixed.
    setErrors({ [dialog === "ADJUST" ? "counted" : "quantity"]: result.error });
    focusFirstInvalid(formRef.current);
  }

  function submit() {
    if (!dialog) return;
    const body =
      dialog === "ADJUST"
        ? { type: dialog, counted: amount, expectedQuantity: item.quantityOnHand, reason: note }
        : {
            type: dialog,
            quantity: amount,
            reason: note,
          };
    const parsed = movementSchema.safeParse(body);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        next[key] ??= issue.message;
      }
      setErrors(next);
      return focusFirstInvalid(formRef.current);
    }
    setErrors({});
    startTransition(async () => afterResult(await recordMovementAction(item.id, parsed.data)));
  }

  function toggleActive() {
    startTransition(async () => {
      const next = !item.isActive;
      const result = await setItemActiveAction(item.id, next);
      if (!result.ok) return setError(result.error);
      toast.success(next ? `${item.name} is active again.` : `${item.name} deactivated.`, {
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () =>
            startTransition(async () => void (await setItemActiveAction(item.id, !next))),
        },
      });
    });
  }

  const amountField = dialog === "ADJUST" ? "counted" : "quantity";
  const spinner = pending ? <LoaderCircle aria-hidden className="animate-spin" /> : null;
  const receivePrimary = item.level !== "OK";

  if (!item.isActive) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="info">
          This item is deactivated. It’s hidden from pickers, and its history is kept.
        </Alert>
        <div>
          <Button variant="secondary" disabled={pending} onClick={toggleActive}>
            {spinner}
            Reactivate
          </Button>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={receivePrimary ? "primary" : "secondary"}
          disabled={pending}
          onClick={() => open("IN")}
        >
          <Plus aria-hidden />
          Receive stock
        </Button>
        <Button
          variant={receivePrimary ? "secondary" : "primary"}
          disabled={pending || item.quantityOnHand <= 0}
          title={item.quantityOnHand <= 0 ? "Nothing in stock to use." : undefined}
          onClick={() => open("OUT")}
        >
          <Minus aria-hidden />
          Use stock
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => open("ADJUST")}>
          <ClipboardCheck aria-hidden />
          Stock count…
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/inventory/${item.id}/edit`}>
            <Pencil aria-hidden />
            Edit
          </Link>
        </Button>
        <Button variant="ghost" className="ml-auto" disabled={pending} onClick={toggleActive}>
          Deactivate
        </Button>
      </div>
      {stale && (
        <Alert tone="info">
          <span>{stale}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setStale(null);
              router.refresh();
            }}
          >
            <RefreshCw aria-hidden />
            Refresh
          </Button>
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <form
            ref={formRef}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <DialogTitle>
              {dialog && TITLE[dialog]}: {item.name}
            </DialogTitle>
            <DialogDescription>
              {dialog === "ADJUST"
                ? `Recorded now: ${formatQuantity(item.quantityOnHand, item.unit)}. Enter what you counted on the shelf.`
                : `On hand now: ${formatQuantity(item.quantityOnHand, item.unit)}.`}
            </DialogDescription>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="movement-amount">
                {dialog === "ADJUST" ? "Counted quantity" : "Quantity"}
              </Label>
              <div className="relative">
                <Input
                  id="movement-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  autoFocus
                  className="pr-16"
                  value={amount}
                  aria-invalid={!!errors[amountField]}
                  aria-describedby={errors[amountField] ? "movement-amount-error" : undefined}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 max-w-14 -translate-y-1/2 truncate text-sm text-muted-foreground">
                  {item.unit}
                </span>
              </div>
              {errors[amountField] ? (
                <p id="movement-amount-error" className="text-sm text-reject">
                  {errors[amountField]}
                </p>
              ) : (
                countDiff !== null && (
                  <p className="text-sm text-muted-foreground" data-testid="count-difference">
                    {countDiff === 0
                      ? "Matches the recorded stock."
                      : `Difference: ${formatDelta(countDiff)} ${item.unit}`}
                  </p>
                )
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="movement-note">
                {dialog === "ADJUST" ? "Reason" : "Note"}
                {dialog !== "ADJUST" && (
                  <span className="font-normal text-muted-foreground"> (optional)</span>
                )}
              </Label>
              <Textarea
                id="movement-note"
                rows={2}
                value={note}
                placeholder={
                  dialog === "ADJUST" ? "e.g. Monthly count, one roll damaged" : undefined
                }
                aria-invalid={!!errors.reason}
                aria-describedby={errors.reason ? "movement-note-error" : undefined}
                onChange={(e) => setNote(e.target.value)}
              />
              {errors.reason && (
                <p id="movement-note-error" className="text-sm text-reject">
                  {errors.reason}
                </p>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {spinner}
                {dialog && SUBMIT[dialog]}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
