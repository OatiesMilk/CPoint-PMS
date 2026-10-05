// Skeleton that matches the detail layout (ui-craft §3).
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading purchase request"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2 border-b pb-5">
        <div className="h-5 w-28 animate-pulse rounded-md bg-muted" />
        <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-6 w-96 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_22rem] gap-6">
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
