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
  setCanRequestMaterials: vi.fn(),
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
const sc = { id: "sc1", role: "SHOE_CONSTRUCTOR" as const, canRequestMaterials: true };
const fm = { id: "fm1", role: "FLOOR_MANAGER" as const, canRequestMaterials: false };
const admin = { id: "ad1", role: "SYSTEM_ADMIN" as const, canRequestMaterials: false };

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
  priority: "NORMAL" as const,
  justification: "Nails for Friday's topsider batch",
  lines: [{ inventoryItemId: "i1", quantity: 4 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  proc.transitionStatus.mockResolvedValue(1);
  inventory.findInventoryItem.mockResolvedValue(nails);
});

describe("createRequest", () => {
  it("refuses a constructor who isn't a designated requester", async () => {
    await expect(
      svc.createRequest(values, { ...sc, canRequestMaterials: false }, now),
    ).rejects.toMatchObject({ status: 403, code: "NOT_A_REQUESTER" });
    expect(proc.insertRequest).not.toHaveBeenCalled();
  });

  it("refuses everyone but a Shoe Constructor, even with the flag", async () => {
    await expect(
      svc.createRequest(values, { ...fm, canRequestMaterials: true }, now),
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
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["neededBy"] }] });
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
  it("allow the Floor Manager anywhere and a designated requester on their own", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    await svc.addRemark("pr1", "Supplier delivers Thursday", fm, now);
    await svc.addRemark("pr1", "Thanks", sc, now);
    expect(proc.insertRemark).toHaveBeenCalledTimes(2);
    await expect(
      svc.addRemark("pr1", "Hi", { ...sc, canRequestMaterials: false }, now),
    ).rejects.toMatchObject({ status: 403 });
    await expect(svc.addRemark("pr1", "Hi", admin, now)).rejects.toMatchObject({ status: 403 });
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

describe("setRequester (D-030)", () => {
  it("designates an active Shoe Constructor and audits it", async () => {
    users.findUserById.mockResolvedValue({
      id: "sc1",
      email: "c@cpoint.local",
      role: "SHOE_CONSTRUCTOR",
      isActive: true,
      canRequestMaterials: false,
    });
    await svc.setRequester("sc1", true, fm);
    expect(proc.setCanRequestMaterials).toHaveBeenCalledWith("sc1", true, "tx");
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      action: "procurement.requester.grant",
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
    expect(proc.setCanRequestMaterials).not.toHaveBeenCalled();
  });
});
