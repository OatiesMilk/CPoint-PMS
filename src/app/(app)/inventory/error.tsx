"use client";

import { ErrorState } from "@/components/features/states";

export default function InventoryError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState title="Couldn’t load inventory." onRetry={() => retry()}>
      Nothing was changed. This is usually a brief connection problem with the database.
    </ErrorState>
  );
}
