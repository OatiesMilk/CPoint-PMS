/*
 * Intent brief (ui-craft §1)
 * Who:   the System Admin, rarely, often after a model retrain or a new supplier.
 * What:  adjust what the camera decides (each defect type's outcome, "counts as found at") and
 *        the lists people pick from (suppliers), and the lunch break that pauses a batch (C-3).
 * Worst: a class the model sends that isn't set up here is ignored (D-108), so a new model's
 *        classes must be added as defect types when the model changes.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Info } from "lucide-react";
import { PageHeader } from "@/components/features/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManilaDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/policies/guard";
import { getThresholds, listReferenceRows } from "@/server/services/settings.service";
import { TablePager } from "@/components/features/table-pager";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatAttendanceDay } from "@/lib/attendance-rules";
import { lunchBreakSettings } from "@/server/services/production.service";
import { LunchBreakForm } from "./lunch-break-form";
import { ReferenceManager, type Column, type Field, type Row } from "./reference-manager";
import { ModelNoticeForm } from "./model-notice-form";
import { ThresholdsForm } from "./thresholds-form";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { id: "thresholds", label: "Thresholds" },
  { id: "defects", label: "Defect types" },
  { id: "lunch", label: "Lunch break" },
  { id: "suppliers", label: "Suppliers" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const HISTORY_ROWS = 15;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** What a found defect of the type means for its section (D-093). */
/** "Usable under 3 in, Not accepted from 3 in" for a type with a length limit (Phase 30C). */
function whenFound(r: Record<string, unknown>): string {
  const limit = r.notAcceptedFromIn;
  if (typeof limit === "number") return `OK under ${limit} in, rejected from ${limit} in`;
  return OUTCOME_LABEL[str(r.outcome)] ?? str(r.outcome);
}

/** How a found one adds to its roll's defect share (D-106, D-110). */
function countsToward(r: Record<string, unknown>): string {
  const flat = r.flatSharePct;
  if (typeof flat !== "number") return "Its size";
  const limit = r.notAcceptedFromIn;
  return typeof limit === "number" ? `${flat}% each, from ${limit} in` : `${flat}% each`;
}

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
        description="What the camera decides, the lists people choose from, and the lunch break."
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
      {tab === "lunch" && <LunchTab page={Number(params.page) || 1} />}
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
      <ThresholdsForm found={t.foundAtOrAbove} returnLimit={t.returnSharePct} />
      <ModelNoticeForm initial={t.earlyModelNotice} />
    </div>
  );
}

async function DefectsTab({ add }: { add?: string }) {
  const rows = await listReferenceRows("defectType");
  const columns: Column[] = [
    { key: "label", label: "Label" },
    { key: "key", label: "Class key", mono: true },
    { key: "outcome", label: "When found" },
    { key: "counts", label: "Counts toward the roll" },
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
      hint: "Usable leaves the section Pass. Not accepted rejects it, and it is reported for salvage. A type with a length limit uses the limit instead.",
    },
    {
      name: "notAcceptedFromIn",
      label: "Rejected from (inches long)",
      type: "number",
      optional: true,
      placeholder: "e.g. 3",
      hint: "Shorter than this is OK. This long or longer is rejected. Leave blank for no limit.",
    },
    {
      name: "flatSharePct",
      label: "Each one adds this to the roll’s total (%)",
      type: "number",
      optional: true,
      placeholder: "e.g. 1",
      hint: "Leave blank to use the defect’s size instead.",
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
            notAcceptedFromIn: str(r.notAcceptedFromIn),
            flatSharePct: str(r.flatSharePct),
            description: str(r.description),
            sortOrder: str(r.sortOrder),
          },
          cells: {
            label: str(r.label),
            outcome: whenFound(r),
            counts: countsToward(r),
            key: str(r.key),
            description: str(r.description),
            sortOrder: str(r.sortOrder),
          },
        }))}
      />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info aria-hidden className="size-4" />
        An inactive defect type is ignored when the camera decides. Its past detections stay. A
        defect counts as found from the value on the Thresholds tab. A class the camera model sends
        that isn’t listed here is ignored, so add each new class when the model changes.
      </p>
    </div>
  );
}

async function LunchTab({ page }: { page: number }) {
  const lunch = await lunchBreakSettings();
  const pages = Math.max(1, Math.ceil(lunch.history.length / HISTORY_ROWS));
  const current = Math.min(Math.max(1, page), pages);
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Lunch pauses the batch it falls in, and a batch whose working time runs out when lunch
        starts ends when lunch ends. Today: {lunch.current.text}.
        {lunch.upcoming &&
          ` From ${formatAttendanceDay(lunch.upcoming.from)}: ${lunch.upcoming.text}.`}
      </p>
      <LunchBreakForm initial={lunch.form} shift={lunch.shift} tomorrow={lunch.tomorrow} />
      <Card>
        <CardHeader>
          <CardTitle>Lunch break history</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table label="Lunch break history" data-testid="lunch-history">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>From</TableHead>
                <TableHead>Lunch</TableHead>
                <TableHead>Set by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lunch.history
                .slice((current - 1) * HISTORY_ROWS, current * HISTORY_ROWS)
                .map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap">
                      {l.effectiveFrom <= "2000-01-01"
                        ? "From the start"
                        : formatAttendanceDay(l.effectiveFrom)}
                    </TableCell>
                    <TableCell>{l.text}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {l.setBy}, {formatManilaDateTime(l.setAt)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePager
            page={current}
            pageCount={pages}
            total={lunch.history.length}
            noun={["lunch break", "lunch breaks"]}
            href={(p) =>
              p > 1 ? `/admin/settings?tab=lunch&page=${p}` : "/admin/settings?tab=lunch"
            }
          />
        </CardContent>
      </Card>
    </div>
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
        { key: "code", label: "Code", mono: true },
        { key: "contactPerson", label: "Contact" },
        { key: "phone", label: "Phone" },
        { key: "notes", label: "Notes" },
      ]}
      fields={[
        { name: "name", label: "Name" },
        {
          name: "code",
          label: "Code",
          optional: true,
          placeholder: "e.g. MLT",
          hint: "2 to 6 capital letters or digits, for roll codes like LR-MLT-001. Left blank, it is made from the name.",
        },
        { name: "contactPerson", label: "Contact person", optional: true },
        { name: "phone", label: "Phone", optional: true, placeholder: "e.g. 0917 123 4567" },
        { name: "notes", label: "Notes", type: "textarea", optional: true },
      ]}
      emptyText="No suppliers yet. Add the leather suppliers you order from."
      rows={rows.map((r): Row => {
        const v = {
          code: str(r.code),
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
