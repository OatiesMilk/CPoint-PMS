/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, or a constructor with camera access, standing in the store with a
 *        phone (Phase 32, D-128; a phone page like Capture, A-71).
 * What:  "where is LR-MLT-004?" or "what is on R1-B3?": type the code or scan the label, and see
 *        where the roll is and where it has been.
 * Worst: sent to the wrong rack. The answer is the largest text, says when the roll left storage,
 *        and the history shows every move with its time.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/features/page-header";
import { requireFindRoll } from "@/server/policies/guard";
import { can } from "@/server/policies/permissions";
import { listLocations } from "@/server/services/location.service";
import { FindRollClient } from "./find-roll-client";

export const metadata: Metadata = { title: "Find roll" };

export default async function FindRollPage({ searchParams }: PageProps<"/find">) {
  const user = await requireFindRoll();
  await connection();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 64) : "";
  const canMove = can(user.role, "roll:move");
  const locations = canMove
    ? (await listLocations({ activeOnly: true })).map(({ id, code, name }) => ({ id, code, name }))
    : [];

  return (
    <>
      <PageHeader
        title="Find roll"
        description="Type a roll’s code or tag number, or scan the QR code on a roll or a rack."
      />
      <FindRollClient
        initialQuery={q}
        canMove={canMove}
        canMarkPickedUp={can(user.role, "roll:manage")}
        locations={locations}
      />
    </>
  );
}
