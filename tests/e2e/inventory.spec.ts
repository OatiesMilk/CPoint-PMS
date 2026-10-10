import { randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { managerApi, shoeTypeId } from "./cv-helpers";

async function signInAs(page: Page, account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS]) {
  await page.goto("/login");
  await signIn(page, account.email);
  await expect(page).toHaveURL(account.home);
}

const uniqueCode = (prefix: string) => `${prefix}-E${randomBytes(3).toString("hex").toUpperCase()}`;

async function createItem(
  api: APIRequestContext,
  item: {
    category?: string;
    unit?: string;
    reorderLevel: number;
    openingStock?: number;
    name?: string;
  },
) {
  const sku = uniqueCode(item.category === "LEATHER_ROLL" ? "LR" : "OT");
  const res = await api.post("/api/v1/inventory", {
    data: {
      sku,
      name: item.name ?? `E2E item ${sku}`,
      category: item.category ?? "OTHER",
      unit: item.unit ?? "box",
      reorderLevel: item.reorderLevel,
      openingStock: item.openingStock,
    },
  });
  expect(res.status()).toBe(201);
  const { id, name } = (await res.json()).data;
  return { id: id as string, sku, name: name as string };
}

async function onHand(api: APIRequestContext, id: string): Promise<number> {
  const res = await api.get(`/api/v1/inventory/${id}`);
  return (await res.json()).data.item.quantityOnHand;
}

test("the Floor Manager adds an item, receives, uses (and undoes), and counts stock", async ({
  page,
}) => {
  const sku = uniqueCode("TH");
  const name = `E2E thread ${sku}`;
  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/inventory/new");
  await page.getByLabel("Category").selectOption("THREAD");
  await expect(page.getByLabel("Unit")).toHaveValue("spool");
  await page.getByLabel("Code").fill(sku);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Reorder at").fill("4");
  await page.getByLabel("Opening stock (optional)").fill("5");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByTestId("on-hand")).toHaveText("5 spools");

  // Receive 3.
  await page.getByRole("button", { name: "Receive stock" }).click();
  await page.getByRole("dialog").getByLabel("Quantity").fill("3");
  await page.getByRole("dialog").getByRole("button", { name: "Record delivery" }).click();
  await expect(page.getByTestId("on-hand")).toHaveText("8 spools");

  // Using more than is on hand is refused in the dialog.
  await page.getByRole("button", { name: "Use stock" }).click();
  const use = page.getByRole("dialog");
  await use.getByLabel("Quantity").fill("9");
  await use.getByRole("button", { name: "Record usage" }).click();
  await expect(use.getByText("Only 8 spools in stock")).toBeVisible();
  await use.getByLabel("Quantity").fill("6");
  await use.getByRole("button", { name: "Record usage" }).click();
  await expect(page.getByTestId("on-hand")).toHaveText("2 spools");
  await expect(page.getByText("Low", { exact: true })).toBeVisible();

  // Undo from the toast puts it back (as an opposite entry).
  await page
    .getByRole("listitem")
    .filter({ hasText: "Used 6 spools" })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(page.getByTestId("on-hand")).toHaveText("8 spools");

  // Stock count: shows the difference, needs a reason.
  await page.getByRole("button", { name: "Stock count…" }).click();
  const count = page.getByRole("dialog");
  await count.getByLabel("Counted quantity").fill("7.5");
  await expect(count.getByTestId("count-difference")).toHaveText("Difference: −0.5 spool");
  await count.getByRole("button", { name: "Save count" }).click();
  await expect(count.getByText(/Enter a reason .*count difference/)).toBeVisible();
  await count.getByLabel("Reason").fill("Half a spool was tangled");
  await count.getByRole("button", { name: "Save count" }).click();
  await expect(page.getByTestId("on-hand")).toHaveText("7.5 spools");

  // History, newest first, with the balance after each entry.
  const rows = page.getByTestId("movement-row");
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText("Stock count");
  await expect(rows.nth(0)).toContainText("−0.5");
  await expect(rows.nth(0)).toContainText("7.5");
  await expect(rows.nth(1)).toContainText("Undo: Used in production");
  await expect(rows.nth(4)).toContainText("Opening stock");
});

test("a low item shows on the Floor Manager home", async ({ browser, page }) => {
  const api = await managerApi(browser);
  const item = await createItem(api, {
    reorderLevel: 10,
    openingStock: 1,
    name: `AAA E2E low ${Date.now()}`,
  });
  await signInAs(page, ACCOUNTS.manager);
  const card = page.getByTestId("low-stock-card");
  await expect(card).toContainText("at or below the reorder level");
  await page.goto(`/inventory?stock=low&q=${item.sku}`);
  await expect(page.getByRole("row", { name: new RegExp(item.sku) })).toContainText("Low");
});

test("creating a batch can take a roll from inventory, and cancelling it before production returns it", async ({
  browser,
  page,
}) => {
  const api = await managerApi(browser);
  const roll = await createItem(api, {
    category: "LEATHER_ROLL",
    unit: "roll",
    reorderLevel: 0,
    openingStock: 2,
  });
  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/batches/new");
  await page.getByLabel("Roll code").fill(`E2E-INV-${randomBytes(2).toString("hex")}`);
  await page.getByLabel("Take a roll from inventory (optional)").selectOption(roll.id);
  await page.getByLabel("Shoe type").selectOption(await shoeTypeId());
  await page.getByRole("button", { name: "Create batch" }).click();
  await expect(page).toHaveURL(/\/batches\/[0-9a-f-]{36}$/);
  const batchId = page.url().split("/").pop()!;
  await expect(page.getByText(`${roll.sku} · ${roll.name}`)).toBeVisible();
  expect(await onHand(api, roll.id)).toBe(1);

  const history = await (await api.get(`/api/v1/inventory/${roll.id}/movements`)).json();
  expect(history.data.movements[0]).toMatchObject({
    type: "OUT",
    quantityDelta: -1,
    batch: { id: batchId },
  });

  const cancel = await api.post(`/api/v1/batches/${batchId}/cancel`, {
    data: { reason: "Order changed" },
  });
  expect(cancel.status()).toBe(200);
  expect(await onHand(api, roll.id)).toBe(2);
});

test("a batch can't take a roll that's no longer in stock", async ({ browser }) => {
  const api = await managerApi(browser);
  const roll = await createItem(api, { category: "LEATHER_ROLL", unit: "roll", reorderLevel: 0 });
  const res = await api.post("/api/v1/batches", {
    data: {
      rollCode: "E2E-NOROLL",
      shoeTypeId: await shoeTypeId(),
      receivedAt: "2026-01-15",
      rollItemId: roll.id,
    },
  });
  expect(res.status()).toBe(422);
  const body = await res.json();
  expect(body.error.details[0]).toMatchObject({ path: ["rollItemId"] });
  expect(body.error.details[0].message).toContain("Only 0 rolls in stock");
});

test("the System Admin sees inventory read-only; the Quality Inspector has no access", async ({
  browser,
  page,
}) => {
  const api = await managerApi(browser);
  const item = await createItem(api, { reorderLevel: 1, openingStock: 3 });

  await signInAs(page, ACCOUNTS.admin);
  await page.goto(`/inventory/${item.id}`);
  await expect(page.getByTestId("on-hand")).toHaveText("3 boxes");
  await expect(
    page.getByRole("button", { name: /Receive stock|Use stock|Stock count/ }),
  ).toHaveCount(0);
  const post = await page.request.post(`/api/v1/inventory/${item.id}/movements`, {
    data: { type: "IN", quantity: 1 },
  });
  expect(post.status()).toBe(403);

  const qi = await browser.newPage();
  await signInAs(qi, ACCOUNTS.inspector);
  await qi.goto("/inventory");
  await expect(qi).toHaveURL("/forbidden");
  expect((await qi.request.get("/api/v1/inventory")).status()).toBe(403);
  await qi.close();
});
