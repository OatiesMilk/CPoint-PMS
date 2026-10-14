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
  setLineDecision: vi.fn(
    async (_requestId: string, _lineId: string, _data: Record<string, unknown>, _tx?: unknown) => 1,
  ),
  transitionStatus: vi.fn(
    async (_id: string, _from: string, _data: Record<string, unknown>, _tx?: unknown) => 1,
  ),
  addReceivedQuantity: vi.fn(
    async (_requestId: string, _lineId: string, _seen: number, _delta: number, _tx?: unknown) => 1,
  ),
  insertDelivery: vi.fn(async (_data: Record<string, unknown>, _tx?: unknown) => ({ id: "d1" })),
  insertAttachments: vi.fn(),
  findDelivery: vi.fn(),
  findAttachment: vi.fn(),
};
const inventory = { findInventoryItem: vi.fn(), listRequestableItems: vi.fn() };
const reference = { findSupplier: vi.fn(), listActiveSuppliers: vi.fn() };
const users = { findUserById: vi.fn() };
const storage = {
  put: vi.fn(async (_key: string, _data: Uint8Array) => undefined),
  read: vi.fn(),
  remove: vi.fn(async (_key: string) => undefined),
};
const postMovement = vi.fn(async () => ({ movementId: "m1", onHandAfter: 0 }));
const recordAudit = vi.fn();

vi.mock("@/server/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/server/models/procurement.model", () => proc);
vi.mock("@/server/models/inventory.model", () => inventory);
vi.mock("@/server/models/reference-data.model", () => reference);
vi.mock("@/server/lib/storage", () => ({ getStorage: () => storage }));
vi.mock("@/server/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
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

/** `decisions`: each line's decision, in order (both PENDING unless given). */
function request(overrides: Record<string, unknown> = {}, decisions: string[] = []) {
  return {
    id: "pr1",
    code: "PR-2026-0007",
    status: "PENDING",
    requestedById: "sc1",
    requestedBy: { id: "sc1", name: "Sam", role: "SHOE_CONSTRUCTOR" },
    neededBy: new Date("2026-10-08T00:00:00.000Z"),
    expectedDeliveryOn: null,
    orderedAt: null,
    rejectionReason: null,
    deliveries: [],
    lines: [
      {
        id: "l1",
        itemName: "Shoe nails",
        category: "NAILS",
        unit: "box",
        quantity: "4",
        receivedQuantity: "0",
        note: null,
        decision: decisions[0] ?? "PENDING",
        rejectionReason: null,
        item: { ...nails },
      },
      {
        id: "l2",
        itemName: "Brass eyelets",
        category: "OTHER",
        unit: "pack",
        quantity: "1",
        receivedQuantity: "0",
        note: null,
        decision: decisions[1] ?? "PENDING",
        rejectionReason: null,
        item: null,
      },
    ],
    ...overrides,
  };
}

const SUPPLIER = "0199c0de-0000-7000-8000-000000000001";
const jpeg = () => ({ name: "receipt.jpg", bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]) });
const pdf = () => ({ name: "note.pdf", bytes: new TextEncoder().encode("%PDF-1.4 sample") });

const values = {
  neededBy: "2026-10-08", // a Thursday: 3 working days after `now`
  remarks: "Nails for Friday's topsider batch",
  lines: [{ inventoryItemId: "i1", quantity: 4 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  proc.transitionStatus.mockResolvedValue(1);
  proc.setLineDecision.mockResolvedValue(1);
  proc.addReceivedQuantity.mockResolvedValue(1);
  proc.insertDelivery.mockResolvedValue({ id: "d1" });
  storage.put.mockResolvedValue(undefined);
  inventory.findInventoryItem.mockResolvedValue(nails);
  reference.findSupplier.mockResolvedValue({
    id: SUPPLIER,
    name: "Marikina Leather",
    isActive: true,
  });
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

  it("refuses roles that can't request, even with the flag", async () => {
    await expect(
      svc.createRequest(values, { ...admin, canRequestLeatherRolls: true }, now),
    ).rejects.toMatchObject({
      status: 403,
      message: expect.stringContaining("Shoe Constructors and the Floor Manager"),
    });
  });

  it("lets the Floor Manager raise a request, leather rolls included, with no flag (D-045)", async () => {
    const typed = {
      ...values,
      lines: [
        { itemName: "Tan cowhide", category: "LEATHER_ROLL" as const, unit: "roll", quantity: 1 },
      ],
    };
    await expect(svc.createRequest(typed, fm, now)).resolves.toMatchObject({ id: "pr1" });
    expect(proc.insertRequest.mock.calls[0][0]).toMatchObject({ requestedById: "fm1" });
  });

  it("copies only the requester's own rejected or cancelled request (D-044)", async () => {
    const source = "0199c0de-0000-7000-8000-0000000000aa";
    proc.findRequestDetail.mockResolvedValue(
      request({ id: source, code: "PR-2026-0003", status: "REJECTED" }),
    );
    await expect(
      svc.createRequest({ ...values, copiedFromId: source }, sc, now),
    ).resolves.toMatchObject({ id: "pr1" });
    expect(proc.insertRequest.mock.calls[0][0]).toMatchObject({ copiedFromId: source });
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({ note: "Copied from PR-2026-0003." });
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      after: { copiedFrom: "PR-2026-0003" },
    });

    proc.insertRequest.mockClear();
    // Someone else's, or one that's still open: refused, and nothing is created.
    for (const [actor, status] of [
      [{ ...sc, id: "sc2" }, "REJECTED"],
      [sc, "APPROVED"],
      [fm, "CANCELLED"],
    ] as const) {
      proc.findRequestDetail.mockResolvedValue(request({ id: source, status }));
      await expect(
        svc.createRequest({ ...values, copiedFromId: source }, actor, now),
      ).rejects.toMatchObject({ status: 409 });
    }
    expect(proc.insertRequest).not.toHaveBeenCalled();
  });

  it("offers a copy's items with the reasons for the rejected ones", async () => {
    proc.findRequestDetail.mockResolvedValue(
      request({ status: "APPROVED" }, ["REJECTED", "APPROVED"]),
    );
    expect(await svc.getCopySource("pr1", sc)).toBeNull(); // not rejected or cancelled
    const row = request({ status: "REJECTED", rejectionReason: "Enough on the shelf" }, [
      "REJECTED",
      "REJECTED",
    ]);
    row.lines[0].rejectionReason = "Still 3 boxes" as never;
    proc.findRequestDetail.mockResolvedValue(row);
    expect(await svc.getCopySource("pr1", sc)).toMatchObject({
      code: "PR-2026-0007",
      lines: [
        {
          inventoryItemId: "i1",
          itemName: "Shoe nails",
          quantity: 4,
          rejectionReason: "Still 3 boxes",
        },
        {
          inventoryItemId: null,
          itemName: "Brass eyelets",
          rejectionReason: "Enough on the shelf",
        },
      ],
    });
    expect(await svc.getCopySource("pr1", { ...sc, id: "sc2" })).toBeNull();
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
      {
        status: "APPROVED",
        decidedById: "fm1",
        decidedAt: now,
        approvalNote: "Order today",
        rejectionReason: null,
      },
      "tx",
    );
    // Approving the request approves every item on it (D-039).
    expect(proc.setLineDecision.mock.calls.map((c) => [c[1], c[2].decision])).toEqual([
      ["l1", "APPROVED"],
      ["l2", "APPROVED"],
    ]);
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      fromStatus: "PENDING",
      toStatus: "APPROVED",
      note: "Approved: Shoe nails, Brass eyelets.\nOrder today",
    });
    expect(recordAudit.mock.calls[0][1]).toMatchObject({ action: "procurement.request.approve" });
  });

  it("records the rejection reason on the request and on every item", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    const result = await svc.actOnRequest(
      "pr1",
      { action: "reject", reason: "We have 3 boxes in the back" },
      fm,
      now,
    );
    expect(result).toMatchObject({ status: "REJECTED", message: "PR-2026-0007 rejected." });
    expect(proc.transitionStatus.mock.calls[0][2]).toMatchObject({
      status: "REJECTED",
      rejectionReason: "We have 3 boxes in the back",
    });
    expect(proc.setLineDecision.mock.calls.map((c) => c[2])).toEqual([
      expect.objectContaining({
        decision: "REJECTED",
        rejectionReason: "We have 3 boxes in the back",
      }),
      expect.objectContaining({
        decision: "REJECTED",
        rejectionReason: "We have 3 boxes in the back",
      }),
    ]);
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      toStatus: "REJECTED",
      note: "Rejected: Shoe nails, Brass eyelets. We have 3 boxes in the back",
    });
    expect(recordAudit.mock.calls[0][1]).toMatchObject({ action: "procurement.request.reject" });
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

  it("needs a reason from the Floor Manager to cancel after approval, while nothing has arrived (D-043)", async () => {
    for (const status of ["APPROVED", "ORDERED"]) {
      proc.findRequestDetail.mockResolvedValue(request({ status }, ["APPROVED", "APPROVED"]));
      // The requester can no longer cancel it.
      await expect(svc.actOnRequest("pr1", { action: "cancel" }, sc, now)).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining("after it's approved"),
      });
      await expect(svc.actOnRequest("pr1", { action: "cancel" }, fm, now)).rejects.toMatchObject({
        status: 422,
        details: [{ path: ["reason"], message: expect.stringContaining("at least 3 characters") }],
      });
      expect(proc.transitionStatus).not.toHaveBeenCalled();
      await expect(
        svc.actOnRequest("pr1", { action: "cancel", reason: "Supplier can't deliver" }, fm, now),
      ).resolves.toMatchObject({ status: "CANCELLED" });
      expect(proc.transitionStatus).toHaveBeenLastCalledWith(
        "pr1",
        status,
        { status: "CANCELLED", cancelReason: "Supplier can't deliver" },
        "tx",
      );
      expect(proc.insertEvent.mock.calls.at(-1)?.[0]).toMatchObject({
        fromStatus: status,
        toStatus: "CANCELLED",
        note: "Supplier can't deliver",
      });
      vi.clearAllMocks();
      proc.transitionStatus.mockResolvedValue(1);
    }
    // Once part of it is here, the only way out is closing short, and the refusal says so.
    proc.findRequestDetail.mockResolvedValue(
      request({ status: "PARTIALLY_RECEIVED" }, ["APPROVED", "APPROVED"]),
    );
    await expect(
      svc.actOnRequest("pr1", { action: "cancel", reason: "No longer needed" }, fm, now),
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining("Use Close short") });
  });
});

describe("ordering (D-041)", () => {
  const order = { supplierId: SUPPLIER, reference: "PO-1042", expectedDeliveryOn: "2026-10-09" };

  it("marks an approved request as ordered, with the supplier, reference and expected date", async () => {
    proc.findRequestDetail.mockResolvedValue(
      request({ status: "APPROVED" }, ["APPROVED", "REJECTED"]),
    );
    const result = await svc.orderRequest("pr1", { ...order, note: "Half paid" }, fm, now);
    expect(result).toMatchObject({
      status: "ORDERED",
      message: "PR-2026-0007 marked as ordered from Marikina Leather.",
    });
    expect(proc.transitionStatus).toHaveBeenCalledWith(
      "pr1",
      "APPROVED",
      {
        status: "ORDERED",
        supplierId: SUPPLIER,
        orderReference: "PO-1042",
        expectedDeliveryOn: new Date("2026-10-09T00:00:00.000Z"),
        orderNote: "Half paid",
        orderedById: "fm1",
        orderedAt: now,
      },
      "tx",
    );
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      fromStatus: "APPROVED",
      toStatus: "ORDERED",
      note: "Ordered from Marikina Leather, reference PO-1042. Expected Oct 9, 2026.\nHalf paid",
    });
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      action: "procurement.request.order",
      after: { supplier: "Marikina Leather", expectedDeliveryOn: "2026-10-09" },
    });
  });

  it("refuses a past date, a date too far ahead and an inactive supplier, each on its field", async () => {
    proc.findRequestDetail.mockResolvedValue(
      request({ status: "APPROVED" }, ["APPROVED", "APPROVED"]),
    );
    await expect(
      svc.orderRequest("pr1", { ...order, expectedDeliveryOn: "2026-10-04" }, fm, now),
    ).rejects.toMatchObject({
      details: [{ path: ["expectedDeliveryOn"], message: expect.stringContaining("in the past") }],
    });
    await expect(
      svc.orderRequest("pr1", { ...order, expectedDeliveryOn: "2027-10-06" }, fm, now),
    ).rejects.toMatchObject({
      details: [{ path: ["expectedDeliveryOn"], message: expect.stringContaining("365 days") }],
    });
    reference.findSupplier.mockResolvedValue({ id: SUPPLIER, name: "Old", isActive: false });
    await expect(svc.orderRequest("pr1", order, fm, now)).rejects.toMatchObject({
      details: [
        { path: ["supplierId"], message: expect.stringContaining("no longer in the list") },
      ],
    });
    expect(proc.transitionStatus).not.toHaveBeenCalled();
  });

  it("only orders an approved request, only for the Floor Manager, and answers STALE", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    await expect(svc.orderRequest("pr1", order, fm, now)).rejects.toMatchObject({
      status: 409,
      message: "Only an approved request can be marked as ordered. This one is pending.",
    });
    proc.findRequestDetail.mockResolvedValue(
      request({ status: "APPROVED" }, ["APPROVED", "APPROVED"]),
    );
    await expect(svc.orderRequest("pr1", order, sc, now)).rejects.toMatchObject({ status: 403 });
    proc.transitionStatus.mockResolvedValue(0);
    await expect(svc.orderRequest("pr1", order, fm, now)).rejects.toMatchObject({ code: "STALE" });
    expect(proc.insertEvent).not.toHaveBeenCalled();
  });
});

describe("deliveries and proof (D-042)", () => {
  const ordered = (received = ["0", "0"], overrides: Record<string, unknown> = {}) => {
    const row = request(
      { status: "ORDERED", orderedAt: new Date("2026-10-02T02:00:00.000Z"), ...overrides },
      ["APPROVED", "APPROVED"],
    );
    row.lines.forEach((line, i) => (line.receivedQuantity = received[i]));
    return row;
  };
  const input = (first: number, second: number, extra: Record<string, unknown> = {}) => ({
    deliveredOn: "2026-10-05",
    lines: [
      { lineId: "l1", quantity: first },
      { lineId: "l2", quantity: second },
    ],
    ...extra,
  });

  it("a full delivery posts stock IN for inventory items, stores the proof and ends as received", async () => {
    proc.findRequestDetail.mockResolvedValue(ordered());
    const result = await svc.recordDelivery("pr1", input(4, 1), [jpeg(), pdf()], fm, now, storage);
    expect(result).toMatchObject({
      status: "RECEIVED",
      message: "PR-2026-0007 received in full. Stock updated.",
    });
    expect(proc.transitionStatus).toHaveBeenCalledWith(
      "pr1",
      "ORDERED",
      { status: "RECEIVED", receivedAt: now },
      "tx",
    );
    // Only the inventory item goes into stock; the typed one is recorded without a movement.
    expect(postMovement).toHaveBeenCalledTimes(1);
    expect(postMovement).toHaveBeenCalledWith(
      "tx",
      expect.objectContaining({ id: "i1", quantityOnHand: 2 }),
      { type: "IN", delta: 4, reason: "Delivery for PR-2026-0007" },
      fm,
      now,
    );
    const delivery = proc.insertDelivery.mock.calls[0][0] as {
      lines: unknown[];
      attachments: { storageKey: string; mime: string; originalName: string; size: number }[];
    };
    expect(delivery).toMatchObject({
      requestId: "pr1",
      deliveredOn: new Date("2026-10-05T00:00:00.000Z"),
      recordedById: "fm1",
      lines: [
        { lineId: "l1", quantity: 4, movementId: "m1" },
        { lineId: "l2", quantity: 1, movementId: null },
      ],
    });
    // Keys are generated by the server; the type comes from the bytes.
    expect(delivery.attachments.map((a) => a.mime)).toEqual(["image/jpeg", "application/pdf"]);
    expect(delivery.attachments[0].storageKey).toMatch(/^pod\/2026\/10\/[0-9a-f-]{36}\.jpg$/);
    expect(delivery.attachments[1].storageKey).toMatch(/\.pdf$/);
    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      fromStatus: "ORDERED",
      toStatus: "RECEIVED",
      deliveryId: "d1",
      note: "Arrived: 4 boxes of Shoe nails, 1 pack of Brass eyelets.\nNot in inventory, so not added to stock: Brass eyelets.",
    });
    expect(recordAudit.mock.calls.at(-1)?.[1]).toMatchObject({
      action: "procurement.delivery.record",
      after: { status: "RECEIVED", proofFiles: ["receipt.jpg", "note.pdf"] },
    });
  });

  it("a short delivery leaves the request partly received, and the next one adds up", async () => {
    proc.findRequestDetail.mockResolvedValue(ordered());
    const first = await svc.recordDelivery(
      "pr1",
      input(1.5, 0, { note: "Rest on Friday" }),
      [jpeg()],
      fm,
      now,
      storage,
    );
    expect(first).toMatchObject({
      status: "PARTIALLY_RECEIVED",
      message:
        "Delivery recorded for PR-2026-0007. Still to come: 2.5 boxes of Shoe nails, 1 pack of Brass eyelets.",
    });
    expect(proc.transitionStatus).toHaveBeenCalledWith(
      "pr1",
      "ORDERED",
      { status: "PARTIALLY_RECEIVED" },
      "tx",
    );
    // Every approved item is checked against what was seen, also the one nothing arrived of.
    expect(proc.addReceivedQuantity.mock.calls.map((c) => c.slice(0, 4))).toEqual([
      ["pr1", "l1", 0, 1.5],
      ["pr1", "l2", 0, 0],
    ]);
    expect(proc.insertDelivery.mock.calls[0][0]).toMatchObject({
      note: "Rest on Friday",
      lines: [{ lineId: "l1", quantity: 1.5, movementId: "m1" }],
    });

    vi.clearAllMocks();
    proc.transitionStatus.mockResolvedValue(1);
    proc.addReceivedQuantity.mockResolvedValue(1);
    proc.insertDelivery.mockResolvedValue({ id: "d2" });
    proc.findRequestDetail.mockResolvedValue(
      ordered(["1.5", "0"], { status: "PARTIALLY_RECEIVED" }),
    );
    const second = await svc.recordDelivery("pr1", input(2.5, 1), [jpeg()], fm, now, storage);
    expect(second.status).toBe("RECEIVED");
    expect(proc.addReceivedQuantity.mock.calls[0].slice(0, 4)).toEqual(["pr1", "l1", 1.5, 2.5]);
  });

  it("refuses more than what is outstanding, in the item's own words", async () => {
    proc.findRequestDetail.mockResolvedValue(
      ordered(["1.5", "1"], { status: "PARTIALLY_RECEIVED" }),
    );
    await expect(
      svc.recordDelivery("pr1", input(2.51, 1), [jpeg()], fm, now, storage),
    ).rejects.toMatchObject({
      status: 422,
      details: [
        {
          path: ["lines", 0, "quantity"],
          message: "Received quantity can't be more than the 2.5 boxes still outstanding.",
        },
        {
          path: ["lines", 1, "quantity"],
          message: "All of Brass eyelets has already arrived. Enter 0 for it.",
        },
      ],
    });
    expect(storage.put).not.toHaveBeenCalled();
    expect(proc.transitionStatus).not.toHaveBeenCalled();
  });

  it("needs a quantity for every approved item, at least one above zero, and a sensible date", async () => {
    proc.findRequestDetail.mockResolvedValue(ordered());
    await expect(
      svc.recordDelivery("pr1", input(0, 0), [jpeg()], fm, now, storage),
    ).rejects.toMatchObject({
      details: [{ path: ["lines"], message: expect.stringContaining("at least one item") }],
    });
    await expect(
      svc.recordDelivery(
        "pr1",
        { deliveredOn: "2026-10-05", lines: [{ lineId: "l1", quantity: 1 }] },
        [jpeg()],
        fm,
        now,
        storage,
      ),
    ).rejects.toMatchObject({
      details: [
        { path: ["lines", 1, "quantity"], message: expect.stringContaining("Brass eyelets") },
      ],
    });
    await expect(
      svc.recordDelivery(
        "pr1",
        {
          deliveredOn: "2026-10-05",
          lines: [
            { lineId: "l1", quantity: 1 },
            { lineId: "0199c0de-0000-7000-8000-00000000ffff", quantity: 1 },
          ],
        },
        [jpeg()],
        fm,
        now,
        storage,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      svc.recordDelivery(
        "pr1",
        input(1, 0, { deliveredOn: "2026-10-06" }),
        [jpeg()],
        fm,
        now,
        storage,
      ),
    ).rejects.toMatchObject({
      details: [{ path: ["deliveredOn"], message: expect.stringContaining("in the future") }],
    });
    await expect(
      svc.recordDelivery(
        "pr1",
        input(1, 0, { deliveredOn: "2026-10-01" }),
        [jpeg()],
        fm,
        now,
        storage,
      ),
    ).rejects.toMatchObject({
      details: [
        {
          path: ["deliveredOn"],
          message: expect.stringContaining("before the order was placed (Oct 2, 2026)"),
        },
      ],
    });
    expect(proc.transitionStatus).not.toHaveBeenCalled();
  });

  it("needs proof: at least one file, at most five, each a real photo or PDF within 10 MB", async () => {
    proc.findRequestDetail.mockResolvedValue(ordered());
    const attempt = (files: { name: string; bytes: Uint8Array }[]) =>
      svc.recordDelivery("pr1", input(4, 1), files, fm, now, storage);
    await expect(attempt([])).rejects.toMatchObject({
      details: [
        { path: ["files"], message: expect.stringContaining("can't be recorded without proof") },
      ],
    });
    await expect(attempt(Array.from({ length: 6 }, jpeg))).rejects.toMatchObject({
      details: [
        { path: ["files"], message: "Attach at most 5 files here. Remove 1 and try again." },
      ],
    });
    // A renamed program is refused by its bytes, whatever it is called.
    const exe = { name: "receipt.pdf", bytes: new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]) };
    await expect(attempt([jpeg(), exe])).rejects.toMatchObject({
      details: [
        {
          path: ["files"],
          message: "“receipt.pdf” isn't a photo or a PDF. Attach a JPEG, PNG, WebP or PDF file.",
        },
      ],
    });
    const huge = new Uint8Array(10 * 1024 * 1024 + 1);
    huge.set([0xff, 0xd8, 0xff]);
    await expect(attempt([{ name: "big.jpg", bytes: huge }])).rejects.toMatchObject({
      details: [
        { path: ["files"], message: expect.stringContaining("“big.jpg” is larger than 10 MB") },
      ],
    });
    expect(storage.put).not.toHaveBeenCalled();
    expect(proc.transitionStatus).not.toHaveBeenCalled();
  });

  it("removes the stored files again when the delivery can't be saved", async () => {
    proc.findRequestDetail.mockResolvedValue(ordered());
    proc.addReceivedQuantity.mockResolvedValueOnce(0); // someone else recorded a delivery first
    await expect(
      svc.recordDelivery("pr1", input(4, 1), [jpeg(), pdf()], fm, now, storage),
    ).rejects.toMatchObject({ code: "STALE" });
    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(storage.remove.mock.calls.map((c) => c[0])).toEqual(
      storage.put.mock.calls.map((c) => c[0]),
    );
    expect(proc.insertDelivery).not.toHaveBeenCalled();
  });

  it("is the Floor Manager's only, and needs the order first", async () => {
    proc.findRequestDetail.mockResolvedValue(ordered());
    await expect(
      svc.recordDelivery("pr1", input(4, 1), [jpeg()], sc, now, storage),
    ).rejects.toMatchObject({ status: 403 });
    proc.findRequestDetail.mockResolvedValue(
      request({ status: "APPROVED" }, ["APPROVED", "APPROVED"]),
    );
    await expect(
      svc.recordDelivery("pr1", input(4, 1), [jpeg()], fm, now, storage),
    ).rejects.toMatchObject({
      status: 409,
      message: "Mark this request as ordered first, then record the delivery.",
    });
  });

  it("closes a partly received request short, with a reason and what never arrived", async () => {
    proc.findRequestDetail.mockResolvedValue(
      ordered(["1.5", "1"], { status: "PARTIALLY_RECEIVED" }),
    );
    const result = await svc.closeShort("pr1", "Supplier is out of stock", fm, now);
    expect(result).toMatchObject({ status: "RECEIVED", message: "PR-2026-0007 closed short." });
    expect(proc.transitionStatus).toHaveBeenCalledWith(
      "pr1",
      "PARTIALLY_RECEIVED",
      {
        status: "RECEIVED",
        receivedAt: now,
        closedShortAt: now,
        closedShortReason: "Supplier is out of stock",
      },
      "tx",
    );
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      note: "Closed short: Supplier is out of stock\nNever arrived: 2.5 boxes of Shoe nails.",
    });
    expect(postMovement).not.toHaveBeenCalled();

    proc.findRequestDetail.mockResolvedValue(ordered());
    await expect(svc.closeShort("pr1", "No longer coming", fm, now)).rejects.toMatchObject({
      status: 409,
      message: "Only a partly received request can be closed short. This one is ordered.",
    });
    proc.findRequestDetail.mockResolvedValue(ordered(["1", "0"], { status: "PARTIALLY_RECEIVED" }));
    await expect(svc.closeShort("pr1", "No longer coming", sc, now)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("adds proof to a recorded delivery, never past its limit, and only for the Floor Manager", async () => {
    const delivery = (attachments: number) => ({
      id: "d1",
      _count: { attachments },
      request: { id: "pr1", code: "PR-2026-0007", requestedById: "sc1", status: "RECEIVED" },
    });
    proc.findDelivery.mockResolvedValue(delivery(1));
    const result = await svc.addDeliveryProof("d1", [pdf()], fm, now, storage);
    expect(result).toMatchObject({ added: 1, message: "1 proof file added to PR-2026-0007." });
    expect(proc.insertAttachments).toHaveBeenCalledWith(
      "d1",
      "fm1",
      [expect.objectContaining({ mime: "application/pdf", originalName: "note.pdf" })],
      now,
      "tx",
    );
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      fromStatus: "RECEIVED",
      toStatus: "RECEIVED",
      deliveryId: "d1",
      note: "Added proof of delivery: note.pdf.",
    });
    await expect(svc.addDeliveryProof("d1", [pdf()], sc, now, storage)).rejects.toMatchObject({
      status: 403,
    });
    proc.findDelivery.mockResolvedValue(delivery(10));
    await expect(svc.addDeliveryProof("d1", [pdf()], fm, now, storage)).rejects.toMatchObject({
      status: 409,
    });
    proc.findDelivery.mockResolvedValue(null);
    await expect(svc.addDeliveryProof("d1", [pdf()], fm, now, storage)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("serves a proof file to the Floor Manager, the Admin and the requester only", async () => {
    proc.findAttachment.mockResolvedValue({
      id: "a1",
      storageKey: "pod/2026/10/x.jpg",
      mime: "image/jpeg",
      originalName: "receipt.jpg",
      delivery: { request: { id: "pr1", requestedById: "sc1" } },
    });
    for (const viewer of [fm, admin, sc])
      expect(await svc.getProofFile("a1", viewer)).toEqual({
        storageKey: "pod/2026/10/x.jpg",
        mime: "image/jpeg",
        originalName: "receipt.jpg",
      });
    expect(await svc.getProofFile("a1", { ...sc, id: "sc2" })).toBeNull();
    proc.findAttachment.mockResolvedValue(null);
    expect(await svc.getProofFile("a1", fm)).toBeNull();
  });
});

describe("item decisions (D-039)", () => {
  const mixed = {
    note: "Nails are fine for now",
    lines: [
      { lineId: "l1", decision: "REJECTED" as const, reason: "Stock is still high" },
      { lineId: "l2", decision: "APPROVED" as const },
    ],
  };

  it("approves some items and rejects others in one transaction; the request is approved", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    const result = await svc.decideRequest("pr1", mixed, fm, now);
    expect(result).toMatchObject({
      status: "APPROVED",
      message: "PR-2026-0007 decided: 1 of 2 items approved.",
    });
    expect(proc.transitionStatus).toHaveBeenCalledWith(
      "pr1",
      "PENDING",
      {
        status: "APPROVED",
        decidedById: "fm1",
        decidedAt: now,
        approvalNote: "Nails are fine for now",
        rejectionReason: null,
      },
      "tx",
    );
    expect(proc.setLineDecision.mock.calls).toEqual([
      [
        "pr1",
        "l1",
        {
          decision: "REJECTED",
          rejectionReason: "Stock is still high",
          decidedById: "fm1",
          decidedAt: now,
        },
        "tx",
      ],
      [
        "pr1",
        "l2",
        { decision: "APPROVED", rejectionReason: null, decidedById: "fm1", decidedAt: now },
        "tx",
      ],
    ]);
    // One timeline event that lists the items, and one audit row with every decision.
    expect(proc.insertEvent).toHaveBeenCalledTimes(1);
    expect(proc.insertEvent.mock.calls[0][0]).toMatchObject({
      fromStatus: "PENDING",
      toStatus: "APPROVED",
      note: "Approved: Brass eyelets.\nRejected: Shoe nails. Stock is still high\nNails are fine for now",
    });
    expect(recordAudit.mock.calls[0][1]).toMatchObject({
      action: "procurement.request.decide",
      after: {
        status: "APPROVED",
        lines: [
          { item: "Shoe nails", decision: "REJECTED", reason: "Stock is still high" },
          { item: "Brass eyelets", decision: "APPROVED" },
        ],
      },
    });
  });

  it("rejects the request when every item is rejected, keeping each item's own reason", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    const result = await svc.decideRequest(
      "pr1",
      {
        lines: [
          { lineId: "l1", decision: "REJECTED", reason: "Stock is still high" },
          { lineId: "l2", decision: "REJECTED", reason: "Not needed this month" },
        ],
      },
      fm,
      now,
    );
    expect(result).toMatchObject({ status: "REJECTED", message: "PR-2026-0007 rejected." });
    // Two different reasons: none of them is the request's reason.
    expect(proc.transitionStatus.mock.calls[0][2]).toMatchObject({
      status: "REJECTED",
      rejectionReason: null,
    });
    expect(proc.insertEvent.mock.calls[0][0].note).toBe(
      "Rejected: Shoe nails. Stock is still high\nRejected: Brass eyelets. Not needed this month",
    );
  });

  it("needs a decision on every item and a reason for each rejection, naming the item", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    await expect(
      svc.decideRequest("pr1", { lines: [{ lineId: "l1", decision: "APPROVED" }] }, fm, now),
    ).rejects.toMatchObject({
      status: 422,
      message: "Choose Approve or Reject for Brass eyelets.",
      details: [{ path: ["lines", 1, "decision"] }],
    });
    await expect(
      svc.decideRequest(
        "pr1",
        {
          lines: [
            { lineId: "l1", decision: "REJECTED", reason: " x " },
            { lineId: "l2", decision: "APPROVED" },
          ],
        },
        fm,
        now,
      ),
    ).rejects.toMatchObject({
      status: 422,
      message:
        "Enter a reason of at least 3 characters for rejecting Shoe nails, so the requester knows why.",
      details: [{ path: ["lines", 0, "reason"] }],
    });
    expect(proc.transitionStatus).not.toHaveBeenCalled();
    expect(proc.setLineDecision).not.toHaveBeenCalled();
  });

  it("refuses an item that isn't on the request, and the same item twice", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    await expect(
      svc.decideRequest(
        "pr1",
        {
          lines: [
            { lineId: "l1", decision: "APPROVED" },
            { lineId: "l2", decision: "APPROVED" },
            { lineId: "l9", decision: "APPROVED" },
          ],
        },
        fm,
        now,
      ),
    ).rejects.toMatchObject({ status: 422, details: [{ path: ["lines", 2, "lineId"] }] });
    await expect(
      svc.decideRequest(
        "pr1",
        {
          lines: [
            { lineId: "l1", decision: "APPROVED" },
            { lineId: "l1", decision: "REJECTED", reason: "Twice" },
          ],
        },
        fm,
        now,
      ),
    ).rejects.toMatchObject({ status: 422 });
    expect(proc.transitionStatus).not.toHaveBeenCalled();
  });

  it("answers STALE when someone else decided first, on the request or on an item", async () => {
    proc.findRequestDetail.mockResolvedValue(request());
    proc.transitionStatus.mockResolvedValueOnce(0);
    await expect(svc.decideRequest("pr1", mixed, fm, now)).rejects.toMatchObject({
      status: 409,
      code: "STALE",
    });
    expect(proc.setLineDecision).not.toHaveBeenCalled();
    proc.setLineDecision.mockResolvedValueOnce(0);
    await expect(svc.decideRequest("pr1", mixed, fm, now)).rejects.toMatchObject({
      status: 409,
      code: "STALE",
    });
    expect(proc.insertEvent).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("only decides a pending request, and only for the Floor Manager", async () => {
    proc.findRequestDetail.mockResolvedValue(
      request({ status: "APPROVED" }, ["APPROVED", "APPROVED"]),
    );
    await expect(svc.decideRequest("pr1", mixed, fm, now)).rejects.toMatchObject({
      status: 409,
      message: "Only a pending request can be decided. This one is approved.",
    });
    proc.findRequestDetail.mockResolvedValue(request());
    await expect(svc.decideRequest("pr1", mixed, admin, now)).rejects.toMatchObject({
      status: 403,
    });
    await expect(svc.decideRequest("pr1", mixed, sc, now)).rejects.toMatchObject({ status: 403 });
    await expect(svc.decideRequest("pr1", mixed, { ...sc, id: "sc2" }, now)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("reads back each item's decision, the stock guidance and the summary", async () => {
    // 11 boxes on hand against a reorder level of 5: more than twice, so still well stocked.
    const stocked = request();
    stocked.lines[0].item = { ...nails, quantityOnHand: "11" };
    proc.findRequestDetail.mockResolvedValue(stocked);
    const pending = await svc.getRequest("pr1", fm, now);
    expect(pending?.decided).toBeNull();
    expect(pending?.lines[0]).toMatchObject({
      wellStocked: true,
      suggestedDecision: "REJECTED",
      suggestedReason: "Stock is still high (11 boxes on hand, reorder at 5).",
    });
    // A typed item has no stock to compare: nothing is suggested.
    expect(pending?.lines[1]).toMatchObject({
      wellStocked: false,
      suggestedDecision: null,
      suggestedReason: null,
    });
    // Low stock (2 on hand, reorder at 5) suggests Approve.
    proc.findRequestDetail.mockResolvedValue(request());
    expect((await svc.getRequest("pr1", fm, now))?.lines[0]).toMatchObject({
      wellStocked: false,
      suggestedDecision: "APPROVED",
    });

    proc.findRequestDetail.mockResolvedValue(
      request({ status: "APPROVED" }, ["REJECTED", "APPROVED"]),
    );
    expect((await svc.getRequest("pr1", sc, now))?.decided).toMatchObject({
      approved: 1,
      rejected: 1,
      label: "1 of 2 items approved",
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
    // High through Thursday; "late" means expected before today, Monday 5 Oct.
    expect(proc.pendingSummary).toHaveBeenCalledWith(
      new Date("2026-10-08T00:00:00.000Z"),
      new Date("2026-10-05T00:00:00.000Z"),
    );
    await svc.listRequests({ late: "1" }, fm, now);
    expect(proc.listRequests.mock.calls[1][0]).toMatchObject({
      lateBefore: new Date("2026-10-05T00:00:00.000Z"),
    });
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

  it("offers the next step for each status, and says why a cancel is blocked", async () => {
    const at = async (status: string, viewer: typeof fm | typeof sc = fm) => {
      proc.findRequestDetail.mockResolvedValue(request({ status }, ["APPROVED", "APPROVED"]));
      return svc.getRequest("pr1", viewer, now);
    };
    expect((await at("APPROVED"))?.actions).toEqual(["order", "cancel"]);
    expect((await at("ORDERED"))?.actions).toEqual(["receive", "cancel"]);
    expect((await at("PARTIALLY_RECEIVED"))?.actions).toEqual(["receive", "close_short"]);
    expect((await at("PARTIALLY_RECEIVED"))?.cancelBlocked).toMatch(/Use Close short/);
    expect((await at("ORDERED"))?.cancelBlocked).toBeNull();
    for (const status of ["RECEIVED", "REJECTED", "CANCELLED"])
      expect((await at(status))?.actions).toEqual([]);
    // The requester can't act after approval, but can copy a rejected or cancelled request.
    expect((await at("ORDERED", sc))?.actions).toEqual([]);
    expect((await at("PARTIALLY_RECEIVED", sc))?.cancelBlocked).toBeNull();
    expect(await at("REJECTED", sc)).toMatchObject({ canCopy: true, canAddProof: false });
    expect(await at("REJECTED", fm)).toMatchObject({ canCopy: false, canAddProof: true });
  });

  it("flags a late delivery, a Floor Manager's request and what is still to come", async () => {
    const row = request(
      {
        status: "PARTIALLY_RECEIVED",
        expectedDeliveryOn: new Date("2026-10-02T00:00:00.000Z"),
        requestedBy: { id: "fm1", name: "Maria", role: "FLOOR_MANAGER" },
      },
      ["APPROVED", "REJECTED"],
    );
    row.lines[0].receivedQuantity = "1.5";
    proc.findRequestDetail.mockResolvedValue(row);
    const detail = await svc.getRequest("pr1", fm, now);
    expect(detail).toMatchObject({ late: true, raisedByFloorManager: true });
    expect(detail?.lines.map((l) => [l.receivedQuantity, l.outstanding])).toEqual([
      [1.5, 2.5],
      [0, 0], // a rejected item is never outstanding
    ]);
    // Not late on the expected day itself, nor once everything is here.
    proc.findRequestDetail.mockResolvedValue(
      request({ status: "ORDERED", expectedDeliveryOn: new Date("2026-10-05T00:00:00.000Z") }),
    );
    expect((await svc.getRequest("pr1", fm, now))?.late).toBe(false);
    proc.findRequestDetail.mockResolvedValue(
      request({ status: "RECEIVED", expectedDeliveryOn: new Date("2026-10-02T00:00:00.000Z") }),
    );
    expect((await svc.getRequest("pr1", fm, now))?.late).toBe(false);
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
