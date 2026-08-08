import "server-only";

import {
  CatalogStatus,
  PaymentMethod,
  PaymentSettlementStatus,
  OutletStatus,
  Prisma,
  SaleAuditAction,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateSaleTotals } from "@/lib/pos/pricing";
import { calculateChannelPrice, calculateExpectedSettlement } from "@/lib/delivery/pricing";
import type { CheckoutInput } from "@/lib/pos/validation";
import type { CheckoutActionState, PosActor } from "@/lib/pos/types";

type PosErrorCode = "FORBIDDEN" | "INVALID_CART" | "PRICE_CHANGED" | "PAYMENT_INVALID";

type ResolvedItem = {
  productId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  note: string | null;
  baseUnitPrice: Prisma.Decimal;
  variantUnitAmount: Prisma.Decimal;
  modifierUnitAmount: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  directUnitPrice: Prisma.Decimal;
  variants: Array<{
    variantGroupId: string;
    variantGroupName: string;
    optionId: string;
    optionName: string;
    priceAdjustment: Prisma.Decimal;
    directPriceAdjustment: Prisma.Decimal;
  }>;
  modifiers: Array<{
    modifierGroupId: string;
    modifierGroupName: string;
    optionId: string;
    optionName: string;
    priceAdjustment: Prisma.Decimal;
    directPriceAdjustment: Prisma.Decimal;
  }>;
};

type ResolvedDeliveryChannel = {
  id: string;
  markupRate: Prisma.Decimal;
  estimatedFeeRate: Prisma.Decimal;
  roundingUnit: number;
  settlementDelayHours: number;
};

export class PosError extends Error {
  /** Creates a safe operational error that may be shown directly to the cashier. */
  constructor(public readonly code: PosErrorCode, message: string) {
    super(message);
    this.name = "PosError";
  }
}

/** Creates one paid sale, payment, receipt sequence, item snapshots, and audit atomically. */
export async function createSale(input: CheckoutInput, actor: PosActor): Promise<CheckoutActionState> {
  const existing = await findIdempotentSale(input.checkoutToken, input.outletId, actor.id);
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const outlet = await transaction.outlet.findFirst({
          where: {
            id: input.outletId,
            status: OutletStatus.ACTIVE,
            ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }),
          },
          select: {
            id: true,
            code: true,
            timezone: true,
            taxRate: true,
            serviceChargeRate: true,
            pricesIncludeTax: true,
          },
        });
        if (!outlet) throw new PosError("FORBIDDEN", "Outlet aktif tidak tersedia untuk akun ini.");

        const channel = input.source.type === "DELIVERY_PLATFORM"
          ? await transaction.outletDeliveryChannel.findFirst({
            where: { id: input.source.channelId, outletId: outlet.id, isActive: true },
            select: { id: true, markupRate: true, estimatedFeeRate: true, roundingUnit: true, settlementDelayHours: true },
          })
          : null;
        if (input.source.type === "DELIVERY_PLATFORM" && !channel) throw new PosError("INVALID_CART", "Channel pengantaran tidak aktif. Muat ulang menu.");

        const items = await resolveCheckoutItems(transaction, input, channel);
        const subtotal = items.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));
        const directEquivalentAmount = items.reduce((sum, item) => sum.add(item.directUnitPrice.mul(item.quantity)), new Prisma.Decimal(0));
        const totals = calculateSaleTotals({
          subtotal,
          serviceChargeRate: channel ? new Prisma.Decimal(0) : outlet.serviceChargeRate,
          taxRate: outlet.taxRate,
          pricesIncludeTax: channel ? true : outlet.pricesIncludeTax,
        });
        const payment = resolvePayment(input, totals.total, directEquivalentAmount, channel);
        const { businessDate, dateToken } = getBusinessDate(outlet.timezone);
        const sequence = await transaction.receiptSequence.upsert({
          where: { outletId_businessDate: { outletId: outlet.id, businessDate } },
          create: { outletId: outlet.id, businessDate, lastValue: 1 },
          update: { lastValue: { increment: 1 } },
          select: { lastValue: true },
        });
        const receiptNumber = `${outlet.code}-${dateToken}-${String(sequence.lastValue).padStart(4, "0")}`;
        const sale = await transaction.sale.create({
          data: {
            checkoutToken: input.checkoutToken,
            outletId: outlet.id,
            receiptNumber,
            businessDate,
            dailySequence: sequence.lastValue,
            orderType: channel ? "DELIVERY" : input.orderType,
            tableLabel: !channel && input.orderType === "DINE_IN" ? input.tableLabel : null,
            channelId: channel?.id ?? null,
            externalOrderId: input.source.type === "DELIVERY_PLATFORM" ? input.source.externalOrderId : null,
            subtotal: totals.subtotal,
            serviceChargeRate: channel ? 0 : outlet.serviceChargeRate,
            serviceChargeAmount: totals.serviceChargeAmount,
            taxRate: outlet.taxRate,
            taxAmount: totals.taxAmount,
            pricesIncludeTax: channel ? true : outlet.pricesIncludeTax,
            total: totals.total,
            createdByUserId: actor.id,
            createdByName: actor.name,
            createdByEmail: actor.email,
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                sku: item.sku,
                quantity: item.quantity,
                note: item.note,
                baseUnitPrice: item.baseUnitPrice,
                variantUnitAmount: item.variantUnitAmount,
                modifierUnitAmount: item.modifierUnitAmount,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
                directUnitPrice: item.directUnitPrice,
                variants: { create: item.variants.map((variant) => ({ variantGroupId: variant.variantGroupId, variantGroupName: variant.variantGroupName, optionId: variant.optionId, optionName: variant.optionName, priceAdjustment: variant.priceAdjustment })) },
                modifiers: { create: item.modifiers.map((modifier) => ({ modifierGroupId: modifier.modifierGroupId, modifierGroupName: modifier.modifierGroupName, optionId: modifier.optionId, optionName: modifier.optionName, priceAdjustment: modifier.priceAdjustment })) },
              })),
            },
            payment: { create: payment },
          },
          select: { id: true, receiptNumber: true, total: true, payment: { select: { changeAmount: true } } },
        });
        await transaction.saleAuditLog.create({
          data: {
            saleId: sale.id,
            action: SaleAuditAction.CREATE,
            actorUserId: actor.id,
            actorEmail: actor.email,
            after: {
              receiptNumber: sale.receiptNumber,
              outletId: outlet.id,
              itemCount: items.length,
              total: sale.total.toFixed(2),
              paymentMethod: channel ? PaymentMethod.DELIVERY_PLATFORM : input.payment!.method,
              deliveryChannelId: channel?.id ?? null,
              externalOrderId: input.source.type === "DELIVERY_PLATFORM" ? input.source.externalOrderId : null,
            },
          },
        });
        return serializeSaleResult(sale);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        const saved = await findIdempotentSale(input.checkoutToken, input.outletId, actor.id);
        if (saved) return saved;
        if (error.code === "P2002" && input.source.type === "DELIVERY_PLATFORM" && String(error.meta?.target).includes("externalOrderId")) {
          throw new PosError("INVALID_CART", "Nomor order platform sudah pernah digunakan.");
        }
        if (attempt < 2) continue;
      }
      throw error;
    }
  }
  throw new PosError("INVALID_CART", "Transaksi sedang sibuk. Coba checkout kembali.");
}

/** Rebuilds cart prices and selection rules from fresh catalog records inside checkout. */
async function resolveCheckoutItems(transaction: Prisma.TransactionClient, input: CheckoutInput, channel: ResolvedDeliveryChannel | null): Promise<ResolvedItem[]> {
  const productIds = Array.from(new Set(input.items.map((item) => item.productId)));
  const products = await transaction.product.findMany({
    where: { id: { in: productIds }, status: CatalogStatus.ACTIVE, category: { status: CatalogStatus.ACTIVE } },
    select: {
      id: true,
      name: true,
      sku: true,
      basePrice: true,
      outletOverrides: { where: { outletId: input.outletId }, select: { isAvailable: true, priceOverride: true } },
      channelPrices: { where: { channelId: channel?.id ?? "" }, select: { priceOverride: true } },
      variantGroups: {
        where: { status: CatalogStatus.ACTIVE },
        orderBy: { displayOrder: "asc" },
        select: {
          id: true,
          name: true,
          options: {
            where: { status: CatalogStatus.ACTIVE },
            select: {
              id: true,
              name: true,
              priceAdjustment: true,
              outletOverrides: { where: { outletId: input.outletId }, select: { isAvailable: true, priceAdjustmentOverride: true } },
            },
          },
        },
      },
      modifierGroups: {
        where: { status: CatalogStatus.ACTIVE, modifierGroup: { status: CatalogStatus.ACTIVE } },
        orderBy: { displayOrder: "asc" },
        select: {
          modifierGroupId: true,
          minSelections: true,
          maxSelections: true,
          modifierGroup: {
            select: {
              name: true,
              options: { where: { status: CatalogStatus.ACTIVE }, select: { id: true, name: true, priceAdjustment: true } },
            },
          },
        },
      },
    },
  });
  if (products.length !== productIds.length) throw new PosError("INVALID_CART", "Ada produk yang sudah tidak aktif. Muat ulang menu.");
  const productMap = new Map(products.map((product) => [product.id, product]));

  return input.items.map((cartItem) => {
    const product = productMap.get(cartItem.productId)!;
    const productOverride = product.outletOverrides[0];
    if (productOverride?.isAvailable === false) throw new PosError("INVALID_CART", `${product.name} sudah tidak tersedia.`);
    const directBaseUnitPrice = productOverride?.priceOverride ?? product.basePrice;
    const baseUnitPrice = channel
      ? product.channelPrices[0]?.priceOverride ?? calculateChannelPrice(directBaseUnitPrice, channel.markupRate, channel.roundingUnit)
      : directBaseUnitPrice;
    const selectedVariantIds = new Set(cartItem.variantOptionIds);
    const variants = product.variantGroups.map((group) => {
      const selected = group.options.filter((option) => option.outletOverrides[0]?.isAvailable !== false && selectedVariantIds.has(option.id));
      if (selected.length !== 1) throw new PosError("INVALID_CART", `Pilih satu opsi ${group.name} untuk ${product.name}.`);
      const option = selected[0];
      return {
        variantGroupId: group.id,
        variantGroupName: group.name,
        optionId: option.id,
        optionName: option.name,
        directPriceAdjustment: option.outletOverrides[0]?.priceAdjustmentOverride ?? option.priceAdjustment,
        priceAdjustment: channel
          ? calculateChannelPrice(option.outletOverrides[0]?.priceAdjustmentOverride ?? option.priceAdjustment, channel.markupRate, channel.roundingUnit)
          : option.outletOverrides[0]?.priceAdjustmentOverride ?? option.priceAdjustment,
      };
    });
    if (variants.length !== selectedVariantIds.size) throw new PosError("INVALID_CART", `Pilihan varian ${product.name} tidak valid.`);

    const selectedModifierIds = new Set(cartItem.modifierOptionIds);
    const modifiers = product.modifierGroups.flatMap((relation) => {
      const selected = relation.modifierGroup.options.filter((option) => selectedModifierIds.has(option.id));
      if (selected.length < relation.minSelections || selected.length > relation.maxSelections) {
        throw new PosError("INVALID_CART", `Pilih ${relation.minSelections}-${relation.maxSelections} opsi ${relation.modifierGroup.name}.`);
      }
      return selected.map((option) => ({
        modifierGroupId: relation.modifierGroupId,
        modifierGroupName: relation.modifierGroup.name,
        optionId: option.id,
        optionName: option.name,
        directPriceAdjustment: option.priceAdjustment,
        priceAdjustment: channel ? calculateChannelPrice(option.priceAdjustment, channel.markupRate, channel.roundingUnit) : option.priceAdjustment,
      }));
    });
    if (modifiers.length !== selectedModifierIds.size) throw new PosError("INVALID_CART", `Pilihan modifier ${product.name} tidak valid.`);

    const variantUnitAmount = variants.reduce((sum, value) => sum.add(value.priceAdjustment), new Prisma.Decimal(0));
    const modifierUnitAmount = modifiers.reduce((sum, value) => sum.add(value.priceAdjustment), new Prisma.Decimal(0));
    const directUnitPrice = directBaseUnitPrice
      .add(variants.reduce((sum, value) => sum.add(value.directPriceAdjustment), new Prisma.Decimal(0)))
      .add(modifiers.reduce((sum, value) => sum.add(value.directPriceAdjustment), new Prisma.Decimal(0)));
    const unitPrice = baseUnitPrice.add(variantUnitAmount).add(modifierUnitAmount);
    if (!unitPrice.equals(new Prisma.Decimal(cartItem.expectedUnitPrice))) {
      throw new PosError("PRICE_CHANGED", `Harga ${product.name} berubah. Muat ulang menu sebelum checkout.`);
    }
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: cartItem.quantity,
      note: cartItem.note || null,
      baseUnitPrice,
      variantUnitAmount,
      modifierUnitAmount,
      unitPrice,
      lineTotal: unitPrice.mul(cartItem.quantity),
      directUnitPrice,
      variants,
      modifiers,
    };
  });
}

/** Validates one payment against the authoritative total and returns its database shape. */
function resolvePayment(input: CheckoutInput, total: Prisma.Decimal, directEquivalentAmount: Prisma.Decimal, channel: ResolvedDeliveryChannel | null) {
  if (channel && input.source.type === "DELIVERY_PLATFORM") {
    const expected = calculateExpectedSettlement(total, channel.estimatedFeeRate);
    return {
      method: PaymentMethod.DELIVERY_PLATFORM,
      amount: total,
      reference: input.source.externalOrderId,
      settlementStatus: PaymentSettlementStatus.PENDING,
      expectedFeeRate: channel.estimatedFeeRate,
      expectedFeeAmount: expected.fee,
      expectedNetAmount: expected.net,
      directEquivalentAmount,
      expectedSettlementAt: new Date(Date.now() + channel.settlementDelayHours * 60 * 60 * 1000),
    };
  }
  const payment = input.payment!;
  if (payment.method !== "CASH") {
    return { method: payment.method, amount: total, reference: payment.reference || null };
  }
  const tenderedAmount = new Prisma.Decimal(payment.tenderedAmount!);
  if (tenderedAmount.lessThan(total)) throw new PosError("PAYMENT_INVALID", "Uang diterima kurang dari total pembayaran.");
  return {
    method: payment.method,
    amount: total,
    reference: null,
    tenderedAmount,
    changeAmount: tenderedAmount.sub(total),
  };
}

/** Converts the current instant into a stable outlet-local business date and receipt token. */
function getBusinessDate(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const date = `${values.year}-${values.month}-${values.day}`;
  return { businessDate: new Date(`${date}T00:00:00.000Z`), dateToken: date.replaceAll("-", "") };
}

/** Finds an earlier checkout response without exposing another actor's transaction. */
async function findIdempotentSale(checkoutToken: string, outletId: string, actorUserId: string): Promise<CheckoutActionState | null> {
  const sale = await prisma.sale.findUnique({
    where: { checkoutToken },
    select: { id: true, outletId: true, createdByUserId: true, receiptNumber: true, total: true, payment: { select: { changeAmount: true } } },
  });
  if (!sale) return null;
  if (sale.outletId !== outletId || sale.createdByUserId !== actorUserId) throw new PosError("FORBIDDEN", "Token checkout sudah digunakan.");
  return serializeSaleResult(sale);
}

/** Serializes a successful database sale into the Client Component action result. */
function serializeSaleResult(sale: {
  id: string;
  receiptNumber: string;
  total: Prisma.Decimal;
  payment: { changeAmount: Prisma.Decimal | null } | null;
}): CheckoutActionState {
  return {
    status: "success",
    message: `Transaksi ${sale.receiptNumber} berhasil disimpan.`,
    saleId: sale.id,
    receiptNumber: sale.receiptNumber,
    total: sale.total.toFixed(2),
    changeAmount: sale.payment?.changeAmount?.toFixed(2) ?? null,
  };
}
