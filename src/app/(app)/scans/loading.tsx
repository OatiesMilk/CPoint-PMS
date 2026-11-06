import { SkeletonHeader, SkeletonTable } from "@/components/features/states";
import { Skeleton } from "@/components/ui/skeleton";

// Skeleton that matches the list layout, so nothing jumps when data arrives (ui-craft §3).
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading scans" className="flex flex-col gap-8">
      <SkeletonHeader />
      <Skeleton className="h-14 w-full max-w-3xl" />
      <SkeletonTable />
    </div>
  );
}
