// Skeleton that matches the report layout (tabs, range, key figures, a list), so nothing jumps
// when data arrives (ui-craft §3).
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading reports"
      className="flex flex-col gap-8"
    >
      <div className="flex flex-col gap-2 border-b pb-5">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-6 w-96 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-80 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg border bg-muted/60" />
        ))}
      </div>
      <div className="flex flex-col gap-px overflow-hidden rounded-lg border">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-11 animate-pulse bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
