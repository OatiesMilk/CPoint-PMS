/*
 * Intent brief (ui-craft §1)
 * Who:   the System Admin, rarely, often after a model retrain or a new supplier.
 * What:  adjust what the camera decides (thresholds, defect classes) and the lists people pick
 *        from (shoe types, suppliers).
 * Worst: a threshold change misread, or a new defect class silently piling up in review. The
 *        threshold form spells out the resulting bands; unknown classes are listed with counts.
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

const ACTION_LABEL: Record<string, string> = {
  "": "By confidence",
  REWORK: "Fixable when found",
  REJECT: "Reject when found",
};

/** How a Fixable section of the type is made usable (D-070). Cut around is the default. */
const HANDLING_LABEL: Record<string, string> = {
  CUT_AROUND: "Cut around the marked area",
  CLEAN: "Clean before cutting",
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
        Each defect the camera finds gives a result, and the worst one decides the section. A defect
        type set to Fixable or Reject when found always gives that; the others go by the model’s
        confidence. Last changed {formatManilaDateTime(t.updatedAt)}.
      </p>
      <ThresholdsForm
        reject={t.rejectAtOrAbove}
        rework={t.reworkAtOrAbove}
        found={t.foundAtOrAbove}
      />
      <ModelNoticeForm initial={t.earlyModelNotice} />
    </div>
  );
}

async function DefectsTab({ add }: { add?: string }) {
  const [rows, unknown] = await Promise.all([listReferenceRows("defectType"), unknownClasses()]);
  const columns: Column[] = [
    { key: "label", label: "Label" },
    { key: "key", label: "Class key", mono: true },
    { key: "action", label: "When found" },
    { key: "handling", label: "When Fixable" },
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
      name: "action",
      label: "When found",
      type: "select",
      optional: true,
      placeholder: ACTION_LABEL[""],
      options: [
        { value: "REWORK", label: ACTION_LABEL.REWORK },
        { value: "REJECT", label: ACTION_LABEL.REJECT },
      ],
      hint: "The model’s confidence says how sure it is a defect is there, not how bad it is. Choose Fixable or Reject to decide by the type instead.",
    },
    {
      name: "handling",
      label: "When Fixable",
      type: "select",
      placeholder: HANDLING_LABEL.CUT_AROUND,
      options: [{ value: "CLEAN", label: HANDLING_LABEL.CLEAN }],
      hint: "What the person at the board does with a Fixable section of this type before cutting.",
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
              <CircleHelp aria-hidden className="size-5 text-review" />
              Unknown classes seen
            </CardTitle>
            <CardDescription>
              The camera sent these, but no defect type matches, so their scans went to the review
              queue. Add one to have future scans decided automatically. Past scans stay in the
              queue.
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
            action: str(r.action),
            // Cut around is the select's blank option, so only Clean is stored as a value here.
            handling: r.handling === "CLEAN" ? "CLEAN" : "",
            description: str(r.description),
            sortOrder: str(r.sortOrder),
          },
          cells: {
            label: str(r.label),
            action: ACTION_LABEL[str(r.action)] ?? str(r.action),
            handling: HANDLING_LABEL[str(r.handling)] ?? HANDLING_LABEL.CUT_AROUND,
            key: str(r.key),
            description: str(r.description),
            sortOrder: str(r.sortOrder),
          },
        }))}
      />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info aria-hidden className="size-4" />
        An inactive defect type is ignored when the camera decides. Its past detections stay.
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
