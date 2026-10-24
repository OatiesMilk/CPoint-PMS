import { expect, type Page } from "@playwright/test";

export const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD ?? "";

export const ACCOUNTS = {
  manager: { email: "manager@cpoint.local", home: "/floor-manager" },
  inspector: { email: "inspector@cpoint.local", home: "/quality-inspector" },
  admin: { email: "admin@cpoint.local", home: "/admin" },
  constructor: { email: "constructor@cpoint.local", home: "/camera/capture" },
} as const;

export async function signIn(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Sidebar entries in order (links and not-yet-built items), without their "Phase N" tags. */
export async function navLabels(page: Page): Promise<string[]> {
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav).toBeVisible();
  const texts = await nav.locator("li").allInnerTexts();
  return texts.map((t) => t.split("\n")[0].trim());
}
