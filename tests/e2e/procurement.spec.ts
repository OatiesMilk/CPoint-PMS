import { randomBytes } from "node:crypto";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { inspectorApi, makeConstructor, managerApi, withDb } from "./cv-helpers";

// Purchase requests (D-029, D-031). Each test gets its own Shoe Constructor (makeConstructor).

async function signedIn(browser: Browser, email: string, home: string): Promise<Page> {
  const page = await browser.newPage();
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
async function apiRequest(page: Page, itemId: string, quantity = 2) {
  const res = await page.request.post("/api/v1/procurement/requests", {
    data: {
      priority: "NORMAL",
      justification: "E2E: running low",
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
  const fmApi = await managerApi(browser);
  const item = await createItem(fmApi, 2);
  const sc = await makeConstructor();

  await page.goto("/login");
  await signIn(page, sc.email);
  await expect(page).toHaveURL("/constructor");
  await page.getByRole("link", { name: "New request" }).click();
  await expect(page).toHaveURL("/procurement/new");
  await page.locator("#lines-0-item").selectOption(item.id);
  await expect(page.getByText("2 boxes on hand · reorder at 5 boxes")).toBeVisible();
  await page.locator("#lines-0-quantity").fill("3");
  await page.getByLabel("Priority").selectOption("URGENT");
  await page.getByLabel("Why it’s needed").fill("Half a box left for the topsider batch");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page).toHaveURL(/\/procurement\/[0-9a-f-]{36}$/);
  const url = new URL(page.url()).pathname;
  const code = (await page.locator("h1").textContent())!.trim();
  await expect(page.getByText("Pending", { exact: true }).first()).toBeVisible();

  // The Floor Manager: pending tab, urgent; approve with a note; receive.
  const fm = await signedIn(browser, ACCOUNTS.manager.email, ACCOUNTS.manager.home);
  await fm.goto("/procurement");
  await expect(fm.getByRole("row", { name: code })).toContainText("Urgent");
  await fm.goto(`/inventory?q=${item.sku}`);
  await expect(fm.getByRole("link", { name: `Requested in ${code}` })).toBeVisible();
  await fm.goto(url);
  await fm.getByLabel("Note to the requester").fill("Ordering today");
  await fm.getByRole("button", { name: "Approve" }).click();
  await expect(fm.getByText("Ordering today").first()).toBeVisible();
  await fm.getByRole("button", { name: "Mark received…" }).click();
  await expect(fm.getByRole("dialog")).toContainText(`${item.name}: +3 boxes`);
  await fm.getByRole("dialog").getByRole("button", { name: "Mark received" }).click();
  await expect(fm.getByText("Added to stock on receipt")).toBeVisible();
  expect(await onHand(item.id)).toBe(5);

  // The requester sees the outcome and the timeline.
  await page.reload();
  await expect(page.locator("header, main").getByText("Received").first()).toBeVisible();
  await expect(page.getByText("Ordering today").first()).toBeVisible();
  await fm.close();
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
  await page.getByRole("button", { name: "Reject…" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(`Reject ${request.code}?`);
  await dialog.getByRole("button", { name: "Reject request" }).click();
  await expect(dialog.getByText(/Say why it's rejected/)).toBeVisible();
  await dialog.getByLabel("Reason").fill("Three boxes in the back room");
  await dialog.getByRole("button", { name: "Reject request" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("Rejected by", { exact: true })).toBeVisible(); // once saved
  await expect(page.getByText("Three boxes in the back room").first()).toBeVisible();

  await scPage.goto(`/procurement/${request.id}`);
  await expect(scPage.getByText("Three boxes in the back room").first()).toBeVisible();
  await scPage.close();
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
  await expect(page.getByText("Found some in storage")).toBeVisible();
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
  await expect(page.getByRole("link", { name: "New request" })).toBeVisible();

  const ask = (itemId: string) =>
    page.request.post("/api/v1/procurement/requests", {
      data: {
        priority: "NORMAL",
        justification: "E2E: running low",
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
