import { SkeletonTable } from "@/components/features/states";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton that matches the item page (header with the on-hand number, then the history).
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading item" className="flex flex-col gap-6">
      <Skeleton className="h-5 w-24" />
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-16 w-36" />
      </div>
      <SkeletonTable rows={6} />
    </div>
  );
}
