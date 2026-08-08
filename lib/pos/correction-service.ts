import "server-only";

import {
  CashShiftStatus,
  PaymentMethod,
  PaymentSettlementStatus,
  Prisma,
  SaleAuditAction,
  SaleRefundType,
  SaleStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isTransactionWriteConflict } from "@/lib/prisma-errors";
import { calculateExpectedCash, requireOpenCashShift } from "@/lib/shifts/service";
import { getOutletBusinessDate } from "@/lib/time/business-date";
import type { PosActor, TransactionActionState } from "@/lib/pos/types";
import type { RefundSaleInput, VoidSaleInput } from "@/lib/pos/validation";

type CorrectionErrorCode = "FORBIDDEN" | "NOT_FOUND" | "INVALID_STATE" | "CONFLICT";
type CorrectionInput = VoidSaleInput | RefundSaleInput;

export class SaleCorrectionError extends Error {
  /** Creates a safe sale-correction error that may be returned to an authorized operator. */
  constructor(public readonly code: CorrectionErrorCode, message: string) {
    super(message);
    this.name = "SaleCorrectionError";
  }
}

/** Voids one same-business-day sale in full while preserving its original snapshots. */
export async function voidSale(input: VoidSaleInput, actor: PosActor): Promise<TransactionActionState> {
  return createSaleCorrection(SaleRefundType.VOID, input, actor);
}

/** Refunds selected remaining item quantities and records the financial allocation atomically. */
export async function refundSale(input: RefundSaleInput, actor: PosActor): Promise<TransactionActionState> {
  return createSaleCorrection(SaleRefundType.REFUND, input, actor);
}

/** Runs the common authorization, allocation, cash, settlement, status, and audit workflow. */
async function createSaleCorrection(type: SaleRefundType, input: CorrectionInput, actor: PosActor): Promise<TransactionActionState> {
  if (actor.role === "cashier") throw new SaleCorrectionError("FORBIDDEN", "Kasir tidak dapat melakukan void atau refund.");
  const existing = await findIdempotentCorrection(input.operationToken, input.saleId, input.outletId, type, actor.id);
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const outlet = await transaction.outlet.findFirst({
          where: {
            id: input.outletId,
            status: "ACTIVE",
            ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }),
          },
          select: { id: true, timezone: true },
        });
        if (!outlet) throw new SaleCorrectionError("FORBIDDEN", "Outlet tidak tersedia untuk akun Anda.");

        const sale = await transaction.sale.findFirst({
          where: { id: input.saleId, outletId: outlet.id },
          select: {
            id: true,
            receiptNumber: true,
            businessDate: true,
            status: true,
            subtotal: true,
            serviceChargeAmount: true,
            taxAmount: true,
            pricesIncludeTax: true,
            total: true,
            payment: { select: {
              method: true,
              settlementStatus: true,
              amount: true,
              expectedFeeAmount: true,
              expectedNetAmount: true,
              directEquivalentAmount: true,
            } },
            items: { select: { id: true, quantity: true, unitPrice: true, directUnitPrice: true } },
          },
        });
        if (!sale?.payment) throw new SaleCorrectionError("NOT_FOUND", "Transaksi tidak ditemukan pada outlet aktif.");
        if (sale.payment.settlementStatus === PaymentSettlementStatus.SETTLED) {
          throw new SaleCorrectionError("INVALID_STATE", "Settlement transaksi sudah cair. Balik settlement terlebih dahulu.");
        }
        if (sale.payment.method !== PaymentMethod.CASH && !input.providerReference) {
          throw new SaleCorrectionError("INVALID_STATE", "Referensi refund bank atau provider wajib diisi.");
        }

        const [refundedTotals, refundedItems] = await Promise.all([
          transaction.saleRefund.aggregate({
            where: { saleId: sale.id },
            _sum: {
              subtotalAmount: true,
              serviceChargeAmount: true,
              taxAmount: true,
              amount: true,
              expectedFeeAmount: true,
              expectedNetAmount: true,
              directEquivalentAmount: true,
            },
          }),
          transaction.saleRefundItem.groupBy({
            by: ["saleItemId"],
            where: { refund: { saleId: sale.id } },
            _sum: { quantity: true },
          }),
        ]);
        const refundedQuantity = new Map(refundedItems.map((item) => [item.saleItemId, item._sum.quantity ?? 0]));
        const selectedItems = resolveSelectedItems(type, input, sale.items, refundedQuantity);
        const fullyCorrected = sale.items.every((item) =>
          (refundedQuantity.get(item.id) ?? 0) + (selectedItems.find((selected) => selected.saleItemId === item.id)?.quantity ?? 0) === item.quantity,
        );
        validateCorrectionState(type, sale.status, sale.businessDate, outlet.timezone, refundedItems.length, fullyCorrected);

        const allocated = allocateCorrectionAmounts({ ...sale, payment: sale.payment }, selectedItems, refundedTotals._sum, fullyCorrected);
        let cashShiftId: string | null = null;
        if (sale.payment.method === PaymentMethod.CASH) {
          const shift = await requireOpenCashShift(transaction, outlet.id, actor.id);
          const current = await transaction.cashShift.findFirst({
            where: { id: shift.id, status: CashShiftStatus.OPEN },
            select: { openingCash: true },
          });
          if (!current) throw new SaleCorrectionError("INVALID_STATE", "Shift aktif tidak lagi tersedia.");
          const cash = await calculateExpectedCash(transaction, shift.id, current.openingCash);
          if (allocated.amount.greaterThan(cash.expectedCash)) {
            throw new SaleCorrectionError("INVALID_STATE", "Saldo kas shift tidak cukup untuk membayar refund ini.");
          }
          cashShiftId = shift.id;
        }

        const refund = await transaction.saleRefund.create({
          data: {
            saleId: sale.id,
            cashShiftId,
            operationToken: input.operationToken,
            type,
            method: sale.payment.method,
            subtotalAmount: allocated.subtotalAmount,
            serviceChargeAmount: allocated.serviceChargeAmount,
            taxAmount: allocated.taxAmount,
            amount: allocated.amount,
            expectedFeeAmount: allocated.expectedFeeAmount,
            expectedNetAmount: allocated.expectedNetAmount,
            directEquivalentAmount: allocated.directEquivalentAmount,
            reason: input.reason,
            providerReference: sale.payment.method === PaymentMethod.CASH ? null : input.providerReference,
            actorUserId: actor.id,
            actorName: actor.name,
            actorEmail: actor.email,
            items: { create: selectedItems.map((item) => ({
              saleItemId: item.saleItemId,
              quantity: item.quantity,
              lineAmount: item.lineAmount,
            })) },
          },
          select: { id: true },
        });
        const nextStatus = type === SaleRefundType.VOID
          ? SaleStatus.VOIDED
          : fullyCorrected ? SaleStatus.REFUNDED : SaleStatus.PARTIALLY_REFUNDED;
        const updated = await transaction.sale.updateMany({
          where: { id: sale.id, status: sale.status },
          data: { status: nextStatus },
        });
        if (updated.count !== 1) throw new SaleCorrectionError("CONFLICT", "Status transaksi berubah. Muat ulang lalu coba kembali.");
        await transaction.saleAuditLog.create({ data: {
          saleId: sale.id,
          action: type === SaleRefundType.VOID ? SaleAuditAction.VOID : SaleAuditAction.REFUND,
          actorUserId: actor.id,
          actorEmail: actor.email,
          after: {
            refundId: refund.id,
            amount: allocated.amount.toFixed(2),
            reason: input.reason,
            cashShiftId,
            status: nextStatus,
          },
        } });
        return {
          status: "success",
          message: type === SaleRefundType.VOID
            ? `Transaksi ${sale.receiptNumber} berhasil divoid.`
            : `Refund transaksi ${sale.receiptNumber} berhasil dicatat.`,
          refundId: refund.id,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
    } catch (error) {
      if (isTransactionWriteConflict(error) && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const repeated = await findIdempotentCorrection(input.operationToken, input.saleId, input.outletId, type, actor.id);
        if (repeated) return repeated;
      }
      throw error;
    }
  }
  throw new SaleCorrectionError("CONFLICT", "Transaksi sedang sibuk. Coba kembali.");
}

/** Resolves requested item quantities against immutable sale rows and prior refunds. */
function resolveSelectedItems(
  type: SaleRefundType,
  input: CorrectionInput,
  saleItems: Array<{ id: string; quantity: number; unitPrice: Prisma.Decimal; directUnitPrice: Prisma.Decimal }>,
  refundedQuantity: Map<string, number>,
) {
  const requests = type === SaleRefundType.VOID
    ? saleItems.map((item) => ({ saleItemId: item.id, quantity: item.quantity }))
    : (input as RefundSaleInput).items;
  return requests.map((request) => {
    const item = saleItems.find((candidate) => candidate.id === request.saleItemId);
    if (!item) throw new SaleCorrectionError("INVALID_STATE", "Item refund tidak termasuk transaksi ini.");
    const remaining = item.quantity - (refundedQuantity.get(item.id) ?? 0);
    if (request.quantity > remaining) throw new SaleCorrectionError("INVALID_STATE", "Jumlah refund melebihi sisa item yang tersedia.");
    return {
      saleItemId: item.id,
      quantity: request.quantity,
      lineAmount: item.unitPrice.mul(request.quantity),
      directLineAmount: item.directUnitPrice.mul(request.quantity),
    };
  });
}

/** Rejects invalid status transitions and enforces same-business-day full voids. */
function validateCorrectionState(
  type: SaleRefundType,
  status: SaleStatus,
  businessDate: Date,
  timezone: string,
  refundedItemGroups: number,
  fullyCorrected: boolean,
) {
  if (status === SaleStatus.VOIDED || status === SaleStatus.REFUNDED) {
    throw new SaleCorrectionError("INVALID_STATE", "Transaksi ini sudah dikoreksi penuh.");
  }
  if (type === SaleRefundType.VOID) {
    const today = getOutletBusinessDate(timezone).date.toISOString().slice(0, 10);
    if (businessDate.toISOString().slice(0, 10) !== today) {
      throw new SaleCorrectionError("INVALID_STATE", "Void hanya tersedia pada tanggal bisnis yang sama. Gunakan refund.");
    }
    if (status !== SaleStatus.COMPLETED || refundedItemGroups > 0 || !fullyCorrected) {
      throw new SaleCorrectionError("INVALID_STATE", "Void hanya tersedia untuk transaksi utuh yang belum direfund.");
    }
  }
}

/** Allocates original snapshot amounts without repricing and gives the final refund all rounding residue. */
function allocateCorrectionAmounts(
  sale: {
    subtotal: Prisma.Decimal;
    serviceChargeAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    pricesIncludeTax: boolean;
    total: Prisma.Decimal;
    payment: {
      amount: Prisma.Decimal;
      expectedFeeAmount: Prisma.Decimal | null;
      expectedNetAmount: Prisma.Decimal | null;
      directEquivalentAmount: Prisma.Decimal | null;
    };
  },
  selectedItems: Array<{ lineAmount: Prisma.Decimal; directLineAmount: Prisma.Decimal }>,
  refunded: {
    subtotalAmount: Prisma.Decimal | null;
    serviceChargeAmount: Prisma.Decimal | null;
    taxAmount: Prisma.Decimal | null;
    amount: Prisma.Decimal | null;
    expectedFeeAmount: Prisma.Decimal | null;
    expectedNetAmount: Prisma.Decimal | null;
    directEquivalentAmount: Prisma.Decimal | null;
  },
  fullyCorrected: boolean,
) {
  const zero = new Prisma.Decimal(0);
  const selectedSubtotal = selectedItems.reduce((sum, item) => sum.add(item.lineAmount), zero);
  if (selectedSubtotal.lessThanOrEqualTo(0) || sale.subtotal.lessThanOrEqualTo(0)) {
    throw new SaleCorrectionError("INVALID_STATE", "Transaksi tanpa nilai tidak dapat direfund.");
  }
  const remainingSubtotal = sale.subtotal.sub(refunded.subtotalAmount ?? 0);
  const remainingService = sale.serviceChargeAmount.sub(refunded.serviceChargeAmount ?? 0);
  const remainingTax = sale.taxAmount.sub(refunded.taxAmount ?? 0);
  const remainingAmount = sale.total.sub(refunded.amount ?? 0);
  const subtotalAmount = fullyCorrected ? remainingSubtotal : minimum(selectedSubtotal, remainingSubtotal);
  let serviceChargeAmount = fullyCorrected ? remainingService : proportional(sale.serviceChargeAmount, selectedSubtotal, sale.subtotal, remainingService);
  let taxAmount = fullyCorrected ? remainingTax : proportional(sale.taxAmount, selectedSubtotal, sale.subtotal, remainingTax);
  let amount = subtotalAmount.add(serviceChargeAmount).add(sale.pricesIncludeTax ? 0 : taxAmount);
  if (amount.greaterThan(remainingAmount)) {
    let excess = amount.sub(remainingAmount);
    if (!sale.pricesIncludeTax) {
      const taxReduction = minimum(taxAmount, excess);
      taxAmount = taxAmount.sub(taxReduction);
      excess = excess.sub(taxReduction);
    }
    serviceChargeAmount = serviceChargeAmount.sub(minimum(serviceChargeAmount, excess));
    amount = remainingAmount;
  }
  const directSelected = selectedItems.reduce((sum, item) => sum.add(item.directLineAmount), zero);
  return {
    subtotalAmount,
    serviceChargeAmount,
    taxAmount,
    amount,
    expectedFeeAmount: allocatePaymentSnapshot(sale.payment.expectedFeeAmount, refunded.expectedFeeAmount, amount, sale.payment.amount, fullyCorrected),
    expectedNetAmount: allocatePaymentSnapshot(sale.payment.expectedNetAmount, refunded.expectedNetAmount, amount, sale.payment.amount, fullyCorrected),
    directEquivalentAmount: sale.payment.directEquivalentAmount
      ? fullyCorrected
        ? sale.payment.directEquivalentAmount.sub(refunded.directEquivalentAmount ?? 0)
        : minimum(directSelected, sale.payment.directEquivalentAmount.sub(refunded.directEquivalentAmount ?? 0))
      : null,
  };
}

/** Allocates one optional payment snapshot proportionally and caps it at the unrefunded remainder. */
function allocatePaymentSnapshot(
  original: Prisma.Decimal | null,
  alreadyRefunded: Prisma.Decimal | null,
  amount: Prisma.Decimal,
  paymentAmount: Prisma.Decimal,
  fullyCorrected: boolean,
) {
  if (!original) return null;
  const remaining = original.sub(alreadyRefunded ?? 0);
  return fullyCorrected ? remaining : proportional(original, amount, paymentAmount, remaining);
}

/** Returns a half-up proportional allocation no larger than the remaining snapshot amount. */
function proportional(original: Prisma.Decimal, numerator: Prisma.Decimal, denominator: Prisma.Decimal, remaining: Prisma.Decimal) {
  if (original.isZero() || denominator.isZero()) return new Prisma.Decimal(0);
  return minimum(original.mul(numerator).div(denominator).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP), remaining);
}

/** Returns the lower of two Decimal values without converting money to floating point. */
function minimum(left: Prisma.Decimal, right: Prisma.Decimal) {
  return left.lessThan(right) ? left : right;
}

/** Resolves a repeated correction token only for the same actor, sale, outlet, and operation type. */
async function findIdempotentCorrection(
  operationToken: string,
  saleId: string,
  outletId: string,
  type: SaleRefundType,
  actorUserId: string,
): Promise<TransactionActionState | null> {
  const refund = await prisma.saleRefund.findUnique({
    where: { operationToken },
    select: { id: true, saleId: true, type: true, actorUserId: true, sale: { select: { outletId: true, receiptNumber: true } } },
  });
  if (!refund) return null;
  if (refund.saleId !== saleId || refund.sale.outletId !== outletId || refund.type !== type || refund.actorUserId !== actorUserId) {
    throw new SaleCorrectionError("FORBIDDEN", "Token koreksi transaksi sudah digunakan.");
  }
  return {
    status: "success",
    message: type === SaleRefundType.VOID
      ? `Transaksi ${refund.sale.receiptNumber} berhasil divoid.`
      : `Refund transaksi ${refund.sale.receiptNumber} berhasil dicatat.`,
    refundId: refund.id,
  };
}
