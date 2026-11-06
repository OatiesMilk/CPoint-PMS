import { SkeletonHeader, SkeletonTable, SkeletonTiles } from "@/components/features/states";
import { Skeleton } from "@/components/ui/skeleton";

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
      <SkeletonHeader />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-10 w-80" />
      <SkeletonTiles count={6} />
      <SkeletonTable rows={6} />
    </div>
  );
}
