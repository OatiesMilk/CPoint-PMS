/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager (decides, orders, receives), Shoe Constructors (ask for materials;
 *        leather rolls only if allowed, D-031), the System Admin (reads). A few times a day.
 * What:  see which requests wait for a decision, an order or a delivery, the soonest needed
 *        first, and open one. Constructors see and send their own, as "Material requests" (D-035).
 * Worst: a request for leather or nails sits unnoticed until the line stops (survey Q13), or an
 *        order nobody chased. Pending is the Floor Manager's default tab, High urgency on top
 *        (D-037), with each one's age; an overdue order says "Delivery late" (D-041).
 */
import type { Metadata } from "next";
import { TablePager } from "@/components/features/table-pager";
import Link from "next/link";
import { connection } from "next/server";
import { Info, Plus } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import {
  ClosedShortBadge,
  LateBadge,
  RaisedByFloorManagerBadge,
  RequestStatusBadge,
  UrgencyBadge,
} from "@/components/features/procurement/request-badges";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCalendarDate, formatDuration, formatManilaDateTime } from "@/lib/format";
import {
  requestLabelsFor,
  STATUS_LABELS,
  STATUS_ORDER,
  summarizeItems,
} from "@/lib/procurement-rules";
import { cn } from "@/lib/utils";
import { getCurrentUser, requirePermission } from "@/server/policies/guard";
import { can, canRequestLeatherRollsFor } from "@/server/policies/permissions";
import {
  listRequesters,
  listRequests,
  OPEN_TAB_DEFAULT,
  requestableItems,
} from "@/server/services/procurement.service";
import { requestListQuerySchema } from "@/server/validators/procurement.validator";
import { RequestFilters } from "./request-filters";
import { RequestersPanel } from "./requesters-panel";

/** "Material requests" for a Shoe Constructor, "Procurement" for everyone else (D-035). */
export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  return { title: user ? requestLabelsFor(user.role).nav : "Procurement" };
}

export default async function ProcurementPage({ searchParams }: PageProps<"/procurement">) {
  const user = await requirePermission("procurement:read");
  await connection();
  const raw = await searchParams;
  const isConstructor = user.role === "SHOE_CONSTRUCTOR";
  const canRequest = can(user.role, "procurement:request");
  const canDesignate = can(user.role, "procurement:designate");
  const tab = raw.tab === "requesters" && canDesignate ? "requesters" : "requests";

  const parsed = requestListQuerySchema.parse(raw);
  const all = raw.status === "all";
  const status = all ? undefined : (parsed.status ?? OPEN_TAB_DEFAULT[user.role]);
  const query = { ...parsed, status };
  const filtered = Boolean(
    query.category || query.urgency || query.late || query.item || query.from || query.to,
  );
  const labels = requestLabelsFor(user.role);

  const [list, items, requesters] = await Promise.all([
    listRequests(query, user), // the tab counts show on every tab
    // The item filter lists inventory items; constructors don't have inventory access.
    tab === "requests" && !isConstructor ? requestableItems() : Promise.resolve([]),
    tab === "requesters" ? listRequesters() : Promise.resolve([]),
  ]);
  const anyRequest = Object.values(list.counts).some((n) => (n ?? 0) > 0);

  const href = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = {
      status: all ? "all" : raw.status === undefined ? undefined : String(raw.status),
      category: query.category,
      urgency: query.urgency,
      late: query.late,
      item: query.item,
      from: query.from,
      to: query.to,
      ...next,
    };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    const qs = params.toString();
    return qs ? `/procurement?${qs}` : "/procurement";
  };
  const now = new Date();

  return (
    <>
      <PageHeader
        title={labels.nav}
        description={
          isConstructor
            ? "Ask for materials when stock runs low. The Floor Manager approves each request."
            : "Materials asked for, the most urgent first. Decide each item, record the order, then record what arrives."
        }
        actions={
          canRequest && (
            <Button asChild>
              <Link href="/procurement/new">
                <Plus aria-hidden />
                {labels.create}
              </Link>
            </Button>
          )
        }
      />

      {isConstructor && !canRequestLeatherRollsFor(user) && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="size-4" />
          You can request any material except leather rolls. Ask your Floor Manager if you need to
          request leather rolls too.
        </p>
      )}
      {user.role === "SYSTEM_ADMIN" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info aria-hidden className="size-4" />
          You can view requests and choose who may request leather rolls. The Floor Manager decides
          them.
        </p>
      )}

      <nav aria-label="Request status" className="flex flex-wrap gap-x-1 border-b">
        {STATUS_ORDER.map((s) => (
          <TabLink
            key={s}
            href={href({ status: s, page: undefined })}
            current={tab === "requests" && status === s}
          >
            {STATUS_LABELS[s]} <span className="tabular-nums">({list.counts[s] ?? 0})</span>
          </TabLink>
        ))}
        <TabLink
          href={href({ status: "all" })}
          current={tab === "requests" && status === undefined}
        >
          All
        </TabLink>
        {canDesignate && (
          <TabLink
            href="/procurement?tab=requesters"
            current={tab === "requesters"}
            className="ml-auto"
          >
            Leather roll requesters
          </TabLink>
        )}
      </nav>

      {tab === "requesters" ? (
        <RequestersPanel people={requesters} />
      ) : !anyRequest && !filtered ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No {labels.many} yet</h2>
          <p className="max-w-md text-muted-foreground">
            {isConstructor
              ? "When nails, thread or leather run low, send a material request. The Floor Manager sees it right away."
              : canRequest
                ? "Shoe Constructors send requests when materials run low, and you can raise one yourself. Leather rolls only from the constructors you allow under Leather roll requesters."
                : "Shoe Constructors send requests when materials run low. The Floor Manager decides, orders and receives them."}
          </p>
          {canRequest && (
            <Button asChild className="mt-2">
              <Link href="/procurement/new">Send your first {labels.one}</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <RequestFilters items={items.map((i) => ({ id: i.id, name: i.name }))} />
          {list.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
              <h2 className="text-xl font-semibold">
                {filtered
                  ? "No requests match these filters"
                  : `No ${status ? STATUS_LABELS[status].toLowerCase() : ""} requests`}
              </h2>
              {filtered && (
                <Button asChild variant="secondary" className="mt-2">
                  <Link
                    href={href({
                      category: undefined,
                      urgency: undefined,
                      late: undefined,
                      item: undefined,
                      from: undefined,
                      to: undefined,
                    })}
                  >
                    Clear filters
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Request</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Urgency</TableHead>
                    {!isConstructor && <TableHead>Requested by</TableHead>}
                    <TableHead>Sent</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.rows.map((r) => (
                    <TableRow key={r.id} aria-label={r.code}>
                      <TableCell>
                        <Link
                          href={`/procurement/${r.id}`}
                          className="font-mono underline-offset-4 hover:underline"
                        >
                          {r.code}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-80 min-w-48 whitespace-normal">
                        <span className="line-clamp-2" title={summarizeItems(r.lines)}>
                          {summarizeItems(r.lines)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <UrgencyBadge urgency={r.urgency} daysLeft={r.daysLeft} />
                      </TableCell>
                      {!isConstructor && (
                        <TableCell className="whitespace-normal">
                          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {r.requestedBy.name}
                            {r.raisedByFloorManager && <RaisedByFloorManagerBadge />}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="min-w-28 whitespace-normal text-muted-foreground">
                        {r.status === "PENDING"
                          ? `${formatDuration(now.getTime() - r.createdAt.getTime())} ago`
                          : formatManilaDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="min-w-28 whitespace-normal text-muted-foreground">
                        {r.expectedDeliveryOn ? (
                          <span className="flex flex-col">
                            {formatCalendarDate(r.expectedDeliveryOn)}
                            {r.supplier && <span className="text-sm">{r.supplier.name}</span>}
                          </span>
                        ) : (
                          <>
                            <span aria-hidden>—</span>
                            <span className="sr-only">Not ordered yet</span>
                          </>
                        )}
                      </TableCell>
                      <TableCell className="min-w-36 whitespace-normal">
                        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <RequestStatusBadge status={r.status} />
                          {r.closedShortAt && <ClosedShortBadge />}
                          {r.late && <LateBadge />}
                          {r.partlyApproved && (
                            <span className="basis-full text-sm text-muted-foreground">
                              {r.partlyApproved}
                            </span>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <TablePager
                page={list.page}
                pageCount={list.pageCount}
                total={list.total}
                noun={["request", "requests"]}
                href={(p) => href({ page: String(p) })}
              />
            </div>
          )}
        </>
      )}
    </>
  );
}

function TabLink({
  href,
  current,
  className,
  children,
}: {
  href: string;
  current: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
        current
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}
