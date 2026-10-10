"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { remarkSchema } from "@/server/validators/procurement.validator";
import { addRemarkAction } from "../actions";

/** Remarks are only ever added: there's no edit or delete (D-029). */
export function RemarkForm({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        // Same rule and words as the API (remarkSchema), checked before the round trip.
        const parsed = remarkSchema.safeParse({ body });
        if (!parsed.success) {
          e.currentTarget.querySelector("textarea")?.focus();
          return setError(parsed.error.issues[0].message);
        }
        startTransition(async () => {
          const result = await addRemarkAction(id, { body });
          if (!result.ok) return setError(result.fieldErrors?.body ?? result.error);
          setBody("");
          router.refresh();
        });
      }}
    >
      <Label htmlFor="remark">Add a remark</Label>
      <Textarea
        id="remark"
        rows={2}
        value={body}
        placeholder="e.g. Supplier says Thursday"
        aria-invalid={!!error}
        aria-describedby={error ? "remark-error" : "remark-hint"}
        onChange={(e) => setBody(e.target.value)}
      />
      {error ? (
        <p id="remark-error" className="text-sm text-reject">
          {error}
        </p>
      ) : (
        <p id="remark-hint" className="text-sm text-muted-foreground">
          Everyone who can see this request reads it. Remarks can’t be edited later.
        </p>
      )}
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Add remark
        </Button>
      </div>
    </form>
  );
}
