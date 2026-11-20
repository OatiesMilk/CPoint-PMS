"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StageCountForm } from "@/components/features/production/stage-count-form";
import type { Stage } from "@/lib/repair-rules";

/** The Floor Manager's "Update count" for any stage on the board (A-72, A-91). */
export function StageCountButton({
  stage,
  label,
  current,
}: {
  stage: Stage;
  label: string;
  current: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        Update count
        <span className="sr-only"> for {label}</span>
      </Button>
    );
  return (
    <StageCountForm
      stage={stage}
      label={label}
      initial={current}
      onSaved={() => {
        setOpen(false);
        router.refresh();
      }}
    />
  );
}
