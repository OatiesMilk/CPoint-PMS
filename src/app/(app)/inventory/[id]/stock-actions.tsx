"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ClipboardPen, LoaderCircle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { setItemActiveAction } from "../actions";

type Props = {
  item: { id: string; sku: string; name: string; isActive: boolean };
};

/**
 * The item's actions. Stock changes only on the Update stock sheet since Phase 29 (D-102): what
 * was added, used or corrected. Receive stock, Use stock, the one-item count and Undo are gone.
 */
export function StockActions({ item }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleActive() {
    startTransition(async () => {
      const next = !item.isActive;
      const result = await setItemActiveAction(item.id, next);
      if (!result.ok) return setError(result.error);
      toast.success(next ? `${item.name} is active again.` : `${item.name} deactivated.`, {
        duration: 6000,
        action: {
          label: "Undo",
          onClick: () =>
            startTransition(async () => void (await setItemActiveAction(item.id, !next))),
        },
      });
    });
  }

  const spinner = pending ? <LoaderCircle aria-hidden className="animate-spin" /> : null;

  if (!item.isActive) {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="info">
          This item is deactivated. It’s left off the Update stock sheet, and its history is kept.
        </Alert>
        <div>
          <Button variant="secondary" disabled={pending} onClick={toggleActive}>
            {spinner}
            Reactivate
          </Button>
        </div>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href={`/inventory/update?q=${encodeURIComponent(item.sku)}`}>
            <ClipboardPen aria-hidden />
            Update stock
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/inventory/${item.id}/edit`}>
            <Pencil aria-hidden />
            Edit
          </Link>
        </Button>
        <Button variant="ghost" className="ml-auto" disabled={pending} onClick={toggleActive}>
          {spinner}
          Deactivate
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}
