/*
 * Intent brief (ui-craft §1)
 * Who:   a Shoe Constructor, at the office PC, when nails, thread or leather run low. Leather
 *        rolls only for those the Floor Manager allows (D-031).
 * What:  ask for one or more materials, with how much, why and how soon, in under a minute.
 * Worst: a request the Floor Manager can't act on (vague item, no reason). Items come from the
 *        inventory list with their stock shown; a reason is required.
 */
import type { Metadata } from "next";
import { PageHeader } from "@/components/features/page-header";
import { requirePermission } from "@/server/policies/guard";
import { canRequestLeatherRollsFor } from "@/server/policies/permissions";
import { requestableItems } from "@/server/services/procurement.service";
import { RequestForm } from "../request-form";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage({ searchParams }: PageProps<"/procurement/new">) {
  const user = await requirePermission("procurement:request");
  const { item } = await searchParams;
  return (
    <>
      <PageHeader
        title="New purchase request"
        description="The Floor Manager sees it right away and approves or rejects it."
      />
      <RequestForm
        items={await requestableItems(user)}
        canRequestLeatherRolls={canRequestLeatherRollsFor(user)}
        prefillItemId={typeof item === "string" ? item : undefined}
      />
    </>
  );
}
