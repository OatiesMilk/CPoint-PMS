/*
 * Intent brief (ui-craft §1)
 * Who:   a Shoe Constructor, between jobs on the line.
 * What:  open Capture when they run the camera (D-075); without camera access, know who grants it.
 *        Phase 26 moves capture to the constructors' own phones and replaces this page.
 * Worst: showing personal performance numbers. Never (client request, D-008).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Aperture } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/server/policies/guard";
import { canCaptureFor } from "@/server/policies/permissions";

export const metadata: Metadata = { title: "Home" };

export default async function ConstructorHome() {
  const user = await requireRole("SHOE_CONSTRUCTOR");
  await connection();
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Good day, ${firstName}`} />
      {canCaptureFor(user) ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Capture sections</CardTitle>
                <CardDescription>
                  You run the camera at Preparation. Open Capture, switch to Floor view, then place
                  each leather piece and press Space.
                </CardDescription>
              </div>
              <Button asChild variant="secondary">
                <Link href="/camera/capture">
                  <Aperture aria-hidden />
                  Open Capture
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <h2 className="text-xl font-semibold">No camera access yet</h2>
          <p className="max-w-md text-muted-foreground">
            Your work in the system is at the camera. Ask the System Admin for camera access.
          </p>
        </div>
      )}
    </>
  );
}
