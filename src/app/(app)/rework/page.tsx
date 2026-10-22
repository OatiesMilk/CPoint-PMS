/*
 * Intent brief (ui-craft §1)
 * Who:   Floor Manager / Quality Inspector handling Fixable leather sections during the shift.
 * What:  see which sections wait to be cleaned or cut around (raw leather, before cutting: nothing
 *        is repaired, D-070), start them, and mark them done so they count as usable again.
 * Worst: a handled section never marked done (batch yield looks wrong, the batch can't close).
 *        Oldest waiting first, one button per card, the action each needs, undo instead of confirm.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CircleCheck, Droplet, Hourglass, Scissors, Wrench } from "lucide-react";
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

export const metadata: Metadata = { title: "Repair Station" };

/** What to do with the section (D-070), and how a finished one reads. */
const HANDLING = {
  CLEAN: { todo: "Clean before cutting", done: "Cleaned, usable", Icon: Droplet },
  CUT_AROUND: { todo: "Cut around the marked area", done: "Cut around, usable", Icon: Scissors },
} as const;

function Card({ card, now }: { card: ReworkCard; now: number }) {
  const label = `${card.batchCode} · section #${card.sequence}`;
  const handling = HANDLING[card.handling];
  const since =
    card.status === "OPEN"
      ? `Waiting ${formatDuration(now - Date.parse(card.openedAt))}`
      : card.status === "IN_PROGRESS"
        ? `Started ${formatDuration(now - Date.parse(card.startedAt!))} ago`
        : `Done ${formatManilaDateTime(card.completedAt!)}${card.completedBy ? ` by ${card.completedBy}` : ""}`;
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
            <span className="font-mono">{card.batchCode}</span> · section #{card.sequence}
          </Link>
          <p className="text-sm text-muted-foreground">
            {card.defect
              ? `${card.defect.label}, ${Math.round(card.defect.confidence * 100)}%`
              : "Sent by a person"}{" "}
            · {since}
          </p>
          {card.status === "DONE" ? (
            <p
              data-testid="rework-done"
              className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-sm bg-pass-soft px-2 py-0.5 text-sm text-pass"
            >
              <CircleCheck aria-hidden className="size-4 shrink-0" />
              {handling.done}
            </p>
          ) : (
            <p
              data-testid="rework-handling"
              className="mt-1 flex items-start gap-1.5 text-sm font-medium"
            >
              <handling.Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
              {handling.todo}
            </p>
          )}
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
              {cards.length - shown.length} more done this week. Filter by batch to find one.
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
        title="Repair Station"
        description="Clean the section or cut around the defect, then mark it done. Done sections count as usable in their batch."
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
            title="To handle"
            icon={Hourglass}
            cards={board.waiting}
            now={now}
            tone="text-rework"
            empty="Nothing to handle. Sections the camera marks Fixable appear here."
          />
          <Column
            id="repairing"
            title="Being handled"
            icon={Wrench}
            cards={board.inProgress}
            now={now}
            empty="Nothing being cleaned or cut around right now."
          />
          <Column
            id="repaired"
            title="Done, usable"
            icon={CircleCheck}
            cards={board.done}
            limit={12}
            now={now}
            tone="text-pass"
            empty="Nothing done in the last 7 days."
          />
        </div>
      </div>
    </>
  );
}
