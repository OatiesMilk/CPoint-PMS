/**
 * Repairs (Phase 34, D-130): the QI's findings on a failed batch and the repair jobs they start.
 * A Fixable pair goes back to a stage as a job (A-87); the stage's constructor or the Floor
 * Manager marks it Back for inspection; the QI then inspects it from the queue (see
 * batch-queue.service). Every figure is per batch, defect or stage, never per person (D-008).
 */
import { appNow } from "@/lib/clock";
import { manilaToday } from "@/lib/format";
import {
  STAGES,
  STAGE_LABEL,
  mayCountStage,
  nextRepairSeq,
  nextRepairState,
  parseFindings,
  repairCodeForBatch,
  suggestFor,
  SUGGEST_WINDOW_DAYS,
  type FindingLine,
  type Stage,
  type RepairFilters,
  hasRepairFilters,
  matchesFinding,
  matchesRepair,
  type Suggestion,
} from "@/lib/repair-rules";
import type { Role } from "@/lib/domain";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import {
  deleteFindingsOfCheckIn,
  findRepair,
  findingsBetween,
  repairsBetween,
  unexplainedFailedPairs,
  insertFinding,
  insertRepair,
  listFindingsForCheckIn,
  listFindingsForCheckIns,
  listRepairStatusesOfCheckIns,
  listFinalDefectTypes,
  listRepairsOfCheckIn,
  repairCodesWithPrefix,
  suggestionFacts,
  transitionRepair,
  setFindingRemedy,
} from "@/server/models/repair.model";
import { listAssignments } from "@/server/models/stage.model";
import type { RepairChangeInput } from "@/server/validators/repair.validator";
import { recordAudit } from "./audit.service";

type Tx = Parameters<Parameters<typeof runInTransaction>[0]>[0];
type Actor = { id: string; name?: string; role: Role };

const toDetails = (errors: Record<string, string>) =>
  Object.entries(errors).map(([key, message]) => ({ path: key.split("."), message }));

/** The final defect types for the finish form, active first. */
export async function finalDefectTypeOptions() {
  const rows = await listFinalDefectTypes();
  return rows.map((r) => ({ id: r.id, key: r.key, label: r.label, isActive: r.isActive }));
}

/** The QI's lines checked against the failed pairs; throws a field error keyed `findings.<n>.<field>`. */
export async function parseFindingLines(
  failedPairs: number,
  raw: unknown,
  keepTypeIds: ReadonlySet<string> = new Set(),
): Promise<FindingLine[]> {
  const result = parseFindings(
    failedPairs,
    Array.isArray(raw) ? raw : undefined,
    await finalDefectTypeOptions(),
    keepTypeIds,
  );
  if (!result.ok) {
    const errors: Record<string, string> = {};
    for (const [i, fields] of Object.entries(result.lines))
      for (const [field, message] of Object.entries(fields))
        errors[`findings.${i}.${field}`] = message;
    if (result.form) errors.findings = result.form;
    throw Errors.validation(toDetails(errors));
  }
  return result.lines;
}

export type FindingSummary = {
  defect: string;
  pairs: number;
  remedy: string;
  returnStage: string | null;
  note: string | null;
};

/**
 * Writes a batch's findings and a repair job for each Fixable one, in the caller's transaction
 * (so the check-in, the lines, the jobs and their audit commit together).
 */
export async function writeFindings(
  p: { checkInId: string; batchCode: string; lines: FindingLine[]; actorId: string; now: Date },
  tx: Tx,
): Promise<{ summary: FindingSummary[]; jobs: { code: string; pairs: number; stage: Stage }[] }> {
  const summary: FindingSummary[] = [];
  const jobs: { code: string; pairs: number; stage: Stage }[] = [];
  const prefix = repairCodeForBatch(p.batchCode, 0).slice(0, -1);
  const taken = await repairCodesWithPrefix(prefix, tx);
  let seq = nextRepairSeq(taken);
  for (const line of p.lines) {
    const finding = await insertFinding(p.checkInId, line, tx);
    summary.push({
      defect: finding.finalDefectType.label,
      pairs: line.pairs,
      remedy: line.remedy,
      returnStage: line.returnStage,
      note: line.note,
    });
    if (line.remedy === "FIXABLE" && line.returnStage) {
      const code = repairCodeForBatch(p.batchCode, seq++);
      const job = await insertRepair(
        { code, findingId: finding.id, pairs: line.pairs, stage: line.returnStage, sentAt: p.now },
        tx,
      );
      jobs.push({ code, pairs: line.pairs, stage: line.returnStage });
      await recordAudit(tx, {
        actor: { type: "USER", userId: p.actorId },
        action: "repair.create",
        entity: "RepairJob",
        entityId: job.id,
        after: {
          code,
          batch: p.batchCode,
          defect: finding.finalDefectType.label,
          pairs: line.pairs,
          stage: line.returnStage,
        },
      });
    }
  }
  return { summary, jobs };
}

/**
 * The batch's current lines and whether a correction may still change them (A-93): not once a
 * repair from it is Back for inspection or Done.
 */
export async function findingsState(checkInId: string) {
  const [findings, jobs] = await Promise.all([
    listFindingsForCheckIn(checkInId),
    listRepairsOfCheckIn(checkInId),
  ]);
  const locked = jobs.some((j) => j.status === "BACK_FOR_INSPECTION" || j.status === "DONE");
  return {
    findings,
    jobs,
    locked,
    lines: findings.map<FindingSummary & { finalDefectTypeId: string }>((f) => ({
      finalDefectTypeId: f.finalDefectTypeId,
      defect: f.finalDefectType.label,
      pairs: f.pairs,
      remedy: f.remedy,
      returnStage: f.returnStage,
      note: f.note,
    })),
  };
}

/** A batch's lines as the Finish form holds them, and what a card reads (Phase 34). */
export type CheckInFindings = {
  lines: {
    finalDefectTypeId: string;
    pairs: string;
    remedy: "FIXABLE" | "NOT_FIXABLE";
    returnStage: Stage | "";
    note: string;
  }[];
  summary: FindingSummary[];
  /** Why the lines can't change now (A-93), or null. */
  lockedReason: string | null;
};

/** The lines of several check-ins, in two queries. A batch from before Phase 34 has none (A-89). */
export async function findingsForCheckIns(ids: string[]): Promise<Map<string, CheckInFindings>> {
  const [rows, repairs] = await Promise.all([
    listFindingsForCheckIns(ids),
    listRepairStatusesOfCheckIns(ids),
  ]);
  const out = new Map<string, CheckInFindings>();
  for (const id of ids) {
    const locked = repairs.some(
      (r) => r.checkInId === id && (r.status === "BACK_FOR_INSPECTION" || r.status === "DONE"),
    );
    out.set(id, { lines: [], summary: [], lockedReason: locked ? LOCKED_MESSAGE : null });
  }
  for (const f of rows) {
    const entry = out.get(f.checkInId)!;
    entry.lines.push({
      finalDefectTypeId: f.finalDefectTypeId,
      pairs: String(f.pairs),
      remedy: f.remedy,
      returnStage: f.returnStage ?? "",
      note: f.note ?? "",
    });
    entry.summary.push({
      defect: f.finalDefectType.label,
      pairs: f.pairs,
      remedy: f.remedy,
      returnStage: f.returnStage,
      note: f.note,
    });
  }
  return out;
}

export const LOCKED_MESSAGE =
  "A repair from this batch is already back for inspection, so its failed pairs can't change. You can still correct the other counts.";

/** A correction rebuilds the batch's lines and its At-stage repairs (A-93), in the caller's transaction. */
export async function rebuildFindings(
  p: { checkInId: string; batchCode: string; lines: FindingLine[]; actorId: string; now: Date },
  tx: Tx,
) {
  await deleteFindingsOfCheckIn(p.checkInId, tx);
  return writeFindings(p, tx);
}

/** What the QI usually answered for each defect type, from the last 4 weeks (A-76). */
export async function defectSuggestions(now: Date = appNow()): Promise<Record<string, Suggestion>> {
  const since = new Date(now.getTime() - SUGGEST_WINDOW_DAYS * 86_400_000);
  const [facts, types] = await Promise.all([suggestionFacts(since), listFinalDefectTypes()]);
  const labels = new Map(types.map((t) => [t.id, t.label]));
  const found = suggestFor(
    facts.map((f) => ({ ...f, at: f.createdAt })),
    (id) => labels.get(id) ?? "This defect",
    now,
  );
  return Object.fromEntries(found.map((s) => [s.finalDefectTypeId, s]));
}

// ───────────── the life of a repair ─────────────

async function loadJob(id: string) {
  const job = await findRepair(id);
  if (!job) throw Errors.notFound("This repair");
  return job;
}

const jobLabel = (job: { code: string }) => job.code;

/**
 * The stage marks a repair Back for inspection: the constructor assigned to that stage today, or
 * the Floor Manager. It then waits in the Inspection queue (no due time, A-65).
 */
export async function markRepairBack(id: string, actor: Actor, now: Date = appNow()) {
  const job = await loadJob(id);
  const assignments = await listAssignments(manilaToday(now));
  if (!mayCountStage(actor, job.stage, assignments))
    throw Errors.forbidden(
      `Only the Floor Manager or a constructor assigned to ${STAGE_LABEL[job.stage]} today can mark ${jobLabel(job)} back for inspection.`,
    );
  if (!nextRepairState(job.status, "back").ok)
    throw Errors.conflict(
      job.status === "BACK_FOR_INSPECTION"
        ? `${job.code} is already back for inspection. Refresh to see it.`
        : `${job.code} can't be marked back now (${job.status === "DONE" ? "already inspected" : "cancelled"}). Refresh to see it.`,
    );
  return runInTransaction(async (tx) => {
    const ok = await transitionRepair(
      id,
      ["AT_STAGE"],
      { status: "BACK_FOR_INSPECTION", backAt: now, backById: actor.id },
      tx,
    );
    if (!ok) throw Errors.stale(`${job.code} was changed by someone else. Refresh to see it.`);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: "repair.back",
      entity: "RepairJob",
      entityId: id,
      before: { status: job.status },
      after: { code: job.code, status: "BACK_FOR_INSPECTION", stage: job.stage, pairs: job.pairs },
    });
    return { id, code: job.code };
  });
}

/**
 * The Floor Manager moves an At-stage job to another stage, or calls it Not fixable after all
 * (A-63, A-87); a reason is required and goes in the audit.
 */
export async function changeRepair(id: string, input: RepairChangeInput, actor: Actor) {
  const job = await loadJob(id);
  if (!nextRepairState(job.status, "move").ok)
    throw Errors.conflict(
      `${job.code} can only change while it is at its stage. It is ${job.status === "BACK_FOR_INSPECTION" ? "back for inspection" : job.status === "DONE" ? "already inspected" : "cancelled"}. Refresh to see it.`,
    );
  if (input.action === "move" && input.stage === job.stage)
    throw Errors.validation([
      {
        path: ["stage"],
        message: `${job.code} is already at ${STAGE_LABEL[job.stage]}. Choose another stage.`,
      },
    ]);
  return runInTransaction(async (tx) => {
    const ok =
      input.action === "move"
        ? await transitionRepair(
            id,
            ["AT_STAGE"],
            { stage: input.stage, changeReason: input.reason },
            tx,
          )
        : await transitionRepair(
            id,
            ["AT_STAGE"],
            { status: "CANCELLED", changeReason: input.reason },
            tx,
          );
    if (!ok) throw Errors.stale(`${job.code} was changed by someone else. Refresh to see it.`);
    // A first job's finding becomes Not fixable; a job sent back again keeps its finding as it was.
    if (input.action === "notFixable" && !job.parentId)
      await setFindingRemedy(job.findingId, { remedy: "NOT_FIXABLE", returnStage: null }, tx);
    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: input.action === "move" ? "repair.move" : "repair.notFixable",
      entity: "RepairJob",
      entityId: id,
      before: { status: job.status, stage: job.stage },
      after:
        input.action === "move"
          ? { code: job.code, stage: input.stage, reason: input.reason }
          : { code: job.code, status: "CANCELLED", reason: input.reason, pairs: job.pairs },
    });
    return { id, code: job.code };
  });
}

// ───────────── Reports → Operations (A-89) ─────────────

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The final defect, origin and repair sections of Reports → Operations. Counts and shares per
 * defect type and stage, never per person (D-008). Failed pairs from before Phase 34 have no
 * reasons; they appear as "Reason not recorded" so the totals reconcile.
 */
export async function repairReport(
  range: { from: string; to: string },
  filters: RepairFilters = {},
) {
  const [allFindings, allRepairs, unexplained] = await Promise.all([
    findingsBetween(range.from, range.to),
    repairsBetween(range.from, range.to),
    unexplainedFailedPairs(range.from, range.to),
  ]);
  // Filters (A-101) narrow the cards, not the whole line: shares stay shares of every failed pair.
  const filtered = hasRepairFilters(filters);
  const findings = allFindings.filter((f) => matchesFinding(f, filters));
  const repairs = allRepairs.filter((j) => matchesRepair(j, filters));
  type Acc = {
    id: string;
    key: string;
    label: string;
    sortOrder: number;
    pairs: number;
    fixable: number;
    scrapped: number;
    byStage: Record<Stage, number>;
  };
  const byType = new Map<string, Acc>();
  for (const f of findings) {
    const t = f.finalDefectType;
    const acc =
      byType.get(t.id) ??
      ({
        id: t.id,
        key: t.key,
        label: t.label,
        sortOrder: t.sortOrder,
        pairs: 0,
        fixable: 0,
        scrapped: 0,
        byStage: { PREPARATION: 0, CONSTRUCTION: 0, SOLE_ING: 0, FINISHING: 0 },
      } satisfies Acc);
    acc.pairs += f.pairs;
    if (f.remedy === "FIXABLE" && f.returnStage) {
      acc.fixable += f.pairs;
      acc.byStage[f.returnStage] += f.pairs;
    } else acc.scrapped += f.pairs;
    byType.set(t.id, acc);
  }
  const rows = [...byType.values()].sort(
    (a, b) => b.pairs - a.pairs || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
  );
  const total = allFindings.reduce((s, f) => s + f.pairs, 0) + unexplained;
  const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);
  const finalDefects = {
    rows: rows.map((r) => ({
      id: r.id,
      label: r.label,
      pairs: r.pairs,
      shareOfFailed: share(r.pairs, total),
      fixableShare: share(r.fixable, r.pairs),
      scrapped: r.scrapped,
    })),
    /** Failed pairs with no reason: batches from before Phase 34 (A-89). */
    notRecorded: filtered ? 0 : unexplained,
    totalFailed: total,
  };
  const origins = {
    stages: STAGES.map((s) => ({ stage: s, label: STAGE_LABEL[s] })),
    rows: rows.map((r) => ({
      id: r.id,
      label: r.label,
      byStage: STAGES.map((s) => ({
        stage: s,
        pairs: r.byStage[s],
        share: share(r.byStage[s], r.pairs),
      })),
      scrapped: r.scrapped,
      scrappedShare: share(r.scrapped, r.pairs),
      pairs: r.pairs,
    })),
  };
  const done = repairs.filter((j) => j.status === "DONE");
  const durations = done
    .filter((j) => j.inspectedAt)
    .map((j) => (j.inspectedAt!.getTime() - j.sentAt.getTime()) / 3_600_000);
  const sum = (pick: (j: (typeof repairs)[number]) => number) =>
    repairs.reduce((s, j) => s + pick(j), 0);
  const repairsSummary = {
    sent: sum((j) => j.pairs),
    back: sum((j) => (j.status === "BACK_FOR_INSPECTION" || j.status === "DONE" ? j.pairs : 0)),
    passed: sum((j) => j.passedPairs ?? 0),
    scrapped: sum((j) => j.scrappedPairs ?? 0),
    sentAgain: sum((j) => j.resentPairs ?? 0),
    stillOpen: sum((j) => (j.status === "AT_STAGE" ? j.pairs : 0)),
    /** Average hours from sent to inspected, over the repairs that were inspected. */
    averageHours: durations.length
      ? round1(durations.reduce((s, h) => s + h, 0) / durations.length)
      : null,
  };
  return { finalDefects, origins, repairs: repairsSummary };
}

export type RepairReport = Awaited<ReturnType<typeof repairReport>>;
