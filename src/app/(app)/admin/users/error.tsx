"use client";

import { ErrorState } from "@/components/features/states";

export default function UsersError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState title="Couldn’t load accounts." onRetry={() => retry()}>
      Nothing was changed. This is usually a brief connection problem with the database.
    </ErrorState>
  );
}
