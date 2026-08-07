import { expect, test } from "@playwright/test";

const enabled = Boolean(process.env.E2E_CAPTURE_ADMIN === "true" && process.env.E2E_OWNER_EMAIL && process.env.E2E_OWNER_PASSWORD && process.env.E2E_ADMIN_OUTLET_NAME);
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet-landscape", width: 1180, height: 820 },
  { name: "tablet-portrait", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test("captures outlet and staff administration across themes and viewports", async ({ page }) => {
  test.skip(!enabled, "Requires the guarded admin visual runner.");
  test.setTimeout(180_000);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(process.env.E2E_OWNER_EMAIL!);
  await page.getByLabel("Kata sandi", { exact: true }).fill(process.env.E2E_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/select-outlet$/, { timeout: 30_000 });
  await page.getByRole("button", { name: new RegExp(process.env.E2E_ADMIN_OUTLET_NAME!) }).click();
  await expect(page).toHaveURL(/\/workspace$/, { timeout: 30_000 });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((nextTheme) => localStorage.setItem("theme", nextTheme), theme);
      for (const route of ["outlets", "staff"] as const) {
        await page.goto(`/${route}`);
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.screenshot({ fullPage: true, path: `.artifacts/admin/${route}-${viewport.name}-${theme}.png` });
      }
    }
  }
});
