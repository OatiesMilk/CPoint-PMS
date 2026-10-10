"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function ProcurementError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex max-w-xl flex-col gap-4 py-10">
      <Alert tone="danger">
        <strong className="font-semibold">Couldn’t load the requests.</strong>
        <span>
          Nothing was changed. This is usually a brief connection problem with the database. Try
          again; if it keeps happening, tell the System Admin.
        </span>
      </Alert>
      <div>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </div>
  );
}
