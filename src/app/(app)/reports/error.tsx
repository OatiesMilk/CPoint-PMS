"use client";

import { ErrorState } from "@/components/features/states";

export default function ReportsError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState title="Couldn’t load the reports." onRetry={() => retry()}>
      Nothing was changed. This is usually a brief connection problem with the database.
    </ErrorState>
  );
}
