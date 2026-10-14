"use client";

import { focusFirstInvalid } from "@/lib/focus-first-invalid";
import { useState, useTransition } from "react";
import { LoaderCircle, Pencil, Plus, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { MATCHING, TablePager } from "@/components/features/table-pager";
import { usePagedRows } from "@/lib/use-paged-rows";
import { cn } from "@/lib/utils";
import { createReferenceAction, setReferenceActiveAction, updateReferenceAction } from "./actions";

export type Column = { key: string; label: string; mono?: boolean; numeric?: boolean };
export type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "select";
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  /** Shown read-only when editing, with this reason (e.g. a defect key the camera sends). */
  lockedOnEdit?: string;
  options?: { value: string; label: string }[];
};
export type Row = {
  id: string;
  isActive: boolean;
  /** Raw values for the edit form. */
  values: Record<string, string>;
  /** Display text per column. */
  cells: Record<string, string>;
};

type Props = {
  kind: string;
  noun: string;
  columns: Column[];
  fields: Field[];
  rows: Row[];
  emptyText: string;
  /** Opens "Add" pre-filled (e.g. from Unknown classes → Add as defect type). */
  initialCreate?: Record<string, string>;
};

/** Everything a row shows, for the find box. */
function rowText(row: Row): string {
  return Object.values(row.cells).join(" ");
}

export function ReferenceManager({
  kind,
  noun,
  columns,
  fields,
  rows,
  emptyText,
  initialCreate,
}: Props) {
  const blank = Object.fromEntries(fields.map((f) => [f.name, ""]));
  const [editing, setEditing] = useState<Row | "new" | null>(initialCreate ? "new" : null);
  const [values, setValues] = useState<Record<string, string>>({ ...blank, ...initialCreate });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const Noun = noun[0].toUpperCase() + noun.slice(1);
  const list = usePagedRows(rows, rowText);

  function open(row: Row | "new") {
    setValues(row === "new" ? blank : { ...blank, ...row.values });
    setErrors({});
    setFormError(null);
    setEditing(row);
  }

  function toggle(row: Row, isActive: boolean, quiet = false) {
    startTransition(async () => {
      const result = await setReferenceActiveAction(kind, row.id, isActive);
      if (!result.ok) return void toast.error(result.error);
      if (quiet) return;
      const name = row.cells[columns[0].key];
      toast.success(isActive ? `${name} is active again.` : `${name} deactivated.`, {
        duration: 6000,
        action: { label: "Undo", onClick: () => toggle(row, !isActive, true) },
      });
    });
  }

  function submit() {
    setFormError(null);
    startTransition(async () => {
      const result =
        editing === "new"
          ? await createReferenceAction(kind, values)
          : await updateReferenceAction(kind, (editing as Row).id, values);
      if (result.ok) {
        toast.success(editing === "new" ? `${Noun} added.` : `${Noun} saved.`);
        setEditing(null);
      } else if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
        setErrors(result.fieldErrors);
        focusFirstInvalid(document.querySelector('[role="dialog"]'));
      } else setFormError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {rows.length > 0 ? (
          <div className="flex w-72 flex-col gap-1.5">
            <Label htmlFor={`find-${kind}`}>Find {noun}</Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id={`find-${kind}`}
                type="search"
                className="pl-9"
                placeholder={`Type a ${noun} name`}
                value={list.query}
                onChange={(e) => list.setQuery(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <span />
        )}
        <Button variant="secondary" onClick={() => open("new")}>
          <Plus aria-hidden />
          Add {noun}
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          {emptyText}
        </p>
      ) : list.total === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-muted-foreground">
          No {noun} matches “{list.query.trim()}”. Check the spelling, or clear the search.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {columns.map((c) => (
                  <TableHead key={c.key} numeric={c.numeric}>
                    {c.label}
                  </TableHead>
                ))}
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.shown.map((row) => (
                <TableRow
                  key={row.id}
                  aria-label={row.cells[columns[0].key]}
                  className={cn(!row.isActive && "text-muted-foreground")}
                >
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      numeric={c.numeric}
                      className={cn(c.mono && "font-mono")}
                    >
                      {row.cells[c.key] || "—"}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Badge tone={row.isActive ? "success" : "neutral"}>
                      {row.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => open(row)}>
                        <Pencil aria-hidden />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => toggle(row, !row.isActive)}
                      >
                        {row.isActive ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePager
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
            noun={[noun, `${noun}s`]}
            suffix={list.query.trim() ? MATCHING : ""}
            onPage={list.setPage}
          />
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <DialogTitle>
              {editing === "new" ? `Add ${noun}` : `Edit ${editing?.cells[columns[0].key] ?? noun}`}
            </DialogTitle>
            <DialogDescription>
              Inactive {noun}s disappear from pickers but stay on existing records.
            </DialogDescription>
            {formError && <Alert tone="danger">{formError}</Alert>}
            {fields.map((f) => {
              const id = `${kind}-${f.name}`;
              const locked = editing !== "new" && f.lockedOnEdit;
              const error = errors[f.name];
              const describedBy = error
                ? `${id}-error`
                : f.hint || locked
                  ? `${id}-hint`
                  : undefined;
              const common = {
                id,
                value: values[f.name] ?? "",
                "aria-invalid": !!error,
                "aria-describedby": describedBy,
              };
              const set = (v: string) => setValues({ ...values, [f.name]: v });
              return (
                <div key={f.name} className="flex flex-col gap-1.5">
                  <Label htmlFor={id}>
                    {f.label}
                    {f.optional && (
                      <span className="font-normal text-muted-foreground"> (optional)</span>
                    )}
                  </Label>
                  {f.type === "textarea" ? (
                    <Textarea rows={2} {...common} onChange={(e) => set(e.target.value)} />
                  ) : f.type === "select" ? (
                    <Select {...common} onChange={(e) => set(e.target.value)}>
                      <option value="">{f.placeholder ?? "None"}</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      {...common}
                      autoComplete="off"
                      inputMode={f.type === "number" ? "numeric" : undefined}
                      placeholder={f.placeholder}
                      readOnly={!!locked}
                      className={cn(locked && "bg-muted")}
                      onChange={(e) => set(e.target.value)}
                    />
                  )}
                  {error ? (
                    <p id={`${id}-error`} className="text-sm text-reject">
                      {error}
                    </p>
                  ) : (
                    (locked || f.hint) && (
                      <p id={`${id}-hint`} className="text-sm text-muted-foreground">
                        {locked || f.hint}
                      </p>
                    )
                  )}
                </div>
              );
            })}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending && <LoaderCircle aria-hidden className="animate-spin" />}
                {editing === "new" ? `Add ${noun}` : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
