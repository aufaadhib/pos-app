import "server-only";

import {
  CatalogStatus,
  OutletStatus,
  Prisma,
  SaleAuditAction,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateSaleTotals } from "@/lib/pos/pricing";
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
  variants: Array<{
    variantGroupId: string;
    variantGroupName: string;
    optionId: string;
    optionName: string;
    priceAdjustment: Prisma.Decimal;
  }>;
  modifiers: Array<{
    modifierGroupId: string;
    modifierGroupName: string;
    optionId: string;
    optionName: string;
    priceAdjustment: Prisma.Decimal;
  }>;
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

        const items = await resolveCheckoutItems(transaction, input);
        const subtotal = items.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));
        const totals = calculateSaleTotals({
          subtotal,
          serviceChargeRate: outlet.serviceChargeRate,
          taxRate: outlet.taxRate,
          pricesIncludeTax: outlet.pricesIncludeTax,
        });
        const payment = resolvePayment(input, totals.total);
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
            orderType: input.orderType,
            tableLabel: input.orderType === "DINE_IN" ? input.tableLabel : null,
            subtotal: totals.subtotal,
            serviceChargeRate: outlet.serviceChargeRate,
            serviceChargeAmount: totals.serviceChargeAmount,
            taxRate: outlet.taxRate,
            taxAmount: totals.taxAmount,
            pricesIncludeTax: outlet.pricesIncludeTax,
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
                variants: { create: item.variants },
                modifiers: { create: item.modifiers },
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
              paymentMethod: input.payment.method,
            },
          },
        });
        return serializeSaleResult(sale);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) {
        const saved = await findIdempotentSale(input.checkoutToken, input.outletId, actor.id);
        if (saved) return saved;
        if (attempt < 2) continue;
      }
      throw error;
    }
  }
  throw new PosError("INVALID_CART", "Transaksi sedang sibuk. Coba checkout kembali.");
}

/** Rebuilds cart prices and selection rules from fresh catalog records inside checkout. */
async function resolveCheckoutItems(transaction: Prisma.TransactionClient, input: CheckoutInput): Promise<ResolvedItem[]> {
  const productIds = Array.from(new Set(input.items.map((item) => item.productId)));
  const products = await transaction.product.findMany({
    where: { id: { in: productIds }, status: CatalogStatus.ACTIVE, category: { status: CatalogStatus.ACTIVE } },
    select: {
      id: true,
      name: true,
      sku: true,
      basePrice: true,
      outletOverrides: { where: { outletId: input.outletId }, select: { isAvailable: true, priceOverride: true } },
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
    const baseUnitPrice = productOverride?.priceOverride ?? product.basePrice;
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
        priceAdjustment: option.outletOverrides[0]?.priceAdjustmentOverride ?? option.priceAdjustment,
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
        priceAdjustment: option.priceAdjustment,
      }));
    });
    if (modifiers.length !== selectedModifierIds.size) throw new PosError("INVALID_CART", `Pilihan modifier ${product.name} tidak valid.`);

    const variantUnitAmount = variants.reduce((sum, value) => sum.add(value.priceAdjustment), new Prisma.Decimal(0));
    const modifierUnitAmount = modifiers.reduce((sum, value) => sum.add(value.priceAdjustment), new Prisma.Decimal(0));
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
      variants,
      modifiers,
    };
  });
}

/** Validates one payment against the authoritative total and returns its database shape. */
function resolvePayment(input: CheckoutInput, total: Prisma.Decimal) {
  if (input.payment.method !== "CASH") {
    return { method: input.payment.method, amount: total, reference: input.payment.reference || null };
  }
  const tenderedAmount = new Prisma.Decimal(input.payment.tenderedAmount!);
  if (tenderedAmount.lessThan(total)) throw new PosError("PAYMENT_INVALID", "Uang diterima kurang dari total pembayaran.");
  return {
    method: input.payment.method,
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
