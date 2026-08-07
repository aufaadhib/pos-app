import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import type { StaffItem, StaffPage, StaffOutletOption } from "@/lib/staff/types";
import type { StaffSearch } from "@/lib/staff/validation";

const staffPageSize = 20;

export async function getStaff(
  search: StaffSearch,
  actor: { id: string; role: AppRole },
): Promise<StaffPage> {
  const managerOutletScope: Prisma.UserWhereInput = actor.role === "manager" ? {
    role: "cashier",
    outletAssignments: {
      some: { outlet: { assignments: { some: { userId: actor.id } } } },
    },
  } : {};
  const where: Prisma.UserWhereInput = {
    ...managerOutletScope,
    ...(search.role === "all" ? {} : { role: search.role }),
    ...(search.status === "all" ? {} : { banned: search.status === "inactive" }),
    ...(search.outlet ? { outletAssignments: { some: { outletId: search.outlet } } } : {}),
    ...(search.q ? {
      OR: [
        { name: { contains: search.q, mode: "insensitive" } },
        { email: { contains: search.q, mode: "insensitive" } },
      ],
    } : {}),
  };
  const totalItems = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / staffPageSize));
  const page = Math.min(search.page, totalPages);
  const users = await prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { name: "asc" }],
    skip: (page - 1) * staffPageSize,
    take: staffPageSize,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      mustChangePassword: true,
      updatedAt: true,
      outletAssignments: {
        orderBy: { outlet: { name: "asc" } },
        select: { outlet: { select: { id: true, code: true, name: true } } },
      },
    },
  });

  return {
    items: users.flatMap((user) => {
      if (user.role !== "owner" && user.role !== "manager" && user.role !== "cashier") return [];
      return [{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: Boolean(user.banned),
        mustChangePassword: user.mustChangePassword,
        outlets: user.outletAssignments.map((assignment) => assignment.outlet),
        updatedAt: user.updatedAt.toISOString(),
      } satisfies StaffItem];
    }),
    page,
    pageSize: staffPageSize,
    totalItems,
    totalPages,
  };
}

export async function getManageableOutlets(userId: string, role: AppRole): Promise<StaffOutletOption[]> {
  if (role === "cashier") return [];
  return prisma.outlet.findMany({
    where: {
      status: "ACTIVE",
      ...(role === "owner" ? {} : { assignments: { some: { userId } } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
}
