/*
 * Intent brief (ui-craft §1)
 * Who:   any user: a new account or one an admin reset (forced), or someone changing it (voluntary).
 * What:  choose their own password in under a minute and get back to work.
 * Worst: a temporary password stays in use, or someone is stuck here with no idea why. Forced
 *        mode says why and offers Sign out as the only other way out.
 */
import type { Metadata } from "next";
import { DemoBand } from "@/components/features/demo-band";
import { demoToolsEnabled } from "@/server/services/demo-tools.service";
import { demoClockView } from "@/server/services/demo-clock.service";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ROLE_HOME } from "@/lib/domain";
import { requireUser } from "@/server/policies/guard";
import logo from "../../../../../public/images/cpoint-logo.jpg";
import { signOutAction } from "../../../(app)/actions";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser({ allowPasswordChange: true });
  const forced = user.mustChangePassword;

  return (
    <>
      <DemoBand clock={demoToolsEnabled() ? await demoClockView() : null} />
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
              <h1 className="text-2xl font-semibold tracking-tight">
                {forced ? "Choose your password" : "Change password"}
              </h1>
              <p className="mt-1 text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-1">
            {forced && (
              <Alert tone="info">
                You signed in with a temporary password from a System Admin. Choose your own to
                continue.
              </Alert>
            )}
            <PasswordForm forced={forced} />
          </div>

          <div className="flex items-center justify-between text-sm">
            {forced ? (
              <span className="text-muted-foreground">Other devices will be signed out.</span>
            ) : (
              <Link
                href={ROLE_HOME[user.role]}
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft aria-hidden className="size-4" />
                Back
              </Link>
            )}
            <form action={signOutAction}>
              <Button type="submit" variant="link" className="h-auto p-0">
                Sign out
              </Button>
            </form>
          </div>
        </main>
      </div>
    </>
  );
}
