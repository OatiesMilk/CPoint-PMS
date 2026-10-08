/*
 * Intent brief (ui-craft §1)
 * Who:   the System Admin, when something needs explaining ("who changed this, and when?").
 * What:  narrow the trail to one person, action, record or day, and see exactly what changed.
 * Worst: reading the wrong entry as the cause. Every row says who, what, on which record, with
 *        the changed fields side by side. Read-only: nothing here can alter the trail.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { auditFilterOptions, listAudit } from "@/server/services/audit-query.service";
import { auditQuerySchema } from "@/server/validators/audit.validator";

export const metadata: Metadata = { title: "Audit log" };

const show = (v: unknown) =>
  v === undefined ? "—" : typeof v === "string" ? v : JSON.stringify(v);

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requirePermission("audit:read");
  await connection();
  const query = auditQuerySchema.parse(await searchParams);
  const [{ entries, total, page, pageCount }, options] = await Promise.all([
    listAudit(query),
    auditFilterOptions(),
  ]);
  const filtered = Boolean(
    query.actor || query.action || query.entity || query.entityId || query.from || query.to,
  );
  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") next.set(k, String(v));
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change and sign-in, newest first. Read-only."
      />

      <form
        method="get"
        className="flex flex-wrap items-end gap-3"
        aria-label="Filter the audit log"
      >
        <div className="flex w-48 flex-col gap-1.5">
          <Label htmlFor="audit-actor">Who</Label>
          <Select id="audit-actor" name="actor" defaultValue={query.actor ?? ""}>
            <option value="">Anyone</option>
            {options.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-60 flex-col gap-1.5">
          <Label htmlFor="audit-action">Action</Label>
          <Select id="audit-action" name="action" defaultValue={query.action ?? ""}>
            <option value="">Any action</option>
            {options.actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-44 flex-col gap-1.5">
          <Label htmlFor="audit-entity">Record type</Label>
          <Select id="audit-entity" name="entity" defaultValue={query.entity ?? ""}>
            <option value="">Any</option>
            {options.entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex w-40 flex-col gap-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input id="audit-from" type="date" name="from" defaultValue={query.from} />
        </div>
        <div className="flex w-40 flex-col gap-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input id="audit-to" type="date" name="to" defaultValue={query.to} />
        </div>
        <div className="flex w-72 flex-col gap-1.5">
          <Label htmlFor="audit-entity-id">Record id</Label>
          <Input
            id="audit-entity-id"
            name="entityId"
            placeholder="Paste an id to see its history"
            defaultValue={query.entityId}
          />
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {filtered && (
          <Button asChild variant="ghost">
            <Link href="/admin/audit">Clear</Link>
          </Button>
        )}
      </form>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">
            {filtered ? "No entries match these filters" : "Nothing recorded yet"}
          </h2>
          {filtered && (
            <Button asChild variant="secondary">
              <Link href="/admin/audit">Clear filters</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ul
            className="flex flex-col divide-y rounded-lg border bg-card text-sm"
            data-testid="audit-list"
          >
            {entries.map((e) => (
              <li key={e.id} data-testid="audit-entry">
                <details className="group">
                  <summary className="grid cursor-pointer grid-cols-1 items-center gap-1 px-4 py-2 hover:bg-accent xl:grid-cols-[11rem_12rem_14rem_1fr_auto] xl:gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="text-muted-foreground tabular-nums">
                      {formatManilaDateTime(e.createdAt)}
                    </span>
                    <span className="truncate">{e.actor}</span>
                    <span className="truncate font-mono text-xs">{e.action}</span>
                    <span className="truncate">
                      {e.entity}
                      {e.entityLabel && (
                        <span className="text-muted-foreground"> · {e.entityLabel}</span>
                      )}
                    </span>
                    <ChevronDown
                      aria-hidden
                      className="size-4 text-muted-foreground transition-transform duration-(--dur-fast) group-open:rotate-180"
                    />
                  </summary>
                  <div className="flex flex-col gap-3 border-t bg-muted/40 px-4 py-3">
                    <p className="text-muted-foreground">
                      {e.entityId ? (
                        <>
                          Record id <span className="font-mono">{e.entityId}</span>
                          {" · "}
                          <Link
                            href={`/admin/audit?entityId=${encodeURIComponent(e.entityId)}`}
                            className="underline underline-offset-4"
                          >
                            Its full history
                          </Link>
                          {e.href && (
                            <>
                              {" · "}
                              <Link href={e.href} className="underline underline-offset-4">
                                Open
                              </Link>
                            </>
                          )}
                        </>
                      ) : (
                        "No specific record."
                      )}
                      {e.ip && <> · from {e.ip}</>}
                    </p>
                    {e.diff.length === 0 ? (
                      <p className="text-muted-foreground">No field values were recorded.</p>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="text-xs text-muted-foreground uppercase">
                          <tr>
                            <th className="w-48 py-1 font-medium">Field</th>
                            <th className="py-1 font-medium">Before</th>
                            <th className="py-1 font-medium">After</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono text-xs">
                          {e.diff.map((d) => (
                            <tr key={d.key} className="align-top">
                              <td className="py-1 pr-3">{d.key}</td>
                              <td className="py-1 pr-3 break-all text-muted-foreground">
                                {show(d.before)}
                              </td>
                              <td className="py-1 break-all">{show(d.after)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between text-sm text-muted-foreground"
          >
            <span>
              {total.toLocaleString("en-PH")} entr{total === 1 ? "y" : "ies"} · page {page} of{" "}
              {pageCount}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeft aria-hidden />
                    Newer
                  </Link>
                </Button>
              )}
              {page < pageCount && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(page + 1)}>
                    Older
                    <ChevronRight aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
