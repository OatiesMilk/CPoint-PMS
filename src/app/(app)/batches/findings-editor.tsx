"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  OTHER_KEY,
  REMEDY_LABEL,
  REPAIR_STAGES,
  STAGE_LABEL,
  findingsGap,
  parseFindings,
  type FindingField,
  type Remedy,
  type RepairStage,
  type Stage,
  type Suggestion,
} from "@/lib/repair-rules";
import { cn } from "@/lib/utils";

/** One line as typed: everything is text until it is checked. */
export type FindingDraft = {
  finalDefectTypeId: string;
  pairs: string;
  remedy: "" | Remedy;
  /** A saved line from before Phase 38 may still name Preparation; the form then asks for a valid stage (D-136). */
  returnStage: "" | Stage;
  note: string;
};

export type DefectOption = { id: string; key: string; label: string; isActive: boolean };

export const emptyFinding = (): FindingDraft => ({
  finalDefectTypeId: "",
  pairs: "",
  remedy: "",
  returnStage: "",
  note: "",
});

/** Errors keyed like the server's: `findings.<line>.<field>` and `findings` for the whole list. */
export function findingErrors(
  failedPairs: number,
  lines: FindingDraft[],
  types: DefectOption[],
): Record<string, string> {
  const result = parseFindings(failedPairs, lines, types);
  if (result.ok) return {};
  const out: Record<string, string> = {};
  for (const [i, fields] of Object.entries(result.lines))
    for (const [field, message] of Object.entries(fields)) out[`findings.${i}.${field}`] = message;
  if (result.form) out.findings = result.form;
  return out;
}

/** The input ids, so the error summary can focus the right field. */
export const findingFieldId = (line: number, field: FindingField) => `finding-${line}-${field}`;

const listedPairs = (lines: FindingDraft[]) =>
  lines.reduce((sum, l) => {
    const n = Number(l.pairs);
    return sum + (Number.isInteger(n) && n > 0 ? n : 0);
  }, 0);

type Props = {
  lines: FindingDraft[];
  onChange: (lines: FindingDraft[]) => void;
  /** The failed pairs typed in the dialog, as a number (0 when empty or not a number). */
  failedPairs: number;
  types: DefectOption[];
  suggestions: Record<string, Suggestion>;
  errors: Record<string, string>;
  /** Why the lines can't change (a repair from this batch is already back), or null. */
  lockedReason?: string | null;
  /** Which errors to clear when a line changes. */
  onClearError: (key: string) => void;
};

/**
 * "What was wrong" (Phase 34, D-130): one line per defect, with the QI's call (Fixable or Not
 * fixable) and, for a fixable one, the stage it goes back to (A-75). A hint can suggest the usual
 * answer; it is never filled in for them (A-76).
 */
export function FindingsEditor({
  lines,
  onChange,
  failedPairs,
  types,
  suggestions,
  errors,
  lockedReason,
  onClearError,
}: Props) {
  const gap = findingsGap(failedPairs, listedPairs(lines));
  const locked = !!lockedReason;
  const active = types.filter((t) => t.isActive);

  function update(i: number, patch: Partial<FindingDraft>, ...cleared: FindingField[]) {
    onChange(lines.map((l, n) => (n === i ? { ...l, ...patch } : l)));
    for (const f of cleared) onClearError(`findings.${i}.${f}`);
    onClearError("findings");
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-4" disabled={locked}>
      <legend className="px-1 text-base font-medium">What was wrong</legend>
      {locked ? (
        <p className="text-sm text-muted-foreground">{lockedReason}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Add one line for each defect. The lines must add up to the failed pairs.
        </p>
      )}
      <ul className="flex flex-col gap-3" aria-label="Defects found">
        {lines.map((line, i) => {
          const n = i + 1;
          const err = (f: FindingField) => errors[`findings.${i}.${f}`];
          const type = types.find((t) => t.id === line.finalDefectTypeId);
          const suggestion = line.finalDefectTypeId
            ? suggestions[line.finalDefectTypeId]
            : undefined;
          const matches =
            suggestion &&
            suggestion.remedy === line.remedy &&
            (suggestion.remedy === "NOT_FIXABLE" || suggestion.returnStage === line.returnStage);
          return (
            <li key={i} className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] items-start gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={findingFieldId(i, "finalDefectTypeId")}>Defect, line {n}</Label>
                  <Select
                    id={findingFieldId(i, "finalDefectTypeId")}
                    value={line.finalDefectTypeId}
                    aria-invalid={!!err("finalDefectTypeId")}
                    aria-describedby={
                      err("finalDefectTypeId")
                        ? `${findingFieldId(i, "finalDefectTypeId")}-error`
                        : undefined
                    }
                    onChange={(e) =>
                      update(i, { finalDefectTypeId: e.target.value }, "finalDefectTypeId", "note")
                    }
                  >
                    <option value="">Choose the defect</option>
                    {active.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                    {type && !type.isActive && <option value={type.id}>{type.label}</option>}
                  </Select>
                  <FieldError
                    id={`${findingFieldId(i, "finalDefectTypeId")}-error`}
                    message={err("finalDefectTypeId")}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor={findingFieldId(i, "pairs")}>Pairs, line {n}</Label>
                  <Input
                    id={findingFieldId(i, "pairs")}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    className="tabular-nums"
                    value={line.pairs}
                    aria-invalid={!!err("pairs")}
                    aria-describedby={
                      err("pairs") ? `${findingFieldId(i, "pairs")}-error` : undefined
                    }
                    onChange={(e) => update(i, { pairs: e.target.value }, "pairs")}
                  />
                  <FieldError id={`${findingFieldId(i, "pairs")}-error`} message={err("pairs")} />
                </div>
              </div>
              <div
                role="radiogroup"
                aria-label={`Can line ${n} be fixed?`}
                aria-describedby={
                  err("remedy") ? `${findingFieldId(i, "remedy")}-error` : undefined
                }
                id={findingFieldId(i, "remedy")}
                tabIndex={-1}
                className="flex flex-wrap items-center gap-2"
              >
                {(["FIXABLE", "NOT_FIXABLE"] as const).map((r) => (
                  <label
                    key={r}
                    className={cn(
                      "relative flex min-h-9 cursor-pointer items-center rounded-md border px-3 text-sm font-medium",
                      "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/25",
                      line.remedy === r
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-input bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <input
                      type="radio"
                      // Invisible but covering the label, so a tap or a click lands on the input.
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                      name={`finding-${i}-remedy`}
                      value={r}
                      checked={line.remedy === r}
                      onChange={() =>
                        update(
                          i,
                          { remedy: r, returnStage: r === "FIXABLE" ? line.returnStage : "" },
                          "remedy",
                          "returnStage",
                        )
                      }
                    />
                    {REMEDY_LABEL[r]}
                  </label>
                ))}
              </div>
              <FieldError id={`${findingFieldId(i, "remedy")}-error`} message={err("remedy")} />
              {line.remedy === "FIXABLE" && (
                <div className="flex max-w-xs flex-col gap-1.5">
                  <Label htmlFor={findingFieldId(i, "returnStage")}>Goes back to, line {n}</Label>
                  <Select
                    id={findingFieldId(i, "returnStage")}
                    value={line.returnStage}
                    aria-invalid={!!err("returnStage")}
                    aria-describedby={
                      err("returnStage") ? `${findingFieldId(i, "returnStage")}-error` : undefined
                    }
                    onChange={(e) =>
                      update(i, { returnStage: e.target.value as RepairStage | "" }, "returnStage")
                    }
                  >
                    <option value="">Choose the stage</option>
                    {REPAIR_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  <FieldError
                    id={`${findingFieldId(i, "returnStage")}-error`}
                    message={err("returnStage")}
                  />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={findingFieldId(i, "note")}>
                  {type?.key === OTHER_KEY ? `Describe the defect, line ${n}` : `Note, line ${n}`}
                  {type?.key !== OTHER_KEY && (
                    <span className="font-normal text-muted-foreground"> (optional)</span>
                  )}
                </Label>
                <Input
                  id={findingFieldId(i, "note")}
                  autoComplete="off"
                  maxLength={200}
                  value={line.note}
                  aria-invalid={!!err("note")}
                  aria-describedby={err("note") ? `${findingFieldId(i, "note")}-error` : undefined}
                  onChange={(e) => update(i, { note: e.target.value }, "note")}
                />
                <FieldError id={`${findingFieldId(i, "note")}-error`} message={err("note")} />
              </div>
              {suggestion && !matches && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{suggestion.text}.</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      update(
                        i,
                        { remedy: suggestion.remedy, returnStage: suggestion.returnStage ?? "" },
                        "remedy",
                        "returnStage",
                      )
                    }
                  >
                    Use this
                    <span className="sr-only"> for line {n}</span>
                  </Button>
                </p>
              )}
              {lines.length > 1 && !locked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => {
                    onChange(lines.filter((_, k) => k !== i));
                    onClearError("findings");
                  }}
                >
                  <Trash2 aria-hidden />
                  Remove line {n}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {!locked && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => onChange([...lines, emptyFinding()])}
        >
          <Plus aria-hidden />
          Add another defect
        </Button>
      )}
      <p id="findings-error" role={errors.findings ? "alert" : undefined} className="text-sm">
        {errors.findings ? (
          <span className="text-destructive">{errors.findings}</span>
        ) : (
          gap && <span className="text-muted-foreground">{gap}</span>
        )}
      </p>
    </fieldset>
  );
}
