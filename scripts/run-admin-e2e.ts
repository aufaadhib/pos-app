import "dotenv/config";

import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import { createAuth } from "../lib/auth/factory";
import type { AppRole } from "../lib/auth/permissions";
import { normalizeOperationalLabel, normalizeOutletName } from "../lib/outlets/normalization";
import { prisma } from "../lib/prisma-core";

type TestAccount = { role: AppRole; email: string; password: string; id?: string };

export async function runAdminE2E() {
  if (process.env.E2E_ALLOW_TEST_USERS !== "true") {
    throw new Error("Set E2E_ALLOW_TEST_USERS=true hanya pada database development/test untuk menjalankan E2E admin live.");
  }
  const runId = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const password = randomBytes(18).toString("base64url");
  const accounts: TestAccount[] = (["owner", "manager", "cashier"] as const).map((role) => ({
    role,
    email: `e2e-admin-${role}-${runId}@glutong.invalid`,
    password,
  }));
  const outletName = `E2E Admin Utama ${runId}`;
  const positionName = `E2E Jabatan ${runId}`;

  try {
    for (const account of accounts) {
      await createTemporaryTestAccount(account);
    }
    const owner = accounts.find((account) => account.role === "owner")!;
    const manager = accounts.find((account) => account.role === "manager")!;
    const cashier = accounts.find((account) => account.role === "cashier")!;
    await prisma.staffPosition.create({
      data: {
        name: positionName,
        normalizedName: normalizeOperationalLabel(positionName).toLocaleLowerCase("id-ID"),
      },
    });
    const primaryOutlet = await prisma.outlet.create({
      data: {
        code: `EA${runId.slice(-6).toUpperCase()}`,
        name: outletName,
        normalizedName: normalizeOutletName(outletName),
        timezone: "Asia/Jakarta",
        addressLine: "Jl. Pengujian No. 1",
        provinceCode: "31",
        provinceName: "DKI Jakarta",
        cityCode: "3174",
        cityName: "Kota Jakarta Selatan",
      },
    });
    const secondaryName = `E2E Admin Kedua ${runId}`;
    const secondaryOutlet = await prisma.outlet.create({
      data: {
        code: `EB${runId.slice(-6).toUpperCase()}`,
        name: secondaryName,
        normalizedName: normalizeOutletName(secondaryName),
        timezone: "Asia/Makassar",
        provinceCode: "73",
        provinceName: "Sulawesi Selatan",
        cityCode: "7371",
        cityName: "Kota Makassar",
      },
    });
    await prisma.userOutletAssignment.createMany({
      data: [
        { userId: manager.id!, outletId: primaryOutlet.id, assignedByUserId: owner.id! },
        { userId: manager.id!, outletId: secondaryOutlet.id, assignedByUserId: owner.id! },
        { userId: cashier.id!, outletId: primaryOutlet.id, assignedByUserId: owner.id! },
      ],
    });

    const accountByRole = Object.fromEntries(accounts.map((account) => [account.role, account])) as Record<AppRole, TestAccount>;
    const result = spawnSync("npx", ["playwright", "test", "e2e/admin.spec.ts", "e2e/admin-visual.spec.ts", "--project=desktop", "--workers=1"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        E2E_OWNER_EMAIL: accountByRole.owner.email,
        E2E_OWNER_PASSWORD: password,
        E2E_MANAGER_EMAIL: accountByRole.manager.email,
        E2E_MANAGER_PASSWORD: password,
        E2E_CASHIER_EMAIL: accountByRole.cashier.email,
        E2E_CASHIER_PASSWORD: password,
        E2E_ADMIN_RUN_ID: runId,
        E2E_ADMIN_OUTLET_NAME: outletName,
        E2E_ADMIN_POSITION_NAME: positionName,
        E2E_ADMIN_MUTATIONS: "true",
        E2E_CAPTURE_ADMIN: "true",
      },
      shell: process.platform === "win32",
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Playwright admin selesai dengan exit code ${result.status ?? "unknown"}.`);
  } finally {
    await cleanupAdminFixtures(runId);
    await prisma.$disconnect();
  }
}

async function cleanupAdminFixtures(runId: string) {
  const users = await prisma.user.findMany({ where: { email: { contains: runId } }, select: { id: true } });
  const outlets = await prisma.outlet.findMany({ where: { name: { contains: runId } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const outletIds = outlets.map((outlet) => outlet.id);
  await prisma.adminAuditLog.deleteMany({ where: { OR: [{ actorUserId: { in: userIds } }, { entityId: { in: [...userIds, ...outletIds] } }] } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.staffPosition.deleteMany({ where: { name: { contains: runId } } });
  await prisma.session.updateMany({ where: { activeOutletId: { in: outletIds } }, data: { activeOutletId: null } });
  await prisma.outlet.deleteMany({ where: { id: { in: outletIds } } });
}

async function createTemporaryTestAccount(account: TestAccount) {
  const auth = createAuth({ allowSignUp: true, defaultRole: account.role });
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await auth.api.signUpEmail({
        body: {
          name: `E2E ${account.role}`,
          email: account.email,
          password: account.password,
        },
      });
      account.id = result.user.id;
      return;
    } catch (error) {
      const existing = await prisma.user.findUnique({
        where: { email: account.email },
        select: { id: true, role: true, accounts: { where: { providerId: "credential" }, select: { id: true } } },
      });
      if (existing?.role === account.role && existing.accounts.length > 0) {
        account.id = existing.id;
        return;
      }
      if (existing) await prisma.user.delete({ where: { id: existing.id } });
      if (attempt === 3) throw error;
      await delay(attempt * 1_000);
    }
  }
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

runAdminE2E().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "E2E admin gagal.");
  process.exitCode = 1;
});
