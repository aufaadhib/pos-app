import { expect, test } from "@playwright/test";

const ownerEmail = process.env.E2E_OWNER_EMAIL;
const ownerPassword = process.env.E2E_OWNER_PASSWORD;
const hasLiveAuth = Boolean(process.env.DATABASE_URL && ownerEmail && ownerPassword);
const restrictedAccounts = [
  {
    role: "manager",
    email: process.env.E2E_MANAGER_EMAIL,
    password: process.env.E2E_MANAGER_PASSWORD,
  },
  {
    role: "cashier",
    email: process.env.E2E_CASHIER_EMAIL,
    password: process.env.E2E_CASHIER_PASSWORD,
  },
] as const;

test("anonymous staff is redirected from protected operational routes", async ({ page }) => {
  for (const route of ["/workspace", "/pos", "/transactions"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/sign-in$/);
  }
  await expect(page.getByRole("heading", { name: "Masuk ke Glutong POS" })).toBeVisible();
});

test("theme choice persists after reload", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Tema gelap" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test.describe("live Better Auth smoke tests", () => {
  test.skip(!hasLiveAuth, "Requires Neon and E2E owner credentials.");

  test("wrong credentials do not create a session", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Kata sandi", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Masuk" }).click();

    await expect(page.getByText(/Email atau kata sandi tidak sesuai/)).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("owner can open design system and sign out", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(ownerEmail!);
    await page.getByLabel("Kata sandi", { exact: true }).fill(ownerPassword!);
    await page.getByRole("button", { name: "Masuk" }).click();

    await expect(page).toHaveURL(/\/(workspace|select-outlet)$/);
    await page.goto("/design-system");
    await expect(page.getByRole("heading", { name: "Design system Glutong" })).toBeVisible();
    await page.getByRole("button", { name: "Keluar dari Glutong POS" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  for (const account of restrictedAccounts) {
    test(`${account.role} is denied from the design system`, async ({ page }) => {
      test.skip(
        !account.email || !account.password,
        `Requires E2E ${account.role} credentials.`,
      );

      await page.goto("/sign-in");
      await page.getByLabel("Email").fill(account.email!);
      await page.getByLabel("Kata sandi", { exact: true }).fill(account.password!);
      await page.getByRole("button", { name: "Masuk" }).click();
      await expect(page).toHaveURL(/\/(workspace|select-outlet)$/);

      await page.goto("/design-system");
      await expect(page).toHaveURL(/\/workspace\?access=denied$/);
      await expect(page.getByText("Akses dibatasi")).toBeVisible();
    });
  }
});
