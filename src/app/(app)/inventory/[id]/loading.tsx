// Skeleton that matches the item page (header with the on-hand number, then the history).
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading item" className="flex flex-col gap-6">
      <div className="h-5 w-24 animate-pulse rounded-md bg-muted" />
      <div className="flex items-start justify-between border-b pb-6">
        <div className="flex flex-col gap-2">
          <div className="h-9 w-72 animate-pulse rounded-md bg-muted" />
          <div className="h-6 w-48 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-16 w-36 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-lg border">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-11 animate-pulse bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
