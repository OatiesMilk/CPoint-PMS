import { REMEDY_LABEL, STAGE_LABEL, type RepairFilters } from "@/lib/repair-rules";

/** The three defect-card filters in words, for a card's "Filtered:" line and the printed header. */
export function defectFilterText(
  f: RepairFilters,
  types: readonly { key: string; label: string }[],
): string {
  return [
    f.defect && `Defect: ${types.find((t) => t.key === f.defect)?.label ?? f.defect}`,
    f.remedy && REMEDY_LABEL[f.remedy],
    f.stage && `Stage: ${STAGE_LABEL[f.stage]}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
