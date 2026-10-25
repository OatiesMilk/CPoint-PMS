import { randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { managerApi, supplierId } from "./cv-helpers";

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

test("the Floor Manager adds an item and updates its stock on the sheet (Phase 29, D-102)", async ({
  page,
}) => {
  const sku = uniqueCode("TH");
  const name = `E2E thread ${sku}`;
  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/inventory/new");
  // A choice made before React hydrates the form is lost; choose again until the unit follows
  // (QA report 2026-10-14 follow-ups run 2: once, the unit stayed "roll" under six workers).
  await expect(async () => {
    await page.getByLabel("Category").selectOption("THREAD");
    await expect(page.getByLabel("Unit")).toHaveValue("spool", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  // Only a leather roll has a supplier.
  await expect(page.getByLabel("Supplier")).toHaveCount(0);
  await page.getByLabel("Code").fill(sku);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Reorder at").fill("4");
  await page.getByLabel("Opening stock (optional)").fill("5");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByTestId("on-hand")).toHaveText("5 spools");
  // No Receive, Use or Stock count dialogs any more: stock changes only on the sheet.
  await expect(
    page.getByRole("button", { name: /Receive stock|Use stock|Stock count/ }),
  ).toHaveCount(0);

  // Update stock opens the sheet found on this item.
  await page.getByRole("link", { name: "Update stock" }).click();
  await expect(page).toHaveURL(/\/inventory\/update\?q=/);
  const row = page.getByRole("row", { name: new RegExp(sku) });
  await expect(row).toContainText("not updated yet");

  // Using more than is on hand (with what was added) is refused under its field.
  await page.getByLabel(`Added to ${name}`).fill("3");
  await page.getByLabel(`Used of ${name}`).fill("9");
  await page.getByRole("button", { name: "Save update (1 item)" }).click();
  await expect(row.getByText(/Only 8 spools of .* in stock/)).toBeVisible();
  await expect(page.getByLabel(`Used of ${name}`)).toBeFocused();

  // A correction needs a reason; the reason box opens only with a correction.
  await expect(page.getByLabel(`Reason for the ${name} correction`)).toBeDisabled();
  await page.getByLabel(`Used of ${name}`).fill("6");
  await page.getByLabel(`Correction for ${name}`).fill("-0.5");
  await page.getByRole("button", { name: "Save update (1 item)" }).click();
  await expect(row.getByText(/Enter a reason for the .* correction/)).toBeVisible();
  await page.getByLabel(`Reason for the ${name} correction`).fill("Half a spool was tangled");
  await expect(row.getByTestId("on-hand-after")).toHaveText("1.5 spools");
  await page.getByRole("button", { name: "Save update (1 item)" }).click();
  await expect(page.getByText("Stock updated: 1 item.")).toBeVisible();
  await expect(row).toContainText("1.5 spools");
  await expect(row).not.toContainText("not updated yet");

  // History, newest first: Correction, Used, Added, then the opening stock.
  await page.goto("/inventory?q=" + sku);
  await expect(page.getByRole("row", { name: new RegExp(sku) })).toContainText("Low");
  await page
    .getByRole("link", { name: new RegExp(sku) })
    .first()
    .click();
  await expect(page.getByTestId("on-hand")).toHaveText("1.5 spools");
  const rows = page.getByTestId("movement-row");
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText("Correction");
  await expect(rows.nth(0)).toContainText("−0.5");
  await expect(rows.nth(0)).toContainText("Half a spool was tangled");
  await expect(rows.nth(1)).toContainText("Used");
  await expect(rows.nth(1)).toContainText("−6");
  await expect(rows.nth(2)).toContainText("Added");
  await expect(rows.nth(3)).toContainText("Opening stock");
});

test("a sheet saved on stock that changed since it loaded is refused (STALE)", async ({
  browser,
}) => {
  const api = await managerApi(browser);
  const item = await createItem(api, { reorderLevel: 0, openingStock: 10 });
  const first = await api.post("/api/v1/inventory/updates", {
    data: { lines: [{ itemId: item.id, seenQuantity: 10, used: 2 }] },
  });
  expect(first.status()).toBe(201);
  expect((await first.json()).data.items).toBe(1);
  // A second sheet that still saw 10 changes nothing.
  const stale = await api.post("/api/v1/inventory/updates", {
    data: { lines: [{ itemId: item.id, seenQuantity: 10, added: 1 }] },
  });
  expect(stale.status()).toBe(409);
  expect(await onHand(api, item.id)).toBe(8);
  // A line with nothing in it is refused under its own field.
  const empty = await api.post("/api/v1/inventory/updates", {
    data: { lines: [{ itemId: item.id, seenQuantity: 8 }] },
  });
  expect(empty.status()).toBe(422);
  // The old one-movement API is gone.
  const old = await api.post(`/api/v1/inventory/${item.id}/movements`, {
    data: { type: "OUT", quantity: 1 },
  });
  expect(old.status()).toBe(405);
});

test("reminder days need at least one day", async ({ browser }) => {
  const api = await managerApi(browser);
  const res = await api.get("/api/v1/inventory/settings");
  expect(res.status()).toBe(200);
  const { reminderDays } = (await res.json()).data;
  expect(Array.isArray(reminderDays)).toBe(true);
  expect(reminderDays.length).toBeGreaterThan(0);
  const none = await api.put("/api/v1/inventory/settings", { data: { reminderDays: [] } });
  expect(none.status()).toBe(422);
  // Saving the same days back changes nothing for the other tests.
  const same = await api.put("/api/v1/inventory/settings", { data: { reminderDays } });
  expect(same.status()).toBe(200);
});

test("Reports → Materials shows what an item used this week, and the CSV", async ({
  browser,
  page,
}) => {
  const api = await managerApi(browser);
  const item = await createItem(api, {
    reorderLevel: 0,
    openingStock: 10,
    name: `E2E cement ${Date.now()}`,
  });
  const saved = await api.post("/api/v1/inventory/updates", {
    data: {
      lines: [{ itemId: item.id, seenQuantity: 10, used: 4, correction: -1, reason: "Recount" }],
    },
  });
  expect(saved.status()).toBe(201);

  await signInAs(page, ACCOUNTS.manager);
  await page.goto("/reports/materials");
  await expect(page.getByRole("heading", { name: "Used per material" })).toBeVisible();
  // Page through until the item shows (earlier runs add items).
  const row = page.getByRole("row", { name: new RegExp(item.sku) });
  for (let i = 0; i < 20 && (await row.count()) === 0; i++) {
    const next = page.getByRole("link", { name: /Next/ });
    if ((await next.count()) === 0) break;
    await next.first().click();
  }
  // The correction is not use: 4 this week, 5 on hand.
  await expect(row.getByRole("cell").nth(1)).toHaveText("4 boxes");
  await expect(row).toContainText("5 boxes");

  const csv = await api.get("/api/v1/reports/materials-used.csv");
  expect(csv.status()).toBe(200);
  const text = await csv.text();
  expect(text).toContain("Week (Monday),Item code,Item,Category,Supplier,Unit,Used");
  expect(text).toMatch(new RegExp(`${item.sku},[^\\n]*,4,`));
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
  const row = page.getByRole("row", { name: new RegExp(item.sku) });
  await expect(row).toContainText("Low");
  // The badge is all the row offers besides the item's own page: stock changes on Update stock.
  await expect(row.getByRole("link")).toHaveCount(1);
});

test("a leather roll needs its supplier (Phase 29, D-102)", async ({ browser }) => {
  const api = await managerApi(browser);
  const sku = uniqueCode("LR");
  const without = await api.post("/api/v1/inventory", {
    data: { sku, name: `E2E roll ${sku}`, category: "LEATHER_ROLL", unit: "roll", reorderLevel: 0 },
  });
  expect(without.status()).toBe(422);
  expect(JSON.stringify(await without.json())).toContain(
    "Choose the supplier of this leather roll.",
  );
  const res = await api.post("/api/v1/inventory", {
    data: {
      sku,
      name: `E2E roll ${sku}`,
      category: "LEATHER_ROLL",
      unit: "roll",
      reorderLevel: 0,
      supplierId: await supplierId(),
    },
  });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()).data;
  const detail = (await (await api.get(`/api/v1/inventory/${id}`)).json()).data.item;
  expect(detail.supplier?.name).toBeTruthy();
});

test("Inventory is the Floor Manager's alone (D-100): the Admin and the QI are refused", async ({
  browser,
  page,
}) => {
  const api = await managerApi(browser);
  const item = await createItem(api, { reorderLevel: 1, openingStock: 3 });

  await signInAs(page, ACCOUNTS.admin);
  for (const path of ["/inventory", `/inventory/${item.id}`]) {
    await page.goto(path);
    await expect(page).toHaveURL("/forbidden");
  }
  expect((await page.request.get("/api/v1/inventory")).status()).toBe(403);
  const post = await page.request.post("/api/v1/inventory/updates", {
    data: { lines: [{ itemId: item.id, seenQuantity: 3, added: 1 }] },
  });
  expect(post.status()).toBe(403);
  await page.goto("/reports/materials");
  await expect(page).toHaveURL("/forbidden");

  const qi = await browser.newPage();
  await signInAs(qi, ACCOUNTS.inspector);
  await qi.goto("/inventory");
  await expect(qi).toHaveURL("/forbidden");
  expect((await qi.request.get("/api/v1/inventory")).status()).toBe(403);
  await qi.close();
});
