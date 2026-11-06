"use client";

import { ErrorState } from "@/components/features/states";

export default function ScansError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState title="Couldn’t load scans." onRetry={() => retry()}>
      Nothing was changed. This is usually a brief connection problem with the database.
    </ErrorState>
  );
}
