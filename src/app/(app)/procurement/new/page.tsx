/*
 * Intent brief (ui-craft §1)
 * Who:   a Shoe Constructor, at the office PC, when nails, thread or leather run low (leather
 *        rolls only for those the Floor Manager allows, D-031); or the Floor Manager raising a
 *        restock request themselves, often from a low item in Inventory (D-045).
 * What:  ask for one or more materials, with how much and by when, in under a minute. A rejected
 *        or cancelled request can be copied here instead of typed again (D-044).
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
import { getCopySource, requestableItems } from "@/server/services/procurement.service";
import { isRequestId } from "@/server/validators/procurement.validator";
import { RequestForm } from "../request-form";

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  return { title: user ? requestLabelsFor(user.role).create : "New request" };
}

export default async function NewRequestPage({ searchParams }: PageProps<"/procurement/new">) {
  const user = await requirePermission("procurement:request");
  const { item, copy } = await searchParams;
  const byFloorManager = user.role === "FLOOR_MANAGER";
  // Only your own rejected or cancelled request can be copied; anything else opens a blank form.
  const source =
    typeof copy === "string" && isRequestId(copy) ? await getCopySource(copy, user) : null;
  return (
    <>
      <PageHeader
        title={requestLabelsFor(user.role).create}
        description={
          byFloorManager
            ? "Raise a restock request yourself. You approve or reject its items on the next page, like any other request."
            : "The Floor Manager sees it right away and approves or rejects it."
        }
      />
      <RequestForm
        items={await requestableItems(user)}
        canRequestLeatherRolls={canRequestLeatherRollsFor(user)}
        prefillItemId={typeof item === "string" ? item : undefined}
        today={manilaToday()}
        copy={source ?? undefined}
        byFloorManager={byFloorManager}
      />
    </>
  );
}
