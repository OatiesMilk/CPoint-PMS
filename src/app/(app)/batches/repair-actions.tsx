"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Undo2 } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/repair-rules";
import { repairAction } from "./actions";

type Repair = { id: string; code: string; stage: Stage };

/**
 * A repair at a stage (Phase 34, A-63, A-87): the Floor Manager marks it Back for inspection (or
 * the stage's constructor, on Capture), moves it to another stage, or calls it Not fixable after
 * all. The last two need a reason and go in the audit.
 */
export function RepairActions({ repair, canManage }: { repair: Repair; canManage: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"move" | "notFixable">("move");
  const [stage, setStage] = useState<"" | Stage>("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function back() {
    startTransition(async () => {
      const result = await repairAction(repair.id, { action: "back" });
      if (result.ok) {
        toast.success(`${result.code} is back for inspection.`);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  function change() {
    setFormError(null);
    const found: Record<string, string> = {};
    if (action === "move" && !stage) found.stage = "Choose the stage it moves to.";
    if (reason.trim().length < 5) found.reason = "Say why, at least 5 characters.";
    setErrors(found);
    if (Object.keys(found).length) return;
    startTransition(async () => {
      const result = await repairAction(
        repair.id,
        action === "move" ? { action, stage, reason } : { action, reason },
      );
      if (result.ok) {
        toast.success(
          action === "move"
            ? `${result.code} moved to ${STAGE_LABEL[stage as Stage]}.`
            : `${result.code} marked not fixable after all.`,
        );
        setOpen(false);
        setReason("");
        router.refresh();
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length)
        setErrors(result.fieldErrors);
      else setFormError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={back}>
        {pending ? <LoaderCircle aria-hidden className="animate-spin" /> : <Undo2 aria-hidden />}
        Back for inspection
        <span className="sr-only"> {repair.code}</span>
      </Button>
      {canManage && (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Change
            <span className="sr-only"> {repair.code}</span>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Change {repair.code}</DialogTitle>
              <DialogDescription>
                It is at {STAGE_LABEL[repair.stage]}. You can change it until the stage marks it
                back for inspection.
              </DialogDescription>
              <form
                noValidate
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  change();
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="repair-change">What do you want to do?</Label>
                  <Select
                    id="repair-change"
                    value={action}
                    onChange={(e) => setAction(e.target.value as "move" | "notFixable")}
                  >
                    <option value="move">Move it to another stage</option>
                    <option value="notFixable">Not fixable after all (scrap the pairs)</option>
                  </Select>
                </div>
                {action === "move" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="repair-stage">Move to</Label>
                    <Select
                      id="repair-stage"
                      value={stage}
                      aria-invalid={!!errors.stage}
                      aria-describedby={errors.stage ? "repair-stage-error" : undefined}
                      onChange={(e) => {
                        setStage(e.target.value as Stage | "");
                        setErrors(({ stage: _s, ...rest }) => rest);
                      }}
                    >
                      <option value="">Choose the stage</option>
                      {STAGES.filter((s) => s !== repair.stage).map((s) => (
                        <option key={s} value={s}>
                          {STAGE_LABEL[s]}
                        </option>
                      ))}
                    </Select>
                    <FieldError id="repair-stage-error" message={errors.stage} />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="repair-reason">Why?</Label>
                  <Textarea
                    id="repair-reason"
                    rows={2}
                    value={reason}
                    placeholder="e.g. The sole needs the press at Sole-ing"
                    aria-invalid={!!errors.reason}
                    aria-describedby={errors.reason ? "repair-reason-error" : undefined}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setErrors(({ reason: _r, ...rest }) => rest);
                    }}
                  />
                  <FieldError id="repair-reason-error" message={errors.reason} />
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
                    Save change
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
