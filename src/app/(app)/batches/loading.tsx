// Skeleton that matches the list layout, so nothing jumps when data arrives (ui-craft §3).
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading batches" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 border-b pb-5">
        <div className="h-9 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-6 w-96 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-14 w-full max-w-3xl animate-pulse rounded-md bg-muted" />
      <div className="flex flex-col gap-px overflow-hidden rounded-lg border">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-11 animate-pulse bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
