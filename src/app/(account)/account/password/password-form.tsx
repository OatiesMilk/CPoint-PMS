"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PASSWORD_MIN,
  passwordChangeSchema,
  type PasswordChangeInput,
} from "@/server/validators/auth.validator";
import { changePasswordAction } from "./actions";

const FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;

export function PasswordForm({ forced }: { forced: boolean }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<PasswordChangeInput>({
    resolver: zodResolver(passwordChangeSchema),
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await changePasswordAction(values);
      // Success redirects to the user's home; reaching here means it didn't.
      if (result.ok) return;
      let field = false;
      for (const key of FIELDS) {
        const message = result.fieldErrors?.[key];
        if (message) {
          form.setError(key, { message }, { shouldFocus: !field });
          field = true;
        }
      }
      if (!field) setFormError(result.error);
    });
  });

  const fields: { name: (typeof FIELDS)[number]; label: string; hint?: string; auto: string }[] = [
    {
      name: "currentPassword",
      label: forced ? "Temporary password" : "Current password",
      auto: "current-password",
    },
    {
      name: "newPassword",
      label: "New password",
      hint: `At least ${PASSWORD_MIN} characters. A short phrase is easy to remember and hard to guess.`,
      auto: "new-password",
    },
    { name: "confirmPassword", label: "Type it again", auto: "new-password" },
  ];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError && <Alert tone="danger">{formError}</Alert>}
      {fields.map((f) => {
        const error = errors[f.name]?.message;
        return (
          <div key={f.name} className="flex flex-col gap-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <Input
              id={f.name}
              type="password"
              autoComplete={f.auto}
              aria-invalid={!!error}
              aria-describedby={error ? `${f.name}-error` : f.hint ? `${f.name}-hint` : undefined}
              {...form.register(f.name)}
            />
            {error ? (
              <p id={`${f.name}-error`} className="text-sm text-reject">
                {error}
              </p>
            ) : (
              f.hint && (
                <p id={`${f.name}-hint`} className="text-sm text-muted-foreground">
                  {f.hint}
                </p>
              )
            )}
          </div>
        );
      })}
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <LoaderCircle aria-hidden className="animate-spin" />}
        {pending ? "Saving…" : "Save new password"}
      </Button>
    </form>
  );
}
