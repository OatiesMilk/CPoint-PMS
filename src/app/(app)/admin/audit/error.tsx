"use client";

import { ErrorState } from "@/components/features/states";

export default function AuditError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <ErrorState title="Couldn’t load the audit log." onRetry={() => retry()}>
      Nothing was changed. This is usually a brief connection problem with the database.
    </ErrorState>
  );
}
