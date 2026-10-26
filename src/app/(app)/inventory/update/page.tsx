/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, at the office desk with the shelf list, any day and on the reminder
 *        days (Wednesday and Friday by default, C-32).
 * What:  type what was added and what was used for each material in one save; fix a miscount
 *        with a Correction and a reason (Phase 29, D-102).
 * Worst: a miscount shows up as consumption, or a change lands on stock that moved meanwhile. So
 *        a Correction is its own column the reports leave out, and a line applies only to the
 *        stock the sheet showed (named STALE otherwise).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { requirePermission } from "@/server/policies/guard";
import { stockSheet } from "@/server/services/stock-update.service";
import { UpdateSheet } from "./update-sheet";

export const metadata: Metadata = { title: "Update stock" };

export default async function UpdateStockPage({ searchParams }: PageProps<"/inventory/update">) {
  await requirePermission("inventory:manage");
  await connection();
  const { q } = await searchParams;
  const sheet = await stockSheet();
  // A new key after each save (the items' stock changes), so the sheet starts clean.
  const version = sheet.items.map((i) => `${i.id}:${i.quantityOnHand}`).join("|");
  return (
    <>
      <div>
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All items
        </Link>
      </div>
      <PageHeader
        title="Update stock"
        description="Type what was added and what was used since the last update. If the shelf doesn't match, enter a Correction with a reason; it isn't counted as use. Items left blank stay as they are."
      />
      <UpdateSheet key={version} sheet={sheet} initialQuery={typeof q === "string" ? q : ""} />
    </>
  );
}
