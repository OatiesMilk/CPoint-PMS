import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import {
  daysAhead,
  inspectorApi,
  makeConstructor,
  managerApi,
  sampleJpeg,
  withDb,
} from "./cv-helpers";

// Material requests / procurement (D-029, D-031, D-035 to D-045). Each test gets its own Shoe
// Constructor (makeConstructor).

/**
 * Waits for entrance animations to end. A dialog fades in over 0.2 s, and text measured while it
 * is half transparent reads as low contrast (QA report 2026-10-14 run 3). Spinners and other
 * endless animations are not waited for.
 */
async function animationsSettled(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity))
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

type ContrastData = {
  fgColor?: string;
  bgColor?: string;
  contrastRatio?: number;
  expectedContrastRatio?: string;
  fontSize?: string;
};

/**
 * No serious or critical axe findings (WCAG 2.1 A/AA) on what is on screen now. A contrast
 * finding is printed with what axe measured, so the report says which colours to fix.
 */
async function expectAccessible(page: Page, what: string) {
  await animationsSettled(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const serious = results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes
          .map((n) => {
            const data = n.any.find((check) => check.id === "color-contrast")?.data as
              ContrastData | undefined;
            const measured = data
              ? ` [${data.fgColor} on ${data.bgColor}, ${data.contrastRatio}:1, needs ${data.expectedContrastRatio}, ${data.fontSize}]`
              : "";
            return `${n.target.join(" ")}${measured}`;
          })
          .slice(0, 8)
          .join(" | ")}`,
    );
  expect.soft(serious, `axe on ${what}`).toEqual([]);
}

/** An active supplier to order from: the first one in Settings. */
async function supplier(api: APIRequestContext) {
  const res = await api.get("/api/v1/procurement/suppliers");
  expect(res.status()).toBe(200);
  const [first] = (await res.json()).data as { id: string; name: string }[];
  expect(first, "the reference data seeds at least one supplier").toBeTruthy();
  return first;
}

/** Approves every item of a pending request and marks it as ordered, through the API. */
async function approveAndOrder(
  api: APIRequestContext,
  id: string,
  expectedDeliveryOn = daysAhead(3),
) {
  expect(
    (await api.post(`/api/v1/procurement/requests/${id}/approve`, { data: {} })).status(),
  ).toBe(200);
  const { id: supplierId } = await supplier(api);
  const res = await api.post(`/api/v1/procurement/requests/${id}/order`, {
    data: { supplierId, reference: "E2E-PO", expectedDeliveryOn },
  });
  expect(res.status()).toBe(200);
}

/** A one-page PDF's first bytes: enough for the type check, which reads the bytes, not the name. */
const samplePdf = () => Buffer.from("%PDF-1.4\n% e2e sample delivery note\n%%EOF\n", "latin1");

/** Fills the "Record delivery" dialog's proof field. */
async function attachProof(
  page: Page,
  files: { name: string; mimeType: string; buffer: Buffer }[],
) {
  await page.getByRole("dialog").getByLabel("Proof of delivery").setInputFiles(files);
}

async function signedIn(browser: Browser, email: string, home: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("close", () => void context.close().catch(() => undefined));
  await page.goto("/login");
  await signIn(page, email);
  await expect(page).toHaveURL(home);
  return page;
}

async function createItem(
  api: APIRequestContext,
  openingStock: number,
  category: "OTHER" | "LEATHER_ROLL" = "OTHER",
) {
  const leather = category === "LEATHER_ROLL";
  const sku = `${leather ? "LR" : "OT"}-P${randomBytes(3).toString("hex").toUpperCase()}`;
  const res = await api.post("/api/v1/inventory", {
    data: {
      sku,
      name: `E2E request item ${sku}`,
      category,
      unit: leather ? "roll" : "box",
      reorderLevel: 5,
      openingStock,
    },
  });
  expect(res.status()).toBe(201);
  return { id: (await res.json()).data.id as string, sku, name: `E2E request item ${sku}` };
}

async function onHand(itemId: string): Promise<number> {
  return withDb(async (db) =>
    Number(
      (await db.query(`SELECT "quantityOnHand" q FROM inventory_items WHERE id = $1`, [itemId]))
        .rows[0].q,
    ),
  );
}

/** A request straight through the API, as the given constructor's session. */
async function apiRequest(page: Page, itemId: string, quantity = 2, neededBy = daysAhead(30)) {
  const res = await page.request.post("/api/v1/procurement/requests", {
    data: {
      neededBy,
      remarks: "E2E: running low",
      lines: [{ inventoryItemId: itemId, quantity }],
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).data as { id: string; code: string };
}

test("a constructor asks, the Floor Manager approves and receives, and stock goes up", async ({
  browser,
  page,
}) => {
  // The whole journey (ask, decide, order, deliver with proof) takes 20–25 s on its own and ran
  // past 30 s once with six workers (QA report 2026-10-14 run 5).
  test.setTimeout(60_000);
  const fmApi = await managerApi(browser);
  const item = await createItem(fmApi, 2);
  const sc = await makeConstructor();

  await page.goto("/login");
  await signIn(page, sc.email);
  await expect(page).toHaveURL("/constructor");
  // A constructor's side is "Material requests" everywhere (D-035).
  await expect(page.getByRole("link", { name: "Material requests", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My material requests" })).toBeVisible();
  await page.getByRole("link", { name: "New material request" }).click();
  await expect(page).toHaveURL("/procurement/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("New material request");
  // No priority and no "why it's needed" any more (D-036, D-037).
  await expect(page.getByLabel("Priority")).toHaveCount(0);
  await expect(page.getByLabel("Why it’s needed")).toHaveCount(0);
  await page.locator("#lines-0-item").selectOption(item.id);
  await expect(page.getByText("2 boxes on hand · reorder at 5 boxes")).toBeVisible();
  await page.locator("#lines-0-quantity").fill("3");
  // Needed today: the form says how the Floor Manager will see it before it's sent.
  await page.getByLabel("Needed by").fill(daysAhead(0));
  await expect(page.locator("#neededBy-hint")).toContainText("High");
  await page.getByLabel("Remarks").fill("Half a box left for the topsider batch");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page).toHaveURL(/\/procurement\/[0-9a-f-]{36}$/);
  const url = new URL(page.url()).pathname;
  const code = (await page.locator("h1").textContent())!.trim();
  await expect(page.getByText("Pending", { exact: true }).first()).toBeVisible();
  // The remarks became the request's first remark.
  await expect(page.getByText("Half a box left for the topsider batch")).toBeVisible();
  await expect(page.getByText("Why it’s needed")).toHaveCount(0);
  await page.goto("/procurement");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Material requests");
  await expect(page).toHaveTitle(/Material requests/);

  // The Floor Manager sees "Procurement": pending tab, High urgency; approve with a note; receive.
  const fm = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await expect(fm.getByRole("link", { name: "Procurement", exact: true }).first()).toBeVisible();
  // Filtered to this item: other runs leave requests pending around this one.
  await fm.goto(`/procurement?status=PENDING&item=${item.id}`);
  await expect(fm.getByRole("heading", { level: 1 })).toHaveText("Procurement");
  await expect(fm.getByRole("row", { name: code })).toContainText("High");
  await expect(fm.getByRole("row", { name: code })).toContainText("needed today");
  // The urgency filter: it is in High, and not in Low.
  await fm.getByLabel("Urgency").selectOption("HIGH");
  await expect(fm).toHaveURL(/urgency=HIGH/);
  await expect(fm.getByRole("row", { name: code })).toBeVisible();
  await fm.getByLabel("Urgency").selectOption("LOW");
  await expect(fm).toHaveURL(/urgency=LOW/);
  await expect(fm.getByRole("row", { name: code })).toHaveCount(0);
  await fm.goto(`/inventory?q=${item.sku}`);
  await expect(fm.getByRole("link", { name: `Requested in ${code}` })).toBeVisible();
  await fm.goto(url);
  // 2 boxes on hand against a reorder level of 5: low, so the item starts on Approve (D-040).
  await expect(fm.locator("#line-0-approve")).toBeChecked();
  await fm.getByLabel("Note to the requester").fill("Ordering today");
  await fm.getByRole("button", { name: "Save decisions" }).click();
  await expect(fm.getByText("Approved by", { exact: true })).toBeVisible(); // once saved
  await expect(fm.getByText("Ordering today").first()).toBeVisible();
  // Ordering comes before receiving (D-041): supplier and expected date are required.
  await expect(fm.getByRole("button", { name: "Record delivery…" })).toHaveCount(0);
  await fm.getByRole("button", { name: "Mark as ordered…" }).click();
  const orderDialog = fm.getByRole("dialog");
  await orderDialog.getByRole("button", { name: "Mark as ordered" }).click();
  await expect(orderDialog.getByText("Choose the supplier you ordered from.")).toBeVisible();
  await expect(
    orderDialog.getByText("Choose the date the supplier expects to deliver."),
  ).toBeVisible();
  await expect(orderDialog.getByLabel("Supplier")).toBeFocused();
  await orderDialog.getByLabel("Supplier").selectOption({ index: 1 });
  await orderDialog.getByLabel("Order or reference number").fill("PO-E2E-1");
  await orderDialog.getByLabel("Expected delivery").fill(daysAhead(2));
  await orderDialog.getByRole("button", { name: "Mark as ordered" }).click();
  await expect(orderDialog).toBeHidden();
  await expect(fm.getByTestId("order-card")).toContainText("PO-E2E-1");
  await expect(fm.getByText("Ordered", { exact: true }).first()).toBeVisible();

  // The delivery: the quantity starts at what is outstanding, and proof is required (D-042).
  await fm.getByRole("button", { name: "Record delivery…" }).click();
  const delivery = fm.getByRole("dialog");
  await expect(delivery.getByLabel(item.name)).toHaveValue("3");
  await delivery.getByRole("button", { name: "Record delivery" }).click();
  await expect(
    delivery.getByText(
      "Attach a photo or PDF of the delivery receipt. A delivery can't be recorded without proof.",
    ),
  ).toBeVisible();
  await attachProof(fm, [
    { name: "receipt.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
  ]);
  await delivery.getByRole("button", { name: "Record delivery" }).click();
  await expect(delivery).toBeHidden();
  await expect(fm.getByText("Added to stock", { exact: true })).toBeVisible();
  await expect(fm.getByTestId("deliveries-card").getByRole("img")).toHaveCount(1);
  expect(await onHand(item.id)).toBe(5);

  // The requester sees the outcome and the timeline. A closed request has no urgency badge.
  await page.goto(url);
  await expect(page.locator("header, main").getByText("Received").first()).toBeVisible();
  await expect(page.getByText("Ordering today").first()).toBeVisible();
  await expect(page.getByText("needed today")).toHaveCount(0);
  await fm.close();
});

test("the pending list puts the soonest needed-by date first (D-037)", async ({ browser }) => {
  const fmApi = await managerApi(browser);
  const item = await createItem(fmApi, 1);
  const sc = await makeConstructor();
  const scPage = await signedIn(browser, sc.email, "/constructor");
  // Sent in the "wrong" order: the far-off one first, then the one needed today.
  const low = await apiRequest(scPage, item.id, 1, daysAhead(60));
  const high = await apiRequest(scPage, item.id, 1, daysAhead(0));
  await scPage.close();

  const fm = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await fm.goto(`/procurement?status=PENDING&item=${item.id}`);
  const rows = fm.getByRole("row").filter({ hasText: /MR-\d{4}-\d+/ });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(high.code);
  await expect(rows.nth(0)).toContainText("High");
  await expect(rows.nth(1)).toContainText(low.code);
  await expect(rows.nth(1)).toContainText("Low");
  await fm.close();
});

test("the request form says exactly which field is wrong and how to fix it (D-038)", async ({
  browser,
  page,
}) => {
  const item = await createItem(await managerApi(browser), 1);
  const sc = await makeConstructor();
  await page.goto("/login");
  await signIn(page, sc.email);
  await expect(page).toHaveURL("/constructor");
  await page.goto("/procurement/new");

  // Nothing filled in: each field gets its own message, and focus goes to the first one.
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.locator("#lines-0-item-error")).toHaveText(
    "Choose an item from the list. If it isn't there, pick “Something not in inventory yet”.",
  );
  await expect(page.locator("#lines-0-item")).toBeFocused();
  await expect(page.locator("#lines-0-quantity-error")).toHaveText(
    "Enter a quantity greater than 0.",
  );
  await expect(page.locator("#neededBy-error")).toHaveText(
    "Choose the date you need the items by.",
  );
  await expect(page.locator("#neededBy")).toHaveAttribute("aria-describedby", "neededBy-error");
  await expect(page.locator("#lines-0-quantity")).toHaveAttribute("aria-invalid", "true");
  // Three or more problems: a summary on top links to each field.
  const summary = page.getByTestId("form-error-summary");
  await expect(summary).toContainText("fields need fixing");
  await expect(summary.getByRole("link").first()).toBeVisible();
  await expect(page.getByText("Some fields need fixing.")).toHaveCount(0);

  // One by one, each rule answers in its own words.
  await page.locator("#lines-0-item").selectOption(item.id);
  await page.locator("#lines-0-quantity").fill("0");
  await page.getByLabel("Needed by").fill("2020-01-01");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.locator("#lines-0-quantity-error")).toHaveText(
    "Enter a quantity greater than 0.",
  );
  await expect(page.locator("#neededBy-error")).toHaveText(
    "Needed by can't be in the past. Pick today or a later date.",
  );
  // Two problems left: the summary steps aside, the messages stay under their fields.
  await expect(summary).toHaveCount(0);

  await page.locator("#lines-0-quantity").fill("1.234");
  await page.getByLabel("Needed by").fill(daysAhead(400));
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.locator("#lines-0-quantity-error")).toHaveText(
    "Quantity can have at most 2 decimal places.",
  );
  await expect(page.locator("#neededBy-error")).toHaveText(
    "Needed by can be at most 180 days ahead. Pick an earlier date.",
  );

  // Fixed: it goes through, and nothing typed was lost on the way.
  await page.locator("#lines-0-quantity").fill("1.5");
  await page.getByLabel("Needed by").fill(daysAhead(20));
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page).toHaveURL(/\/procurement\/[0-9a-f-]{36}$/);
});

test("rejecting needs a reason, and the requester sees it", async ({ browser, page }) => {
  const item = await createItem(await managerApi(browser), 1);
  const sc = await makeConstructor();
  const scPage = await signedIn(browser, sc.email, "/constructor");
  const request = await apiRequest(scPage, item.id);

  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto(`/procurement/${request.id}`);
  await page.getByRole("button", { name: "Reject whole request…" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`Reject ${request.code}?`);
  await dialog.getByRole("button", { name: "Reject request" }).click();
  await expect(dialog.locator("#request-reason-error")).toHaveText(
    "Enter a reason of at least 3 characters, so the requester knows why it's rejected.",
  );
  await expect(dialog.getByLabel("Reason")).toBeFocused();
  await dialog.getByLabel("Reason").fill("Three boxes in the back room");
  await dialog.getByRole("button", { name: "Reject request" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Rejected by", { exact: true })).toBeVisible(); // once saved
  await expect(page.getByText("Three boxes in the back room").first()).toBeVisible();

  await scPage.goto(`/procurement/${request.id}`);
  await expect(scPage.getByText("Three boxes in the back room").first()).toBeVisible();
  await scPage.close();
});

test("the Floor Manager decides each item with stock guidance; the requester sees the result per item (D-039, D-040)", async ({
  browser,
  page,
}) => {
  const fmApi = await managerApi(browser);
  // Reorder level 5 for both: 40 on hand is more than twice it, 2 on hand is low.
  const nails = await createItem(fmApi, 40);
  const adhesive = await createItem(fmApi, 2);
  const sc = await makeConstructor();
  const scPage = await signedIn(browser, sc.email, "/constructor");
  const res = await scPage.request.post("/api/v1/procurement/requests", {
    data: {
      neededBy: daysAhead(30),
      lines: [
        { inventoryItemId: nails.id, quantity: 3 },
        { inventoryItemId: adhesive.id, quantity: 4 },
      ],
    },
  });
  expect(res.status()).toBe(201);
  const request = (await res.json()).data as { id: string; code: string };

  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto(`/procurement/${request.id}`);

  // The well-stocked item: badge, stock now and when requested, Reject with the reason filled in.
  const first = page.getByTestId("decision-line-0");
  await expect(first).toContainText(nails.name);
  await expect(first.getByText("Still in stock")).toBeVisible();
  await expect(first).toContainText("On hand 40 boxes · reorder at 5 · was 40 when requested");
  await expect(page.locator("#line-0-reject")).toBeChecked();
  await expect(page.locator("#line-0-reason")).toHaveValue(
    "Stock is still high (40 boxes on hand, reorder at 5).",
  );
  // The low one starts on Approve, with no reason box.
  const second = page.getByTestId("decision-line-1");
  await expect(second).toContainText("On hand 2 boxes · reorder at 5 · was 2 when requested");
  await expect(page.locator("#line-1-approve")).toBeChecked();
  await expect(page.locator("#line-1-reason")).toHaveCount(0);
  // Nothing is decided until it's saved.
  await expect(page.getByText("Pending", { exact: true }).first()).toBeVisible();

  // A rejection needs a reason, and the message names the item.
  await page.locator("#line-0-reason").fill("");
  await page.getByRole("button", { name: "Save decisions" }).click();
  await expect(page.locator("#line-0-reason-error")).toHaveText(
    `Enter a reason of at least 3 characters for rejecting ${nails.name}, so the requester knows why.`,
  );
  await expect(page.locator("#line-0-reason")).toBeFocused();
  await expect(page.locator("#line-0-reason")).toHaveAttribute("aria-invalid", "true");

  // Keep the suggestions: Reject comes back with its reason, then save.
  await page.locator("#line-0-approve").check();
  await page.locator("#line-0-reject").check();
  await expect(page.locator("#line-0-reason")).toHaveValue(
    "Stock is still high (40 boxes on hand, reorder at 5).",
  );
  await page.getByRole("button", { name: "Save decisions" }).click();
  await expect(page.getByText("Decided by", { exact: true })).toBeVisible(); // once saved
  await expect(page.getByText("1 of 2 items approved").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save decisions" })).toHaveCount(0);
  // An item rejected inside an approved request is no longer "requested" in Inventory.
  await page.goto(`/inventory?q=${nails.sku}`);
  await expect(page.getByRole("link", { name: `Requested in ${request.code}` })).toHaveCount(0);
  await page.goto(`/inventory?q=${adhesive.sku}`);
  await expect(page.getByRole("link", { name: `Requested in ${request.code}` })).toBeVisible();

  // The requester: approved overall, 1 of 2, with the reason on the rejected item.
  await scPage.goto(`/procurement/${request.id}`);
  await expect(scPage.getByText("Approved", { exact: true }).first()).toBeVisible();
  await expect(scPage.getByText("1 of 2 items approved").first()).toBeVisible();
  const nailsRow = scPage.getByRole("row", { name: nails.name });
  await expect(nailsRow).toContainText("Rejected");
  await expect(nailsRow).toContainText(
    "Reason: Stock is still high (40 boxes on hand, reorder at 5).",
  );
  await expect(scPage.getByRole("row", { name: adhesive.name })).toContainText("Approved");
  await scPage.goto("/procurement?status=all");
  await expect(scPage.getByRole("row", { name: request.code })).toContainText(
    "1 of 2 items approved",
  );
  await scPage.close();

  // Receiving adds only the approved item to stock.
  await page.goto(`/procurement/${request.id}`);
  await page.getByRole("button", { name: "Mark as ordered…" }).click();
  const orderDialog = page.getByRole("dialog");
  await orderDialog.getByLabel("Supplier").selectOption({ index: 1 });
  await orderDialog.getByLabel("Expected delivery").fill(daysAhead(1));
  await orderDialog.getByRole("button", { name: "Mark as ordered" }).click();
  await expect(orderDialog).toBeHidden();
  await page.getByRole("button", { name: "Record delivery…" }).click();
  const dialog = page.getByRole("dialog");
  // Only the approved item can arrive; the rejected one isn't in the form.
  await expect(dialog.getByLabel(adhesive.name)).toHaveValue("4");
  await expect(dialog).not.toContainText(nails.name);
  await attachProof(page, [
    { name: "receipt.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
  ]);
  await dialog.getByRole("button", { name: "Record delivery" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Added to stock", { exact: true })).toBeVisible();
  expect(await onHand(adhesive.id)).toBe(6);
  expect(await onHand(nails.id)).toBe(40);
});

test("every item needs a decision before saving; Approve all remaining fills the rest (D-039)", async ({
  browser,
  page,
}) => {
  const fmApi = await managerApi(browser);
  // 8 on hand against a reorder level of 5: neither low nor well stocked, so nothing is suggested.
  const item = await createItem(fmApi, 8);
  const sc = await makeConstructor();
  const scPage = await signedIn(browser, sc.email, "/constructor");
  const res = await scPage.request.post("/api/v1/procurement/requests", {
    data: {
      neededBy: daysAhead(30),
      lines: [
        { inventoryItemId: item.id, quantity: 1 },
        { itemName: "E2E brass eyelets", category: "OTHER", unit: "pack", quantity: 2 },
      ],
    },
  });
  expect(res.status()).toBe(201);
  const request = (await res.json()).data as { id: string; code: string };

  // Only the Floor Manager decides: the requester's own API call is refused.
  const refused = await scPage.request.post(`/api/v1/procurement/requests/${request.id}/decide`, {
    data: { lines: [] },
  });
  expect(refused.status()).toBe(403);
  await scPage.close();

  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto(`/procurement/${request.id}`);
  await expect(page.getByTestId("decision-line-1").getByText("Not in inventory")).toBeVisible();
  for (const id of ["#line-0-approve", "#line-0-reject", "#line-1-approve", "#line-1-reject"])
    await expect(page.locator(id)).not.toBeChecked();
  await expect(page.getByText("2 of 2 items still to decide.")).toBeVisible();

  await page.getByRole("button", { name: "Save decisions" }).click();
  await expect(page.locator("#line-0-decision-error")).toHaveText(
    `Choose Approve or Reject for ${item.name}.`,
  );
  await expect(page.locator("#line-1-decision-error")).toHaveText(
    "Choose Approve or Reject for E2E brass eyelets.",
  );
  await expect(page.locator("#line-0-approve")).toBeFocused();

  // Reject one by hand, then let the button approve what's left.
  await page.locator("#line-1-reject").check();
  await page.locator("#line-1-reason").fill("Found a pack in the storage room");
  await page.getByRole("button", { name: "Approve all remaining" }).click();
  await expect(page.locator("#line-0-approve")).toBeChecked();
  await expect(page.locator("#line-1-reject")).toBeChecked();
  await expect(page.getByRole("button", { name: "Approve all remaining" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save decisions" }).click();
  await expect(page.getByText("1 of 2 items approved").first()).toBeVisible();
  await expect(page.getByText("Found a pack in the storage room").first()).toBeVisible();
});

test("the requester cancels their own pending request; others can't", async ({ browser, page }) => {
  const item = await createItem(await managerApi(browser), 1);
  const sc = await makeConstructor();
  await page.goto("/login");
  await signIn(page, sc.email);
  await expect(page).toHaveURL("/constructor");
  const request = await apiRequest(page, item.id);

  // Another constructor can't even see it; the Floor Manager can't cancel it.
  const other = await makeConstructor();
  const otherPage = await signedIn(browser, other.email, "/constructor");
  expect((await otherPage.request.get(`/api/v1/procurement/requests/${request.id}`)).status()).toBe(
    404,
  );
  await otherPage.close();
  const fmApi = await managerApi(browser);
  expect(
    (await fmApi.post(`/api/v1/procurement/requests/${request.id}/cancel`, { data: {} })).status(),
  ).toBe(403);

  await page.goto(`/procurement/${request.id}`);
  await page.getByRole("button", { name: "Cancel request…" }).click();
  await page.getByRole("dialog").getByLabel("Note").fill("Found some in storage");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel request" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Found some in storage").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel request…" })).toHaveCount(0);
});

test("every constructor requests supplies; leather rolls need the Floor Manager's OK, effective on the next request (D-031)", async ({
  browser,
  page,
}) => {
  const fmApi = await managerApi(browser);
  const nails = await createItem(fmApi, 1);
  const roll = await createItem(fmApi, 1, "LEATHER_ROLL");
  const sc = await makeConstructor(false);
  await page.goto("/login");
  await signIn(page, sc.email);
  await expect(page).toHaveURL("/constructor");
  await expect(page.getByRole("link", { name: "New material request" })).toBeVisible();

  const ask = (itemId: string) =>
    page.request.post("/api/v1/procurement/requests", {
      data: {
        neededBy: daysAhead(30),
        lines: [{ inventoryItemId: itemId, quantity: 1 }],
      },
    });

  // Supplies: yes. Leather rolls: no, and the picker greys them out.
  expect((await ask(nails.id)).status()).toBe(201);
  const refused = await ask(roll.id);
  expect(refused.status()).toBe(403);
  expect((await refused.json()).error.code).toBe("LEATHER_ROLLS_NOT_ALLOWED");
  await page.goto("/procurement/new");
  await expect(page.getByText("Leather rolls are greyed out")).toBeVisible();
  await expect(page.locator(`#lines-0-item option[value="${roll.id}"]`)).toBeDisabled();

  // The Floor Manager allows leather rolls: the next request goes through, still signed in.
  const fm = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await fm.goto("/procurement?tab=requesters");
  // Found, not browsed: every run adds constructors, which can push this one past page 1 (D-047).
  await fm.getByLabel("Find a Shoe Constructor").fill(sc.email);
  const row = fm.getByRole("row", { name: new RegExp(sc.email.slice(3, 11)) });
  await row.getByRole("button", { name: "Allow leather rolls" }).click();
  await expect(row.getByText("Can request")).toBeVisible();
  expect((await ask(roll.id)).status()).toBe(201);

  // And stops them again: refused on the next request.
  await row.getByRole("button", { name: "Stop leather rolls" }).click();
  await expect(row.getByText("Can’t request")).toBeVisible();
  await fm.close();
  expect((await ask(roll.id)).status()).toBe(403);
  expect((await ask(nails.id)).status()).toBe(201);
});

test("the Quality Inspector has no procurement access", async ({ browser, page }) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.inspector.email);
  await expect(page).toHaveURL(ACCOUNTS.inspector.home);
  await page.goto("/procurement");
  await expect(page).toHaveURL("/forbidden");
  const api = await inspectorApi(browser);
  expect((await api.get("/api/v1/procurement/requests")).status()).toBe(403);
});

test("order, a short delivery with proof, then close short: only what arrived is in stock (D-041, D-042)", async ({
  browser,
  page,
}) => {
  // Long under a full parallel run (several sign-ins and password hashes): 30 s was too tight.
  test.setTimeout(60_000);
  const fmApi = await managerApi(browser);
  const item = await createItem(fmApi, 1, "LEATHER_ROLL");
  const sc = await makeConstructor(true);
  const scPage = await signedIn(browser, sc.email, "/constructor");
  const request = await apiRequest(scPage, item.id, 6);
  await approveAndOrder(fmApi, request.id);

  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto(`/procurement/${request.id}`);
  await expect(page.getByText("Ordered", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("deliveries-card")).toContainText("Nothing has arrived yet.");
  await expectAccessible(page, "an ordered request");

  // More than what is outstanding is refused under the item, in its own words.
  await page.getByRole("button", { name: "Record delivery…" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(item.name)).toBeVisible();
  await expectAccessible(page, "the Record delivery dialog");
  await dialog.getByLabel(item.name).fill("7");
  // Pick a file, remove it, then pick the real ones: they must stay (QA report 2026-10-13, F1).
  await attachProof(page, [
    { name: "wrong-photo.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
  ]);
  await dialog.getByRole("button", { name: "Remove wrong-photo.jpg" }).click();
  await expect(dialog.getByRole("list", { name: "Files to upload" })).toHaveCount(0);
  await attachProof(page, [
    { name: "receipt.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
    { name: "delivery-note.pdf", mimeType: "application/pdf", buffer: samplePdf() },
  ]);
  await dialog.getByRole("button", { name: "Record delivery" }).click();
  await expect(
    dialog.getByText("Received quantity can't be more than the 6 rolls still outstanding."),
  ).toBeVisible();
  await expect(dialog.getByLabel(item.name)).toBeFocused();
  // The two files are still attached after the refusal.
  await expect(
    dialog.getByRole("list", { name: "Files to upload" }).getByRole("listitem"),
  ).toHaveCount(2);

  // Four of six arrive: partly received, four rolls in stock, both proof files kept.
  await dialog.getByLabel(item.name).fill("4");
  await dialog.locator("#delivery-note").fill("Two rolls short; the rest on Friday");
  await dialog.getByRole("button", { name: "Record delivery" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Partly received", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("row", { name: item.name })).toContainText("2 still to come");
  const deliveries = page.getByTestId("deliveries-card");
  await expect(deliveries).toContainText(`4 rolls of ${item.name}`);
  await expect(deliveries).toContainText("Two rolls short; the rest on Friday");
  await expect(deliveries.getByRole("img")).toHaveCount(1);
  await expect(deliveries.getByRole("link", { name: "delivery-note.pdf" })).toBeVisible();
  expect(await onHand(item.id)).toBe(5);
  await expectAccessible(page, "a partly received request");

  // A proof file is served privately, as the type its bytes say it is.
  const pdfHref = await deliveries
    .getByRole("link", { name: "delivery-note.pdf" })
    .getAttribute("href");
  const served = await page.request.get(pdfHref!);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("application/pdf");
  expect(served.headers()["cache-control"]).toContain("private");
  expect(served.headers()["x-content-type-options"]).toBe("nosniff");
  expect(served.headers()["content-disposition"]).toContain('filename="delivery-note.pdf"');
  // The requester sees their own request's proof; another constructor and the QI don't.
  expect((await scPage.request.get(pdfHref!)).status()).toBe(200);
  const other = await makeConstructor();
  const otherPage = await signedIn(browser, other.email, "/constructor");
  expect((await otherPage.request.get(pdfHref!)).status()).toBe(404);
  await otherPage.close();
  expect((await (await inspectorApi(browser)).get(pdfHref!)).status()).toBe(403);

  // Part of it is here, so it can't be cancelled any more; the page says what to do instead.
  await expect(page.getByRole("button", { name: "Cancel request…" })).toHaveCount(0);
  await expect(
    page.getByText(
      "Part of this request has already arrived, so it can't be cancelled. Use Close short for what won't come.",
    ),
  ).toBeVisible();
  expect(
    (
      await fmApi.post(`/api/v1/procurement/requests/${request.id}/cancel`, {
        data: { reason: "E2E: no longer needed" },
      })
    ).status(),
  ).toBe(409);

  // Close short needs a reason, then the request ends as received with the shortfall on record.
  await page.getByRole("button", { name: "Close short…" }).click();
  const close = page.getByRole("dialog");
  await expect(close).toContainText(`2 rolls of ${item.name}`);
  await close.getByRole("button", { name: "Close short" }).click();
  await expect(
    close.getByText(/Enter a reason of at least 3 characters for closing short/),
  ).toBeVisible();
  await close.getByLabel("Reason").fill("The supplier is out of this hide");
  await close.getByRole("button", { name: "Close short" }).click();
  await expect(close).toBeHidden();
  await expect(page.getByText("Closed short", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("The supplier is out of this hide").first()).toBeVisible();
  await expect(page.getByRole("row", { name: item.name })).toContainText("2 never arrived");
  await expect(page.getByRole("button", { name: "Record delivery…" })).toHaveCount(0);
  expect(await onHand(item.id)).toBe(5);

  // The requester follows all of it, read-only.
  await scPage.goto(`/procurement/${request.id}`);
  await expect(scPage.getByText("Closed short", { exact: true }).first()).toBeVisible();
  await expect(scPage.getByTestId("deliveries-card").getByRole("img")).toHaveCount(1);
  await expect(scPage.getByRole("button", { name: "Add a proof file" })).toHaveCount(0);
  await scPage.close();
});

test("a file that isn't a photo or PDF is refused by its content, and nothing is saved (D-042)", async ({
  browser,
  page,
}) => {
  const fmApi = await managerApi(browser);
  const item = await createItem(fmApi, 1);
  const sc = await makeConstructor();
  const scPage = await signedIn(browser, sc.email, "/constructor");
  const request = await apiRequest(scPage, item.id, 2);
  await scPage.close();
  await approveAndOrder(fmApi, request.id);

  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto(`/procurement/${request.id}`);
  await page.getByRole("button", { name: "Record delivery…" }).click();
  const dialog = page.getByRole("dialog");
  // A program renamed to .pdf: the name and the browser's type both lie; the bytes don't.
  await attachProof(page, [
    {
      name: "receipt.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("MZ\x90\x00 not a pdf"),
    },
  ]);
  await dialog.getByRole("button", { name: "Record delivery" }).click();
  await expect(
    dialog.getByText("“receipt.pdf” isn't a photo or a PDF. Attach a JPEG, PNG, WebP or PDF file."),
  ).toBeVisible();
  expect(await onHand(item.id)).toBe(1);
  await page.reload();
  await expect(page.getByText("Ordered", { exact: true }).first()).toBeVisible();

  // The API refuses a delivery without proof, and one dated in the future.
  const detail = (await (await fmApi.get(`/api/v1/procurement/requests/${request.id}`)).json())
    .data;
  const data = (deliveredOn: string) =>
    JSON.stringify({ deliveredOn, lines: [{ lineId: detail.lines[0].id, quantity: 2 }] });
  const noProof = await fmApi.post(`/api/v1/procurement/requests/${request.id}/deliveries`, {
    multipart: { data: data(daysAhead(0)) },
  });
  expect(noProof.status()).toBe(422);
  expect((await noProof.json()).error.details[0].path).toEqual(["files"]);
  const future = await fmApi.post(`/api/v1/procurement/requests/${request.id}/deliveries`, {
    multipart: {
      data: data(daysAhead(1)),
      files: { name: "receipt.jpg", mimeType: "image/jpeg", buffer: await sampleJpeg() },
    },
  });
  expect(future.status()).toBe(422);
  expect(await onHand(item.id)).toBe(1);
});

test("the Floor Manager cancels an ordered request with a reason; the requester copies it to a new one (D-043, D-044)", async ({
  browser,
  page,
}) => {
  const fmApi = await managerApi(browser);
  const item = await createItem(fmApi, 1);
  const sc = await makeConstructor();
  const scPage = await signedIn(browser, sc.email, "/constructor");
  const request = await apiRequest(scPage, item.id, 3);
  await approveAndOrder(fmApi, request.id);

  // After approval the requester can no longer cancel it.
  await scPage.goto(`/procurement/${request.id}`);
  await expect(scPage.getByRole("button", { name: "Cancel request…" })).toHaveCount(0);
  expect(
    (
      await scPage.request.post(`/api/v1/procurement/requests/${request.id}/cancel`, { data: {} })
    ).status(),
  ).toBe(403);

  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto(`/procurement/${request.id}`);
  await page.getByRole("button", { name: "Cancel request…" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancel request" }).click();
  await expect(
    dialog.getByText(
      "Enter a reason of at least 3 characters, so the requester knows why it's cancelled.",
    ),
  ).toBeVisible();
  await expect(dialog.getByLabel("Reason")).toBeFocused();
  await dialog.getByLabel("Reason").fill("The supplier can't deliver this month");
  await dialog.getByRole("button", { name: "Cancel request" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Cancelled", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("The supplier can't deliver this month").first()).toBeVisible();
  expect(await onHand(item.id)).toBe(1);
  // Not the Floor Manager's request, so the copy isn't theirs to make.
  await expect(page.getByRole("link", { name: "Copy to a new request" })).toHaveCount(0);

  // The requester reads the reason and copies the request: the form opens prefilled.
  await scPage.reload();
  await expect(scPage.getByText("The supplier can't deliver this month").first()).toBeVisible();
  await scPage.getByRole("link", { name: "Copy to a new request" }).click();
  await expect(scPage).toHaveURL(new RegExp(`/procurement/new\\?copy=${request.id}$`));
  await expect(scPage.getByText(`Copied from ${request.code}`)).toBeVisible();
  await expect(scPage.locator("#lines-0-item")).toHaveValue(item.id);
  await expect(scPage.locator("#lines-0-quantity")).toHaveValue("3");
  await expectAccessible(scPage, "the copied request form");
  await scPage.getByLabel("Needed by").fill(daysAhead(10));
  await scPage.getByRole("button", { name: "Send request" }).click();
  await expect(scPage).toHaveURL(/\/procurement\/[0-9a-f-]{36}$/);
  const copyCode = (await scPage.locator("h1").textContent())!.trim();
  expect(copyCode).not.toBe(request.code);
  // Both requests point at each other.
  await expect(scPage.getByRole("link", { name: request.code })).toBeVisible();
  await scPage.goto(`/procurement/${request.id}`);
  await expect(scPage.getByRole("link", { name: copyCode })).toBeVisible();
  await scPage.close();
});

test("copying a partly rejected request leaves the rejected items unticked, with their reasons (D-044)", async ({
  browser,
  page,
}) => {
  const fmApi = await managerApi(browser);
  const kept = await createItem(fmApi, 1);
  const turnedDown = await createItem(fmApi, 1);
  const sc = await makeConstructor();
  await page.goto("/login");
  await signIn(page, sc.email);
  await expect(page).toHaveURL("/constructor");
  const res = await page.request.post("/api/v1/procurement/requests", {
    data: {
      neededBy: daysAhead(20),
      lines: [
        { inventoryItemId: kept.id, quantity: 2 },
        { inventoryItemId: turnedDown.id, quantity: 5 },
      ],
    },
  });
  expect(res.status()).toBe(201);
  const request = (await res.json()).data as { id: string; code: string };
  // An open request can't be copied: the form opens blank.
  await page.goto(`/procurement/new?copy=${request.id}`);
  await expect(page.getByText(`Copied from ${request.code}`)).toHaveCount(0);
  await expect(page.locator("#lines-0-item")).toHaveValue("");

  // Decide it in part, then cancel the order: now it can be copied.
  const detail = (await (await fmApi.get(`/api/v1/procurement/requests/${request.id}`)).json())
    .data;
  const decided = await fmApi.post(`/api/v1/procurement/requests/${request.id}/decide`, {
    data: {
      lines: [
        { lineId: detail.lines[0].id, decision: "APPROVED" },
        {
          lineId: detail.lines[1].id,
          decision: "REJECTED",
          reason: "E2E: a box came in yesterday",
        },
      ],
    },
  });
  expect(decided.status()).toBe(200);
  expect(
    (
      await fmApi.post(`/api/v1/procurement/requests/${request.id}/cancel`, {
        data: { reason: "E2E: supplier closed" },
      })
    ).status(),
  ).toBe(200);

  await page.goto(`/procurement/new?copy=${request.id}`);
  await expect(page.locator("#lines-0-item")).toHaveValue(kept.id);
  await expect(page.getByRole("listitem", { name: "Item 2" })).toHaveCount(0);
  const rejected = page.getByRole("group", { name: "Rejected last time" });
  await expect(rejected).toContainText("Rejected: E2E: a box came in yesterday");
  const box = rejected.getByRole("checkbox", { name: new RegExp(turnedDown.name) });
  await expect(box).not.toBeChecked();
  // Ticking it brings the item back as a line; unticking removes it again.
  await box.click();
  await expect(box).toBeChecked();
  await expect(page.locator("#lines-1-item")).toHaveValue(turnedDown.id);
  await expect(page.locator("#lines-1-quantity")).toHaveValue("5");
  await box.click();
  await expect(page.getByRole("listitem", { name: "Item 2" })).toHaveCount(0);
  await expect(box).not.toBeChecked();
});

test("the Floor Manager raises a restock request from a low item, decides and orders it; a late order is flagged (D-041, D-045)", async ({
  browser,
  page,
}) => {
  const fmApi = await managerApi(browser);
  const item = await createItem(fmApi, 1, "LEATHER_ROLL");

  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto(`/inventory?q=${item.sku}`);
  await page.getByRole("link", { name: `Request ${item.name}` }).click();
  await expect(page).toHaveURL(new RegExp(`/procurement/new\\?item=${item.id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("New purchase request");
  // Leather rolls need no extra OK for the Floor Manager.
  await expect(page.locator("#lines-0-item")).toHaveValue(item.id);
  await expect(page.getByText("Leather rolls are greyed out")).toHaveCount(0);
  await expectAccessible(page, "the Floor Manager's new request form");
  await page.locator("#lines-0-quantity").fill("4");
  await page.getByLabel("Needed by").fill(daysAhead(6));
  await page.getByRole("button", { name: "Raise request" }).click();
  await expect(page).toHaveURL(/\/procurement\/[0-9a-f-]{36}$/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  const code = (await page.locator("h1").textContent())!.trim();
  await expect(page.getByText("Raised by Floor Manager")).toBeVisible();

  // It goes through the same item-by-item step; their own approval is allowed.
  await expect(page.locator("#line-0-approve")).toBeChecked();
  await page.getByRole("button", { name: "Save decisions" }).click();
  await expect(page.getByText("Approved by", { exact: true })).toBeVisible();
  // The inventory row now says "Requested" instead of offering "Request".
  await page.goto(`/inventory?q=${item.sku}`);
  await expect(page.getByRole("link", { name: `Requested in ${code}` })).toBeVisible();
  await expect(page.getByRole("link", { name: `Request ${item.name}` })).toHaveCount(0);

  // Ordered with a date that has since passed (set in the database: the form refuses past dates).
  const { id: supplierId } = await supplier(fmApi);
  expect(
    (
      await fmApi.post(`/api/v1/procurement/requests/${id}/order`, {
        data: { supplierId, expectedDeliveryOn: daysAhead(0) },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await fmApi.post(`/api/v1/procurement/requests/${id}/order`, {
        data: { supplierId, expectedDeliveryOn: daysAhead(1) },
      })
    ).status(),
  ).toBe(409); // already ordered
  await withDb((db) =>
    db.query(`UPDATE purchase_requests SET "expectedDeliveryOn" = CURRENT_DATE - 3 WHERE id = $1`, [
      id,
    ]),
  );
  await page.goto(`/procurement?status=ORDERED&item=${item.id}`);
  const row = page.getByRole("row", { name: code });
  await expect(row).toContainText("Delivery late");
  await expect(row).toContainText("Raised by Floor Manager");
  // The Delivery filter keeps it; the home card counts it.
  await page.getByLabel("Delivery").selectOption("1");
  await expect(page).toHaveURL(/late=1/);
  await expect(page.getByRole("row", { name: code })).toBeVisible();
  await expectAccessible(page, "the procurement list with a late delivery");
  await page.goto("/floor-manager");
  await expect(page.getByTestId("pending-requests-card")).toContainText(
    /deliver(y is|ies are) late/,
  );
  await page.goto(`/procurement/${id}`);
  await expect(page.getByTestId("order-card")).toContainText("Delivery late");
});

test("the status tabs follow a request from approved to received", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
  await page.goto("/procurement?status=all");
  const tabs = page.getByRole("navigation", { name: "Request status" });
  for (const label of [
    "Pending",
    "Approved",
    "Ordered",
    "Partly received",
    "Received",
    "Rejected",
    "Cancelled",
  ])
    await expect(
      tabs.getByRole("link", { name: new RegExp(`^${label} \\(\\d+\\)$`) }),
    ).toBeVisible();
  // No sideways scroll at 1280 px or at 960 px (D-034).
  for (const width of [1280, 960]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
