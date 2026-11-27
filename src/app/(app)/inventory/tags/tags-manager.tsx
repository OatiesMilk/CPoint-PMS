"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { ROLL_TAG_MESSAGES } from "@/lib/roll-tag-rules";
import { cn } from "@/lib/utils";
import { addRollTagSchema } from "@/server/validators/roll-tag.validator";
import {
  addRollTagAction,
  editRollTagAction,
  removeRollTagAction,
  setRollTagActiveAction,
} from "./actions";

export type RollTagView = {
  id: string;
  code: string;
  supplierId: string | null;
  supplierName: string | null;
  isDefault: boolean;
  isActive: boolean;
  rolls: number;
  /** A roll was made from it, so its code is on labels and can't change (A-122). */
  codeLocked: boolean;
};

type Values = { code: string; supplierId: string; isDefault: boolean };
const EMPTY: Values = { code: "", supplierId: "", isDefault: false };
const fieldId = (name: string) => `roll-tag-${name}`;

/**
 * Inventory → Roll tags (Phase 42, D-139): the tags that start every roll code. Add and edit
 * them, deactivate one (its rolls keep their codes), or remove one no roll was made from.
 */
export function RollTagsManager({
  tags,
  suppliers,
}: {
  tags: RollTagView[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<RollTagView | "new" | null>(null);
  const [removing, setRemoving] = useState<RollTagView | null>(null);
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const open = (target: RollTagView | "new") => {
    setEditing(target);
    setValues(
      target === "new"
        ? EMPTY
        : {
            code: target.code,
            supplierId: target.supplierId ?? "",
            isDefault: target.isDefault,
          },
    );
    setErrors({});
    setFormError(null);
  };

  function validate(): Record<string, string> {
    const out: Record<string, string> = {};
    const parsed = addRollTagSchema.safeParse(values);
    if (!parsed.success)
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !out[key]) out[key] = issue.message;
      }
    if (values.isDefault && !values.supplierId && !out.isDefault)
      out.isDefault = ROLL_TAG_MESSAGES.defaultNeedsSupplier;
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
        supplierId: values.supplierId,
        isDefault: values.isDefault,
        ...(editing === "new" || !editing.codeLocked ? { code: values.code } : {}),
      };
      const result =
        editing === "new"
          ? await addRollTagAction(body)
          : await editRollTagAction(editing.id, body);
      if (result.ok) {
        const code = values.code.trim().toUpperCase();
        toast.success(editing === "new" ? `${code} added.` : `${code} saved.`);
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

  function setActive(tag: RollTagView, isActive: boolean) {
    startTransition(async () => {
      const result = await setRollTagActiveAction(tag.id, isActive);
      if (result.ok) {
        router.refresh();
        toast.success(
          isActive ? `${tag.code} reactivated.` : `${tag.code} deactivated.`,
          isActive
            ? undefined
            : {
                action: {
                  label: "Undo",
                  onClick: () =>
                    void setRollTagActiveAction(tag.id, true).then(() => router.refresh()),
                },
                duration: 6000,
              },
        );
        return;
      }
      toast.error(result.error);
    });
  }

  function confirmRemove() {
    if (!removing) return;
    setRemoveError(null);
    startTransition(async () => {
      const result = await removeRollTagAction(removing.id);
      if (result.ok) {
        toast.success(`${removing.code} removed.`);
        setRemoving(null);
        router.refresh();
        return;
      }
      setRemoveError(result.error);
    });
  }

  const isNew = editing === "new";
  const codeLocked = !isNew && editing !== null && editing.codeLocked;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Roll codes read <span className="font-mono">LR-</span>tag
          <span className="font-mono">-</span>digits.
        </p>
        <Button onClick={() => open("new")}>
          <Plus aria-hidden />
          Add tag
        </Button>
      </div>

      {tags.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          <p className="font-medium">No roll tags yet.</p>
          <p className="text-sm text-muted-foreground">
            Add a tag, like BLC, then choose it in Add rolls. Every supplier added in Settings gets
            a tag of its own.
          </p>
          <Button onClick={() => open("new")}>
            <Plus aria-hidden />
            Add the first tag
          </Button>
        </div>
      ) : (
        <Table label="Roll tags">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Tag</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Default</TableHead>
              <TableHead numeric>Rolls using it</TableHead>
              <TableHead>Status</TableHead>
              <TableActionsHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tags.map((t) => (
              <TableRow
                key={t.id}
                data-testid="roll-tag-row"
                className={cn(!t.isActive && "text-muted-foreground")}
              >
                <TableCell className="font-mono font-medium">{t.code}</TableCell>
                <TableCell>
                  {t.supplierName ?? <span className="text-muted-foreground">Any supplier</span>}
                </TableCell>
                <TableCell>
                  {t.isDefault ? (
                    <Badge tone="success">Default</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell numeric>{t.rolls}</TableCell>
                <TableCell>
                  <Badge tone={t.isActive ? "success" : "neutral"}>
                    {t.isActive ? "Active" : "Deactivated"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${t.code}`}
                      onClick={() => open(t)}
                    >
                      <Pencil aria-hidden />
                      Edit
                    </Button>
                    {t.isActive ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label={`Deactivate ${t.code}`}
                        onClick={() => setActive(t, false)}
                      >
                        Deactivate
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        aria-label={`Reactivate ${t.code}`}
                        onClick={() => setActive(t, true)}
                      >
                        Reactivate
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending || t.rolls > 0}
                      title={
                        t.rolls > 0 ? "Rolls were made from it. Deactivate it instead." : undefined
                      }
                      aria-label={`Remove ${t.code}`}
                      onClick={() => {
                        setRemoveError(null);
                        setRemoving(t);
                      }}
                    >
                      <Trash2 aria-hidden />
                      Remove
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent size="md">
          <DialogTitle>{isNew ? "Add a tag" : `Edit ${editing ? editing.code : ""}`}</DialogTitle>
          <DialogDescription>
            The tag starts a roll’s code, like LR-BLC-001. It is printed on the roll’s label, so
            keep it short.
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
                placeholder="BLC"
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
                  Rolls were made from this tag, so the code on their labels stays. Add a new tag
                  instead, and deactivate this one if it shouldn’t be used again.
                </p>
              )}
              <FieldError id={`${fieldId("code")}-error`} message={errors.code} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={fieldId("supplierId")}>
                Supplier <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select
                id={fieldId("supplierId")}
                value={values.supplierId}
                aria-invalid={!!errors.supplierId}
                aria-describedby={errors.supplierId ? `${fieldId("supplierId")}-error` : undefined}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    supplierId: e.target.value,
                    isDefault: e.target.value ? v.isDefault : false,
                  }))
                }
              >
                <option value="">Any supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                {editing &&
                  editing !== "new" &&
                  editing.supplierId &&
                  !suppliers.some((s) => s.id === editing.supplierId) && (
                    <option value={editing.supplierId}>{editing.supplierName}</option>
                  )}
              </Select>
              <FieldError id={`${fieldId("supplierId")}-error`} message={errors.supplierId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2">
                <input
                  id={fieldId("isDefault")}
                  type="checkbox"
                  className="size-4 accent-(--primary)"
                  checked={values.isDefault}
                  disabled={!values.supplierId}
                  aria-invalid={!!errors.isDefault}
                  aria-describedby={errors.isDefault ? `${fieldId("isDefault")}-error` : undefined}
                  onChange={(e) => setValues((v) => ({ ...v, isDefault: e.target.checked }))}
                />
                Default for this supplier
              </label>
              <p className="text-sm text-muted-foreground">
                Add rolls chooses the supplier’s default tag first. A supplier has one default.
              </p>
              <FieldError id={`${fieldId("isDefault")}-error`} message={errors.isDefault} />
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
                {isNew ? "Add tag" : "Save tag"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent size="md">
          <DialogTitle>Remove {removing?.code}?</DialogTitle>
          <DialogDescription>
            No roll was made from this tag, so it can go. It leaves the list for good.
          </DialogDescription>
          {removeError && <Alert tone="danger">{removeError}</Alert>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Keep it
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirmRemove}>
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              Remove tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
