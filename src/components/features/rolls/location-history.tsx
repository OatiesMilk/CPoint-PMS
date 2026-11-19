import { formatManilaDateTime } from "@/lib/format";

export type HistoryEntry = {
  id: string;
  at: string;
  label: string;
  from: string | null;
  to: string | null;
  note: string | null;
};

/**
 * A roll's location history (Phase 32, D-128), newest first: when, what happened and from where
 * to where. No names (D-008, A-78); the System Admin's audit log keeps who did it.
 */
export function LocationHistory({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No moves yet. Moves show here once the roll is placed in a storage location.
      </p>
    );
  return (
    <ol className="flex flex-col divide-y" aria-label="Location history">
      {entries.map((e) => (
        <li key={e.id} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-medium">{e.label}</span>
            <time dateTime={e.at} className="text-sm text-muted-foreground">
              {formatManilaDateTime(e.at)}
            </time>
          </p>
          <p className="text-sm">
            {e.from && e.to ? (
              <>
                {e.from} → {e.to}
              </>
            ) : e.to ? (
              <>To {e.to}</>
            ) : e.from ? (
              <>From {e.from}</>
            ) : null}
          </p>
          {e.note && <p className="text-sm text-muted-foreground">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}
