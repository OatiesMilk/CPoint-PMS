"use client";

import { useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** A secret shown exactly once (device token, temporary password), with Copy. */
export function ShownOnceSecret({
  value,
  label,
  warning,
}: {
  value: string;
  label: string;
  warning: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="info">
        <span className="flex items-center gap-1.5 font-semibold">
          <TriangleAlert aria-hidden className="size-4" /> You won’t see it again.
        </span>
        <span>{warning}</span>
      </Alert>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          aria-label={label}
          className="font-mono text-base tracking-wide"
          onFocus={(e) => e.target.select()}
        />
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            } catch {
              toast.error("Couldn’t copy automatically. Select it and copy it by hand.");
            }
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
