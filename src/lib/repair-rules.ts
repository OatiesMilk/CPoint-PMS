/**
 * Final defects, repairs and work in progress (Phase 34, D-130). Pure and dependency-free: what the
 * QI says was wrong with the failed pairs, the repair job's life, what the stage counts show.
 * Everything is per stage, per defect or per day for the whole line (D-008): there is no
 * per-person figure here.
 */

export const STAGES = ["PREPARATION", "CONSTRUCTION", "SOLE_ING", "FINISHING"] as const;
export type Stage = (typeof STAGES)[number];

/** "Upper making" became "Construction" (D-130). */
export const STAGE_LABEL: Record<Stage, string> = {
  PREPARATION: "Preparation",
  CONSTRUCTION: "Construction",
  SOLE_ING: "Sole-ing",
  FINISHING: "Finishing",
};

export const isStage = (v: unknown): v is Stage =>
  typeof v === "string" && (STAGES as readonly string[]).includes(v);

export type Remedy = "FIXABLE" | "NOT_FIXABLE";
export type RepairStatus = "AT_STAGE" | "BACK_FOR_INSPECTION" | "DONE" | "CANCELLED";

export const REMEDY_LABEL: Record<Remedy, string> = {
  FIXABLE: "Fixable",
  NOT_FIXABLE: "Not fixable",
};

export const REPAIR_STATUS_LABEL: Record<RepairStatus, string> = {
  AT_STAGE: "At stage",
  BACK_FOR_INSPECTION: "Back for inspection",
  DONE: "Done",
  CANCELLED: "Not fixable after all",
};

/** The defect type that always exists and needs a note (A-62). */
export const OTHER_KEY = "OTHER";
/** How many findings of a type, inside the window, before the form suggests the usual answer. */
export const SUGGEST_MIN_FINDINGS = 5;
export const SUGGEST_WINDOW_DAYS = 28;
export const MAX_FINDING_NOTE = 200;
/** The longest reason a repair change may give. */
export const MAX_REASON = 200;

const DAY = 86_400_000;
const pairsWord = (n: number) => `${n.toLocaleString("en-PH")} pair${n === 1 ? "" : "s"}`;

// ───────────── findings: what was wrong ─────────────

export type FinalDefectTypeRef = { id: string; key: string; label: string; isActive: boolean };

export type RawFinding = {
  finalDefectTypeId?: unknown;
  pairs?: unknown;
  remedy?: unknown;
  returnStage?: unknown;
  note?: unknown;
};

export type FindingLine = {
  finalDefectTypeId: string;
  pairs: number;
  remedy: Remedy;
  returnStage: Stage | null;
  note: string | null;
};

export type FindingField = "finalDefectTypeId" | "pairs" | "remedy" | "returnStage" | "note";

export type FindingErrors = {
  /** Errors by line (0-based) then field, so a form puts each under its own input. */
  lines: Record<number, Partial<Record<FindingField, string>>>;
  /** About the whole list (the sum, or lines when nothing failed). */
  form?: string;
};

/** "3 of 5 failed pairs still need a reason." / "You listed 6 for 5 failed pairs. Remove 1." */
export function findingsGap(failedPairs: number, listed: number): string | null {
  if (failedPairs <= 0) return null;
  if (listed === failedPairs) return null;
  if (listed < failedPairs)
    return `${listed.toLocaleString("en-PH")} of ${failedPairs.toLocaleString("en-PH")} failed pairs have a reason. ${pairsWord(failedPairs - listed)} still need one.`;
  const extra = listed - failedPairs;
  return `You listed ${listed.toLocaleString("en-PH")} for ${failedPairs.toLocaleString("en-PH")} failed pairs. Remove ${extra.toLocaleString("en-PH")}.`;
}

const wholePairs = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).trim());
  return Number.isInteger(n) ? n : null;
};

/**
 * Checks the finding lines of a batch against its failed pairs (A-62, A-75). One line per defect,
 * remedy and stage; a Fixable line names the stage it goes back to, a Not fixable line has none;
 * "Other" needs a note; the lines add up to exactly the failed pairs. Messages name the line.
 */
export function parseFindings(
  failedPairs: number,
  raw: readonly RawFinding[] | undefined | null,
  types: readonly FinalDefectTypeRef[],
  /** Types a correction may keep even though they were switched off since (A-93). */
  keepTypeIds: ReadonlySet<string> = new Set(),
): { ok: true; lines: FindingLine[] } | ({ ok: false } & FindingErrors) {
  const list = raw ?? [];
  if (failedPairs <= 0) {
    return list.length === 0
      ? { ok: true, lines: [] }
      : {
          ok: false,
          lines: {},
          form: "No pairs failed, so there is nothing to list. Remove the lines.",
        };
  }
  const errors: FindingErrors = { lines: {} };
  const put = (i: number, field: FindingField, message: string) => {
    (errors.lines[i] ??= {})[field] ??= message;
  };
  if (list.length === 0) {
    return {
      ok: false,
      lines: {},
      form: `Say what was wrong with the ${failedPairs.toLocaleString("en-PH")} failed pair${failedPairs === 1 ? "" : "s"}. Add a defect.`,
    };
  }
  const lines: FindingLine[] = [];
  const seen = new Map<string, number>();
  let sum = 0;
  list.forEach((r, i) => {
    const n = i + 1;
    const typeId = typeof r.finalDefectTypeId === "string" ? r.finalDefectTypeId : "";
    const type = types.find((t) => t.id === typeId);
    if (!typeId || !type || (!type.isActive && !keepTypeIds.has(type.id)))
      put(i, "finalDefectTypeId", `Choose the defect on line ${n}.`);
    const pairs = wholePairs(r.pairs);
    if (pairs === null || pairs < 1)
      put(i, "pairs", `Enter how many pairs on line ${n} (1 or more).`);
    else sum += pairs;
    const remedy: Remedy | null =
      r.remedy === "FIXABLE" || r.remedy === "NOT_FIXABLE" ? r.remedy : null;
    if (!remedy) put(i, "remedy", `Say whether line ${n} can be fixed.`);
    let stage: Stage | null = null;
    if (remedy === "FIXABLE") {
      if (isStage(r.returnStage)) stage = r.returnStage;
      else put(i, "returnStage", `Choose the stage line ${n} goes back to.`);
    }
    const note = typeof r.note === "string" && r.note.trim() ? r.note.trim() : null;
    if (note && note.length > MAX_FINDING_NOTE)
      put(i, "note", `Keep the note on line ${n} under ${MAX_FINDING_NOTE} characters.`);
    if (type?.key === OTHER_KEY && !note) put(i, "note", `Describe the defect on line ${n}.`);
    if (type && remedy && pairs !== null && pairs >= 1) {
      const key = `${type.id}|${remedy}|${stage ?? ""}`;
      // Two "Other" lines may differ by their notes, so they aren't duplicates.
      const dupKey = type.key === OTHER_KEY ? `${key}|${note ?? ""}` : key;
      if (seen.has(dupKey))
        put(i, "finalDefectTypeId", `${type.label} is listed twice. Combine them into one line.`);
      seen.set(dupKey, i);
    }
    if (type && remedy && pairs !== null && pairs >= 1 && (remedy === "NOT_FIXABLE" || stage))
      lines.push({ finalDefectTypeId: type.id, pairs, remedy, returnStage: stage, note });
  });
  if (Object.keys(errors.lines).length) return { ok: false, ...errors };
  if (sum !== failedPairs)
    return {
      ok: false,
      lines: {},
      form: `The lines add up to ${sum.toLocaleString("en-PH")} pairs, but ${failedPairs.toLocaleString("en-PH")} failed. Change the lines or the failed count.`,
    };
  return { ok: true, lines };
}

// ───────────── the learned answer (A-76) ─────────────

export type PastFinding = {
  finalDefectTypeId: string;
  remedy: Remedy;
  returnStage: Stage | null;
  at: Date;
};

export type Suggestion = {
  finalDefectTypeId: string;
  remedy: Remedy;
  returnStage: Stage | null;
  /** The findings behind the answer (of the same remedy, and of the stage when fixable). */
  count: number;
  total: number;
  /** "Usually fixable at Sole-ing, 14 of 17" */
  text: string;
};

/**
 * Per defect type, the usual answer once there are 5 or more findings in the last 4 weeks: the
 * most common remedy over all of them and, if that is Fixable, the most common stage. A tie goes to
 * Fixable, and to the earlier stage in line order. Never forced onto the form.
 */
export function suggestFor(
  findings: readonly PastFinding[],
  labelOf: (finalDefectTypeId: string) => string,
  now: Date,
): Suggestion[] {
  const since = now.getTime() - SUGGEST_WINDOW_DAYS * DAY;
  const byType = new Map<string, PastFinding[]>();
  for (const f of findings) {
    if (f.at.getTime() < since || f.at.getTime() > now.getTime()) continue;
    const list = byType.get(f.finalDefectTypeId) ?? [];
    list.push(f);
    byType.set(f.finalDefectTypeId, list);
  }
  const out: Suggestion[] = [];
  for (const [typeId, list] of byType) {
    if (list.length < SUGGEST_MIN_FINDINGS) continue;
    const fixable = list.filter((f) => f.remedy === "FIXABLE");
    const notFixable = list.length - fixable.length;
    const remedy: Remedy = fixable.length >= notFixable ? "FIXABLE" : "NOT_FIXABLE";
    let stage: Stage | null = null;
    let count = notFixable;
    if (remedy === "FIXABLE") {
      let best = -1;
      for (const s of STAGES) {
        const c = fixable.filter((f) => f.returnStage === s).length;
        if (c > best) {
          best = c;
          stage = s;
        }
      }
      count = best;
    }
    const label = labelOf(typeId);
    out.push({
      finalDefectTypeId: typeId,
      remedy,
      returnStage: stage,
      count,
      total: list.length,
      text:
        remedy === "FIXABLE" && stage
          ? `Usually fixable at ${STAGE_LABEL[stage]}, ${count} of ${list.length}`
          : `${label} is usually not fixable, ${count} of ${list.length}`,
    });
  }
  return out;
}

// ───────────── repair jobs ─────────────

/** `RP-261120-2-1`: the batch's day and number, then the job's number within that batch (A-87). */
export function repairCode(batchDay: string, batchNumber: number, seq: number): string {
  return `RP-${batchDay.slice(2, 4)}${batchDay.slice(5, 7)}${batchDay.slice(8, 10)}-${batchNumber}-${seq}`;
}

/** The code of a batch's repair: B-261120-2 and job 1 give RP-261120-2-1. */
export const repairCodeForBatch = (batchCode: string, seq: number) =>
  `RP-${batchCode.replace(/^B-/i, "")}-${seq}`;

/** The next job number of a batch, from the codes it already has (a re-sent job takes the next one). */
export function nextRepairSeq(takenCodes: readonly string[]): number {
  let max = 0;
  for (const c of takenCodes) {
    const n = Number(c.slice(c.lastIndexOf("-") + 1));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return max + 1;
}

export const isRepairCode = (value: string) => /^RP-\d{6}-\d{1,2}-\d{1,3}$/i.test(value.trim());

export type RepairAction = "back" | "move" | "notFixable" | "inspect";

/**
 * The allowed moves of a repair job (A-63, A-87): At stage → Back for inspection (the stage),
 * At stage → another stage or Not fixable after all (the Floor Manager), Back → Done (the QI).
 */
export function nextRepairState(
  status: RepairStatus,
  action: RepairAction,
): { ok: true; to: RepairStatus } | { ok: false; reason: string } {
  if (status === "DONE") return { ok: false, reason: "This repair is already done." };
  if (status === "CANCELLED")
    return { ok: false, reason: "This repair was marked not fixable. It can't change." };
  if (action === "inspect")
    return status === "BACK_FOR_INSPECTION"
      ? { ok: true, to: "DONE" }
      : {
          ok: false,
          reason: "This repair is still at its stage. It can be inspected once it is back.",
        };
  if (status === "BACK_FOR_INSPECTION")
    return {
      ok: false,
      reason:
        action === "back"
          ? "This repair is already back for inspection."
          : "This repair is already back for inspection, so it can't be moved or changed.",
    };
  if (action === "back") return { ok: true, to: "BACK_FOR_INSPECTION" };
  if (action === "move") return { ok: true, to: "AT_STAGE" };
  return { ok: true, to: "CANCELLED" };
}

export type RawRepairResult = {
  passedPairs?: unknown;
  scrappedPairs?: unknown;
  resend?: unknown;
};

export type RepairResult = {
  passedPairs: number;
  scrappedPairs: number;
  resend: { stage: Stage; pairs: number }[];
};

export type RepairResultErrors = {
  passedPairs?: string;
  scrappedPairs?: string;
  resend?: Record<number, string>;
  form?: string;
};

/** Passed + scrapped + sent back again must equal the job's pairs (A-88). */
export function parseRepairResult(
  jobPairs: number,
  raw: RawRepairResult,
): { ok: true; result: RepairResult } | ({ ok: false } & RepairResultErrors) {
  const errors: RepairResultErrors = {};
  const count = (v: unknown, field: "passedPairs" | "scrappedPairs", label: string) => {
    const n = v === undefined || v === null || v === "" ? 0 : wholePairs(v);
    if (n === null || n < 0) {
      errors[field] = `Enter the pairs ${label} as a whole number, like 2. Enter 0 if none.`;
      return 0;
    }
    return n;
  };
  const passed = count(raw.passedPairs, "passedPairs", "that passed");
  const scrapped = count(raw.scrappedPairs, "scrappedPairs", "scrapped");
  const resend: { stage: Stage; pairs: number }[] = [];
  const list = Array.isArray(raw.resend)
    ? (raw.resend as { stage?: unknown; pairs?: unknown }[])
    : [];
  list.forEach((r, i) => {
    const pairs = wholePairs(r?.pairs);
    if (!isStage(r?.stage))
      (errors.resend ??= {})[i] = `Choose the stage line ${i + 1} goes back to.`;
    else if (pairs === null || pairs < 1)
      (errors.resend ??= {})[i] = `Enter how many pairs on line ${i + 1} (1 or more).`;
    else resend.push({ stage: r.stage, pairs });
  });
  if (Object.keys(errors).length) return { ok: false, ...errors };
  const again = resend.reduce((s, r) => s + r.pairs, 0);
  const sum = passed + scrapped + again;
  if (sum !== jobPairs)
    return {
      ok: false,
      form: `Passed, scrapped and sent back again add up to ${sum.toLocaleString("en-PH")}, but this repair has ${jobPairs.toLocaleString("en-PH")} pair${jobPairs === 1 ? "" : "s"}. Change the numbers.`,
    };
  return { ok: true, result: { passedPairs: passed, scrappedPairs: scrapped, resend } };
}

const manilaDay = (at: Date) => new Date(at.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);

/** Repaired pairs that passed, by the Manila day they were inspected (A-64). */
export function repairedPassedByDay(
  jobs: readonly { inspectedAt: Date | null; passedPairs: number | null }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const j of jobs) {
    if (!j.inspectedAt || !j.passedPairs) continue;
    const day = manilaDay(j.inspectedAt);
    out.set(day, (out.get(day) ?? 0) + j.passedPairs);
  }
  return out;
}

/** Waiting rows in the Inspection queue: Urgent batches first, then who started waiting first. */
export function compareWaiting(
  a: { urgent: boolean; since: Date; code: string },
  b: { urgent: boolean; since: Date; code: string },
): number {
  return (
    Number(b.urgent) - Number(a.urgent) ||
    a.since.getTime() - b.since.getTime() ||
    a.code.localeCompare(b.code)
  );
}

// ───────────── stage assignments and counts ─────────────

export type Assignment = { userId: string; stage: Stage };

const previousDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) - DAY).toISOString().slice(0, 10);

/**
 * The suggestion for an empty day (A-74): the nearest earlier working day, up to two weeks back,
 * that has assignments, without anyone no longer active. Nothing is stored until it is saved.
 */
export function prefillAssignments(
  day: string,
  history: ReadonlyMap<string, readonly Assignment[]>,
  isWorkingDay: (day: string) => boolean,
  activeUserIds: ReadonlySet<string>,
): { from: string; assignments: Assignment[] } | null {
  let d = day;
  for (let i = 0; i < 14; i++) {
    d = previousDay(d);
    if (!isWorkingDay(d)) continue;
    const found = history.get(d);
    if (!found || found.length === 0) continue;
    const kept = found.filter((a) => activeUserIds.has(a.userId));
    return kept.length ? { from: d, assignments: kept.map((a) => ({ ...a })) } : null;
  }
  return null;
}

/**
 * A constructor with Capture access works at Preparation, where capture happens (Addendum 1,
 * A-95): the message when someone tries to put one anywhere else.
 */
export function captureStageMessage(name: string): string {
  const first = name.trim().split(" ")[0] || name;
  return `${first} is a shoe constructor with Capture access, so ${first} works at Preparation. Choose Preparation, or ask the Admin to remove Capture access first.`;
}

/** A constructor is at one stage a day (A-86): a person ticked twice keeps the last stage. */
export function oneStagePerPerson(assignments: readonly Assignment[]): Assignment[] {
  const byUser = new Map<string, Assignment>();
  for (const a of assignments) byUser.set(a.userId, a);
  return [...byUser.values()];
}

/**
 * May this person save a count for this stage (A-72, A-73)? The Floor Manager any stage; a
 * constructor only the stage they are assigned to today; nobody else.
 */
export function mayCountStage(
  viewer: { id: string; role: string },
  stage: Stage,
  assignedToday: readonly Assignment[],
): boolean {
  if (viewer.role === "FLOOR_MANAGER") return true;
  if (viewer.role !== "SHOE_CONSTRUCTOR") return false;
  return assignedToday.some((a) => a.userId === viewer.id && a.stage === stage);
}

/**
 * The batch that ended since the stage was last counted, or null (A-73): "B-261120-2 just ended.
 * Update the count." Only batches that ended today count.
 */
export function countReminderDue(
  lastCountAt: Date | null,
  endedBatches: readonly { code: string; slotAt: Date }[],
  now: Date,
): { code: string } | null {
  let latest: { code: string; slotAt: Date } | null = null;
  for (const b of endedBatches) {
    if (b.slotAt.getTime() > now.getTime()) continue;
    if (!latest || b.slotAt.getTime() > latest.slotAt.getTime()) latest = b;
  }
  if (!latest) return null;
  if (lastCountAt && lastCountAt.getTime() >= latest.slotAt.getTime()) return null;
  return { code: latest.code };
}

export type CountRow = { day: string; stage: Stage; pairs: number; enteredAt: Date };

/** The current count per stage: the latest row of the day (A-72). */
export function latestCounts(
  rows: readonly CountRow[],
  day: string,
): Map<Stage, { pairs: number; enteredAt: Date }> {
  const out = new Map<Stage, { pairs: number; enteredAt: Date }>();
  for (const r of rows) {
    if (r.day !== day) continue;
    const cur = out.get(r.stage);
    if (!cur || r.enteredAt.getTime() >= cur.enteredAt.getTime())
      out.set(r.stage, { pairs: r.pairs, enteredAt: r.enteredAt });
  }
  return out;
}

export type StageTotals = {
  stage: Stage;
  /** Days with at least one count. */
  days: number;
  /** Average of each day's last count; null without a count. */
  average: number | null;
  highest: number | null;
  /** The most recent day's last count. */
  latest: number | null;
};

/** Per stage: how many days were counted and the average, highest and latest of the day's last count. */
export function wipTotals(rows: readonly CountRow[]): StageTotals[] {
  return STAGES.map((stage) => {
    const lastByDay = new Map<string, CountRow>();
    for (const r of rows) {
      if (r.stage !== stage) continue;
      const cur = lastByDay.get(r.day);
      if (!cur || r.enteredAt.getTime() >= cur.enteredAt.getTime()) lastByDay.set(r.day, r);
    }
    const days = [...lastByDay.keys()].sort();
    if (days.length === 0) return { stage, days: 0, average: null, highest: null, latest: null };
    const values = days.map((d) => lastByDay.get(d)!.pairs);
    return {
      stage,
      days: days.length,
      average: Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10,
      highest: Math.max(...values),
      latest: values[values.length - 1],
    };
  });
}

/** "2 batches and 1 repair waiting for inspection" */
export function waitingLine(batches: number, repairs: number): string {
  if (batches === 0 && repairs === 0) return "Nothing is waiting for inspection.";
  const parts: string[] = [];
  if (batches) parts.push(`${batches} batch${batches === 1 ? "" : "es"}`);
  if (repairs) parts.push(`${repairs} repair${repairs === 1 ? "" : "s"}`);
  return `${parts.join(" and ")} waiting for inspection`;
}

export const STAGE_COUNT_MAX = 50_000;

/**
 * The pairs at a stage (A-72): digits only, from 0 to 50,000. Typed text such as "1e3", "0x10",
 * "1.5", "-1" or nothing is refused. The form checks it as it is typed and the server checks it again
 * with the same text.
 */
export function parseStageCount(
  raw: unknown,
): { ok: true; pairs: number } | { ok: false; message: string } {
  const bad = {
    ok: false as const,
    message: "Enter the pairs here now as a whole number, like 12. Enter 0 if none.",
  };
  let n: number;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 0) return bad;
    n = raw;
  } else if (typeof raw === "string") {
    const text = raw.trim();
    if (!/^[0-9]+$/.test(text)) return bad;
    n = Number(text);
  } else return bad;
  if (n > STAGE_COUNT_MAX)
    return {
      ok: false,
      message:
        "That is more than " +
        STAGE_COUNT_MAX.toLocaleString("en-PH") +
        " pairs. Check the number.",
    };
  return { ok: true, pairs: n };
}

/**
 * The input an error summary link should focus, from a form error key: `findings.2.note` is
 * `finding-2-note` (the id the findings editor gives that field), `findings` is the list-level
 * message, anything else is the dialog's own field (null here).
 */
export function summaryFieldId(key: string): string | null {
  const m = key.split(".");
  if (m.length === 3 && m[0] === "findings" && /^[0-9]+$/.test(m[1]) && /^[A-Za-z]+$/.test(m[2]))
    return "finding-" + m[1] + "-" + m[2];
  if (key === "findings") return "findings-error";
  return null;
}
