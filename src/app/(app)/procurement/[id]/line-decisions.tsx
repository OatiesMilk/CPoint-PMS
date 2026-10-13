"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, LoaderCircle, PackageCheck, PackageX } from "lucide-react";
import { toast } from "sonner";
import { StockBadge } from "@/components/features/inventory/stock-badge";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { FormErrorSummary, type SummaryError } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatQuantity, stockLevel } from "@/lib/inventory-rules";
import { stockGuidanceLine, type LineOutcome } from "@/lib/procurement-rules";
import { decideRequestAction } from "../actions";

export type DecisionLine = {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  note: string | null;
  onHandAtRequest: number | null;
  /** Null for a typed item that isn't in inventory. */
  item: {
    id: string;
    unit: string;
    quantityOnHand: number;
    reorderLevel: number;
    isActive: boolean;
  } | null;
  wellStocked: boolean;
  suggestedDecision: LineOutcome | null;
  suggestedReason: string | null;
};

type Choice = { decision: LineOutcome | ""; reason: string };
type LineErrors = { decision?: string; reason?: string };

const MIN_REASON = 3;
const MAX_REASON = 300;

/**
 * The Floor Manager's decision panel (D-039, D-040): every item is approved or rejected on its
 * own, with the stock now and when it was requested beside it. A well-stocked item starts on
 * Reject with the reason filled in, a low one on Approve; both are only suggestions, and nothing
 * is decided until "Save decisions".
 */
export function LineDecisions({
  id,
  code,
  lines,
  seesInventory,
}: {
  id: string;
  code: string;
  lines: DecisionLine[];
  seesInventory: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choices, setChoices] = useState<Choice[]>(() =>
    lines.map((l) => ({
      decision: l.suggestedDecision ?? "",
      reason: l.suggestedDecision === "REJECTED" ? (l.suggestedReason ?? "") : "",
    })),
  );
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<LineErrors[]>(() => lines.map(() => ({})));
  const [formError, setFormError] = useState<string | null>(null);

  const undecided = choices.filter((c) => c.decision === "").length;
  const suggested = lines.some((l) => l.suggestedDecision !== null);

  function update(i: number, patch: Partial<Choice>) {
    setChoices((all) => all.map((c, at) => (at === i ? { ...c, ...patch } : c)));
    // Once a field has errored, its message clears the moment it is fixed.
    setErrors((all) =>
      all.map((e, at) => {
        if (at !== i) return e;
        const next = { ...choices[i], ...patch };
        return {
          decision: next.decision ? undefined : e.decision,
          reason:
            next.decision !== "REJECTED" || next.reason.trim().length >= MIN_REASON
              ? undefined
              : e.reason,
        };
      }),
    );
  }

  function choose(i: number, decision: LineOutcome) {
    const line = lines[i];
    // Switching to Reject on a well-stocked item brings its suggested reason back if the box is empty.
    const reason =
      decision === "REJECTED" && !choices[i].reason.trim() && line.suggestedReason
        ? line.suggestedReason
        : choices[i].reason;
    update(i, { decision, reason });
  }

  function approveRemaining() {
    setChoices((all) => all.map((c) => (c.decision === "" ? { ...c, decision: "APPROVED" } : c)));
    setErrors((all) => all.map((e) => ({ ...e, decision: undefined })));
  }

  /** The same rules and words as the server (decideRequest), checked before the round trip. */
  function validate(): LineErrors[] {
    return lines.map((line, i) => {
      const c = choices[i];
      if (c.decision === "") return { decision: `Choose Approve or Reject for ${line.itemName}.` };
      if (c.decision !== "REJECTED") return {};
      const reason = c.reason.trim();
      if (reason.length < MIN_REASON)
        return {
          reason: `Enter a reason of at least ${MIN_REASON} characters for rejecting ${line.itemName}, so the requester knows why.`,
        };
      if (reason.length > MAX_REASON)
        return { reason: `Keep the reason under ${MAX_REASON} characters.` };
      return {};
    });
  }

  function focusFirst(found: LineErrors[]) {
    const at = found.findIndex((e) => e.decision || e.reason);
    if (at < 0) return;
    const target = found[at].decision ? `line-${at}-approve` : `line-${at}-reason`;
    requestAnimationFrame(() => document.getElementById(target)?.focus());
  }

  function submit() {
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (found.some((e) => e.decision || e.reason)) return focusFirst(found);

    startTransition(async () => {
      const result = await decideRequestAction(id, {
        note,
        lines: lines.map((line, i) => ({
          lineId: line.id,
          decision: choices[i].decision,
          reason: choices[i].decision === "REJECTED" ? choices[i].reason : undefined,
        })),
      });
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        return;
      }
      // The server names the item and the field ("lines.1.reason"): put each message under it.
      const fromServer = lines.map((_, i) => ({
        decision: result.fieldErrors?.[`lines.${i}.decision`],
        reason: result.fieldErrors?.[`lines.${i}.reason`],
      }));
      if (fromServer.some((e) => e.decision || e.reason)) {
        setErrors(fromServer);
        return focusFirst(fromServer);
      }
      setFormError(
        result.error ??
          `${code} couldn't be decided and nothing was changed. Refresh the page and try again.`,
      );
      if (result.code === "STALE" || result.code === "CONFLICT" || result.fieldErrors)
        router.refresh();
    });
  }

  const summary: SummaryError[] = errors.flatMap((e, i) => [
    ...(e.decision ? [{ fieldId: `line-${i}-approve`, message: e.decision }] : []),
    ...(e.reason ? [{ fieldId: `line-${i}-reason`, message: e.reason }] : []),
  ]);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {suggested
          ? "Approve or reject each item. The choices already made come from the stock right now, so check them before you save."
          : "Approve or reject each item, then save. The requester sees your reason for every rejected item."}
      </p>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <FormErrorSummary errors={summary} outcome="saved" />

      <ol className="flex flex-col divide-y border-y">
        {lines.map((line, i) => {
          const choice = choices[i];
          const error = errors[i];
          const describedBy = error.decision ? `line-${i}-decision-error` : undefined;
          return (
            <li key={line.id} className="py-4">
              <fieldset
                className="flex flex-col gap-3"
                aria-describedby={describedBy}
                data-testid={`decision-line-${i}`}
              >
                <legend className="sr-only">{line.itemName}</legend>
                <div className="flex flex-col items-start gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {line.item && seesInventory ? (
                      <Link
                        href={`/inventory/${line.item.id}`}
                        className="text-lg font-medium underline-offset-4 hover:underline"
                      >
                        {line.itemName}
                      </Link>
                    ) : (
                      <span className="text-lg font-medium">{line.itemName}</span>
                    )}
                    <span className="text-muted-foreground">
                      Asked for {formatQuantity(line.quantity, line.unit)}
                    </span>
                  </div>
                  {line.note && <p className="text-sm text-muted-foreground">{line.note}</p>}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {!line.item ? (
                      <Badge>
                        <PackageX aria-hidden />
                        Not in inventory
                      </Badge>
                    ) : line.wellStocked ? (
                      <Badge tone="info">
                        <PackageCheck aria-hidden />
                        Still in stock
                      </Badge>
                    ) : (
                      <StockBadge
                        level={stockLevel(line.item.quantityOnHand, line.item.reorderLevel)}
                        inactive={!line.item.isActive}
                      />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {line.item
                        ? stockGuidanceLine(
                            {
                              onHand: line.item.quantityOnHand,
                              reorderLevel: line.item.reorderLevel,
                              unit: line.item.unit,
                            },
                            line.onHandAtRequest,
                          )
                        : "No stock to compare, so nothing is suggested."}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      id={`line-${i}-approve`}
                      name={`line-${i}-decision`}
                      className="size-4 accent-primary"
                      checked={choice.decision === "APPROVED"}
                      disabled={pending}
                      onChange={() => choose(i, "APPROVED")}
                    />
                    Approve
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      id={`line-${i}-reject`}
                      name={`line-${i}-decision`}
                      className="size-4 accent-primary"
                      checked={choice.decision === "REJECTED"}
                      disabled={pending}
                      onChange={() => choose(i, "REJECTED")}
                    />
                    Reject
                  </label>
                </div>
                <FieldError id={`line-${i}-decision-error`} message={error.decision} />

                {choice.decision === "REJECTED" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`line-${i}-reason`}>Reason for rejecting {line.itemName}</Label>
                    <Textarea
                      id={`line-${i}-reason`}
                      rows={2}
                      value={choice.reason}
                      disabled={pending}
                      aria-invalid={!!error.reason}
                      aria-describedby={error.reason ? `line-${i}-reason-error` : undefined}
                      placeholder="e.g. We still have 3 boxes in the back room"
                      onChange={(e) => update(i, { reason: e.target.value })}
                    />
                    <FieldError id={`line-${i}-reason-error`} message={error.reason} />
                  </div>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="approve-note">
          Note to the requester{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="approve-note"
          value={note}
          autoComplete="off"
          maxLength={MAX_REASON}
          disabled={pending}
          placeholder="e.g. Ordering from the usual supplier today"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Save decisions
        </Button>
        {undecided > 0 && (
          <Button type="button" variant="secondary" disabled={pending} onClick={approveRemaining}>
            Approve all remaining
          </Button>
        )}
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {undecided === 0
            ? "Every item has a decision. Nothing is final until you save."
            : `${undecided} of ${lines.length} item${lines.length === 1 ? "" : "s"} still to decide.`}
        </span>
      </div>
    </form>
  );
}
