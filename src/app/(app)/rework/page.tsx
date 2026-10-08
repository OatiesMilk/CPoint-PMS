/*
 * Intent brief (ui-craft §1)
 * Who:   Floor Manager / Quality Inspector tracking the separate repair station during the shift.
 * What:  see which sections wait for repair, start them, and mark them repaired so they count again.
 * Worst: a repaired section never marked done (batch yield looks wrong, the batch can't close).
 *        Oldest waiting first, one button per card, undo instead of confirm.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Hourglass, Wrench, CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { ScanThumb } from "@/components/features/scans/scan-thumb";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDuration, formatManilaDateTime } from "@/lib/format";
import { requirePermission } from "@/server/policies/guard";
import { reworkBoard, type ReworkCard } from "@/server/services/rework.service";
import { reworkListQuerySchema } from "@/server/validators/outcome.validator";
import { ReworkCardActions } from "./rework-card-actions";
import { ReworkColumn } from "./rework-column";

export const metadata: Metadata = { title: "Rework" };

function Card({ card, now }: { card: ReworkCard; now: number }) {
  const label = `${card.batchCode} · #${card.sequence}`;
  const since =
    card.status === "OPEN"
      ? `Waiting ${formatDuration(now - Date.parse(card.openedAt))}`
      : card.status === "IN_PROGRESS"
        ? `Started ${formatDuration(now - Date.parse(card.startedAt!))} ago`
        : `Repaired ${formatManilaDateTime(card.completedAt!)}${card.completedBy ? ` by ${card.completedBy}` : ""}`;
  return (
    <li
      data-testid="rework-card"
      aria-label={label}
      className="flex gap-3 rounded-md border bg-card p-3 shadow-1"
    >
      <Link href={`/scans/${card.scanId}`} className="shrink-0" aria-label={`Open scan ${label}`}>
        {card.hasImage ? (
          <ScanThumb scanId={card.scanId} className="h-14 w-18" />
        ) : (
          <span className="block h-14 w-18 rounded-sm bg-muted" />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div>
          <Link
            href={`/scans/${card.scanId}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            <span className="font-mono">{card.batchCode}</span> · #{card.sequence}
          </Link>
          <p className="text-sm text-muted-foreground">
            {card.defect
              ? `${card.defect.label} ${Math.round(card.defect.confidence * 100)}%`
              : "Sent by a person"}{" "}
            · {since}
          </p>
          {card.notes && <p className="text-sm">“{card.notes}”</p>}
        </div>
        <ReworkCardActions id={card.id} status={card.status} label={label} />
      </div>
    </li>
  );
}

function Column({
  id,
  title,
  icon: Icon,
  cards,
  empty,
  now,
  tone,
  limit,
}: {
  id: string;
  title: string;
  icon: typeof Wrench;
  cards: ReworkCard[];
  empty: string;
  now: number;
  tone?: string;
  /** Show at most this many cards (the finished column grows all week). */
  limit?: number;
}) {
  const shown = limit ? cards.slice(0, limit) : cards;
  return (
    <ReworkColumn
      id={id}
      title={title}
      count={cards.length}
      tone={tone}
      icon={<Icon aria-hidden className="size-4 shrink-0" />}
    >
      {cards.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((c) => (
            <Card key={c.id} card={c} now={now} />
          ))}
          {cards.length > shown.length && (
            <li className="px-1 text-sm text-muted-foreground">
              {cards.length - shown.length} more finished this week. Filter by batch to find one.
            </li>
          )}
        </ul>
      )}
    </ReworkColumn>
  );
}

export default async function ReworkPage({ searchParams }: PageProps<"/rework">) {
  await requirePermission("rework:manage");
  await connection();
  const query = reworkListQuerySchema.parse(await searchParams);
  const board = await reworkBoard(query.batch);
  const { now } = board;

  return (
    <>
      <PageHeader
        title="Rework"
        description="Sections the camera sent to the repair station. Repaired sections count as usable in their batch."
      />
      <form className="flex items-end gap-2" action="/rework">
        <div className="flex w-64 flex-col gap-1.5">
          <label htmlFor="rework-batch" className="text-sm font-medium">
            Batch
          </label>
          <Input
            id="rework-batch"
            name="batch"
            type="search"
            defaultValue={query.batch ?? ""}
            placeholder="e.g. B-2026-0003"
          />
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {query.batch && (
          <Button asChild variant="ghost">
            <Link href="/rework">Clear</Link>
          </Button>
        )}
      </form>
      {/* Three columns when they fit, one stack otherwise. Never a second row, so a folded column
          can't leave a gap above the next row (a container query, so it follows the page, not the
          screen). */}
      <div className="@container">
        <div className="grid grid-cols-1 items-start gap-4 @min-[52rem]:grid-cols-3">
          <Column
            id="waiting"
            title="Waiting"
            icon={Hourglass}
            cards={board.waiting}
            now={now}
            tone="text-rework"
            empty="Nothing waiting. Sections the camera sends to rework appear here."
          />
          <Column
            id="repairing"
            title="Being repaired"
            icon={Wrench}
            cards={board.inProgress}
            now={now}
            empty="No repairs in progress."
          />
          <Column
            id="repaired"
            title="Repaired, last 7 days"
            icon={CircleCheck}
            cards={board.done}
            limit={12}
            now={now}
            tone="text-pass"
            empty="No repairs finished in the last 7 days."
          />
        </div>
      </div>
    </>
  );
}
