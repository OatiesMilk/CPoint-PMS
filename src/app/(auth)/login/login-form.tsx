"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/server/validators/auth.validator";
import { loginAction } from "./actions";

const noSubscribe = () => () => {};

/**
 * Clicking a demo button (D-101) moves focus out of the form. Validating on that blur would show
 * "Enter your email." and push the demo buttons down mid-click, so the click was lost (QA Phase 28
 * F3, F4). Blurs towards the demo tools don't validate.
 */
function toDemoTools(event: React.FocusEvent): boolean {
  const next = event.relatedTarget;
  return next instanceof Element && next.closest("[data-demo-tools]") !== null;
}

export function LoginForm({
  callbackUrl,
  showContinueNotice = false,
  autoFocusEmail = true,
}: {
  callbackUrl?: string;
  showContinueNotice?: boolean;
  /** Off while the demo tools are on, so a demo click never starts with a field to validate. */
  autoFocusEmail?: boolean;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Until React takes over, a submit would be a native browser submit. Keep the button disabled
  // so credentials never go anywhere without the action (and never in a URL: method="post").
  const ready = useSyncExternalStore(
    noSubscribe,
    () => true, // in the browser, once hydrated
    () => false, // in the server render
  );

  // Validate on blur, then live once a field has errored (DESIGN.md → Patterns).
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;
  const field = (name: keyof LoginInput) => {
    const registered = form.register(name);
    return {
      ...registered,
      onBlur: (event: React.FocusEvent<HTMLInputElement>) =>
        toDemoTools(event) ? Promise.resolve() : registered.onBlur(event),
    };
  };

  const onSubmit = form.handleSubmit((values) => {
    setServerError(null);
    startTransition(async () => {
      const result = await loginAction({ ...values, callbackUrl });
      // Reaching here means sign-in failed (success redirects). Keep the email, clear the password.
      setServerError(result.error);
      form.resetField("password");
      form.setFocus("password");
    });
  });

  return (
    <form method="post" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError ? (
        <Alert tone="danger">{serverError}</Alert>
      ) : (
        showContinueNotice && <Alert tone="info">Sign in to continue.</Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoFocus={autoFocusEmail}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...field("email")}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-reject">
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : undefined}
          {...field("password")}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-reject">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={pending || !ready} className="mt-1">
        {pending && <LoaderCircle aria-hidden className="animate-spin" />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
