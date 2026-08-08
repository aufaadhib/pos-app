import "server-only";

import {
  CashMovementDirection,
  CashShiftAuditAction,
  CashShiftCloseMode,
  CashShiftStatus,
  OutletStatus,
  PaymentMethod,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isTransactionWriteConflict } from "@/lib/prisma-errors";
import type {
  CashMovementInput,
  CloseCashShiftInput,
  ForceCloseCashShiftInput,
  OpenCashShiftInput,
} from "@/lib/shifts/validation";
import type { ShiftActionState, ShiftActor } from "@/lib/shifts/types";
import { getOutletBusinessDate } from "@/lib/time/business-date";

export type CashShiftErrorCode = "FORBIDDEN" | "CONFLICT" | "INVALID_STATE" | "NOT_FOUND";

export class CashShiftError extends Error {
  /** Creates a safe shift-domain error that may be shown to an authenticated operator. */
  constructor(public readonly code: CashShiftErrorCode, message: string) {
    super(message);
    this.name = "CashShiftError";
  }
}

/** Opens one personal shift at an accessible active outlet and writes its audit atomically. */
export async function openCashShift(input: OpenCashShiftInput, actor: ShiftActor): Promise<ShiftActionState> {
  const saved = await findOpenTokenResult(input.openToken, input.outletId, actor.id);
  if (saved) return saved;

  try {
    return await runSerializable(async (transaction) => {
      const outlet = await findAccessibleOutlet(transaction, input.outletId, actor);
      const businessDate = getOutletBusinessDate(outlet.timezone).date;
      const shift = await transaction.cashShift.create({
        data: {
          outletId: outlet.id,
          businessDate,
          openUserKey: actor.id,
          openToken: input.openToken,
          openingCash: new Prisma.Decimal(input.openingCash),
          openedByUserId: actor.id,
          openedByName: actor.name,
          openedByEmail: actor.email,
        },
        select: { id: true },
      });
      await writeShiftAudit(transaction, shift.id, CashShiftAuditAction.OPEN, actor, {
        outletId: outlet.id,
        openingCash: new Prisma.Decimal(input.openingCash).toFixed(2),
        businessDate: businessDate.toISOString(),
      });
      return { status: "success", message: "Shift berhasil dibuka.", shiftId: shift.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const repeated = await findOpenTokenResult(input.openToken, input.outletId, actor.id);
      if (repeated) return repeated;
      throw new CashShiftError("CONFLICT", "Anda masih memiliki shift terbuka. Tutup shift tersebut terlebih dahulu.");
    }
    throw error;
  }
}

/** Appends one idempotent cash movement to the actor's own open shift. */
export async function addCashMovement(input: CashMovementInput, actor: ShiftActor): Promise<ShiftActionState> {
  const saved = await findMovementTokenResult(input.operationToken, input.shiftId, actor.id);
  if (saved) return saved;

  try {
    return await runSerializable(async (transaction) => {
      const shift = await transaction.cashShift.findFirst({
        where: { id: input.shiftId, outletId: input.outletId, status: CashShiftStatus.OPEN, openedByUserId: actor.id },
        select: { id: true, openingCash: true },
      });
      if (!shift) throw new CashShiftError("FORBIDDEN", "Shift aktif milik Anda tidak ditemukan pada outlet ini.");
      const amount = new Prisma.Decimal(input.amount);
      if (input.direction === CashMovementDirection.OUT) {
        const available = await calculateExpectedCash(transaction, shift.id, shift.openingCash);
        if (amount.greaterThan(available.expectedCash)) {
          throw new CashShiftError("INVALID_STATE", "Kas keluar melebihi saldo kas seharusnya saat ini.");
        }
      }
      const movement = await transaction.cashMovement.create({
        data: {
          shiftId: shift.id,
          operationToken: input.operationToken,
          direction: input.direction,
          category: input.category,
          amount,
          reason: input.reason,
          actorUserId: actor.id,
          actorName: actor.name,
          actorEmail: actor.email,
        },
        select: { id: true },
      });
      const action = input.direction === CashMovementDirection.IN ? CashShiftAuditAction.CASH_IN : CashShiftAuditAction.CASH_OUT;
      await writeShiftAudit(transaction, shift.id, action, actor, {
        movementId: movement.id,
        category: input.category,
        amount: amount.toFixed(2),
        reason: input.reason,
      });
      return { status: "success", message: input.direction === "IN" ? "Kas masuk berhasil dicatat." : "Kas keluar berhasil dicatat.", shiftId: shift.id };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const repeated = await findMovementTokenResult(input.operationToken, input.shiftId, actor.id);
      if (repeated) return repeated;
    }
    throw error;
  }
}

/** Closes the actor's own shift after a blind physical cash count. */
export async function closeCashShift(input: CloseCashShiftInput, actor: ShiftActor): Promise<ShiftActionState> {
  return completeCashShift(input, actor, CashShiftCloseMode.SELF, null);
}

/** Force-closes another operator's shift with elevated permission and a mandatory reason. */
export async function forceCloseCashShift(input: ForceCloseCashShiftInput, actor: ShiftActor): Promise<ShiftActionState> {
  if (actor.role === "cashier") throw new CashShiftError("FORBIDDEN", "Kasir tidak dapat menutup shift staf lain.");
  return completeCashShift(input, actor, CashShiftCloseMode.FORCED, input.reason);
}

/** Finds the actor's matching open shift inside an existing checkout transaction. */
export async function requireOpenCashShift(
  transaction: Prisma.TransactionClient,
  outletId: string,
  actorUserId: string,
) {
  const shift = await transaction.cashShift.findUnique({
    where: { openUserKey: actorUserId },
    select: { id: true, outletId: true },
  });
  if (!shift) throw new CashShiftError("INVALID_STATE", "Buka shift kasir sebelum menyelesaikan pembayaran.");
  if (shift.outletId !== outletId) throw new CashShiftError("INVALID_STATE", "Shift Anda masih aktif di outlet lain. Tutup shift tersebut terlebih dahulu.");
  return shift;
}

/** Returns whether one user currently owns an open shift. */
export async function hasOpenCashShiftForUser(transaction: Prisma.TransactionClient, userId: string) {
  return Boolean(await transaction.cashShift.findUnique({ where: { openUserKey: userId }, select: { id: true } }));
}

/** Returns whether one outlet currently has any open shift. */
export async function hasOpenCashShiftForOutlet(transaction: Prisma.TransactionClient, outletId: string) {
  return Boolean(await transaction.cashShift.findFirst({ where: { outletId, status: CashShiftStatus.OPEN }, select: { id: true } }));
}

/** Closes one shift with a stable aggregate snapshot and an immutable audit entry. */
async function completeCashShift(
  input: CloseCashShiftInput,
  actor: ShiftActor,
  mode: CashShiftCloseMode,
  reason: string | null,
): Promise<ShiftActionState> {
  const saved = await findCloseTokenResult(input.closeToken, input.shiftId, actor.id, mode);
  if (saved) return saved;

  try {
    return await runSerializable(async (transaction) => {
      const shift = await transaction.cashShift.findFirst({
        where: { id: input.shiftId, outletId: input.outletId, status: CashShiftStatus.OPEN },
        select: { id: true, outletId: true, openingCash: true, openedByUserId: true },
      });
      if (!shift) throw new CashShiftError("NOT_FOUND", "Shift terbuka tidak ditemukan atau sudah ditutup.");
      if (mode === CashShiftCloseMode.SELF && shift.openedByUserId !== actor.id) {
        throw new CashShiftError("FORBIDDEN", "Anda hanya dapat menutup shift milik sendiri.");
      }
      if (mode === CashShiftCloseMode.FORCED) await findAccessibleOutlet(transaction, shift.outletId, actor);

      const totals = await calculateExpectedCash(transaction, shift.id, shift.openingCash);
      const actualCash = new Prisma.Decimal(input.actualCash);
      const cashDifference = actualCash.sub(totals.expectedCash);
      const closedAt = new Date();
      const update = await transaction.cashShift.updateMany({
        where: { id: shift.id, status: CashShiftStatus.OPEN, openUserKey: shift.openedByUserId },
        data: {
          status: CashShiftStatus.CLOSED,
          openUserKey: null,
          closeMode: mode,
          closeToken: input.closeToken,
          closedByUserId: actor.id,
          closedByName: actor.name,
          closedByEmail: actor.email,
          expectedCash: totals.expectedCash,
          actualCash,
          cashDifference,
          closeReason: reason,
          closedAt,
        },
      });
      if (update.count !== 1) throw new CashShiftError("CONFLICT", "Shift berubah saat sedang ditutup. Muat ulang lalu coba kembali.");
      const action = mode === CashShiftCloseMode.FORCED ? CashShiftAuditAction.FORCE_CLOSE : CashShiftAuditAction.CLOSE;
      await writeShiftAudit(transaction, shift.id, action, actor, {
        expectedCash: totals.expectedCash.toFixed(2),
        actualCash: actualCash.toFixed(2),
        cashDifference: cashDifference.toFixed(2),
        cashSales: totals.cashSales.toFixed(2),
        cashIn: totals.cashIn.toFixed(2),
        cashOut: totals.cashOut.toFixed(2),
        reason,
        closedAt: closedAt.toISOString(),
      });
      return {
        status: "success",
        message: mode === CashShiftCloseMode.FORCED ? "Shift berhasil ditutup oleh pengelola." : "Shift berhasil ditutup.",
        shiftId: shift.id,
        expectedCash: totals.expectedCash.toFixed(2),
        actualCash: actualCash.toFixed(2),
        cashDifference: cashDifference.toFixed(2),
      };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const repeated = await findCloseTokenResult(input.closeToken, input.shiftId, actor.id, mode);
      if (repeated) return repeated;
    }
    throw error;
  }
}

/** Calculates cash sales and manual movements for one shift inside a trusted transaction. */
async function calculateExpectedCash(transaction: Prisma.TransactionClient, shiftId: string, openingCash: Prisma.Decimal) {
  const [cashSalesAggregate, movements] = await Promise.all([
    transaction.salePayment.aggregate({
      where: { method: PaymentMethod.CASH, sale: { shiftId } },
      _sum: { amount: true },
    }),
    transaction.cashMovement.groupBy({
      by: ["direction"],
      where: { shiftId },
      _sum: { amount: true },
    }),
  ]);
  const cashSales = cashSalesAggregate._sum.amount ?? new Prisma.Decimal(0);
  const cashIn = movements.find((movement) => movement.direction === CashMovementDirection.IN)?._sum.amount ?? new Prisma.Decimal(0);
  const cashOut = movements.find((movement) => movement.direction === CashMovementDirection.OUT)?._sum.amount ?? new Prisma.Decimal(0);
  return { cashSales, cashIn, cashOut, expectedCash: openingCash.add(cashSales).add(cashIn).sub(cashOut) };
}

/** Verifies one active outlet against the actor's owner or assignment scope. */
async function findAccessibleOutlet(transaction: Prisma.TransactionClient, outletId: string, actor: ShiftActor) {
  const outlet = await transaction.outlet.findFirst({
    where: {
      id: outletId,
      status: OutletStatus.ACTIVE,
      ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }),
    },
    select: { id: true, timezone: true },
  });
  if (!outlet) throw new CashShiftError("FORBIDDEN", "Outlet tidak tersedia untuk akun Anda.");
  return outlet;
}

/** Runs a financial mutation at serializable isolation and retries transaction conflicts. */
async function runSerializable<T>(mutation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(mutation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      if (isTransactionWriteConflict(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new CashShiftError("CONFLICT", "Data shift sedang sibuk. Coba kembali.");
}

/** Writes a minimal immutable audit snapshot for one shift event. */
async function writeShiftAudit(
  transaction: Prisma.TransactionClient,
  shiftId: string,
  action: CashShiftAuditAction,
  actor: ShiftActor,
  after: Prisma.InputJsonObject,
) {
  await transaction.cashShiftAuditLog.create({
    data: { shiftId, action, actorUserId: actor.id, actorEmail: actor.email, after },
  });
}

/** Resolves a repeated open request only when it belongs to the same actor and outlet. */
async function findOpenTokenResult(token: string, outletId: string, actorUserId: string): Promise<ShiftActionState | null> {
  const shift = await prisma.cashShift.findUnique({ where: { openToken: token }, select: { id: true, outletId: true, openedByUserId: true } });
  if (!shift) return null;
  if (shift.outletId !== outletId || shift.openedByUserId !== actorUserId) throw new CashShiftError("FORBIDDEN", "Token pembukaan shift sudah digunakan.");
  return { status: "success", message: "Shift berhasil dibuka.", shiftId: shift.id };
}

/** Resolves a repeated movement request without exposing another actor's movement. */
async function findMovementTokenResult(token: string, shiftId: string, actorUserId: string): Promise<ShiftActionState | null> {
  const movement = await prisma.cashMovement.findUnique({ where: { operationToken: token }, select: { shiftId: true, actorUserId: true, direction: true } });
  if (!movement) return null;
  if (movement.shiftId !== shiftId || movement.actorUserId !== actorUserId) throw new CashShiftError("FORBIDDEN", "Token pergerakan kas sudah digunakan.");
  return { status: "success", message: movement.direction === "IN" ? "Kas masuk berhasil dicatat." : "Kas keluar berhasil dicatat.", shiftId };
}

/** Resolves a repeated close request to its stored financial outcome. */
async function findCloseTokenResult(token: string, shiftId: string, actorUserId: string, mode: CashShiftCloseMode): Promise<ShiftActionState | null> {
  const shift = await prisma.cashShift.findUnique({
    where: { closeToken: token },
    select: { id: true, closeMode: true, closedByUserId: true, expectedCash: true, actualCash: true, cashDifference: true },
  });
  if (!shift) return null;
  if (shift.id !== shiftId || shift.closedByUserId !== actorUserId || shift.closeMode !== mode) throw new CashShiftError("FORBIDDEN", "Token penutupan shift sudah digunakan.");
  return {
    status: "success",
    message: mode === CashShiftCloseMode.FORCED ? "Shift berhasil ditutup oleh pengelola." : "Shift berhasil ditutup.",
    shiftId,
    expectedCash: shift.expectedCash!.toFixed(2),
    actualCash: shift.actualCash!.toFixed(2),
    cashDifference: shift.cashDifference!.toFixed(2),
  };
}
