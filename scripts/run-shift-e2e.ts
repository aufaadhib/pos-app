import "dotenv/config";

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import { createAuth } from "../lib/auth/factory";
import { normalizeCatalogName } from "../lib/catalog/normalization";
import { normalizeOutletName } from "../lib/outlets/normalization";
import { prisma } from "../lib/prisma-core";

type TestAccount = { email: string; password: string; id?: string };

/** Creates isolated live fixtures and runs the complete cashier-shift browser journey. */
export async function runShiftE2E() {
  if (process.env.E2E_ALLOW_TEST_USERS !== "true") {
    throw new Error("Set E2E_ALLOW_TEST_USERS=true hanya pada database development/test untuk menjalankan E2E shift live.");
  }

  const runId = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const port = String(3100 + (Number(runId.slice(0, 6)) % 500));
  const password = randomBytes(18).toString("base64url");
  const account: TestAccount = { email: `e2e-shift-owner-${runId}@glutong.invalid`, password };
  const outletName = `E2E Shift ${runId}`;
  const categoryName = `E2E Shift Category ${runId}`;
  const productName = `E2E Shift Product ${runId}`;

  try {
    await createTemporaryOwner(account);
    const [outlet, category] = await prisma.$transaction([
      prisma.outlet.create({
        data: {
          code: `ES${runId.slice(-6).toUpperCase()}`,
          name: outletName,
          normalizedName: normalizeOutletName(outletName),
          timezone: "Asia/Jakarta",
          provinceCode: "31",
          provinceName: "Daerah Khusus Ibukota Jakarta",
          cityCode: "3174",
          cityName: "Kota Jakarta Selatan",
        },
      }),
      prisma.category.create({
        data: { name: categoryName, normalizedName: normalizeCatalogName(categoryName) },
      }),
    ]);
    await prisma.product.create({
      data: {
        categoryId: category.id,
        name: productName,
        normalizedName: normalizeCatalogName(productName),
        sku: `ES-${runId.slice(-8).toUpperCase()}`,
        basePrice: "25000.00",
      },
    });

    const result = spawnSync("npx", ["playwright", "test", "e2e/shift.spec.ts", "--project=desktop", "--workers=1"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        E2E_SHIFT_LIVE: "true",
        E2E_SHIFT_EMAIL: account.email,
        E2E_SHIFT_PASSWORD: password,
        E2E_SHIFT_OUTLET_NAME: outlet.name,
        E2E_SHIFT_PRODUCT_NAME: productName,
        BETTER_AUTH_URL: `http://localhost:${port}`,
        NEXT_DIST_DIR: ".next-shift-e2e",
        NEXT_TSCONFIG_PATH: "tsconfig.e2e.json",
        PLAYWRIGHT_PORT: port,
      },
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Playwright shift selesai dengan exit code ${result.status ?? "unknown"}.`);
  } finally {
    await cleanupShiftFixtures(runId);
    await prisma.$disconnect();
  }
}

/** Removes every financial and catalog row created by one guarded E2E run. */
async function cleanupShiftFixtures(runId: string) {
  const [users, outlets, categories] = await Promise.all([
    prisma.user.findMany({ where: { email: { contains: runId } }, select: { id: true } }),
    prisma.outlet.findMany({ where: { name: { contains: runId } }, select: { id: true } }),
    prisma.category.findMany({ where: { name: { contains: runId } }, select: { id: true } }),
  ]);
  const userIds = users.map(({ id }) => id);
  const outletIds = outlets.map(({ id }) => id);
  const categoryIds = categories.map(({ id }) => id);
  const sales = await prisma.sale.findMany({ where: { outletId: { in: outletIds } }, select: { id: true } });
  const saleIds = sales.map(({ id }) => id);
  const saleItems = await prisma.saleItem.findMany({ where: { saleId: { in: saleIds } }, select: { id: true } });
  const saleItemIds = saleItems.map(({ id }) => id);
  const shifts = await prisma.cashShift.findMany({ where: { outletId: { in: outletIds } }, select: { id: true } });
  const shiftIds = shifts.map(({ id }) => id);

  await prisma.$transaction([
    prisma.platformSettlementItem.deleteMany({ where: { salePayment: { saleId: { in: saleIds } } } }),
    prisma.saleItemVariant.deleteMany({ where: { saleItemId: { in: saleItemIds } } }),
    prisma.saleItemModifier.deleteMany({ where: { saleItemId: { in: saleItemIds } } }),
    prisma.salePayment.deleteMany({ where: { saleId: { in: saleIds } } }),
    prisma.saleAuditLog.deleteMany({ where: { saleId: { in: saleIds } } }),
    prisma.saleItem.deleteMany({ where: { saleId: { in: saleIds } } }),
    prisma.sale.deleteMany({ where: { id: { in: saleIds } } }),
    prisma.receiptSequence.deleteMany({ where: { outletId: { in: outletIds } } }),
    prisma.cashMovement.deleteMany({ where: { shiftId: { in: shiftIds } } }),
    prisma.cashShiftAuditLog.deleteMany({ where: { shiftId: { in: shiftIds } } }),
    prisma.cashShift.deleteMany({ where: { id: { in: shiftIds } } }),
    prisma.session.updateMany({ where: { activeOutletId: { in: outletIds } }, data: { activeOutletId: null } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    prisma.product.deleteMany({ where: { categoryId: { in: categoryIds } } }),
    prisma.category.deleteMany({ where: { id: { in: categoryIds } } }),
    prisma.outlet.deleteMany({ where: { id: { in: outletIds } } }),
  ]);
}

/** Creates one temporary owner through Better Auth, retrying transient Neon cold starts. */
async function createTemporaryOwner(account: TestAccount) {
  const auth = createAuth({ allowSignUp: true, defaultRole: "owner" });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await auth.api.signUpEmail({ body: { name: "E2E Shift Owner", email: account.email, password: account.password } });
      account.id = result.user.id;
      return;
    } catch (error) {
      const existing = await prisma.user.findUnique({
        where: { email: account.email },
        select: { id: true, role: true, accounts: { where: { providerId: "credential" }, select: { id: true } } },
      });
      if (existing?.role === "owner" && existing.accounts.length > 0) {
        account.id = existing.id;
        return;
      }
      if (existing) await prisma.user.delete({ where: { id: existing.id } });
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_000));
    }
  }
}

runShiftE2E().catch((error: unknown) => {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
});

/** Extracts a safe diagnostic message from Error-like library failures. */
function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "E2E shift gagal.";
}
