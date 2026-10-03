"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BATCH_STATUS_LABELS, type BatchStatus, type SalvageStatus } from "@/lib/domain";
import { assignSalvageAction, discardSalvageAction, unassignSalvageAction } from "./actions";

type BatchOption = { id: string; code: string; rollCode: string; status: BatchStatus };
type Props = {
  id: string;
  label: string;
  status: SalvageStatus;
  originBatchId: string;
  assignedBatchId: string | null;
  batches: BatchOption[];
};

export function SalvageActions({
  id,
  label,
  status,
  originBatchId,
  assignedBatchId,
  batches,
}: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"assign" | "discard" | null>(null);
  const [batchId, setBatchId] = useState("");
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const targets = batches.filter((b) => b.id !== originBatchId);

  function open(kind: "assign" | "discard") {
    setBatchId("");
    setText("");
    setFieldError(null);
    setDialog(kind);
  }

  function handle(
    result: { ok: boolean; error?: string; code?: string; fieldErrors?: Record<string, string> },
    success: () => void,
  ) {
    if (result.ok) {
      setDialog(null);
      success();
      return;
    }
    const field = result.fieldErrors?.batchId ?? result.fieldErrors?.reason;
    if (field) return setFieldError(field);
    setDialog(null);
    setError(result.error ?? "Something went wrong.");
    if (result.code === "STALE") router.refresh();
  }

  function assign(toBatch: string, expectedStatus: SalvageStatus, note?: string, quiet = false) {
    startTransition(async () => {
      const result = await assignSalvageAction(id, { batchId: toBatch, expectedStatus, note });
      handle(result, () => {
        if (!quiet && result.ok) toast.success(`${label} will be used in ${result.assignedTo}.`);
      });
    });
  }

  if (status === "ASSIGNED") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await unassignSalvageAction(id, { expectedStatus: "ASSIGNED" });
              handle(result, () =>
                toast.success(`${label} is available again.`, {
                  duration: 6000,
                  action: assignedBatchId
                    ? {
                        label: "Undo",
                        onClick: () => assign(assignedBatchId, "AVAILABLE", undefined, true),
                      }
                    : undefined,
                }),
              );
            })
          }
        >
          Unassign
        </Button>
        {error && <p className="text-sm text-reject">{error}</p>}
      </div>
    );
  }
  if (status !== "AVAILABLE") return null;

  return (
    <div className="flex flex-col items-end gap-1">
      {/* Destructive set apart from the reuse action (DESIGN.md → Hierarchy). */}
      <div className="flex gap-6">
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => open("assign")}>
          Use in batch…
        </Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => open("discard")}>
          Discard…
        </Button>
      </div>
      {error && <p className="text-sm text-reject">{error}</p>}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFieldError(null);
              if (dialog === "assign") {
                if (!batchId) return setFieldError("Choose the batch that will use this section.");
                assign(batchId, "AVAILABLE", text);
              } else {
                if (text.trim().length < 3)
                  return setFieldError("Say why this section is discarded.");
                startTransition(async () => {
                  const result = await discardSalvageAction(id, {
                    reason: text,
                    expectedStatus: "AVAILABLE",
                  });
                  handle(result, () => toast.success(`${label} discarded.`));
                });
              }
            }}
          >
            <DialogTitle>
              {dialog === "assign" ? `Use ${label} in another batch` : `Discard ${label}?`}
            </DialogTitle>
            <DialogDescription>
              {dialog === "assign"
                ? "The rejected leather will be cut for another roll's production. It shows on that batch's yield."
                : "Use this when the piece can't be reused at all. This can't be undone."}
            </DialogDescription>
            {dialog === "assign" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="salvage-batch">Batch</Label>
                {targets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No other batch is planned or in progress right now.
                  </p>
                ) : (
                  <Select
                    id="salvage-batch"
                    value={batchId}
                    aria-invalid={!!fieldError && !batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {targets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} · roll {b.rollCode} · {BATCH_STATUS_LABELS[b.status]}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="salvage-text">
                {dialog === "assign" ? (
                  <>
                    Note <span className="font-normal text-muted-foreground">(optional)</span>
                  </>
                ) : (
                  "Reason"
                )}
              </Label>
              <Textarea
                id="salvage-text"
                rows={2}
                value={text}
                placeholder={
                  dialog === "assign"
                    ? "e.g. For tongue pieces"
                    : "e.g. Too small to cut any component from"
                }
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            {fieldError && <p className="text-sm text-reject">{fieldError}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {dialog === "assign" ? "Cancel" : "Keep it"}
                </Button>
              </DialogClose>
              <Button
                type="submit"
                variant={dialog === "discard" ? "destructive" : "primary"}
                disabled={pending || (dialog === "assign" && targets.length === 0)}
              >
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                {dialog === "assign" ? "Use in this batch" : "Discard section"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
