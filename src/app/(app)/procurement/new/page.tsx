/*
 * Intent brief (ui-craft §1)
 * Who:   a Shoe Constructor, at the office PC, when nails, thread or leather run low. Leather
 *        rolls only for those the Floor Manager allows (D-031).
 * What:  ask for one or more materials, with how much and by when, in under a minute.
 * Worst: a request the Floor Manager can't act on (vague item, no date). Items come from the
 *        inventory list with their stock shown; the needed-by date is required and sets the
 *        urgency (D-037); anything else goes in an optional remark (D-036).
 */
import type { Metadata } from "next";
import { PageHeader } from "@/components/features/page-header";
import { manilaToday } from "@/lib/format";
import { requestLabelsFor } from "@/lib/procurement-rules";
import { getCurrentUser, requirePermission } from "@/server/policies/guard";
import { canRequestLeatherRollsFor } from "@/server/policies/permissions";
import { requestableItems } from "@/server/services/procurement.service";
import { RequestForm } from "../request-form";

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  return { title: user ? requestLabelsFor(user.role).create : "New request" };
}

export default async function NewRequestPage({ searchParams }: PageProps<"/procurement/new">) {
  const user = await requirePermission("procurement:request");
  const { item } = await searchParams;
  return (
    <>
      <PageHeader
        title={requestLabelsFor(user.role).create}
        description="The Floor Manager sees it right away and approves or rejects it."
      />
      <RequestForm
        items={await requestableItems(user)}
        canRequestLeatherRolls={canRequestLeatherRollsFor(user)}
        prefillItemId={typeof item === "string" ? item : undefined}
        today={manilaToday()}
      />
    </>
  );
}
