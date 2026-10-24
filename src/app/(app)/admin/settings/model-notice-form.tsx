"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { saveModelNoticeAction } from "./actions";

/**
 * Whether the Camera page says the model is an early one (D-055). The admin turns it off once a
 * model the team trusts is in use; the page shows the model's version either way.
 */
export function ModelNoticeForm({ initial }: { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex max-w-2xl flex-col gap-4 border-t pt-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveModelNoticeAction({ earlyModelNotice: checked });
          if (result.ok) {
            setSaved(checked);
            toast.success(
              checked
                ? "The Camera page now says the model is an early one."
                : "The early-model notice is off.",
            );
          } else setError(result.error);
        });
      }}
    >
      <div>
        <h2 className="font-medium">Early model notice</h2>
        <p className="text-sm text-muted-foreground">
          Tells everyone on the Camera and Capture pages that the model is still being trained, so
          some verdicts may be wrong.
        </p>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="earlyModelNotice"
          className="size-4 accent-(--primary)"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        Show “Early model” on the Camera page
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending || checked === saved}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Save notice
        </Button>
        {checked === saved && (
          <span className="text-sm text-muted-foreground">No changes yet.</span>
        )}
      </div>
    </form>
  );
}
