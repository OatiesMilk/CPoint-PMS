"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

type Result =
  { ok: true } | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string> };

/**
 * Picked up by supplier (Phase 32, A-77): the supplier took a roll marked Returned to supplier.
 * It can't be undone, so the dialog names the roll and what happens.
 */
export function PickedUpButton({ code, action }: { code: string; action: () => Promise<Result> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      toast.success(`${code} marked picked up by the supplier.`);
      router.refresh();
    });

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <PackageCheck aria-hidden />
        Picked up by supplier
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Did the supplier pick up {code}?</DialogTitle>
          <DialogDescription>
            It leaves storage for good and its place is freed. This can’t be undone.
          </DialogDescription>
          {error && <Alert tone="danger">{error}</Alert>}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Not yet</Button>
            </DialogClose>
            <Button disabled={pending} onClick={confirm}>
              {pending && <LoaderCircle aria-hidden className="animate-spin" />}
              Mark picked up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
