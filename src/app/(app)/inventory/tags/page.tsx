/*
 * Intent brief (ui-craft §1)
 * Who:   the Floor Manager, keeping the tags that start every roll code (Phase 42, D-139).
 * What:  list the tags, add or edit one, deactivate or remove one.
 * Worst: a tag's code is on printed labels, so it can't change once a roll was made from it, and
 *        only a tag no roll ever used can be removed. CPoint hasn't confirmed its real tag codes
 *        (A-119): BLC is a placeholder.
 */
import type { Metadata } from "next";
import { connection } from "next/server";
import { PageHeader } from "@/components/features/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/server/policies/guard";
import { listRollTagsForManager } from "@/server/services/roll-tag.service";
import { supplierOptions } from "@/server/services/roll.service";
import { RollTagsManager } from "./tags-manager";

export const metadata: Metadata = { title: "Roll tags" };

export default async function RollTagsPage() {
  await requirePermission("inventory:manage");
  await connection();
  const [tags, suppliers] = await Promise.all([listRollTagsForManager(), supplierOptions()]);
  const active = tags.filter((t) => t.isActive).length;

  return (
    <>
      <PageHeader
        back={{ href: "/inventory", label: "Inventory" }}
        title="Roll tags"
        description="The tags that start every roll code, like LR-BLC-001. Add rolls offers them: a supplier’s default tag is chosen first, and you type the digits after it."
      />
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>
            {tags.length === 0
              ? "None yet."
              : `${active} active${tags.length > active ? `, ${tags.length - active} deactivated` : ""}. A tag's code is on printed labels, so it stays once a roll was made from it. Deactivate it instead of removing it.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RollTagsManager
            tags={tags}
            suppliers={suppliers.map(({ id, name }) => ({ id, name }))}
          />
        </CardContent>
      </Card>
    </>
  );
}
