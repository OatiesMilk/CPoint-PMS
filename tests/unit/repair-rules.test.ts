import { describe, expect, it } from "vitest";
import {
  hasRepairFilters,
  matchesFinding,
  matchesRepair,
  captureStageMessage,
  parseStageCount,
  summaryFieldId,
  compareWaiting,
  countReminderDue,
  findingsGap,
  latestCounts,
  mayCountStage,
  nextRepairState,
  oneStagePerPerson,
  parseFindings,
  parseRepairResult,
  prefillAssignments,
  repairCode,
  repairedPassedByDay,
  STAGE_LABEL,
  STAGES,
  suggestFor,
  waitingLine,
  wipFooterLine,
  wipTotals,
  type Assignment,
  type PastFinding,
} from "@/lib/repair-rules";

const types = [
  { id: "t1", key: "LIFTED_SOLE", label: "Lifted sole", isActive: true },
  { id: "t2", key: "GLUE_MARKS", label: "Glue marks", isActive: true },
  { id: "t3", key: "OTHER", label: "Other", isActive: true },
  { id: "t4", key: "OFF", label: "Old type", isActive: false },
];
const fixable = (id: string, pairs: number, stage = "SOLE_ING") => ({
  finalDefectTypeId: id,
  pairs,
  remedy: "FIXABLE",
  returnStage: stage,
});

describe("the stages (D-130)", () => {
  it("are in line order and Upper making is Construction", () => {
    expect(STAGES.map((s) => STAGE_LABEL[s])).toEqual([
      "Preparation",
      "Construction",
      "Sole-ing",
      "Finishing",
    ]);
  });
});

describe("parseFindings", () => {
  it("accepts lines that add up to the failed pairs", () => {
    const r = parseFindings(
      5,
      [fixable("t1", 3), { finalDefectTypeId: "t2", pairs: 2, remedy: "NOT_FIXABLE" }],
      types,
    );
    expect(r).toEqual({
      ok: true,
      lines: [
        {
          finalDefectTypeId: "t1",
          pairs: 3,
          remedy: "FIXABLE",
          returnStage: "SOLE_ING",
          note: null,
        },
        { finalDefectTypeId: "t2", pairs: 2, remedy: "NOT_FIXABLE", returnStage: null, note: null },
      ],
    });
  });
  it("needs nothing when no pair failed, and refuses lines then", () => {
    expect(parseFindings(0, [], types)).toEqual({ ok: true, lines: [] });
    expect(parseFindings(0, undefined, types)).toEqual({ ok: true, lines: [] });
    const r = parseFindings(0, [fixable("t1", 1)], types);
    expect(r.ok).toBe(false);
  });
  it("asks for lines when pairs failed and none are given", () => {
    const r = parseFindings(2, [], types);
    expect(r.ok === false && r.form).toContain("Add a defect");
  });
  it("names the line and the field in each message", () => {
    const r = parseFindings(
      5,
      [
        fixable("t1", 2),
        { finalDefectTypeId: "", pairs: "", remedy: undefined },
        { finalDefectTypeId: "t2", pairs: 1, remedy: "FIXABLE" },
      ],
      types,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.lines[1]).toEqual({
      finalDefectTypeId: "Choose the defect on line 2.",
      pairs: "Enter how many pairs on line 2 (1 or more).",
      remedy: "Say whether line 2 can be fixed.",
    });
    expect(r.lines[2].returnStage).toBe("Choose the stage line 3 goes back to.");
  });
  it("needs a note for Other and refuses an inactive type", () => {
    const r = parseFindings(
      2,
      [
        { finalDefectTypeId: "t3", pairs: 1, remedy: "NOT_FIXABLE" },
        { finalDefectTypeId: "t4", pairs: 1, remedy: "NOT_FIXABLE" },
      ],
      types,
    );
    if (r.ok) throw new Error("expected errors");
    expect(r.lines[0].note).toBe("Describe the defect on line 1.");
    expect(r.lines[1].finalDefectTypeId).toBe("Choose the defect on line 2.");
    expect(
      parseFindings(
        1,
        [{ finalDefectTypeId: "t3", pairs: 1, remedy: "NOT_FIXABLE", note: " Torn lining " }],
        types,
      ),
    ).toMatchObject({ ok: true, lines: [{ note: "Torn lining" }] });
  });
  it("combines duplicates of one defect, remedy and stage", () => {
    const r = parseFindings(3, [fixable("t1", 1), fixable("t1", 2)], types);
    if (r.ok) throw new Error("expected errors");
    expect(r.lines[1].finalDefectTypeId).toBe(
      "Lifted sole is listed twice. Combine them into one line.",
    );
    // The same defect fixable at two different stages is two answers, not a duplicate.
    expect(
      parseFindings(3, [fixable("t1", 1, "SOLE_ING"), fixable("t1", 2, "FINISHING")], types).ok,
    ).toBe(true);
  });
  it("says how the lines and the failed count differ", () => {
    const r = parseFindings(5, [fixable("t1", 6)], types);
    expect(r).toEqual({
      ok: false,
      lines: {},
      form: "The lines add up to 6 pairs, but 5 failed. Change the lines or the failed count.",
    });
  });
  it("ignores a stage on a Not fixable line", () => {
    const r = parseFindings(
      1,
      [{ finalDefectTypeId: "t1", pairs: 1, remedy: "NOT_FIXABLE", returnStage: "FINISHING" }],
      types,
    );
    expect(r).toMatchObject({ ok: true, lines: [{ returnStage: null }] });
  });
});

describe("findingsGap", () => {
  it("reads as a live helper", () => {
    expect(findingsGap(5, 2)).toBe("2 of 5 failed pairs have a reason. 3 pairs still need one.");
    expect(findingsGap(5, 6)).toBe("You listed 6 for 5 failed pairs. Remove 1.");
    expect(findingsGap(5, 5)).toBeNull();
    expect(findingsGap(0, 0)).toBeNull();
  });
});

describe("suggestFor", () => {
  const now = new Date("2026-11-20T04:00:00Z");
  const f = (
    typeId: string,
    days: number,
    stage: PastFinding["returnStage"] = "SOLE_ING",
    remedy: PastFinding["remedy"] = "FIXABLE",
  ): PastFinding => ({
    finalDefectTypeId: typeId,
    remedy,
    returnStage: remedy === "FIXABLE" ? stage : null,
    at: new Date(now.getTime() - days * 86_400_000),
  });
  const label = (id: string) => (id === "t1" ? "Lifted sole" : id);
  it("says nothing with 4 findings and speaks at 5", () => {
    expect(suggestFor([f("t1", 1), f("t1", 2), f("t1", 3), f("t1", 4)], label, now)).toEqual([]);
    const [s] = suggestFor(
      [f("t1", 1), f("t1", 2), f("t1", 3), f("t1", 4), f("t1", 5)],
      label,
      now,
    );
    expect(s).toMatchObject({ remedy: "FIXABLE", returnStage: "SOLE_ING", count: 5, total: 5 });
    expect(s.text).toBe("Usually fixable at Sole-ing, 5 of 5");
  });
  it("counts only the last 4 weeks", () => {
    const rows = [f("t1", 1), f("t1", 2), f("t1", 3), f("t1", 4), f("t1", 29)];
    expect(suggestFor(rows, label, now)).toEqual([]);
    expect(suggestFor([...rows.slice(0, 4), f("t1", 28)], label, now)).toHaveLength(1);
  });
  it("takes the most common remedy over all, and the stage over the fixable ones", () => {
    const rows = [
      f("t1", 1, "FINISHING"),
      f("t1", 2, "FINISHING"),
      f("t1", 3, "SOLE_ING", "NOT_FIXABLE"),
      f("t1", 4, "SOLE_ING", "NOT_FIXABLE"),
      f("t1", 5, "SOLE_ING", "NOT_FIXABLE"),
      f("t1", 6, "SOLE_ING", "NOT_FIXABLE"),
    ];
    const [s] = suggestFor(rows, label, now);
    expect(s.remedy).toBe("NOT_FIXABLE");
    expect(s.text).toBe("Lifted sole is usually not fixable, 4 of 6");
    const [fx] = suggestFor(
      [
        ...rows.slice(0, 2),
        f("t1", 7, "FINISHING"),
        f("t1", 8, "FINISHING"),
        f("t1", 9, "FINISHING"),
      ],
      label,
      now,
    );
    expect(fx.returnStage).toBe("FINISHING");
  });
  it("breaks a stage tie towards the earlier stage in the line", () => {
    const rows = [
      f("t1", 1, "FINISHING"),
      f("t1", 2, "FINISHING"),
      f("t1", 3, "CONSTRUCTION"),
      f("t1", 4, "CONSTRUCTION"),
      f("t1", 5, "SOLE_ING"),
    ];
    expect(suggestFor(rows, label, now)[0].returnStage).toBe("CONSTRUCTION");
  });
});

describe("repairs", () => {
  it("codes name the batch's day and number and the job's number", () => {
    expect(repairCode("2026-11-20", 2, 1)).toBe("RP-261120-2-1");
    expect(repairCode("2026-11-20", 2, 3)).toBe("RP-261120-2-3");
  });
  it("allows only the moves of A-63 and A-87", () => {
    expect(nextRepairState("AT_STAGE", "back")).toEqual({ ok: true, to: "BACK_FOR_INSPECTION" });
    expect(nextRepairState("AT_STAGE", "move")).toEqual({ ok: true, to: "AT_STAGE" });
    expect(nextRepairState("AT_STAGE", "notFixable")).toEqual({ ok: true, to: "CANCELLED" });
    expect(nextRepairState("BACK_FOR_INSPECTION", "inspect")).toEqual({ ok: true, to: "DONE" });
    for (const a of ["back", "move", "notFixable"] as const)
      expect(nextRepairState("BACK_FOR_INSPECTION", a).ok).toBe(false);
    expect(nextRepairState("AT_STAGE", "inspect").ok).toBe(false);
    for (const s of ["DONE", "CANCELLED"] as const)
      for (const a of ["back", "move", "notFixable", "inspect"] as const)
        expect(nextRepairState(s, a).ok).toBe(false);
  });
  it("the result adds up to the job's pairs", () => {
    expect(
      parseRepairResult(5, {
        passedPairs: 3,
        scrappedPairs: 1,
        resend: [{ stage: "FINISHING", pairs: 1 }],
      }),
    ).toEqual({
      ok: true,
      result: { passedPairs: 3, scrappedPairs: 1, resend: [{ stage: "FINISHING", pairs: 1 }] },
    });
    expect(parseRepairResult(5, { passedPairs: 5 })).toMatchObject({ ok: true });
    const bad = parseRepairResult(5, { passedPairs: 3, scrappedPairs: 1 });
    expect(bad.ok === false && bad.form).toContain("add up to 4, but this repair has 5 pairs");
    const noStage = parseRepairResult(2, { resend: [{ pairs: 2 }] });
    expect(noStage.ok === false && noStage.resend?.[0]).toBe(
      "Choose the stage line 1 goes back to.",
    );
    expect(parseRepairResult(2, { passedPairs: -1 }).ok).toBe(false);
  });
  it("counts passed pairs on the day they were inspected (Manila)", () => {
    const m = repairedPassedByDay([
      { inspectedAt: new Date("2026-11-19T10:00:00Z"), passedPairs: 2 },
      { inspectedAt: new Date("2026-11-19T17:00:00Z"), passedPairs: 1 }, // 01:00 on the 20th in Manila
      { inspectedAt: null, passedPairs: 4 },
      { inspectedAt: new Date("2026-11-20T02:00:00Z"), passedPairs: null },
    ]);
    expect([...m]).toEqual([
      ["2026-11-19", 2],
      ["2026-11-20", 1],
    ]);
  });
  it("orders the waiting rows Urgent first, then by who waited longest", () => {
    const rows = [
      { urgent: false, since: new Date("2026-11-20T01:00:00Z"), code: "RP-1" },
      { urgent: true, since: new Date("2026-11-20T05:00:00Z"), code: "B-2" },
      { urgent: false, since: new Date("2026-11-19T01:00:00Z"), code: "B-1" },
    ];
    expect(rows.sort(compareWaiting).map((r) => r.code)).toEqual(["B-2", "B-1", "RP-1"]);
  });
  it("words what is waiting", () => {
    expect(waitingLine(2, 1)).toBe("2 batches and 1 repair waiting for inspection");
    expect(waitingLine(1, 0)).toBe("1 batch waiting for inspection");
    expect(waitingLine(0, 2)).toBe("2 repairs waiting for inspection");
    expect(waitingLine(0, 0)).toBe("Nothing is waiting for inspection.");
  });
  it("words the Overview card's last line with one full stop each (D-131)", () => {
    expect(wipFooterLine(0, waitingLine(0, 0))).toBe(
      "No repairs open. Nothing is waiting for inspection.",
    );
    expect(wipFooterLine(1, waitingLine(1, 0))).toBe(
      "1 pair in repair. 1 batch waiting for inspection.",
    );
    expect(wipFooterLine(17, waitingLine(1, 1))).toBe(
      "17 pairs in repair. 1 batch and 1 repair waiting for inspection.",
    );
  });
});

describe("stage assignments and counts", () => {
  const a = (userId: string, stage: Assignment["stage"]): Assignment => ({ userId, stage });
  it("prefills from the nearest earlier working day and drops inactive people", () => {
    const history = new Map<string, Assignment[]>([
      ["2026-11-19", [a("u1", "SOLE_ING"), a("u2", "FINISHING")]],
      ["2026-11-16", [a("u1", "PREPARATION")]],
    ]);
    const working = (d: string) => d !== "2026-11-21" && d !== "2026-11-22"; // a weekend
    expect(prefillAssignments("2026-11-20", history, working, new Set(["u1"]))).toEqual({
      from: "2026-11-19",
      assignments: [a("u1", "SOLE_ING")],
    });
    // Monday looks past the weekend to Friday.
    const fri = new Map([["2026-11-20", [a("u1", "FINISHING")]]]);
    expect(prefillAssignments("2026-11-23", fri, working, new Set(["u1"]))?.from).toBe(
      "2026-11-20",
    );
  });
  it("skips non-working days even when they have assignments, and gives up after two weeks", () => {
    const history = new Map([["2026-11-19", [a("u1", "SOLE_ING")]]]);
    expect(
      prefillAssignments("2026-11-20", history, (d) => d !== "2026-11-19", new Set(["u1"])),
    ).toBeNull();
    expect(prefillAssignments("2026-12-20", history, () => true, new Set(["u1"]))).toBeNull();
  });
  it("keeps one stage per person", () => {
    expect(
      oneStagePerPerson([a("u1", "SOLE_ING"), a("u2", "FINISHING"), a("u1", "CONSTRUCTION")]),
    ).toEqual([a("u1", "CONSTRUCTION"), a("u2", "FINISHING")]);
  });
  it("lets the assigned constructor and the Floor Manager count, nobody else", () => {
    const today = [a("c1", "SOLE_ING")];
    expect(mayCountStage({ id: "c1", role: "SHOE_CONSTRUCTOR" }, "SOLE_ING", today)).toBe(true);
    expect(mayCountStage({ id: "c1", role: "SHOE_CONSTRUCTOR" }, "FINISHING", today)).toBe(false);
    expect(mayCountStage({ id: "c2", role: "SHOE_CONSTRUCTOR" }, "SOLE_ING", today)).toBe(false);
    expect(mayCountStage({ id: "fm", role: "FLOOR_MANAGER" }, "FINISHING", [])).toBe(true);
    expect(mayCountStage({ id: "qi", role: "QUALITY_INSPECTOR" }, "SOLE_ING", today)).toBe(false);
    expect(mayCountStage({ id: "c1", role: "SYSTEM_ADMIN" }, "SOLE_ING", today)).toBe(false);
  });
  it("reminds once a batch has ended since the last count", () => {
    const ended = [
      { code: "B-261120-1", slotAt: new Date("2026-11-20T04:00:00Z") },
      { code: "B-261120-2", slotAt: new Date("2026-11-20T07:00:00Z") },
      { code: "B-261120-3", slotAt: new Date("2026-11-20T09:00:00Z") },
    ];
    const now = new Date("2026-11-20T07:30:00Z");
    expect(countReminderDue(null, ended, now)).toEqual({ code: "B-261120-2" });
    expect(countReminderDue(new Date("2026-11-20T05:00:00Z"), ended, now)).toEqual({
      code: "B-261120-2",
    });
    expect(countReminderDue(new Date("2026-11-20T07:10:00Z"), ended, now)).toBeNull();
    expect(countReminderDue(null, [], now)).toBeNull();
  });
  it("takes the latest count of a day and stage as current", () => {
    const rows = [
      {
        day: "2026-11-20",
        stage: "SOLE_ING" as const,
        pairs: 10,
        enteredAt: new Date("2026-11-20T01:00:00Z"),
      },
      {
        day: "2026-11-20",
        stage: "SOLE_ING" as const,
        pairs: 14,
        enteredAt: new Date("2026-11-20T05:00:00Z"),
      },
      {
        day: "2026-11-19",
        stage: "FINISHING" as const,
        pairs: 3,
        enteredAt: new Date("2026-11-19T05:00:00Z"),
      },
    ];
    const m = latestCounts(rows, "2026-11-20");
    expect(m.get("SOLE_ING")?.pairs).toBe(14);
    expect(m.has("FINISHING")).toBe(false);
  });
  it("totals per stage from each day's last count, with no per-person data", () => {
    const at = (d: string, h: number) => new Date(`${d}T0${h}:00:00Z`);
    const t = wipTotals([
      { day: "2026-11-18", stage: "SOLE_ING", pairs: 8, enteredAt: at("2026-11-18", 1) },
      { day: "2026-11-18", stage: "SOLE_ING", pairs: 10, enteredAt: at("2026-11-18", 5) },
      { day: "2026-11-19", stage: "SOLE_ING", pairs: 20, enteredAt: at("2026-11-19", 5) },
    ]);
    expect(t.map((x) => x.stage)).toEqual([...STAGES]);
    expect(t[2]).toEqual({ stage: "SOLE_ING", days: 2, average: 15, highest: 20, latest: 20 });
    expect(t[0]).toEqual({
      stage: "PREPARATION",
      days: 0,
      average: null,
      highest: null,
      latest: null,
    });
    for (const row of t)
      expect(Object.keys(row).sort()).toEqual(["average", "days", "highest", "latest", "stage"]);
  });
});

describe("captureStageMessage (Addendum 1, A-95)", () => {
  it("names the person by their first name and says how to fix it", () => {
    expect(captureStageMessage("Sam Lopez")).toBe(
      "Sam is a shoe constructor with Capture access, so Sam works at Preparation. Choose Preparation, or ask the Admin to remove Capture access first.",
    );
    expect(captureStageMessage("Sam")).toContain("Sam works at Preparation");
  });
});

describe("summaryFieldId (the error summary's links)", () => {
  it("points a finding error at the editor's own input id", () => {
    expect(summaryFieldId("findings.0.finalDefectTypeId")).toBe("finding-0-finalDefectTypeId");
    expect(summaryFieldId("findings.2.note")).toBe("finding-2-note");
    expect(summaryFieldId("findings.11.returnStage")).toBe("finding-11-returnStage");
    expect(summaryFieldId("findings")).toBe("findings-error");
  });
  it("leaves the dialog's own fields to the dialog", () => {
    for (const key of [
      "pairs",
      "failedPairs",
      "reason",
      "findings.x.note",
      "findings.1",
      "findings.1.a.b",
    ])
      expect(summaryFieldId(key)).toBeNull();
  });
});

describe("parseStageCount (A-72)", () => {
  const bad = "Enter the pairs here now as a whole number, like 12. Enter 0 if none.";
  it("accepts digits and whole numbers from 0", () => {
    for (const [raw, pairs] of [
      ["12", 12],
      [" 12 ", 12],
      ["0", 0],
      [12, 12],
      [0, 0],
      ["50000", 50000],
    ] as const)
      expect(parseStageCount(raw)).toEqual({ ok: true, pairs });
  });
  it("refuses anything that isn't plain digits, with the fix", () => {
    for (const raw of [
      "x",
      "",
      "  ",
      "-1",
      "1.5",
      "1e3",
      "0x10",
      "12 pairs",
      1.5,
      -1,
      null,
      undefined,
    ])
      expect(parseStageCount(raw)).toEqual({ ok: false, message: bad });
  });
  it("refuses more than 50,000 pairs", () => {
    expect(parseStageCount("50001")).toEqual({
      ok: false,
      message: "That is more than 50,000 pairs. Check the number.",
    });
  });
});

describe("report filters (Phase 35, A-101)", () => {
  const finding = (key: string, remedy: string, returnStage: string | null) => ({
    remedy,
    returnStage,
    finalDefectType: { key },
  });

  it("knows when a filter is on", () => {
    expect(hasRepairFilters({})).toBe(false);
    expect(hasRepairFilters({ stage: "FINISHING" })).toBe(true);
  });

  it("a finding must match every filter that is set", () => {
    const f = finding("GLUE", "FIXABLE", "FINISHING");
    expect(matchesFinding(f, {})).toBe(true);
    expect(matchesFinding(f, { defect: "GLUE", remedy: "FIXABLE", stage: "FINISHING" })).toBe(true);
    expect(matchesFinding(f, { defect: "STITCH" })).toBe(false);
    expect(matchesFinding(f, { remedy: "NOT_FIXABLE" })).toBe(false);
    expect(matchesFinding(f, { stage: "SOLE_ING" })).toBe(false);
    // A Not fixable pair has no stage, so a stage filter leaves it out.
    expect(matchesFinding(finding("GLUE", "NOT_FIXABLE", null), { stage: "FINISHING" })).toBe(
      false,
    );
  });

  it("a repair matches by its finding's defect and remedy and the stage it went to", () => {
    const job = {
      stage: "SOLE_ING",
      finding: { remedy: "FIXABLE", finalDefectType: { key: "GLUE" } },
    };
    expect(matchesRepair(job, {})).toBe(true);
    expect(matchesRepair(job, { defect: "GLUE", stage: "SOLE_ING" })).toBe(true);
    expect(matchesRepair(job, { stage: "FINISHING" })).toBe(false);
    expect(matchesRepair(job, { remedy: "NOT_FIXABLE" })).toBe(false);
  });
});
