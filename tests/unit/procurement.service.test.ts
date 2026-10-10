import { beforeEach, describe, expect, it, vi } from "vitest";

const proc = {
  findRequestDetail: vi.fn(),
  insertEvent: vi.fn(async (_data: Record<string, unknown>, _tx?: unknown) => ({ id: "e1" })),
  insertRemark: vi.fn(async (d: Record<string, unknown>) => ({ id: "r1", ...d })),
  insertRequest: vi.fn(async (d: { code: string }) => ({ id: "pr1", code: d.code })),
  listConstructors: vi.fn(),
  listRequests: vi.fn(),
  nextRequestNumber: vi.fn(async () => 7),
  openRequestsBy: vi.fn(),
  openRequestsForItems: vi.fn(async () => [] as unknown[]),
  pendingSummary: vi.fn(),
  setCanRequestLeatherRolls: vi.fn(),
  setLineMovement: vi.fn(),
  transitionStatus: vi.fn(
    async (_id: string, _from: string, _data: Record<string, unknown>, _tx?: unknown) => 1,
  ),
};
const inventory = { findInventoryItem: vi.fn(), listRequestableItems: vi.fn() };
const users = { findUserById: vi.fn() };
const postMovement = vi.fn(async () => ({ movementId: "m1", onHandAfter: 0 }));
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/procurement.model", () => proc);
vi.mock("@/server/models/inventory.model", () => inventory);
vi.mock("@/server/models/user.model", () => users);
vi.mock("@/server/models/db", () => ({
  runInTransaction: (fn: (tx: unknown) => unknown) => fn("tx"),
}));
vi.mock("@/server/services/audit.service", () => ({ recordAudit }));
vi.mock("@/server/services/inventory.service", () => ({ postMovement }));

const svc = await import("@/server/services/procurement.service");

const now = new Date("2026-10-05T02:00:00.000Z"); // 10:00 in Manila
const sc = { id: "sc1", role: "SHOE_CONSTRUCTOR" as const, canRequestLeatherRolls: true };
const fm = { id: "fm1", role: "FLOOR_MANAGER" as const, canRequestLeatherRolls: false };
const admin = { id: "ad1", role: "SYSTEM_ADMIN" as const, canRequestLeatherRolls: false };

const nails = {
  id: "i1",
  sku: "NL-001",
  name: "Shoe nails",
  unit: "box",
  category: "NAILS",
  quantityOnHand: "2",
  reorderLevel: "5",
  isActive: true,
};

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: "pr1",
    code: "PR-2026-0007",
    status: "PENDING",
    requestedById: "sc1",
    neededBy: new Date("2026-10-08T00:00:00.000Z"),
    lines: [
      {
        id: "l1",
        itemName: "Shoe nails",
        unit: "box",
        quantity: "4",
        item: { ...nails },
      },
      { id: "l2", itemName: "Brass eyelets", unit: "pack", quantity: "1", item: null },
    ],
    ...overrides,
  };
}

const values = {
  neededBy: "2026-10-08", // a Thursday: 3 working days after `now`
  remarks: "Nails for Friday's topsider batch",
  lines: [{ inventoryItemId: "i1", quantity: 4 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  proc.transitionStatus.mockResolvedValue(1);
  inventory.findInventoryItem.mockResolvedValue(nails);
});

describe("createRequest", () => {
  it("lets any Shoe Constructor request materials other than leather rolls (D-031)", async () => {
    await expect(
      svc.createRequest(values, { ...sc, canRequestLeatherRolls: false }, now),
    ).resolves.toMatchObject({ code: "PR-2026-0007" });
  });

  it("refuses leather rolls without the Floor Manager's OK, picked or typed (D-031)", async () => {
    const noLeather = { ...sc, canRequestLeatherRolls: false };
    inventory.findInventoryItem.mockResolvedValueOnce({ ...nails, category: "LEATHER_ROLL" });
    await expect(svc.createRequest(values, noLeather, now)).rejects.toMatchObject({
      status: 403,
      code: "LEATHER_ROLLS_NOT_ALLOWED",
    });
    const typed = {
      ...values,
      lines: [
        { itemName: "Tan cowhide", category: "LEATHER_ROLL" as const, unit: "roll", quantity: 1 },
      ],
    };
    await expect(svc.createRequest(typed, noLeather, now)).rejects.toMatchObject({
      code: "LEATHER_ROLLS_NOT_ALLOWED",
    });
    expect(proc.insertRequest).not.toHaveBeenCalled();
    // With the OK, the same leather roll goes through.
    await expect(svc.createRequest(typed, sc, now)).resolves.toMatchObject({ id: "pr1" });
    expect(proc.insertRequest.mock.calls[0][0]).toMatchObject({
      lines: [{ inventoryItemId: null, itemName: "Tan cowhide", category: "LEATHER_ROLL" }],
    });
  });

  it("marks leather rolls not allowed in the picker for a constructor without the OK", async () => {
    inventory.listRequestableItems.mockResolvedValue([
      { ...nails, quantityOnHand: "2", reorderLevel: "5" },
      { ...nails, id: "i2", name: "Black cowhide", category: "LEATHER_ROLL" },
    ]);
    const off = await svc.requestableItems({
      role: "SHOE_CONSTRUCTOR",
      canRequestLeatherRolls: false,
    });
    expect(off.map((i) => [i.id, i.allowed])).toEqual([
      ["i1", true],
      ["i2", false],
    ]);
    const on = await svc.requestableItems(sc);
    expect(on.every((i) => i.allowed)).toBe(true);
  });

  it("refuses everyone but a Shoe Constructor, even with the flag", async () => {
    await expect(
      svc.createRequest(values, { ...fm, canRequestLeatherRolls: true }, now),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("numbers the request, snapshots the stock, and records the first timeline event", async () => {
    const result = await svc.createRequest(
      {
        ...values,
        lines: [
          { inventoryItemId: "i1", quantity: 4 },
          { itemName: "Brass eyelets", unit: "pack", quantity: 1 },
        ],
      },
      sc,
      now,
    );
    expect(result).toMatchObject({ id: "pr1", code: "PR-2026-0007", alreadyRequested: [] });
    expect(proc.nextRequestNumber).toHaveBeenCalledWith(2026, "tx");
    expect(proc.insertRequest.mock.calls[0][0]).toMatchObject({
      requestedById: "sc1",
      createdAt: now,
      lines: [
        {
          inventoryItemId: "i1",
          itemName: "Shoe nails",
          unit: "box",
          quantity: 4,
          onHandAtRequest: 2,
          reorderLevelAtRequest: 5,
        },
        { inventoryItemId: null, itemName: "Brass eyelets", unit: "pack", onHandAtRequest: null },
      ],
    });
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      fromStatus: null,
      toStatus: "PENDING",
      actorId: "sc1",
    });
    expect(recordAudit.mock.calls[0][1]).toMatchObject({ action: "procurement.request.create" });
  });

  it("saves the remarks as the request's first remark, in the same transaction (D-036)", async () => {
    await svc.createRequest(values, sc, now);
    expect(proc.insertRequest.mock.calls[0][0]).toMatchObject({
      neededBy: new Date("2026-10-08T00:00:00.000Z"),
    });
    expect(proc.insertRequest.mock.calls[0][0]).not.toHaveProperty("justification");
    expect(proc.insertRequest.mock.calls[0][0]).not.toHaveProperty("priority");
    expect(proc.insertRemark).toHaveBeenCalledWith(
      {
        requestId: "pr1",
        authorId: "sc1",
        body: "Nails for Friday's topsider batch",
        createdAt: now,
      },
      "tx",
    );
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      after: { neededBy: "2026-10-08", remarks: "Nails for Friday's topsider batch" },
    });
  });

  it("adds no remark when the remarks box is left empty", async () => {
    await svc.createRequest({ ...values, remarks: undefined }, sc, now);
    expect(proc.insertRemark).not.toHaveBeenCalled();
  });

  it("warns, without blocking, when an open request already asks for the item", async () => {
    proc.openRequestsForItems.mockResolvedValueOnce([
      { inventoryItemId: "i1", request: { id: "pr0", code: "PR-2026-0003", status: "PENDING" } },
    ]);
    const result = await svc.createRequest(values, sc, now);
    expect(result.alreadyRequested).toEqual([{ itemName: "Shoe nails", code: "PR-2026-0003" }]);
    expect(proc.insertRequest).toHaveBeenCalled();
  });

  it("refuses a needed-by date in the past and a deactivated item, as field errors", async () => {
    await expect(
      svc.createRequest({ ...values, neededBy: "2026-10-04" }, sc, now),
    ).rejects.toMatchObject({
      status: 422,
      message: "Needed by can't be in the past. Pick today or a later date.",
      details: [{ path: ["neededBy"] }],
    });
    await expect(
      svc.createRequest({ ...values, neededBy: "2027-04-04" }, sc, now), // 181 days ahead
    ).rejects.toMatchObject({
      status: 422,
      message: "Needed by can be at most 180 days ahead. Pick an earlier date.",
    });
    inventory.findInventoryItem.mockResolvedValueOnce({ ...nails, isActive: false });
    await expect(svc.createRequest(values, sc, now)).rejects.toMatchObject({
      status: 422,
      details: [{ path: ["lines", 0, "inventoryItemId"] }],
    });
  });
});

describe("decisions", () => {
  it("lets the Floor Manager approve with a note, conditional on PENDING", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    const result = await svc.actOnRequest(
      "pr1",
      { action: "approve", note: "Order today" },
      fm,
      now,
    );
    expect(result).toMatchObject({ status: "APPROVED", message: "PR-2026-0007 approved." });
    expect(proc.transitionStatus).toHaveBeenCalledWith(
      "pr1",
      "PENDING",
      { status: "APPROVED", decidedById: "fm1", decidedAt: now, approvalNote: "Order today" },
      "tx",
    );
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      fromStatus: "PENDING",
      toStatus: "APPROVED",
      note: "Order today",
    });
    expect(recordAudit.mock.calls[0][1]).toMatchObject({ action: "procurement.request.approve" });
  });

  it("records the rejection reason", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    await svc.actOnRequest(
      "pr1",
      { action: "reject", reason: "We have 3 boxes in the back" },
      fm,
      now,
    );
    expect(proc.transitionStatus.mock.calls[0][2]).toMatchObject({
      status: "REJECTED",
      rejectionReason: "We have 3 boxes in the back",
    });
  });

  it("answers STALE when someone else changed the request first", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    proc.transitionStatus.mockResolvedValueOnce(0);
    await expect(svc.actOnRequest("pr1", { action: "approve" }, fm, now)).rejects.toMatchObject({
      status: 409,
      code: "STALE",
    });
    expect(proc.insertEvent).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("refuses an action the status doesn't allow, in plain words", async () => {
    proc.findRequestDetail.mockResolvedValue(request({ status: "REJECTED" }));
    await expect(svc.actOnRequest("pr1", { action: "approve" }, fm, now)).rejects.toMatchObject({
      status: 409,
      message: "Only a pending request can be approved. This one is rejected.",
    });
  });

  it("refuses decisions from anyone but the Floor Manager", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    await expect(svc.actOnRequest("pr1", { action: "approve" }, sc, now)).rejects.toMatchObject({
      status: 403,
    });
    await expect(svc.actOnRequest("pr1", { action: "approve" }, admin, now)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("lets only the requester cancel, and hides other people's requests from a constructor", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    await expect(svc.actOnRequest("pr1", { action: "cancel" }, fm, now)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      svc.actOnRequest("pr1", { action: "cancel" }, { ...sc, id: "sc2" }, now),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      svc.actOnRequest("pr1", { action: "cancel", note: "Found some" }, sc, now),
    ).resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("receiving posts stock IN for inventory lines only, in the same transaction", async () => {
    proc.findRequestDetail.mockResolvedValue(request({ status: "APPROVED" }));
    const result = await svc.actOnRequest("pr1", { action: "receive" }, fm, now);
    expect(result.status).toBe("RECEIVED");
    expect(postMovement).toHaveBeenCalledTimes(1);
    expect(postMovement).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ id: "i1", quantityOnHand: 2 }),
      { type: "IN", delta: 4, reason: "Received for PR-2026-0007" },
      fm,
      now,
    );
    expect(proc.setLineMovement).toHaveBeenCalledWith("l1", "m1", "tx");
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      toStatus: "RECEIVED",
      note: "Added to stock: Shoe nails.",
    });
  });
});

describe("remarks", () => {
  it("allow the Floor Manager anywhere and the requester on their own", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    await svc.addRemark("pr1", "Supplier delivers Thursday", fm, now);
    await svc.addRemark("pr1", "Thanks", { ...sc, canRequestLeatherRolls: false }, now);
    expect(proc.insertRemark).toHaveBeenCalledTimes(2);
    await expect(svc.addRemark("pr1", "Hi", { ...sc, id: "sc2" }, now)).rejects.toMatchObject({
      status: 404,
    });
    await expect(svc.addRemark("pr1", "Hi", admin, now)).rejects.toMatchObject({ status: 403 });
  });
});

describe("urgency on reads (D-037)", () => {
  it("is worked out from the needed-by date, and gone once the request is closed", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    expect(await svc.getRequest("pr1", fm, now)).toMatchObject({
      urgency: "HIGH",
      daysLeft: "in 3 working days",
    });
    // The same request read a week earlier is Medium, and Low two weeks earlier.
    expect(await svc.getRequest("pr1", fm, new Date("2026-09-29T02:00:00.000Z"))).toMatchObject({
      urgency: "MEDIUM",
      daysLeft: "in 7 working days",
    });
    expect(await svc.getRequest("pr1", fm, new Date("2026-09-21T02:00:00.000Z"))).toMatchObject({
      urgency: "LOW",
    });
    for (const status of ["RECEIVED", "REJECTED", "CANCELLED"]) {
      proc.findRequestDetail.mockResolvedValue(request({ status }));
      expect(await svc.getRequest("pr1", fm, now)).toMatchObject({
        urgency: null,
        daysLeft: null,
      });
    }
  });

  it("filters the list by a needed-by range and counts High for the home card", async () => {
    proc.listRequests.mockResolvedValue({ rows: [], total: 0, counts: {} });
    await svc.listRequests({ urgency: "MEDIUM" }, fm, now); // Monday 5 Oct
    expect(proc.listRequests.mock.calls[0][0]).toMatchObject({
      neededBy: {
        after: new Date("2026-10-08T00:00:00.000Z"), // High runs through Thursday
        through: new Date("2026-10-14T00:00:00.000Z"), // Medium through next Wednesday
      },
    });
    await svc.pendingRequestsCard(now);
    expect(proc.pendingSummary).toHaveBeenCalledWith(new Date("2026-10-08T00:00:00.000Z"));
  });
});

describe("getRequest", () => {
  it("lists only the actions this viewer may take now", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    expect((await svc.getRequest("pr1", fm))?.actions).toEqual(["approve", "reject"]);
    expect((await svc.getRequest("pr1", sc))?.actions).toEqual(["cancel"]);
    expect((await svc.getRequest("pr1", admin))?.actions).toEqual([]);
    expect(await svc.getRequest("pr1", { ...sc, id: "sc2" })).toBeNull();
  });
});

describe("setRequester: leather rolls (D-031)", () => {
  it("allows an active Shoe Constructor leather rolls and audits it", async () => {
    users.findUserById.mockResolvedValue({
      id: "sc1",
      email: "c@cpoint.local",
      role: "SHOE_CONSTRUCTOR",
      isActive: true,
      canRequestLeatherRolls: false,
    });
    await svc.setRequester("sc1", true, fm);
    expect(proc.setCanRequestLeatherRolls).toHaveBeenCalledWith("sc1", true, "tx");
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      action: "procurement.leather_rolls.grant",
      entity: "User",
    });
  });

  it("refuses anyone who isn't an active Shoe Constructor, and a role without the permission", async () => {
    users.findUserById.mockResolvedValueOnce({
      id: "q1",
      role: "QUALITY_INSPECTOR",
      isActive: true,
    });
    await expect(svc.setRequester("q1", true, fm)).rejects.toMatchObject({ status: 409 });
    users.findUserById.mockResolvedValueOnce({
      id: "sc1",
      role: "SHOE_CONSTRUCTOR",
      isActive: false,
    });
    await expect(svc.setRequester("sc1", true, admin)).rejects.toMatchObject({ status: 409 });
    await expect(
      svc.setRequester("sc1", true, { id: "q2", role: "QUALITY_INSPECTOR" }),
    ).rejects.toMatchObject({ status: 403 });
    expect(proc.setCanRequestLeatherRolls).not.toHaveBeenCalled();
  });
});
