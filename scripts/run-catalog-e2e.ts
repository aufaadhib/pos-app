import "dotenv/config";

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import { createAuth } from "../lib/auth/factory";
import type { AppRole } from "../lib/auth/permissions";
import { prisma } from "../lib/prisma-core";

type TestAccount = {
  role: AppRole;
  email: string;
  password: string;
};

export async function runCatalogE2E() {
  if (process.env.E2E_ALLOW_TEST_USERS !== "true") {
    throw new Error(
      "Set E2E_ALLOW_TEST_USERS=true hanya pada database development/test untuk menjalankan E2E katalog live.",
    );
  }

  const marker = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const password = randomBytes(18).toString("base64url");
  const accounts: TestAccount[] = (["owner", "manager", "cashier"] as const).map(
    (role) => ({
      role,
      email: `e2e-${role}-${marker}@glutong.invalid`,
      password,
    }),
  );

  try {
    for (const account of accounts) {
      await createTemporaryTestAccount(account);
    }

    const accountByRole = Object.fromEntries(
      accounts.map((account) => [account.role, account]),
    ) as Record<AppRole, TestAccount>;
    const result = spawnSync(
      "npx",
      [
        "playwright",
        "test",
        "e2e/catalog.spec.ts",
        "e2e/catalog-visual.spec.ts",
        "--project=desktop",
        "--workers=1",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          E2E_OWNER_EMAIL: accountByRole.owner.email,
          E2E_OWNER_PASSWORD: accountByRole.owner.password,
          E2E_MANAGER_EMAIL: accountByRole.manager.email,
          E2E_MANAGER_PASSWORD: accountByRole.manager.password,
          E2E_CASHIER_EMAIL: accountByRole.cashier.email,
          E2E_CASHIER_PASSWORD: accountByRole.cashier.password,
          E2E_CATALOG_MUTATIONS: "true",
          E2E_CAPTURE_CATALOG: "true",
        },
        shell: process.platform === "win32",
        stdio: "inherit",
      },
    );

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Playwright katalog selesai dengan exit code ${result.status ?? "unknown"}.`);
    }
  } finally {
    await prisma.user.deleteMany({
      where: { email: { in: accounts.map((account) => account.email) } },
    });
    await prisma.$disconnect();
  }
}

async function createTemporaryTestAccount(account: TestAccount) {
  const testAuth = createAuth({ allowSignUp: true, defaultRole: account.role });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await testAuth.api.signUpEmail({
        body: {
          name: `E2E ${account.role}`,
          email: account.email,
          password: account.password,
        },
      });
      return;
    } catch (error) {
      const existing = await prisma.user.findUnique({
        where: { email: account.email },
        select: {
          role: true,
          accounts: {
            where: { providerId: "credential" },
            select: { id: true },
          },
        },
      });
      if (existing?.role === account.role && existing.accounts.length > 0) return;
      if (existing) {
        await prisma.user.delete({ where: { email: account.email } });
      }
      if (attempt === 3) throw error;
      await delay(attempt * 750);
    }
  }
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

runCatalogE2E().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "E2E katalog gagal.");
  process.exitCode = 1;
});
