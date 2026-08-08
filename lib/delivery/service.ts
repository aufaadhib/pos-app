import "server-only";

import {
  AdminAuditAction,
  AdminAuditEntityType,
  CatalogStatus,
  PaymentSettlementStatus,
  Prisma,
  SaleAuditAction,
  SettlementBatchStatus,
} from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
import { calculateSettlementNet } from "@/lib/delivery/pricing";
import type {
  ChannelProductPriceInput,
  DeliveryChannelInput,
  ReverseSettlementInput,
  SettlementBatchInput,
} from "@/lib/delivery/validation";
import { prisma } from "@/lib/prisma";

type DeliveryActor = { id: string; name: string; email: string; role: AppRole };
type DeliveryErrorCode = "FORBIDDEN" | "NOT_FOUND" | "INVALID" | "CONFLICT";

export class DeliveryError extends Error {
  /** Creates a safe delivery-management error that may be shown to an authorized user. */
  constructor(public readonly code: DeliveryErrorCode, message: string) {
    super(message);
    this.name = "DeliveryError";
  }
}

/** Creates or updates one outlet channel and records the configuration change. */
export async function saveDeliveryChannel(input: DeliveryChannelInput, actor: DeliveryActor) {
  return prisma.$transaction(async (transaction) => {
    await requireOutletAccess(transaction, input.outletId, actor);
    const key = { outletId_provider: { outletId: input.outletId, provider: input.provider } };
    const current = await transaction.outletDeliveryChannel.findUnique({ where: key });
    const saved = await transaction.outletDeliveryChannel.upsert({
      where: key,
      create: {
        outletId: input.outletId,
        provider: input.provider,
        isActive: input.isActive,
        markupRate: input.markupRate,
        estimatedFeeRate: input.estimatedFeeRate,
        roundingUnit: 500,
        settlementDelayHours: input.settlementDelayHours,
      },
      update: {
        isActive: input.isActive,
        markupRate: input.markupRate,
        estimatedFeeRate: input.estimatedFeeRate,
        roundingUnit: 500,
        settlementDelayHours: input.settlementDelayHours,
      },
    });
    await transaction.adminAuditLog.create({ data: {
      entityType: AdminAuditEntityType.DELIVERY_CHANNEL,
      entityId: saved.id,
      action: current ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
      actorUserId: actor.id,
      actorEmail: actor.email,
      before: current ? channelSnapshot(current) : undefined,
      after: channelSnapshot(saved),
    } });
    return saved;
  });
}

/** Saves or removes an exact product base price for one outlet delivery channel. */
export async function saveChannelProductPrice(input: ChannelProductPriceInput, actor: DeliveryActor) {
  return prisma.$transaction(async (transaction) => {
    await requireOutletAccess(transaction, input.outletId, actor);
    const channel = await transaction.outletDeliveryChannel.findFirst({ where: { id: input.channelId, outletId: input.outletId } });
    if (!channel) throw new DeliveryError("NOT_FOUND", "Channel pengantaran tidak ditemukan.");
    const product = await transaction.product.findFirst({
      where: { id: input.productId, status: CatalogStatus.ACTIVE },
      select: { id: true, basePrice: true, outletOverrides: { where: { outletId: input.outletId }, select: { priceOverride: true } } },
    });
    if (!product) throw new DeliveryError("NOT_FOUND", "Produk aktif tidak ditemukan.");
    const key = { channelId_productId: { channelId: channel.id, productId: product.id } };
    const current = await transaction.channelProductPrice.findUnique({ where: key });
    if (input.priceOverride === undefined) {
      if (current) await transaction.channelProductPrice.delete({ where: key });
      await transaction.adminAuditLog.create({ data: {
        entityType: AdminAuditEntityType.CHANNEL_PRODUCT_PRICE,
        entityId: `${channel.id}:${product.id}`,
        action: AdminAuditAction.UPDATE,
        actorUserId: actor.id,
        actorEmail: actor.email,
        before: current ? { priceOverride: current.priceOverride.toFixed(2) } : undefined,
        after: Prisma.JsonNull,
      } });
      return null;
    }
    const directPrice = product.outletOverrides[0]?.priceOverride ?? product.basePrice;
    if (new Prisma.Decimal(input.priceOverride).lessThanOrEqualTo(directPrice)) {
      throw new DeliveryError("INVALID", "Harga channel harus lebih tinggi daripada harga outlet.");
    }
    const saved = await transaction.channelProductPrice.upsert({
      where: key,
      create: { channelId: channel.id, productId: product.id, priceOverride: input.priceOverride },
      update: { priceOverride: input.priceOverride },
    });
    await transaction.adminAuditLog.create({ data: {
      entityType: AdminAuditEntityType.CHANNEL_PRODUCT_PRICE,
      entityId: `${channel.id}:${product.id}`,
      action: current ? AdminAuditAction.UPDATE : AdminAuditAction.CREATE,
      actorUserId: actor.id,
      actorEmail: actor.email,
      before: current ? { priceOverride: current.priceOverride.toFixed(2) } : undefined,
      after: { priceOverride: saved.priceOverride.toFixed(2) },
    } });
    return saved;
  });
}

/** Confirms one balanced platform transfer and settles all selected payments atomically. */
export async function createSettlementBatch(input: SettlementBatchInput, actor: DeliveryActor) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await requireOutletAccess(transaction, input.outletId, actor);
      const channel = await transaction.outletDeliveryChannel.findFirst({ where: { id: input.channelId, outletId: input.outletId } });
      if (!channel) throw new DeliveryError("NOT_FOUND", "Channel pengantaran tidak ditemukan.");
      const payments = await transaction.salePayment.findMany({
        where: {
          id: { in: input.paymentIds },
          settlementStatus: PaymentSettlementStatus.PENDING,
          sale: { outletId: input.outletId, channelId: channel.id },
        },
        select: {
          id: true,
          saleId: true,
          amount: true,
          directEquivalentAmount: true,
          expectedNetAmount: true,
        },
      });
      if (payments.length !== input.paymentIds.length) throw new DeliveryError("CONFLICT", "Ada transaksi yang sudah diselesaikan atau tidak termasuk channel ini.");
      const gross = payments.reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
      const platformFee = new Prisma.Decimal(input.platformFeeAmount);
      const merchantPromotion = new Prisma.Decimal(input.merchantPromotionAmount);
      const otherAdjustment = new Prisma.Decimal(input.otherAdjustmentAmount);
      const netReceived = new Prisma.Decimal(input.netReceivedAmount);
      const calculatedNet = calculateSettlementNet({ gross, platformFee, merchantPromotion, otherAdjustment });
      if (!calculatedNet.equals(netReceived)) {
        throw new DeliveryError("INVALID", `Nominal tidak seimbang. Net yang benar adalah ${calculatedNet.toFixed(2)}.`);
      }
      const settlement = await transaction.platformSettlement.create({ data: {
        channelId: channel.id,
        reference: input.reference,
        grossAmount: gross,
        platformFeeAmount: platformFee,
        merchantPromotionAmount: merchantPromotion,
        otherAdjustmentAmount: otherAdjustment,
        otherAdjustmentNote: input.otherAdjustmentNote || null,
        netReceivedAmount: netReceived,
        receivedAt: new Date(input.receivedAt),
        confirmedByUserId: actor.id,
        confirmedByName: actor.name,
        confirmedByEmail: actor.email,
        items: { create: payments.map((payment) => ({
          salePaymentId: payment.id,
          grossAmount: payment.amount,
          directEquivalentAmount: payment.directEquivalentAmount!,
          expectedNetAmount: payment.expectedNetAmount!,
        })) },
      } });
      const updated = await transaction.salePayment.updateMany({
        where: { id: { in: input.paymentIds }, settlementStatus: PaymentSettlementStatus.PENDING },
        data: { settlementStatus: PaymentSettlementStatus.SETTLED },
      });
      if (updated.count !== payments.length) throw new DeliveryError("CONFLICT", "Status settlement berubah. Muat ulang data.");
      await transaction.saleAuditLog.createMany({ data: payments.map((payment) => ({
        saleId: payment.saleId,
        action: SaleAuditAction.SETTLE,
        actorUserId: actor.id,
        actorEmail: actor.email,
        after: { settlementId: settlement.id, reference: settlement.reference, netReceivedAmount: netReceived.toFixed(2) },
      })) });
      await transaction.adminAuditLog.create({ data: {
        entityType: AdminAuditEntityType.SETTLEMENT,
        entityId: settlement.id,
        action: AdminAuditAction.CREATE,
        actorUserId: actor.id,
        actorEmail: actor.email,
        after: settlementSnapshot(settlement, payments.length),
      } });
      return settlement;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new DeliveryError("CONFLICT", "Referensi settlement sudah digunakan.");
    throw error;
  }
}

/** Reverses a confirmed batch without deleting its financial history. */
export async function reverseSettlementBatch(input: ReverseSettlementInput, actor: DeliveryActor) {
  return prisma.$transaction(async (transaction) => {
    await requireOutletAccess(transaction, input.outletId, actor);
    const settlement = await transaction.platformSettlement.findFirst({
      where: { id: input.settlementId, status: SettlementBatchStatus.CONFIRMED, channel: { outletId: input.outletId } },
      select: { id: true, reference: true, items: { select: { salePaymentId: true, salePayment: { select: { saleId: true } } } } },
    });
    if (!settlement) throw new DeliveryError("CONFLICT", "Settlement tidak ditemukan atau sudah dibalik.");
    const paymentIds = settlement.items.map((item) => item.salePaymentId);
    const updated = await transaction.salePayment.updateMany({
      where: { id: { in: paymentIds }, settlementStatus: PaymentSettlementStatus.SETTLED },
      data: { settlementStatus: PaymentSettlementStatus.PENDING },
    });
    if (updated.count !== paymentIds.length) throw new DeliveryError("CONFLICT", "Sebagian transaksi sudah berubah. Pembalikan dibatalkan.");
    const reversed = await transaction.platformSettlement.update({
      where: { id: settlement.id },
      data: {
        status: SettlementBatchStatus.REVERSED,
        reversedAt: new Date(),
        reversedByUserId: actor.id,
        reversedByEmail: actor.email,
        reversalReason: input.reason,
      },
    });
    await transaction.saleAuditLog.createMany({ data: settlement.items.map((item) => ({
      saleId: item.salePayment.saleId,
      action: SaleAuditAction.UNSETTLE,
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: { settlementId: settlement.id, reference: settlement.reference, reason: input.reason },
    })) });
    await transaction.adminAuditLog.create({ data: {
      entityType: AdminAuditEntityType.SETTLEMENT,
      entityId: settlement.id,
      action: AdminAuditAction.UPDATE,
      actorUserId: actor.id,
      actorEmail: actor.email,
      after: { status: reversed.status, reversalReason: reversed.reversalReason },
    } });
    return reversed;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

/** Verifies that the actor may operate on the requested outlet. */
async function requireOutletAccess(transaction: Prisma.TransactionClient, outletId: string, actor: DeliveryActor) {
  const outlet = await transaction.outlet.findFirst({
    where: { id: outletId, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) },
    select: { id: true },
  });
  if (!outlet) throw new DeliveryError("FORBIDDEN", "Outlet tidak tersedia untuk akun ini.");
}

/** Serializes one channel configuration for its immutable audit entry. */
function channelSnapshot(value: { provider: string; isActive: boolean; markupRate: Prisma.Decimal; estimatedFeeRate: Prisma.Decimal; roundingUnit: number; settlementDelayHours: number }): Prisma.InputJsonObject {
  return { provider: value.provider, isActive: value.isActive, markupRate: value.markupRate.toFixed(2), estimatedFeeRate: value.estimatedFeeRate.toFixed(2), roundingUnit: value.roundingUnit, settlementDelayHours: value.settlementDelayHours };
}

/** Serializes one confirmed settlement without exposing relational internals. */
function settlementSnapshot(value: { reference: string; grossAmount: Prisma.Decimal; platformFeeAmount: Prisma.Decimal; merchantPromotionAmount: Prisma.Decimal; otherAdjustmentAmount: Prisma.Decimal; netReceivedAmount: Prisma.Decimal }, transactionCount: number): Prisma.InputJsonObject {
  return { reference: value.reference, grossAmount: value.grossAmount.toFixed(2), platformFeeAmount: value.platformFeeAmount.toFixed(2), merchantPromotionAmount: value.merchantPromotionAmount.toFixed(2), otherAdjustmentAmount: value.otherAdjustmentAmount.toFixed(2), netReceivedAmount: value.netReceivedAmount.toFixed(2), transactionCount };
}
