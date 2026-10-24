"use client";

import { useState } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROLL_MESSAGES, ROLL_TAG_MAX } from "@/lib/roll-rules";
import type { OpenRollView } from "./roll-bar";

type ApiError = { error?: { message?: string; details?: { path?: string[]; message?: string }[] } };

/**
 * Start a roll (Phase 26): the supplier it came from (required, C-36 needs it for a return) and the
 * number on the supplier's tag (optional). Messages name the field and the fix (D-038).
 */
export function StartRollForm({
  suppliers,
  onStarted,
  onCancel,
}: {
  suppliers: { id: string; name: string }[];
  onStarted: (roll: OpenRollView) => void;
  /** Shown when another roll is already open, to go back without starting one. */
  onCancel?: () => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [tagCode, setTagCode] = useState("");
  const [errors, setErrors] = useState<{ supplierId?: string; tagCode?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const next: typeof errors = {};
    if (!supplierId) next.supplierId = ROLL_MESSAGES.chooseSupplier;
    if (tagCode.trim().length > ROLL_TAG_MAX) next.tagCode = ROLL_MESSAGES.tagTooLong;
    setErrors(next);
    setFormError(null);
    if (next.supplierId) return document.getElementById("start-supplier")?.focus();
    if (next.tagCode) return document.getElementById("start-tag")?.focus();
    setBusy(true);
    try {
      const res = await fetch("/api/v1/rolls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId, tagCode }),
      });
      const body = (await res.json().catch(() => ({}))) as ApiError & { data?: OpenRollView };
      if (res.ok && body.data) return onStarted(body.data);
      const fields: typeof errors = {};
      for (const issue of body.error?.details ?? []) {
        const field = issue.path?.[0];
        if ((field === "supplierId" || field === "tagCode") && issue.message)
          fields[field] = issue.message;
      }
      if (Object.keys(fields).length > 0) setErrors(fields);
      else setFormError(body.error?.message ?? "The roll couldn’t be started. Try again.");
    } catch {
      setFormError("The roll couldn’t be started: the server didn’t answer. Check the Wi-Fi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {suppliers.length === 0 ? (
        <Alert tone="info">
          No supplier is set up yet. Ask the System Admin to add one in Settings → Suppliers.
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start-supplier">Supplier</Label>
        <Select
          id="start-supplier"
          value={supplierId}
          aria-invalid={!!errors.supplierId}
          aria-describedby={errors.supplierId ? "start-supplier-error" : undefined}
          onChange={(e) => {
            setSupplierId(e.target.value);
            if (e.target.value) setErrors((x) => ({ ...x, supplierId: undefined }));
          }}
          className="h-11"
        >
          <option value="">Choose the supplier</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <FieldError id="start-supplier-error" message={errors.supplierId} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="start-tag">
          Roll code <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="start-tag"
          value={tagCode}
          autoComplete="off"
          aria-invalid={!!errors.tagCode}
          aria-describedby={errors.tagCode ? "start-tag-error" : "start-tag-hint"}
          onChange={(e) => setTagCode(e.target.value)}
          className="h-11"
        />
        {errors.tagCode ? (
          <FieldError id="start-tag-error" message={errors.tagCode} />
        ) : (
          <p id="start-tag-hint" className="text-sm text-muted-foreground">
            The number on the supplier’s tag.
          </p>
        )}
      </div>
      {formError && <Alert tone="danger">{formError}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={busy || suppliers.length === 0}>
          {busy ? <LoaderCircle aria-hidden className="animate-spin" /> : <Play aria-hidden />}
          Start roll
        </Button>
        {onCancel && (
          <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
            Back to capturing
          </Button>
        )}
      </div>
    </form>
  );
}
