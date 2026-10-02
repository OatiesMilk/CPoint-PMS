/*
 * Intent brief (ui-craft §1)
 * Who:   factory office staff at a desk, at the start of a shift; some sign in rarely.
 * What:  get into the right role's workspace.
 * Worst: being locked out with no idea why. Every refusal says what happened and what to do.
 */
import type { Metadata } from "next";
import Image from "next/image";
import { Alert } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/theme-toggle";
import logo from "../../../../public/images/cpoint-logo.jpg";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const REASONS: Record<string, { tone: "info" | "success"; text: string }> = {
  "signed-out": { tone: "success", text: "You signed out." },
  deactivated: {
    tone: "info",
    text: "Your account was deactivated, so you were signed out. Ask a System Admin if this is a mistake.",
  },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" ? params.callbackUrl : undefined;
  const reason = typeof params.reason === "string" ? REASONS[params.reason] : undefined;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-10">
      <div className="absolute top-6 right-6">
        <ThemeToggle />
      </div>

      <main className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src={logo}
            alt="CPoint Shoe Store"
            className="size-14 rounded-lg shadow-1"
            priority
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sign in to CPoint</h1>
            <p className="mt-1 text-muted-foreground">Product Monitoring System</p>
          </div>
        </div>

        <div className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-1">
          {reason && <Alert tone={reason.tone}>{reason.text}</Alert>}
          <LoginForm callbackUrl={callbackUrl} showContinueNotice={!reason && !!callbackUrl} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Forgot your password? Ask a System Admin to reset it.
        </p>
      </main>
    </div>
  );
}
