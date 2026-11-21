import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

/**
 * The Floor Manager's Overview (Overview clean-up, D-131): three zones, cards of one height per
 * row, no orphan card, one primary button, no banner, no sideways scroll.
 *
 * Read-only: it changes nothing, so it works on whatever state today is in. What depends on the
 * day (a plan due, a stock update due) is asserted whenever it shows; the no-plan case itself is
 * in batches.spec.ts, and Codex's O1 and O3 walk both due rows by hand.
 */
test.describe.configure({ mode: "serial" });

let context: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  page = await context.newPage();
  await page.goto("/login");
  await signIn(page, ACCOUNTS.manager.email);
  await expect(page).toHaveURL(ACCOUNTS.manager.home);
});

test.afterAll(async () => {
  await context.close();
});

async function openOverview(width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(ACCOUNTS.manager.home);
  await expect(page.getByTestId("todays-batches-card")).toBeVisible();
}

const card = (testId: string) => page.getByTestId(testId);
const dailySummary = () =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Daily summary" }) });

async function box(locator: ReturnType<typeof card>) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("A card has no box on screen");
  return b;
}

test("the zones come in order, and Needs attention shows only when something is due", async () => {
  await openOverview(1280);
  const canonical = [
    "plan-today-card",
    "stock-update-card",
    "todays-batches-card",
    "wip-card",
    "attendance-card",
    "rolls-today",
    "low-stock-card",
  ];
  // The cards that are on the page, in the order they sit in the document (reading and tab order).
  const present = await page.evaluate((ids) => {
    const found = ids.flatMap((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      return el ? [{ id, el }] : [];
    });
    found.sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    return found.map((f) => f.id);
  }, canonical);
  expect(present).toEqual(canonical.filter((id) => present.includes(id)));
  for (const id of [
    "todays-batches-card",
    "wip-card",
    "attendance-card",
    "rolls-today",
    "low-stock-card",
  ])
    expect(present).toContain(id);
  await expect(dailySummary()).toHaveCount(1);

  // The zone exists exactly when one of its two rows does, and no empty box ever shows.
  const rows = present.filter((id) => id === "plan-today-card" || id === "stock-update-card");
  await expect(page.getByRole("region", { name: "Needs attention" })).toHaveCount(
    rows.length ? 1 : 0,
  );
  // The Plan today row replaces the banner on this page (D-131); the bell and other pages keep it.
  await expect(card("plan-notice")).toHaveCount(0);
});

test("one primary button in Needs attention, whichever rows are due", async () => {
  await openOverview(1280);
  const zone = page.getByRole("region", { name: "Needs attention" });
  test.skip((await zone.count()) === 0, "Nothing is due today, so the zone isn't shown.");
  await expect(zone.locator('[data-slot="button"].bg-primary')).toHaveCount(1);
  if ((await card("plan-today-card").count()) > 0)
    await expect(card("plan-today-card").locator('[data-slot="button"].bg-primary')).toHaveCount(1);
});

test("Today's batches and Work in progress, and the pairs below, are one height per row", async () => {
  await openOverview(1280);
  const [batches, wip] = [await box(card("todays-batches-card")), await box(card("wip-card"))];
  expect(Math.abs(batches.height - wip.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(batches.y - wip.y)).toBeLessThanOrEqual(1);
  const [attendance, rolls] = [await box(card("attendance-card")), await box(card("rolls-today"))];
  expect(Math.abs(attendance.height - rolls.height)).toBeLessThanOrEqual(1);
  const [low, daily] = [await box(card("low-stock-card")), await box(dailySummary())];
  expect(Math.abs(low.height - daily.height)).toBeLessThanOrEqual(1);

  // No card sits on another one.
  const all = [batches, wip, attendance, rolls, low, daily];
  for (const [i, a] of all.entries())
    for (const b of all.slice(i + 1))
      expect(
        a.x + a.width <= b.x + 1 ||
          b.x + b.width <= a.x + 1 ||
          a.y + a.height <= b.y + 1 ||
          b.y + b.height <= a.y + 1,
      ).toBe(true);
});

test("the four lower cards sit two by two at 1280 and in one row at 1536", async () => {
  await openOverview(1280);
  const [a, r, l, d] = [
    await box(card("attendance-card")),
    await box(card("rolls-today")),
    await box(card("low-stock-card")),
    await box(dailySummary()),
  ];
  expect(Math.abs(a.y - r.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(l.y - d.y)).toBeLessThanOrEqual(1);
  expect(l.y).toBeGreaterThan(a.y + a.height - 1);
  expect(r.x).toBeGreaterThan(a.x);

  await openOverview(1536);
  const row = [
    await box(card("attendance-card")),
    await box(card("rolls-today")),
    await box(card("low-stock-card")),
    await box(dailySummary()),
  ];
  for (const b of row) expect(Math.abs(b.y - row[0].y)).toBeLessThanOrEqual(1);
  expect(row.map((b) => b.x)).toEqual([...row.map((b) => b.x)].sort((x, y) => x - y));
});

test("no sideways scroll at 700, 768 and 1024, and no serious accessibility fault", async () => {
  for (const width of [700, 768, 1024]) {
    await openOverview(width);
    const [scroll, client] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(scroll, `scrollWidth at ${width} px`).toBeLessThanOrEqual(client);
  }
  await openOverview(1280);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("[data-sonner-toaster]")
    .analyze();
  expect(
    results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
});
