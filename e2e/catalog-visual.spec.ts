import { expect, test } from "@playwright/test";

const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const canCapture = Boolean(
  process.env.E2E_CAPTURE_CATALOG === "true" && ownerEmail && ownerPassword,
);

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet-landscape", width: 1180, height: 820 },
  { name: "tablet-portrait", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test("captures the catalog in every supported viewport and theme", async ({ page }) => {
  test.skip(!canCapture, "Requires temporary owner credentials and E2E_CAPTURE_CATALOG=true.");
  test.setTimeout(120_000);

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(ownerEmail!);
  await page.getByLabel("Kata sandi", { exact: true }).fill(ownerPassword!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/(workspace|select-outlet)$/, { timeout: 30_000 });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/catalog");
      await page.evaluate((nextTheme) => localStorage.setItem("theme", nextTheme), theme);
      await page.reload();
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      await expect(page.getByRole("heading", { name: "Katalog produk" })).toBeVisible();
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({
        fullPage: true,
        path: `.artifacts/catalog/catalog-${viewport.name}-${theme}.png`,
      });
    }
  }
});
