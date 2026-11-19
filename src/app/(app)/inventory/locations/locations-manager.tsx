"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableActionsHead,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { LOCATION_KIND_LABELS, LOCATION_KINDS } from "@/lib/location-rules";
import { cn } from "@/lib/utils";
import { addLocationSchema } from "@/server/validators/location.validator";
import { addLocationAction, editLocationAction, setLocationActiveAction } from "./actions";

export type LocationView = {
  id: string;
  code: string;
  name: string | null;
  kind: (typeof LOCATION_KINDS)[number];
  notes: string | null;
  isActive: boolean;
  rolls: number;
  /** A roll was placed there once, so its code is on labels and can't change (A-79). */
  codeLocked: boolean;
};

type Values = { code: string; name: string; kind: string; notes: string };
const EMPTY: Values = { code: "", name: "", kind: "BIN", notes: "" };
const fieldId = (name: string) => `location-${name}`;

/**
 * Inventory → Storage locations (Phase 32, D-128): the racks, bins and areas where rolls are kept.
 * Add and edit them, deactivate an empty one, and tick some to print their labels.
 */
export function LocationsManager({ locations }: { locations: LocationView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<LocationView | "new" | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const formRef = useRef<HTMLFormElement>(null);

  const open = (target: LocationView | "new") => {
    setEditing(target);
    setValues(
      target === "new"
        ? EMPTY
        : {
            code: target.code,
            name: target.name ?? "",
            kind: target.kind,
            notes: target.notes ?? "",
          },
    );
    setErrors({});
    setFormError(null);
  };

  function validate(): Record<string, string> {
    const out: Record<string, string> = {};
    const parsed = addLocationSchema.safeParse(values);
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !out[key]) out[key] = issue.message;
      }
    return out;
  }

  function save() {
    if (!editing) return;
    setFormError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return focusFirstInvalid(formRef.current);
    startTransition(async () => {
      const body = {
        name: values.name,
        kind: values.kind,
        notes: values.notes,
        ...(editing === "new" || !editing.codeLocked ? { code: values.code } : {}),
      };
      const result =
        editing === "new"
          ? await addLocationAction(body)
          : await editLocationAction(editing.id, body);
      if (result.ok) {
        toast.success(
          editing === "new"
            ? `${values.code.trim().toUpperCase()} added.`
            : `${values.code.trim().toUpperCase()} saved.`,
        );
        setEditing(null);
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

  function setActive(location: LocationView, isActive: boolean) {
    startTransition(async () => {
      const result = await setLocationActiveAction(location.id, isActive);
      if (result.ok) {
        router.refresh();
        toast.success(
          isActive ? `${location.code} reactivated.` : `${location.code} deactivated.`,
          isActive
            ? undefined
            : {
                action: {
                  label: "Undo",
                  onClick: () =>
                    void setLocationActiveAction(location.id, true).then(() => router.refresh()),
                },
                duration: 6000,
              },
        );
        return;
      }
      toast.error(result.error);
    });
  }

  const toggle = (id: string) =>
    setTicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allTicked = locations.length > 0 && ticked.size === locations.length;
  const labelsHref = `/inventory/locations/labels?ids=${[...ticked].join(",")}`;
  const isNew = editing === "new";
  const codeLocked = !isNew && editing !== null && editing.codeLocked;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {ticked.size === 0
            ? "Tick locations to print their labels."
            : ticked.size === 1
              ? "1 location ticked."
              : `${ticked.size} locations ticked.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {ticked.size > 0 ? (
            <Link href={labelsHref} className={buttonVariants({ variant: "secondary" })}>
              <Printer aria-hidden />
              Print {ticked.size === 1 ? "1 label" : `${ticked.size} labels`}
            </Link>
          ) : (
            <Button variant="secondary" disabled title="Tick at least one location first.">
              <Printer aria-hidden />
              Print labels
            </Button>
          )}
          <Button onClick={() => open("new")}>
            <Plus aria-hidden />
            Add location
          </Button>
        </div>
      </div>

      {locations.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          <p className="font-medium">No storage locations yet.</p>
          <p className="text-sm text-muted-foreground">
            Add your racks, bins and areas, then print their labels and stick them on.
          </p>
          <Button onClick={() => open("new")}>
            <Plus aria-hidden />
            Add the first location
          </Button>
        </div>
      ) : (
        <Table label="Storage locations">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label="Tick every location"
                  checked={allTicked}
                  onChange={() =>
                    setTicked(allTicked ? new Set() : new Set(locations.map((l) => l.id)))
                  }
                />
              </TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead numeric>Rolls in it</TableHead>
              <TableHead>Status</TableHead>
              <TableActionsHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.map((l) => (
              <TableRow
                key={l.id}
                data-testid="location-row"
                className={cn(!l.isActive && "text-muted-foreground")}
              >
                <TableCell>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={`Tick ${l.code}`}
                    checked={ticked.has(l.id)}
                    onChange={() => toggle(l.id)}
                  />
                </TableCell>
                <TableCell className="font-mono font-medium">{l.code}</TableCell>
                <TableCell className="max-w-56 whitespace-normal">
                  {l.name ?? <span className="text-muted-foreground">—</span>}
                  {l.notes && (
                    <span className="block text-sm text-muted-foreground">{l.notes}</span>
                  )}
                </TableCell>
                <TableCell>{LOCATION_KIND_LABELS[l.kind]}</TableCell>
                <TableCell numeric>
                  {l.rolls > 0 ? (
                    <Link
                      href={`/find?q=${encodeURIComponent(`LOC:${l.code}`)}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {l.rolls}
                    </Link>
                  ) : (
                    0
                  )}
                </TableCell>
                <TableCell>
                  <Badge tone={l.isActive ? "success" : "neutral"}>
                    {l.isActive ? "Active" : "Deactivated"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${l.code}`}
                      onClick={() => open(l)}
                    >
                      <Pencil aria-hidden />
                      Edit
                    </Button>
                    {l.isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending || l.rolls > 0}
                        title={l.rolls > 0 ? "Move its rolls first." : undefined}
                        onClick={() => setActive(l, false)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setActive(l, true)}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent size="md">
          <DialogTitle>
            {isNew ? "Add a location" : `Edit ${editing ? editing.code : ""}`}
          </DialogTitle>
          <DialogDescription>
            A rack, a bin or an area where rolls are kept. The code goes on its label, so keep it
            short, like R1-B3.
          </DialogDescription>
          <form
            ref={formRef}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldId("code")}>Code</Label>
              <Input
                id={fieldId("code")}
                autoComplete="off"
                className="font-mono uppercase"
                value={values.code}
                placeholder="R1-B3"
                readOnly={codeLocked}
                aria-invalid={!!errors.code}
                aria-describedby={
                  errors.code
                    ? `${fieldId("code")}-error`
                    : codeLocked
                      ? `${fieldId("code")}-hint`
                      : undefined
                }
                onChange={(e) => setValues((v) => ({ ...v, code: e.target.value }))}
              />
              {codeLocked && (
                <p id={`${fieldId("code")}-hint`} className="text-sm text-muted-foreground">
                  Rolls have been kept here, so the code on its labels stays. Change the name
                  instead.
                </p>
              )}
              <FieldError id={`${fieldId("code")}-error`} message={errors.code} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldId("name")}>
                Name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={fieldId("name")}
                autoComplete="off"
                value={values.name}
                placeholder="Rack 1, bin 3"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? `${fieldId("name")}-error` : undefined}
                onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              />
              <FieldError id={`${fieldId("name")}-error`} message={errors.name} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldId("kind")}>Kind</Label>
              <Select
                id={fieldId("kind")}
                value={values.kind}
                aria-invalid={!!errors.kind}
                onChange={(e) => setValues((v) => ({ ...v, kind: e.target.value }))}
              >
                {LOCATION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LOCATION_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
              <FieldError id={`${fieldId("kind")}-error`} message={errors.kind} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldId("notes")}>
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id={fieldId("notes")}
                rows={2}
                value={values.notes}
                aria-invalid={!!errors.notes}
                aria-describedby={errors.notes ? `${fieldId("notes")}-error` : undefined}
                onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              />
              <FieldError id={`${fieldId("notes")}-error`} message={errors.notes} />
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
                {isNew ? "Add location" : "Save location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
