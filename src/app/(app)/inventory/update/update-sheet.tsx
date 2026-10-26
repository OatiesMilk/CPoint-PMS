"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
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
import { MATCHING, TablePager } from "@/components/features/table-pager";
import type { InventoryCategory } from "@/lib/domain";
import { formatManilaDateTime, formatManilaWeekdayDate } from "@/lib/format";
import {
  CATEGORY_LABELS,
  formatQuantity,
  planStockLine,
  type StockLineField,
} from "@/lib/inventory-rules";
import { describeReminderDays, WEEKDAY_LABELS } from "@/lib/stock-rules";
import { usePagedRows } from "@/lib/use-paged-rows";
import { stockLineSchema } from "@/server/validators/inventory.validator";
import type { stockSheet } from "@/server/services/stock-update.service";
import { saveReminderDaysAction, saveStockUpdateAction } from "../actions";

type Sheet = Awaited<ReturnType<typeof stockSheet>>;
type Item = Sheet["items"][number];
type Entry = Record<StockLineField, string>;

const LEAVE_PROMPT = "Leave without saving the stock update? What you typed will be lost.";
const EMPTY: Entry = { added: "", used: "", correction: "", reason: "" };
const NUMBER_FIELDS = ["added", "used", "correction"] as const;

const itemText = (i: Item) => `${i.sku} ${i.name} ${i.supplier ?? ""}`;
const fieldId = (field: StockLineField, id: string) => `${field}-${id}`;
const isBlank = (e: Entry) => NUMBER_FIELDS.every((f) => e[f].trim() === "");

/** "6", "-3", "−2.5" → a number; 0 when blank; NaN when it isn't one. Used ignores its sign. */
function parseNumber(text: string, unsigned = false): number {
  let t = text.trim().replace(/^[−–]/, "-").replace(/^\+/, "");
  if (unsigned) t = t.replace(/^-/, "");
  return t === "" ? 0 : Number(t);
}

/** The stock after the line, or null while a number can't be read. */
function afterOf(onHand: number, e: Entry): number | null {
  const added = parseNumber(e.added);
  const used = parseNumber(e.used, true);
  const correction = parseNumber(e.correction);
  if (![added, used, correction].every(Number.isFinite)) return null;
  return Math.round((onHand + added - used + correction) * 100) / 100;
}

/**
 * The Update stock sheet (Phase 29, D-102). Per item: what was added, what was used, and a
 * correction for a miscount (with a reason; the reports never count it as use). Entries stay
 * while you search, filter or page, and are saved together; leaving with unsaved entries asks.
 */
export function UpdateSheet({ sheet, initialQuery }: { sheet: Sheet; initialQuery: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState<Map<string, Entry>>(() => new Map());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [category, setCategory] = useState<InventoryCategory | "all">("all");

  const categories = useMemo(() => [...new Set(sheet.items.map((i) => i.category))], [sheet.items]);
  const filtered = useMemo(
    () => sheet.items.filter((i) => category === "all" || i.category === category),
    [sheet.items, category],
  );
  const list = usePagedRows(filtered, itemText, undefined, initialQuery);

  const entryOf = (id: string) => entries.get(id) ?? EMPTY;
  const filled = sheet.items.filter((i) => !isBlank(entryOf(i.id)));
  const dirty = [...entries.values()].some((e) => !isBlank(e) || e.reason.trim() !== "");

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (!window.confirm(LEAVE_PROMPT)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  function edit(id: string, patch: Partial<Entry>) {
    setEntries((m) => new Map(m).set(id, { ...(m.get(id) ?? EMPTY), ...patch }));
    setErrors((errs) => {
      const rest = { ...errs };
      for (const f of [...NUMBER_FIELDS, "reason"]) delete rest[`lines.${id}.${f}`];
      return rest;
    });
  }

  /** Checks every filled line as the server will; returns the field errors, keyed like it. */
  function check() {
    const next: Record<string, string> = {};
    const lines = [];
    for (const item of filled) {
      const e = entryOf(item.id);
      const parsed = stockLineSchema(item.name).safeParse({
        itemId: item.id,
        seenQuantity: item.quantityOnHand,
        ...e,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues)
          next[`lines.${item.id}.${String(issue.path[0])}`] ??= issue.message;
        continue;
      }
      const plan = planStockLine({ ...item, isActive: true }, parsed.data);
      if (!plan.ok) {
        next[`lines.${item.id}.${plan.field ?? "added"}`] = plan.reason;
        continue;
      }
      lines.push(parsed.data);
    }
    return { next, lines };
  }

  function focusField(key: string) {
    const [, id, field] = key.split(".");
    const target = document.getElementById(fieldId(field as StockLineField, id));
    if (target) return target.focus();
    // On another page of the sheet: find it first.
    const item = sheet.items.find((i) => i.id === id);
    if (item) {
      setCategory("all");
      list.setQuery(item.sku);
    }
  }

  function save() {
    setFormError(null);
    if (filled.length === 0) {
      setFormError("Enter a change for at least one item.");
      return;
    }
    const { next, lines } = check();
    const keys = Object.keys(next).filter((k) => next[k]);
    if (keys.length > 0) {
      setErrors(next);
      return focusField(keys[0]);
    }
    setErrors({});
    startTransition(async () => {
      const result = await saveStockUpdateAction({ lines });
      if (result.ok) {
        toast.success(`Stock updated: ${result.items} ${result.items === 1 ? "item" : "items"}.`);
        setEntries(new Map());
        router.refresh();
        return;
      }
      setFormError(result.error);
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        const first = Object.keys(result.fieldErrors)[0];
        if (first) focusField(first);
      }
    });
  }

  const summary = Object.entries(errors)
    .filter(([, m]) => m)
    .map(([key, message]) => {
      const [, id, field] = key.split(".");
      return { fieldId: fieldId(field as StockLineField, id), message };
    });

  return (
    <div className="flex flex-col gap-6">
      {sheet.due && (
        <Alert tone="info" data-testid="stock-update-due">
          <span className="flex items-center gap-2">
            <BellRing aria-hidden className="size-4 shrink-0 text-info" />
            Today is a stock update day. Save an update to clear the reminder.
          </span>
        </Alert>
      )}
      {formError && <Alert tone="danger">{formError} Your entries are kept.</Alert>}
      <FormErrorSummary errors={summary} outcome="saved" />

      {sheet.items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-5 py-10 text-center text-muted-foreground">
          No active items yet. Add the materials you keep on the shelf under Inventory → Add item.
        </p>
      ) : (
        <section aria-labelledby="sheet-heading" className="flex flex-col gap-4">
          <h2 id="sheet-heading" className="sr-only">
            Items
          </h2>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex w-72 flex-col gap-1.5">
                <Label htmlFor="find-item">Find an item</Label>
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="find-item"
                    type="search"
                    className="pl-9"
                    placeholder="Code, name or supplier"
                    value={list.query}
                    onChange={(e) => list.setQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex w-56 flex-col gap-1.5">
                <Label htmlFor="category-filter">Category</Label>
                <Select
                  id="category-filter"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as InventoryCategory | "all");
                    list.setPage(1);
                  }}
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <Button disabled={pending || filled.length === 0} onClick={save}>
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              {pending
                ? "Saving…"
                : filled.length > 0
                  ? `Save update (${filled.length} ${filled.length === 1 ? "item" : "items"})`
                  : "Save update"}
            </Button>
          </div>

          {list.total === 0 ? (
            <p className="rounded-lg border border-dashed px-5 py-10 text-center text-muted-foreground">
              {`No item matches “${list.query.trim()}”. Check the spelling, or clear the search.`}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Item</TableHead>
                    <TableHead numeric>On hand</TableHead>
                    <TableHead>Added (+)</TableHead>
                    <TableHead>Used (−)</TableHead>
                    <TableHead>Correction</TableHead>
                    <TableHead>Reason for a correction</TableHead>
                    <TableHead numeric>After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.shown.map((item) => {
                    const e = entryOf(item.id);
                    const after = isBlank(e) ? null : afterOf(item.quantityOnHand, e);
                    const correcting = e.correction.trim() !== "";
                    const numberCell = (
                      field: (typeof NUMBER_FIELDS)[number],
                      label: string,
                      example: string,
                    ) => {
                      const id = fieldId(field, item.id);
                      const error = errors[`lines.${item.id}.${field}`];
                      return (
                        <TableCell className="align-top">
                          <Label htmlFor={id} className="sr-only">
                            {label} {item.name}
                          </Label>
                          <div className="relative w-28">
                            <Input
                              id={id}
                              inputMode="decimal"
                              autoComplete="off"
                              className="pr-12"
                              placeholder={example}
                              value={e[field]}
                              disabled={pending}
                              aria-invalid={!!error}
                              aria-describedby={error ? `${id}-error` : undefined}
                              onChange={(ev) => edit(item.id, { [field]: ev.target.value })}
                            />
                            <span className="pointer-events-none absolute top-1/2 right-2 max-w-10 -translate-y-1/2 truncate text-sm text-muted-foreground">
                              {item.unit}
                            </span>
                          </div>
                          <FieldError
                            id={`${id}-error`}
                            message={error}
                            className="mt-1 max-w-48"
                          />
                        </TableCell>
                      );
                    };
                    const reasonError = errors[`lines.${item.id}.reason`];
                    const reasonField = fieldId("reason", item.id);
                    return (
                      <TableRow key={item.id} aria-label={`${item.sku} ${item.name}`}>
                        <TableCell className="align-top">
                          <span className="font-medium">{item.name}</span>
                          <span className="block text-sm text-muted-foreground">
                            <span className="font-mono">{item.sku}</span>
                            {item.supplier && <> · {item.supplier}</>}
                            {" · "}
                            {item.lastUpdatedAt
                              ? `updated ${formatManilaWeekdayDate(item.lastUpdatedAt)}`
                              : "not updated yet"}
                          </span>
                        </TableCell>
                        <TableCell numeric className="align-top whitespace-nowrap">
                          {formatQuantity(item.quantityOnHand, item.unit)}
                        </TableCell>
                        {item.category === "LEATHER_ROLL" ? (
                          <TableCell colSpan={5} className="align-top text-muted-foreground">
                            Counted from its rolls.{" "}
                            <Link
                              href={`/inventory/${item.id}`}
                              className="text-foreground underline underline-offset-4 hover:no-underline"
                            >
                              Add or remove rolls on the item
                            </Link>
                            .
                          </TableCell>
                        ) : (
                          <>
                            {numberCell("added", "Added to", "e.g. 6")}
                            {numberCell("used", "Used of", "e.g. 3")}
                            {numberCell("correction", "Correction for", "e.g. −2")}
                            <TableCell className="align-top">
                              <Label htmlFor={reasonField} className="sr-only">
                                Reason for the {item.name} correction
                              </Label>
                              <Input
                                id={reasonField}
                                className="w-52"
                                autoComplete="off"
                                placeholder={
                                  correcting ? "e.g. Recounted the shelf" : "Only for a correction"
                                }
                                value={e.reason}
                                disabled={pending || !correcting}
                                aria-invalid={!!reasonError}
                                aria-describedby={reasonError ? `${reasonField}-error` : undefined}
                                onChange={(ev) => edit(item.id, { reason: ev.target.value })}
                              />
                              <FieldError
                                id={`${reasonField}-error`}
                                message={reasonError}
                                className="mt-1 max-w-52"
                              />
                            </TableCell>
                            <TableCell
                              numeric
                              className="align-top whitespace-nowrap"
                              data-testid="on-hand-after"
                            >
                              {after === null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                formatQuantity(after, item.unit)
                              )}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <TablePager
                page={list.page}
                pageCount={list.pageCount}
                total={list.total}
                noun={["item", "items"]}
                suffix={list.query.trim() ? MATCHING : ""}
                onPage={list.setPage}
              />
            </>
          )}
        </section>
      )}

      <ReminderDays days={sheet.reminderDays} />

      {sheet.recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
          <h2 id="recent-heading" className="text-xl font-semibold">
            Recent updates
          </h2>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {sheet.recent.map((u) => (
              <li key={u.id}>
                {formatManilaDateTime(u.createdAt)} · {u.items} {u.items === 1 ? "item" : "items"} ·{" "}
                {u.by}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The reminder days (C-32): ticks for Monday to Sunday, saved on their own. */
function ReminderDays({ days }: { days: number[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<number[]>(days);
  const [error, setError] = useState<string | null>(null);
  const changed = [...chosen].sort().join(",") !== [...days].sort().join(",");

  function save() {
    setError(null);
    if (chosen.length === 0) return setError("Pick at least one reminder day.");
    startTransition(async () => {
      const result = await saveReminderDaysAction({ reminderDays: chosen });
      if (!result.ok) return setError(result.error);
      toast.success(`Reminder days saved: ${describeReminderDays(chosen)}.`);
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="reminder-heading" className="rounded-lg border bg-card px-5 py-4">
      <h2 id="reminder-heading" className="text-lg font-semibold">
        Reminder days
      </h2>
      <p className="mt-1 text-muted-foreground">
        On these days your Overview and the bell remind you to update stock until you save an
        update. Now: {describeReminderDays(days)}.
      </p>
      <fieldset className="mt-3" aria-describedby={error ? "reminder-error" : undefined}>
        <legend className="sr-only">Remind me on</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <label key={d} className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-(--primary)"
                checked={chosen.includes(d)}
                disabled={pending}
                onChange={(e) =>
                  setChosen((c) => (e.target.checked ? [...c, d] : c.filter((x) => x !== d)))
                }
              />
              {WEEKDAY_LABELS[d]}
            </label>
          ))}
        </div>
      </fieldset>
      <FieldError id="reminder-error" message={error} className="mt-2" />
      <Button variant="secondary" className="mt-3" disabled={pending || !changed} onClick={save}>
        {pending && <LoaderCircle aria-hidden className="animate-spin" />}
        Save reminder days
      </Button>
    </section>
  );
}
