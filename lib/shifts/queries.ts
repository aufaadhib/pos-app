import "server-only";

import { CashMovementDirection, CashShiftStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CashShiftDetail,
  CashShiftListItem,
  CashShiftPage,
  CurrentCashShift,
  PaymentSummary,
  ShiftActor,
} from "@/lib/shifts/types";

const shiftPageSize = 25;

const shiftListSelect = {
  id: true,
  outletId: true,
  businessDate: true,
  status: true,
  openingCash: true,
  openedByName: true,
  openedAt: true,
  closeMode: true,
  closedByName: true,
  closedAt: true,
  expectedCash: true,
  actualCash: true,
  cashDifference: true,
} satisfies Prisma.CashShiftSelect;

/** Returns the user's only open shift, including its outlet identity. */
export async function getCurrentCashShift(userId: string): Promise<CurrentCashShift | null> {
  const shift = await prisma.cashShift.findUnique({
    where: { openUserKey: userId },
    select: {
      ...shiftListSelect,
      outlet: { select: { name: true, timezone: true } },
    },
  });
  if (!shift) return null;
  return {
    ...serializeShift(shift),
    outletName: shift.outlet.name,
    outletTimezone: shift.outlet.timezone,
    isCurrentUser: true,
  };
}

/** Returns whether the current workspace header should warn before logout. */
export async function hasCurrentCashShift(userId: string) {
  return Boolean(await prisma.cashShift.findUnique({ where: { openUserKey: userId }, select: { id: true } }));
}

/** Reads one outlet-scoped, role-filtered shift page with bounded history. */
export async function getCashShiftPage(input: {
  outletId: string;
  actor: ShiftActor;
  page: number;
  status: "all" | "OPEN" | "CLOSED";
}): Promise<CashShiftPage | null> {
  if (!(await canAccessOutlet(input.outletId, input.actor))) return null;
  const scope = {
    outletId: input.outletId,
    ...(input.actor.role === "owner" || input.actor.role === "manager" ? {} : { openedByUserId: input.actor.id }),
  } satisfies Prisma.CashShiftWhereInput;
  const where = {
    ...scope,
    ...(input.status === "all" ? {} : { status: input.status }),
  } satisfies Prisma.CashShiftWhereInput;
  const [current, openShifts, history, totalItems] = await Promise.all([
    getCurrentCashShift(input.actor.id),
    prisma.cashShift.findMany({
      where: { ...scope, status: CashShiftStatus.OPEN },
      orderBy: { openedAt: "asc" },
      select: shiftListSelect,
      take: 100,
    }),
    prisma.cashShift.findMany({
      where,
      orderBy: { openedAt: "desc" },
      skip: (input.page - 1) * shiftPageSize,
      take: shiftPageSize,
      select: shiftListSelect,
    }),
    prisma.cashShift.count({ where }),
  ]);
  return {
    current,
    openShifts: openShifts.map(serializeShift),
    history: history.map(serializeShift),
    page: input.page,
    totalPages: Math.max(1, Math.ceil(totalItems / shiftPageSize)),
    totalItems,
  };
}

/** Reads one authorized shift, financial breakdown, immutable activity, and paginated sales. */
export async function getCashShiftDetail(input: {
  shiftId: string;
  outletId: string;
  actor: ShiftActor;
  salesPage: number;
}): Promise<CashShiftDetail | null> {
  if (!(await canAccessOutlet(input.outletId, input.actor))) return null;
  const shift = await prisma.cashShift.findFirst({
    where: {
      id: input.shiftId,
      outletId: input.outletId,
      ...(input.actor.role === "owner" || input.actor.role === "manager" ? {} : { openedByUserId: input.actor.id }),
    },
    select: {
      ...shiftListSelect,
      openedByUserId: true,
      openedByEmail: true,
      closedByEmail: true,
      closeReason: true,
      outlet: { select: { name: true, timezone: true } },
    },
  });
  if (!shift) return null;

  const [payments, cashRefunds, movements, audits, sales, salesTotalItems] = await Promise.all([
    prisma.salePayment.groupBy({
      by: ["method"],
      where: { sale: { shiftId: shift.id } },
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { method: "asc" },
    }),
    prisma.saleRefund.aggregate({
      where: { cashShiftId: shift.id, method: "CASH" },
      _sum: { amount: true },
    }),
    prisma.cashMovement.findMany({
      where: { shiftId: shift.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, direction: true, category: true, amount: true, reason: true, actorName: true, createdAt: true },
      take: 500,
    }),
    prisma.cashShiftAuditLog.findMany({
      where: { shiftId: shift.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, action: true, actorEmail: true, createdAt: true },
      take: 100,
    }),
    prisma.sale.findMany({
      where: { shiftId: shift.id },
      orderBy: { completedAt: "desc" },
      skip: (input.salesPage - 1) * shiftPageSize,
      take: shiftPageSize,
      select: { id: true, receiptNumber: true, total: true, completedAt: true, payment: { select: { method: true } } },
    }),
    prisma.sale.count({ where: { shiftId: shift.id } }),
  ]);
  const concealOpenOwnerTotals = shift.status === CashShiftStatus.OPEN && shift.openedByUserId === input.actor.id;
  const cashIn = sumMovements(movements, CashMovementDirection.IN);
  const cashOut = sumMovements(movements, CashMovementDirection.OUT);
  const paymentSummaries: PaymentSummary[] = payments.map((payment) => ({
    method: payment.method,
    amount: payment._sum.amount?.toFixed(2) ?? "0.00",
    count: payment._count._all,
  }));
  const cashSales = paymentSummaries.find((payment) => payment.method === "CASH")?.amount ?? "0.00";

  return {
    ...serializeShift(shift),
    isCurrentUser: shift.openedByUserId === input.actor.id,
    outletName: shift.outlet.name,
    outletTimezone: shift.outlet.timezone,
    openedByEmail: shift.openedByEmail,
    closedByEmail: shift.closedByEmail,
    closeReason: shift.closeReason,
    cashSales: concealOpenOwnerTotals ? null : cashSales,
    cashRefunds: concealOpenOwnerTotals ? null : cashRefunds._sum.amount?.toFixed(2) ?? "0.00",
    cashIn: concealOpenOwnerTotals ? null : cashIn.toFixed(2),
    cashOut: concealOpenOwnerTotals ? null : cashOut.toFixed(2),
    paymentSummaries: concealOpenOwnerTotals ? null : paymentSummaries,
    movements: movements.map((movement) => ({
      ...movement,
      amount: movement.amount.toFixed(2),
      createdAt: movement.createdAt.toISOString(),
    })),
    audits: audits.map((audit) => ({ ...audit, createdAt: audit.createdAt.toISOString() })),
    sales: sales.flatMap((sale) => sale.payment ? [{
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      total: sale.total.toFixed(2),
      paymentMethod: sale.payment.method,
      completedAt: sale.completedAt.toISOString(),
    }] : []),
    salesPage: input.salesPage,
    salesTotalPages: Math.max(1, Math.ceil(salesTotalItems / shiftPageSize)),
    salesTotalItems,
  };
}

/** Checks active outlet access without returning any unnecessary outlet fields. */
async function canAccessOutlet(outletId: string, actor: ShiftActor) {
  return Boolean(await prisma.outlet.findFirst({
    where: {
      id: outletId,
      status: "ACTIVE",
      ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }),
    },
    select: { id: true },
  }));
}

/** Converts a Prisma shift projection into a client-safe list DTO. */
function serializeShift(shift: Prisma.CashShiftGetPayload<{ select: typeof shiftListSelect }>): CashShiftListItem {
  return {
    id: shift.id,
    outletId: shift.outletId,
    businessDate: shift.businessDate.toISOString().slice(0, 10),
    status: shift.status,
    openingCash: shift.openingCash.toFixed(2),
    openedByName: shift.openedByName,
    openedAt: shift.openedAt.toISOString(),
    closeMode: shift.closeMode,
    closedByName: shift.closedByName,
    closedAt: shift.closedAt?.toISOString() ?? null,
    expectedCash: shift.expectedCash?.toFixed(2) ?? null,
    actualCash: shift.actualCash?.toFixed(2) ?? null,
    cashDifference: shift.cashDifference?.toFixed(2) ?? null,
  };
}

/** Sums one direction of already bounded immutable movement records. */
function sumMovements(
  movements: Array<{ direction: CashMovementDirection; amount: Prisma.Decimal }>,
  direction: CashMovementDirection,
) {
  return movements.filter((movement) => movement.direction === direction).reduce((sum, movement) => sum.add(movement.amount), new Prisma.Decimal(0));
}
