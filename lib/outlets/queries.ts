import "server-only";

import { OutletStatus, Prisma } from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import type { OutletItem, OutletPage } from "@/lib/outlets/types";
import type { OutletSearch } from "@/lib/outlets/validation";

const outletPageSize = 20;

export async function getOutlets(
  search: OutletSearch,
  actor: { id: string; role: AppRole },
): Promise<OutletPage> {
  const scope: Prisma.OutletWhereInput = actor.role === "owner"
    ? {}
    : { assignments: { some: { userId: actor.id } } };
  const where: Prisma.OutletWhereInput = {
    ...scope,
    ...(search.status === "all" ? {} : {
      status: search.status === "archived" ? OutletStatus.ARCHIVED : OutletStatus.ACTIVE,
    }),
    ...(search.q ? {
      OR: [
        { name: { contains: search.q, mode: "insensitive" } },
        { code: { contains: search.q, mode: "insensitive" } },
        { cityName: { contains: search.q, mode: "insensitive" } },
      ],
    } : {}),
  };
  const totalItems = await prisma.outlet.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / outletPageSize));
  const page = Math.min(search.page, totalPages);
  const outlets = await prisma.outlet.findMany({
    where,
    orderBy: [{ status: "asc" }, { name: "asc" }],
    skip: (page - 1) * outletPageSize,
    take: outletPageSize,
    select: {
      id: true,
      code: true,
      name: true,
      timezone: true,
      addressLine: true,
      provinceCode: true,
      provinceName: true,
      cityCode: true,
      cityName: true,
      taxRate: true,
      serviceChargeRate: true,
      pricesIncludeTax: true,
      status: true,
      updatedAt: true,
      _count: { select: { assignments: true } },
    },
  });

  return {
    items: outlets.map(serializeOutlet),
    page,
    pageSize: outletPageSize,
    totalItems,
    totalPages,
  };
}

export async function getAccessibleOutlets(userId: string, role: AppRole) {
  const outlets = await prisma.outlet.findMany({
    where: {
      status: OutletStatus.ACTIVE,
      ...(role === "owner" ? {} : { assignments: { some: { userId } } }),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      timezone: true,
      addressLine: true,
      provinceCode: true,
      provinceName: true,
      cityCode: true,
      cityName: true,
      taxRate: true,
      serviceChargeRate: true,
      pricesIncludeTax: true,
      status: true,
      updatedAt: true,
      _count: { select: { assignments: true } },
    },
  });

  return outlets.map(serializeOutlet);
}

export async function getActiveOutlet(
  activeOutletId: string | null | undefined,
  userId: string,
  role: AppRole,
) {
  if (!activeOutletId) return null;
  const outlet = await prisma.outlet.findFirst({
    where: {
      id: activeOutletId,
      status: OutletStatus.ACTIVE,
      ...(role === "owner" ? {} : { assignments: { some: { userId } } }),
    },
    select: { id: true, code: true, name: true, timezone: true },
  });

  return outlet;
}

function serializeOutlet(outlet: {
  id: string;
  code: string;
  name: string;
  timezone: string;
  addressLine: string | null;
  provinceCode: string;
  provinceName: string;
  cityCode: string;
  cityName: string;
  taxRate: Prisma.Decimal;
  serviceChargeRate: Prisma.Decimal;
  pricesIncludeTax: boolean;
  status: "ACTIVE" | "ARCHIVED";
  updatedAt: Date;
  _count: { assignments: number };
}): OutletItem {
  return {
    id: outlet.id,
    code: outlet.code,
    name: outlet.name,
    timezone: outlet.timezone,
    addressLine: outlet.addressLine,
    provinceCode: outlet.provinceCode,
    provinceName: outlet.provinceName,
    cityCode: outlet.cityCode,
    cityName: outlet.cityName,
    taxRate: outlet.taxRate.toFixed(2),
    serviceChargeRate: outlet.serviceChargeRate.toFixed(2),
    pricesIncludeTax: outlet.pricesIncludeTax,
    status: outlet.status,
    staffCount: outlet._count.assignments,
    updatedAt: outlet.updatedAt.toISOString(),
  };
}
