"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, MoveRight } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button, type ButtonProps } from "@/components/ui/button";
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
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { LOCATION_MESSAGES, locationText, MOVE_MAX, MOVE_NOTE_MAX } from "@/lib/location-rules";

/** What moveRollsAction answers (an ActionResult). */
type MoveResult =
  | { ok: true; moved: number; to: string }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

export type LocationOption = { id: string; code: string; name: string | null };
export type MovableRoll = { id: string; code: string; where: string; locationId: string | null };

/**
 * Move rolls to a storage location (Phase 32, the Floor Manager, A-56). With one roll it moves
 * that roll; with several the Floor Manager ticks which ones. Each move is one history row.
 */
export function MoveRollsDialog({
  rolls,
  locations,
  action,
  triggerLabel,
  size = "sm",
  variant = "secondary",
}: {
  rolls: MovableRoll[];
  locations: LocationOption[];
  action: (input: unknown) => Promise<MoveResult>;
  triggerLabel?: string;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}) {
  const router = useRouter();
  const single = rolls.length === 1 ? rolls[0] : null;
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState<Set<string>>(new Set(single ? [single.id] : []));
  const [toLocationId, setTo] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const reset = () => {
    setTicked(new Set(single ? [single.id] : []));
    setTo("");
    setNote("");
    setErrors({});
    setFormError(null);
  };

  function submit() {
    setFormError(null);
    const found: Record<string, string> = {};
    if (ticked.size === 0) found.rollIds = LOCATION_MESSAGES.chooseRolls;
    else if (ticked.size > MOVE_MAX) found.rollIds = LOCATION_MESSAGES.tooMany;
    if (!toLocationId) found.toLocationId = LOCATION_MESSAGES.chooseLocation;
    if (note.trim().length > MOVE_NOTE_MAX) found.note = LOCATION_MESSAGES.noteTooLong;
    setErrors(found);
    if (Object.keys(found).length) return focusFirstInvalid(formRef.current);
    startTransition(async () => {
      const result = await action({ rollIds: [...ticked], toLocationId, note });
      if (result.ok) {
        toast.success(
          result.moved === 1
            ? `${single?.code ?? "1 roll"} moved to ${result.to}.`
            : `${result.moved} rolls moved to ${result.to}.`,
        );
        setOpen(false);
        router.refresh();
        return;
      }
      if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
        setErrors(result.fieldErrors);
        return focusFirstInvalid(formRef.current);
      }
      setFormError(result.error);
    });
  }

  const toggle = (id: string) =>
    setTicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const label = triggerLabel ?? (single ? "Move" : "Move rolls");
  const noLocations = locations.length === 0;

  return (
    <>
      <Button
        size={size}
        variant={variant}
        disabled={rolls.length === 0 || noLocations}
        title={noLocations ? "Add a storage location first." : undefined}
        // The visible word ("Move", "Place it", "Set aside") then the roll (run 1 observation).
        aria-label={single ? `${label.replace(/ it$/, "")} ${single.code}` : undefined}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <MoveRight aria-hidden />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size={single ? "md" : "lg"} className="max-h-[90dvh] overflow-y-auto">
          <DialogTitle>{single ? `Move ${single.code}` : "Move rolls"}</DialogTitle>
          <DialogDescription>
            {single
              ? `Now: ${single.where}. Choose where it is kept from now on.`
              : "Tick the rolls you moved, then choose where they are kept now."}
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
            {!single && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-sm font-medium">Rolls</legend>
                <ul
                  id="move-rollIds"
                  tabIndex={-1}
                  aria-describedby={errors.rollIds ? "move-rollIds-error" : undefined}
                  className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-md border"
                >
                  {rolls.map((r) => (
                    <li key={r.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={ticked.has(r.id)}
                          onChange={() => toggle(r.id)}
                        />
                        <span className="font-mono font-medium">{r.code}</span>
                        <span className="ml-auto text-sm text-muted-foreground">{r.where}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <FieldError id="move-rollIds-error" message={errors.rollIds} />
              </fieldset>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="move-toLocationId">Move to</Label>
              <Select
                id="move-toLocationId"
                value={toLocationId}
                aria-invalid={!!errors.toLocationId}
                aria-describedby={errors.toLocationId ? "move-toLocationId-error" : undefined}
                onChange={(e) => setTo(e.target.value)}
              >
                <option value="">Choose a location</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id} disabled={single?.locationId === l.id}>
                    {locationText(l)}
                    {single?.locationId === l.id ? " (now)" : ""}
                  </option>
                ))}
              </Select>
              <FieldError id="move-toLocationId-error" message={errors.toLocationId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="move-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="move-note"
                rows={2}
                value={note}
                placeholder="Rack 1 was full"
                aria-invalid={!!errors.note}
                aria-describedby={errors.note ? "move-note-error" : undefined}
                onChange={(e) => setNote(e.target.value)}
              />
              <FieldError id="move-note-error" message={errors.note} />
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
                {single || ticked.size === 1
                  ? "Move 1 roll"
                  : `Move ${ticked.size === 0 ? "" : `${ticked.size} `}rolls`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
