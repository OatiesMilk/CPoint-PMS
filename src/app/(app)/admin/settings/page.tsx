/*
 * Intent brief (ui-craft §1)
 * Who:   the System Admin, rarely, often after a model retrain or a new supplier.
 * What:  adjust what the camera decides (each defect type's outcome, "counts as found at") and
 *        the lists people pick from (shoe types, suppliers).
 * Worst: a new defect class silently rejecting sections (A-12). Unknown classes are listed with
 *        counts and one click to add each as a defect type.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CircleHelp, Info } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManilaDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/policies/guard";
import {
  getThresholds,
  listReferenceRows,
  unknownClasses,
} from "@/server/services/settings.service";
import { ReferenceManager, type Column, type Field, type Row } from "./reference-manager";
import { ModelNoticeForm } from "./model-notice-form";
import { ThresholdsForm } from "./thresholds-form";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "thresholds", label: "Thresholds" },
  { id: "defects", label: "Defect types" },
  { id: "shoes", label: "Shoe types" },
  { id: "suppliers", label: "Suppliers" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** What a found defect of the type means for its section (D-093). */
const OUTCOME_LABEL: Record<string, string> = {
  USABLE: "Usable (Pass)",
  NOT_ACCEPTED: "Not accepted (Reject)",
};

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  await requirePermission("settings:manage");
  await connection();
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : "thresholds";
  const add =
    typeof params.add === "string" && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(params.add)
      ? params.add
      : undefined;

  return (
    <>
      <PageHeader
        title="Settings"
        description="What the camera decides, and the lists people choose from."
      />
      <nav aria-label="Settings sections" className="flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/admin/settings?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "thresholds" && <ThresholdsTab />}
      {tab === "defects" && <DefectsTab add={add} />}
      {tab === "shoes" && <ShoesTab />}
      {tab === "suppliers" && <SuppliersTab />}
    </>
  );
}

async function ThresholdsTab() {
  const t = await getThresholds();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        A section is Pass or Reject. Any defect found that is Not accepted rejects it; Usable
        defects leave it Pass. Each type’s outcome is set under Defect types. Last changed{" "}
        {formatManilaDateTime(t.updatedAt)}.
      </p>
      <ThresholdsForm found={t.foundAtOrAbove} />
      <ModelNoticeForm initial={t.earlyModelNotice} />
    </div>
  );
}

async function DefectsTab({ add }: { add?: string }) {
  const [rows, unknown] = await Promise.all([listReferenceRows("defectType"), unknownClasses()]);
  const columns: Column[] = [
    { key: "label", label: "Label" },
    { key: "key", label: "Class key", mono: true },
    { key: "outcome", label: "When found" },
    { key: "description", label: "Description" },
    { key: "sortOrder", label: "Order", numeric: true },
  ];
  const fields: Field[] = [
    {
      name: "key",
      label: "Class key",
      placeholder: "e.g. scratch",
      hint: "Exactly as the camera model sends it. It can’t be changed later.",
      lockedOnEdit: "The camera sends this key, so it can’t change. Add a new type instead.",
    },
    { name: "label", label: "Label", placeholder: "e.g. Scratch" },
    {
      name: "outcome",
      label: "When found",
      type: "select",
      placeholder: "Choose Usable or Not accepted",
      options: [
        { value: "USABLE", label: OUTCOME_LABEL.USABLE },
        { value: "NOT_ACCEPTED", label: OUTCOME_LABEL.NOT_ACCEPTED },
      ],
      hint: "Usable leaves the section Pass. Not accepted rejects it, and it is reported for salvage.",
    },
    { name: "description", label: "Description", type: "textarea", optional: true },
    {
      name: "sortOrder",
      label: "Order",
      type: "number",
      optional: true,
      hint: "Lower shows first.",
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      {unknown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleHelp aria-hidden className="size-5 text-reject" />
              Unknown classes seen
            </CardTitle>
            <CardDescription>
              The camera sent these, but no defect type matches, so those sections are rejected
              until you set the type up. Add one and choose its outcome; future sections follow it.
              Past sections keep their verdict.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y" data-testid="unknown-classes">
              {unknown.map((u) => (
                <li key={u.rawClassKey} className="flex items-center justify-between gap-3 py-2">
                  <span>
                    <span className="font-mono font-medium">{u.rawClassKey}</span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {u.detections} detection{u.detections === 1 ? "" : "s"} · last{" "}
                      {formatManilaDateTime(u.lastSeen)}
                    </span>
                  </span>
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      href={`/admin/settings?tab=defects&add=${encodeURIComponent(u.rawClassKey)}`}
                    >
                      Add as defect type
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      <ReferenceManager
        key={add ?? "list"}
        kind="defectType"
        noun="defect type"
        columns={columns}
        fields={fields}
        emptyText="No defect types yet. Add the classes your camera model detects."
        initialCreate={
          add
            ? { key: add, label: add[0].toUpperCase() + add.slice(1).replace(/[-_]/g, " ") }
            : undefined
        }
        rows={rows.map((r): Row => ({
          id: r.id,
          isActive: r.isActive,
          values: {
            key: str(r.key),
            label: str(r.label),
            outcome: str(r.outcome),
            description: str(r.description),
            sortOrder: str(r.sortOrder),
          },
          cells: {
            label: str(r.label),
            outcome: OUTCOME_LABEL[str(r.outcome)] ?? str(r.outcome),
            key: str(r.key),
            description: str(r.description),
            sortOrder: str(r.sortOrder),
          },
        }))}
      />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info aria-hidden className="size-4" />
        An inactive defect type is ignored when the camera decides. Its past detections stay. A
        defect counts as found from the value on the Thresholds tab.
      </p>
    </div>
  );
}

async function ShoesTab() {
  const rows = await listReferenceRows("shoeType");
  return (
    <ReferenceManager
      kind="shoeType"
      noun="shoe type"
      columns={[
        { key: "name", label: "Name" },
        { key: "code", label: "Code", mono: true },
        { key: "sortOrder", label: "Order", numeric: true },
      ]}
      fields={[
        { name: "name", label: "Name", placeholder: "e.g. Loafer" },
        { name: "code", label: "Code", placeholder: "e.g. LOA", hint: "2–10 letters or numbers." },
        { name: "sortOrder", label: "Order", type: "number", optional: true },
      ]}
      emptyText="No shoe types yet."
      rows={rows.map((r): Row => ({
        id: r.id,
        isActive: r.isActive,
        values: { name: str(r.name), code: str(r.code), sortOrder: str(r.sortOrder) },
        cells: { name: str(r.name), code: str(r.code), sortOrder: str(r.sortOrder) },
      }))}
    />
  );
}

async function SuppliersTab() {
  const rows = await listReferenceRows("supplier");
  return (
    <ReferenceManager
      kind="supplier"
      noun="supplier"
      columns={[
        { key: "name", label: "Name" },
        { key: "contactPerson", label: "Contact" },
        { key: "phone", label: "Phone" },
        { key: "notes", label: "Notes" },
      ]}
      fields={[
        { name: "name", label: "Name" },
        { name: "contactPerson", label: "Contact person", optional: true },
        { name: "phone", label: "Phone", optional: true, placeholder: "e.g. 0917 123 4567" },
        { name: "notes", label: "Notes", type: "textarea", optional: true },
      ]}
      emptyText="No suppliers yet. Add the leather suppliers you order from."
      rows={rows.map((r): Row => {
        const v = {
          name: str(r.name),
          contactPerson: str(r.contactPerson),
          phone: str(r.phone),
          notes: str(r.notes),
        };
        return { id: r.id, isActive: r.isActive, values: v, cells: v };
      })}
    />
  );
}
