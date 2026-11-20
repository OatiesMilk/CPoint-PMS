/*
 * The Inspection queue (Phase 33, D-129; the panel's revision 2). Every batch waiting for
 * inspection, across days, each named by its code (B-261116-2) with its day, times, what went into
 * it and how long it has waited: Urgent first, then the oldest (A-58). Below, the batches inspected
 * or voided in the last 7 days, so one can still be found after it leaves the queue.
 * Figures are per batch for the whole line (D-008).
 */
import { Ban, CircleCheck, Clock, Flag, Hourglass, Search, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { InspectionQueue, QueueItem } from "@/server/services/batch-queue.service";
import { FinishBatchDialog } from "./finish-batch-dialog";
import {
  ClearQueueFilters,
  FloorManagerBatchActions,
  StartInspectionButton,
} from "./queue-actions";

const n = (v: number) => v.toLocaleString("en-PH");

function StateBadges({ item }: { item: QueueItem }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {item.priority === "URGENT" && (
        <Badge tone="danger">
          <Flag aria-hidden />
          Urgent
        </Badge>
      )}
      {item.state === "LATE" && (
        <Badge tone="warning">
          <Clock aria-hidden />
          Late
        </Badge>
      )}
      {item.state === "WAITING" && (
        <Badge tone="info">
          <Hourglass aria-hidden />
          Waiting
        </Badge>
      )}
      {item.state === "INSPECTING" && (
        <Badge tone="brand">
          <UserCheck aria-hidden />
          Being inspected
        </Badge>
      )}
      {item.state === "INSPECTED" && (
        <Badge tone="success">
          <CircleCheck aria-hidden />
          Inspected
        </Badge>
      )}
      {item.state === "VOID" && (
        <Badge tone="neutral">
          <Ban aria-hidden />
          Void
        </Badge>
      )}
    </span>
  );
}

function QueueCard({ item, queue }: { item: QueueItem; queue: InspectionQueue }) {
  const takenByOther = item.state === "INSPECTING" && !item.inspectingByMe;
  return (
    <Card aria-label={item.code} data-testid={`queue-${item.code}`}>
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="font-mono text-xl font-semibold tracking-tight">{item.code}</p>
            <StateBadges item={item} />
          </div>
          <p className="text-muted-foreground tabular-nums">
            {item.dayLabel}, {item.times}
          </p>
          <p className="text-sm">{item.rolls}</p>
          {item.waiting && <p className="text-sm text-muted-foreground">{item.waiting}</p>}
          {item.priority === "URGENT" && item.priorityReason && (
            <p className="text-sm">
              <span className="text-muted-foreground">
                Urgent{item.priorityBy ? ` (${item.priorityBy})` : ""}:{" "}
              </span>
              {item.priorityReason}
            </p>
          )}
          {item.inspectingBy && (
            <p className="text-sm" data-testid="inspecting-by">
              {item.inspectingByMe
                ? `You started inspecting it at ${item.inspectingSince}.`
                : `Being inspected by ${item.inspectingBy} since ${item.inspectingSince}.`}
            </p>
          )}
          {queue.canPrioritise && (
            <FloorManagerBatchActions item={item} urgent={item.priority === "URGENT"} />
          )}
        </div>
        {queue.canInspect && item.canFinish && (
          <div className="flex shrink-0 flex-col gap-2 sm:w-44">
            {item.state !== "INSPECTING" && <StartInspectionButton item={item} />}
            {!takenByOther && (
              <FinishBatchDialog
                mode="finish"
                buttonLabel="Inspect"
                primary
                batch={{
                  code: item.code,
                  batchId: item.id,
                  times: item.times,
                  dayLabel: item.day === queue.today ? undefined : item.dayLabel,
                }}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DoneRow({ item, queue }: { item: QueueItem; queue: InspectionQueue }) {
  const f = item.finished;
  return (
    <li
      className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid={`done-${item.code}`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-medium">{item.code}</span>
          <StateBadges item={item} />
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {item.dayLabel}, {item.times} · {item.rolls}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:items-end">
        <p className="text-sm sm:text-right">
          {f
            ? `${n(f.pairs)} pairs, ${n(f.failedPairs)} failed · ${f.by}, ${f.at}`
            : item.voidReason
              ? `${item.voidReason}${item.voidedBy ? ` (${item.voidedBy})` : ""}`
              : ""}
        </p>
        {f && f.correctable && queue.canInspect && (
          <div className="sm:w-44">
            <FinishBatchDialog
              mode="correct"
              primary
              batch={{
                code: item.code,
                batchId: item.id,
                times: item.times,
                dayLabel: item.day === queue.today ? undefined : item.dayLabel,
              }}
              checkIn={{
                id: f.checkInId,
                updatedAt: f.updatedAt,
                pairs: f.pairs,
                failedPairs: f.failedPairs,
              }}
            />
          </div>
        )}
      </div>
    </li>
  );
}

export function QueueList({ queue }: { queue: InspectionQueue }) {
  const f = queue.filters;
  const filtered = Boolean(f.day || f.status || f.priority || f.q);
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="queue-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="queue-heading" className="text-lg font-semibold">
            Waiting for inspection
          </h2>
          <p className="text-muted-foreground" data-testid="queue-summary">
            {queue.total === 0
              ? "No batches are waiting for inspection."
              : `${queue.total} batch${queue.total === 1 ? "" : "es"} waiting${
                  queue.urgent ? `, ${queue.urgent} urgent` : ""
                }${queue.late ? `, ${queue.late} late` : ""}. Urgent first, then the one that has waited longest.`}
          </p>
          {queue.inspectNote && (
            <p className="text-sm text-muted-foreground" data-testid="queue-inspect-note">
              {queue.inspectNote}
            </p>
          )}
        </div>

        <form
          key={JSON.stringify(f)}
          method="get"
          action="/batches"
          className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] items-end gap-3"
          aria-label="Filter the queue"
        >
          <input type="hidden" name="tab" value="queue" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="queue-q">Batch code</Label>
            <Input id="queue-q" name="q" defaultValue={f.q ?? ""} placeholder="e.g. B-261116-2" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="queue-day">Day</Label>
            <Select id="queue-day" name="day" defaultValue={f.day ?? ""}>
              <option value="">Any day</option>
              {queue.days.map((d) => (
                <option key={d.day} value={d.day}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="queue-status">Status</Label>
            <Select id="queue-status" name="status" defaultValue={f.status ?? ""}>
              <option value="">Any status</option>
              <option value="WAITING">Waiting</option>
              <option value="LATE">Late</option>
              <option value="INSPECTING">Being inspected</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="queue-priority">Priority</Label>
            <Select id="queue-priority" name="priority" defaultValue={f.priority ?? ""}>
              <option value="">Any priority</option>
              <option value="URGENT">Urgent</option>
              <option value="NORMAL">Normal</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" className="max-sm:h-11">
              <Search aria-hidden />
              Filter
            </Button>
            {filtered && <ClearQueueFilters />}
          </div>
        </form>

        {queue.waiting.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-5 py-8 text-center text-muted-foreground"
            data-testid="queue-empty"
          >
            <p>
              {filtered && queue.total > 0
                ? "No waiting batch matches these filters."
                : "No batches are waiting for inspection."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="queue-list">
            {queue.waiting.map((item) => (
              <li key={item.id}>
                <QueueCard item={item} queue={queue} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Inspected and void</CardTitle>
          <CardDescription>Batches from the last 7 days that have left the queue.</CardDescription>
        </CardHeader>
        <CardContent>
          {queue.done.length === 0 ? (
            <p className="text-muted-foreground">Nothing inspected in the last 7 days yet.</p>
          ) : (
            <ul className="divide-y" data-testid="done-list">
              {queue.done.map((item) => (
                <DoneRow key={item.id} item={item} queue={queue} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
