"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Flag, FlagOff, LoaderCircle, Play } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PRIORITY_REASON_MESSAGE,
  VOID_REASON_MESSAGE,
} from "@/server/validators/production.validator";
import { batchPriorityAction, startInspectionAction, voidBatchAction } from "./actions";

type Item = { id: string; code: string; updatedAt: string };

/** "I'm inspecting this one" (A-60): another inspector then sees who has it. */
export function StartInspectionButton({ item }: { item: Item }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="secondary"
      className="max-sm:h-11 sm:w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startInspectionAction(item.id, {
            expectedUpdatedAt: item.updatedAt,
          });
          if (result.ok) toast.success(`You're inspecting ${result.code}.`);
          else toast.error(result.error);
          router.refresh();
        })
      }
    >
      {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
      Start inspection
      <span className="sr-only"> {item.code}</span>
    </Button>
  );
}

/**
 * Clear on the queue's filters: empties every field straight away (the page reload that follows
 * would too, but a Day picked before it arrives must not send the old code), then shows the queue.
 */
export function ClearQueueFilters() {
  return (
    <Button asChild variant="ghost" className="max-sm:h-11">
      <Link
        href="/batches?tab=queue"
        onClick={(e) => {
          const form = e.currentTarget.closest("form");
          form
            ?.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[name], select[name]")
            .forEach((field) => {
              if (field.name !== "tab") field.value = "";
            });
        }}
      >
        Clear
      </Link>
    </Button>
  );
}

const PHONE_SHEET = cn(
  "max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none",
  "max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]",
);

function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  message,
  submitLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  message: string;
  submitLabel: string;
  onSubmit: (reason: string) => Promise<{ ok: boolean; error?: string; fieldError?: string }>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const valid = (v: string) => v.trim().length >= 5 && v.trim().length <= 200;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setReason("");
          setError(null);
          setFormError(null);
        }
      }}
    >
      <DialogContent className={PHONE_SHEET}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            if (!valid(reason)) {
              setError(
                reason.trim().length > 200 ? "Keep the reason under 200 characters." : message,
              );
              ref.current?.focus();
              return;
            }
            startTransition(async () => {
              const result = await onSubmit(reason.trim());
              if (result.ok) {
                onOpenChange(false);
                setReason("");
                return;
              }
              if (result.fieldError) {
                setError(result.fieldError);
                ref.current?.focus();
              } else setFormError(result.error ?? "Something went wrong. Try again.");
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="batch-queue-reason">{label}</Label>
            <Textarea
              id="batch-queue-reason"
              ref={ref}
              rows={2}
              value={reason}
              placeholder={placeholder}
              aria-invalid={!!error}
              aria-describedby={error ? "batch-queue-reason-error" : undefined}
              onChange={(e) => {
                setReason(e.target.value);
                if (error && valid(e.target.value)) setError(null);
              }}
            />
            <FieldError id="batch-queue-reason-error" message={error ?? undefined} />
          </div>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <DialogFooter className="max-sm:flex-col-reverse">
            <DialogClose asChild>
              <Button type="button" variant="ghost" className="max-sm:h-11">
                Not now
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending} className="max-sm:h-11">
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The Floor Manager's Urgent and Void (A-58, A-59), each with a reason. */
export function FloorManagerBatchActions({ item, urgent }: { item: Item; urgent: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"urgent" | "void" | null>(null);
  const [pending, startTransition] = useTransition();
  const done = (message: string) => {
    toast.success(message);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap gap-2">
      {urgent ? (
        <Button
          variant="ghost"
          size="sm"
          className="max-sm:h-11"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await batchPriorityAction(item.id, {
                priority: "NORMAL",
                expectedUpdatedAt: item.updatedAt,
              });
              if (result.ok) done(`${result.code} is back to Normal.`);
              else {
                toast.error(result.error);
                router.refresh();
              }
            })
          }
        >
          <FlagOff aria-hidden />
          Set to Normal
          <span className="sr-only"> {item.code}</span>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="max-sm:h-11"
          onClick={() => setDialog("urgent")}
        >
          <Flag aria-hidden />
          Mark Urgent
          <span className="sr-only"> {item.code}</span>
        </Button>
      )}
      <Button variant="ghost" size="sm" className="max-sm:h-11" onClick={() => setDialog("void")}>
        <Ban aria-hidden />
        Void
        <span className="sr-only"> {item.code}</span>
      </Button>
      <ReasonDialog
        open={dialog === "urgent"}
        onOpenChange={(o) => setDialog(o ? "urgent" : null)}
        title={`Mark ${item.code} Urgent`}
        description="It moves to the top of the Inspection queue. The inspectors see your reason."
        label="Why is it urgent?"
        placeholder="e.g. Customer pick-up at 3 pm"
        message={PRIORITY_REASON_MESSAGE}
        submitLabel="Mark Urgent"
        onSubmit={async (reason) => {
          const result = await batchPriorityAction(item.id, {
            priority: "URGENT",
            reason,
            expectedUpdatedAt: item.updatedAt,
          });
          if (result.ok) done(`${result.code} is Urgent.`);
          return result.ok
            ? { ok: true }
            : { ok: false, error: result.error, fieldError: result.fieldErrors?.reason };
        }}
      />
      <ReasonDialog
        open={dialog === "void"}
        onOpenChange={(o) => setDialog(o ? "void" : null)}
        title={`Void ${item.code}`}
        description="It leaves the queue and won't be inspected. This can't be undone."
        label="Why won't it be inspected?"
        placeholder="e.g. Line stopped, no pairs made"
        message={VOID_REASON_MESSAGE}
        submitLabel="Void batch"
        onSubmit={async (reason) => {
          const result = await voidBatchAction(item.id, {
            reason,
            expectedUpdatedAt: item.updatedAt,
          });
          if (result.ok) done(`${result.code} is void.`);
          return result.ok
            ? { ok: true }
            : { ok: false, error: result.error, fieldError: result.fieldErrors?.reason };
        }}
      />
    </div>
  );
}
