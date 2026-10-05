/*
 * Intent brief (ui-craft §1)
 * Who:   a designated Shoe Constructor, at the office PC, when nails, thread or leather run low.
 * What:  ask for one or more materials, with how much, why and how soon, in under a minute.
 * Worst: a request the Floor Manager can't act on (vague item, no reason). Items come from the
 *        inventory list with their stock shown; a reason is required.
 */
import type { Metadata } from "next";
import { PageHeader } from "@/components/features/page-header";
import { requirePurchaseRequester } from "@/server/policies/guard";
import { requestableItems } from "@/server/services/procurement.service";
import { RequestForm } from "../request-form";

export const metadata: Metadata = { title: "New request" };

export default async function NewRequestPage({ searchParams }: PageProps<"/procurement/new">) {
  await requirePurchaseRequester();
  const { item } = await searchParams;
  return (
    <>
      <PageHeader
        title="New purchase request"
        description="The Floor Manager sees it right away and approves or rejects it."
      />
      <RequestForm
        items={await requestableItems()}
        prefillItemId={typeof item === "string" ? item : undefined}
      />
    </>
  );
}
