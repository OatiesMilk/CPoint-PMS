"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { setActiveBatchAction } from "./actions";

type Option = { id: string; code: string; rollCode: string; shoeType: string };

export function ActiveBatchForm({
  options,
  selectedId,
}: {
  options: Option[];
  selectedId: string | null;
}) {
  const [value, setValue] = useState(selectedId ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const changed = value !== (selectedId ?? "");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await setActiveBatchAction(value || null);
          if (result.ok)
            toast.success(
              value
                ? "The camera now feeds the chosen batch."
                : "The camera follows the oldest batch again.",
            );
          else setError(result.error);
        });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="active-batch">Batch the camera feeds</Label>
        <Select id="active-batch" value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Automatic: longest at Preparation</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} · {o.shoeType} · roll {o.rollCode}
            </option>
          ))}
        </Select>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      <div>
        <Button type="submit" variant="secondary" disabled={!changed || pending}>
          {pending && <LoaderCircle aria-hidden className="animate-spin" />}
          Use this batch
        </Button>
      </div>
    </form>
  );
}
