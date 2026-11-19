/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, setting up where leather rolls are kept (Phase 32, D-128).
 * What:  list the racks, bins and areas, add or rename one, print their labels.
 * Worst: a label's code no longer matches the system, so a roll can't be found. A code is fixed
 *        once rolls have been kept there (A-79), and a location with rolls can't be deactivated.
 * CPoint hasn't confirmed its rack layout (A-53): the codes are theirs to choose.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/features/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/server/policies/guard";
import { listLocationsForManager } from "@/server/services/location.service";
import { LocationsManager } from "./locations-manager";

export const metadata: Metadata = { title: "Storage locations" };

export default async function StorageLocationsPage() {
  await requirePermission("location:manage");
  await connection();
  const locations = await listLocationsForManager();
  const active = locations.filter((l) => l.isActive).length;

  return (
    <>
      <PageHeader
        back={{ href: "/inventory", label: "Inventory" }}
        title="Storage locations"
        description="The racks, bins and areas where leather rolls are kept. Each has a label with its code and a QR code to scan at Find roll."
      />
      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
          <CardDescription>
            {locations.length === 0
              ? "None yet."
              : `${active} active${locations.length > active ? `, ${locations.length - active} deactivated` : ""}. A location with rolls in it can’t be deactivated: move the rolls first.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <LocationsManager locations={locations} />
        </CardContent>
      </Card>
    </>
  );
}
