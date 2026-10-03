import type { Verdict } from "@/lib/domain";
import { Errors } from "@/server/lib/errors";
import { runInTransaction } from "@/server/models/db";
import {
  cancelReworkTicket,
  cancelSalvageItem,
  findLiveOutcomes,
  insertReworkTicket,
  insertSalvageItem,
} from "@/server/models/outcome.model";
import { findScanById, updateScanDecision } from "@/server/models/scan.model";
import type { DecisionInput } from "@/server/validators/scan.validator";
import { recordAudit } from "./audit.service";

const STALE = "Someone else already decided this scan. Refresh to see the current decision.";

/**
 * A person's decision on a scan (D-011). Resolving a NEEDS_REVIEW scan needs no reason; changing an
 * existing decision (an override) does. The scan's rework ticket / salvage item is swapped to match,
 * keeping the cancelled one as history (D-018).
 */
export async function decideScan(
  id: string,
  input: DecisionInput,
  actor: { id: string },
  now: Date = new Date(),
) {
  const scan = await findScanById(id);
  if (!scan) throw Errors.notFound("This scan");
  if (scan.batch.status === "COMPLETED" || scan.batch.status === "CANCELLED") {
    throw Errors.conflict(
      `Batch ${scan.batch.code} is closed, so its scans can no longer be changed.`,
    );
  }
  if ((input.expectedFinalVerdict ?? null) !== scan.finalVerdict) throw Errors.stale(STALE);

  const resolvingReview = scan.status === "PENDING_REVIEW";
  if (!resolvingReview && input.verdict === scan.finalVerdict) {
    throw Errors.conflict("That is already the decision for this scan.");
  }
  if (!resolvingReview && !input.reason) {
    throw Errors.validation([
      { path: ["reason"], message: "Say why you're changing the camera's decision." },
    ]);
  }

  const live = await findLiveOutcomes(id);
  if (live.rework && live.rework.status !== "OPEN" && input.verdict !== "REWORK") {
    throw Errors.conflict(
      "The repair station has already worked on this section, so the decision can't change now.",
    );
  }
  if (live.salvage && live.salvage.status !== "AVAILABLE" && input.verdict !== "REJECT") {
    throw Errors.conflict(
      "This rejected section was already reused or discarded, so the decision can't change now.",
    );
  }

  const isOverride = scan.aiVerdict !== "NEEDS_REVIEW" && input.verdict !== scan.aiVerdict;

  await runInTransaction(async (tx) => {
    const { count } = await updateScanDecision(
      id,
      {
        finalVerdict: input.verdict,
        status: "DECIDED",
        isOverride,
        overrideReason: input.reason ?? null,
        decidedById: actor.id,
        decidedAt: now,
      },
      { finalVerdict: scan.finalVerdict },
      tx,
    );
    if (count !== 1) throw Errors.stale(STALE);

    if (live.rework && input.verdict !== "REWORK")
      await cancelReworkTicket(live.rework.id, now, tx);
    if (live.salvage && input.verdict !== "REJECT") await cancelSalvageItem(live.salvage.id, tx);
    if (input.verdict === "REWORK" && !live.rework) await insertReworkTicket(id, tx, now);
    if (input.verdict === "REJECT" && !live.salvage) {
      await insertSalvageItem({ scanId: id, originBatchId: scan.batchId, createdAt: now }, tx);
    }

    await recordAudit(tx, {
      actor: { type: "USER", userId: actor.id },
      action: resolvingReview ? "scan.review" : "scan.override",
      entity: "Scan",
      entityId: id,
      before: { aiVerdict: scan.aiVerdict, finalVerdict: scan.finalVerdict, status: scan.status },
      after: { finalVerdict: input.verdict, isOverride, reason: input.reason ?? null },
    });
  });

  return { id, finalVerdict: input.verdict as Verdict, isOverride };
}
