// Skeleton matching the batch detail layout (header, actions, stage stepper, timeline, cards).
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading batch" className="flex flex-col gap-8">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-3 border-b pb-6">
        <div className="h-9 w-56 animate-pulse rounded-md bg-muted" />
        <div className="h-6 w-80 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-lg bg-muted/60" />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 h-48 animate-pulse rounded-lg bg-muted/60" />
        <div className="h-48 animate-pulse rounded-lg bg-muted/60" />
      </div>
    </div>
  );
}
