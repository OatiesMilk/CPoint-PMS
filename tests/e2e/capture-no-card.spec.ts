import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";
import { makeConstructor } from "./cv-helpers";

// Capture without the scale marker card (D-120): Chromium's own fake camera, a test pattern with
// no card. Its own file, because launch options apply to a whole file (QA run 1, F2).
test.use({
  permissions: ["camera"],
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  },
});

test("without the card Capture stays off, says to show it and links the printable card", async ({
  page,
}) => {
  const sc = await makeConstructor({ canCapture: true });
  await page.goto("/login");
  await signIn(page, sc.email);
  await expect(page).toHaveURL(ACCOUNTS.constructor.home);
  await expect(page.getByLabel("Live camera picture")).toBeVisible();
  const status = page.getByTestId("marker-status");
  await expect(status).toContainText("Show the marker card to capture.");
  await expect(status.getByRole("link", { name: "Print the marker card" })).toHaveAttribute(
    "href",
    "/cpoint-scale-marker-2in.pdf",
  );
  await expect(page.getByRole("button", { name: "Capture", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Set up this phone" })).toHaveCount(0);
  const pdf = await page.request.get("/cpoint-scale-marker-2in.pdf");
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
});
