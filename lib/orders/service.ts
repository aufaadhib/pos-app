import "server-only";

import { randomUUID } from "node:crypto";

import {
  AdminAuditAction,
  AdminAuditEntityType,
  KitchenTicketKind,
  KitchenTicketLineAction,
  KitchenTicketStatus,
  OrderAuditAction,
  OrderStatus,
  OutletStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isTransactionWriteConflict } from "@/lib/prisma-errors";
import { calculateSaleTotals } from "@/lib/pos/pricing";
import { resolveCheckoutItems, type ResolvedItem } from "@/lib/pos/service";
import { requireOpenCashShift } from "@/lib/shifts/service";
import type { OrderActionState, OrderActor } from "@/lib/orders/types";
import type {
  CancelOrderInput,
  OrderMutationInput,
  SaveOrderInput,
  TicketStatusInput,
  UpdateOrderInput,
} from "@/lib/orders/validation";

export class OrderError extends Error {
  /** Creates an operational order error safe to return to authenticated staff. */
  constructor(public readonly code: "FORBIDDEN" | "INVALID" | "CONFLICT", message: string) {
    super(message);
    this.name = "OrderError";
  }
}

/** Saves one unpaid dine-in or takeaway order using fresh catalog pricing. */
export async function saveOpenOrder(input: SaveOrderInput, actor: OrderActor): Promise<OrderActionState> {
  const existing = await prisma.order.findUnique({ where: { operationToken: input.operationToken }, select: { id: true, version: true, outletId: true } });
  if (existing) return existing.outletId === input.outletId
    ? { status: "success", message: "Pesanan sudah tersimpan.", orderId: existing.id, version: existing.version }
    : forbiddenToken();

  return retrySerializable(async (transaction) => {
    const outlet = await requireOperationalOutlet(transaction, input.outletId, actor, true);
    const shift = await requireOpenCashShift(transaction, outlet.id, actor.id);
    const items = await resolveCheckoutItems(transaction, input, null);
    const totals = orderTotals(items, outlet);
    const table = activeTable(input.outletId, input.orderType, input.tableLabel);
    const itemIds = input.items.map(() => randomUUID());
    const order = await transaction.order.create({
      data: {
        operationToken: input.operationToken,
        outletId: outlet.id,
        openedShiftId: shift.id,
        orderType: input.orderType,
        tableLabel: table.label,
        normalizedTableLabel: table.normalized,
        activeTableKey: table.key,
        ...totals,
        createdByUserId: actor.id,
        createdByName: actor.name,
        createdByEmail: actor.email,
        items: { create: orderItemCreates(input.items, items, itemIds) },
      },
      select: { id: true, version: true },
    });
    await transaction.orderAuditLog.create({ data: { orderId: order.id, action: OrderAuditAction.CREATE, actorUserId: actor.id, actorEmail: actor.email, after: { orderType: input.orderType, tableLabel: table.label, total: totals.total.toFixed(2), itemCount: items.length } } });
    return { status: "success", message: "Pesanan berhasil disimpan.", orderId: order.id, version: order.version, itemIds };
  }, "Meja tersebut masih digunakan oleh pesanan aktif lain.");
}

/** Replaces the current open-order content while retaining sent rows for delta tickets. */
export async function updateOpenOrder(input: UpdateOrderInput, actor: OrderActor): Promise<OrderActionState> {
  return retrySerializable(async (transaction) => {
    const order = await requireOpenOrder(transaction, input.orderId, input.outletId, actor);
    if (order.lastOperationToken === input.operationToken) return { status: "success", message: "Perubahan pesanan sudah tersimpan.", orderId: order.id, version: order.version, itemIds: order.items.filter((item) => item.quantity > 0).map((item) => item.id) };
    if (order.version !== input.expectedVersion) throw conflict();
    const resolved = await resolveCheckoutItems(transaction, input, null);
    const outlet = await requireOperationalOutlet(transaction, input.outletId, actor, false);
    const totals = orderTotals(resolved, outlet);
    const incomingById = new Map(input.items.map((item, index) => item.orderItemId ? [item.orderItemId, { item, resolved: resolved[index] }] as const : null).filter((value): value is NonNullable<typeof value> => value !== null));
    const table = activeTable(input.outletId, input.orderType, input.tableLabel);
    const activeItems = order.items.filter((item) => item.quantity > 0);
    const unchanged = order.orderType === input.orderType
      && order.tableLabel === table.label
      && order.total.equals(totals.total)
      && activeItems.length === input.items.length
      && input.items.every((item, index) => {
        const current = activeItems.find((value) => value.id === item.orderItemId);
        return Boolean(current && current.quantity === item.quantity && (current.note ?? "") === (item.note ?? "") && sameIds(current.variantOptionIds, item.variantOptionIds) && sameIds(current.modifierOptionIds, item.modifierOptionIds) && current.unitPrice.equals(resolved[index].unitPrice));
      });
    if (unchanged) return { status: "success", message: "Pesanan tidak berubah.", orderId: order.id, version: order.version, itemIds: input.items.map((item) => item.orderItemId!) };
    const reductions = order.items.filter((item) => {
      const next = incomingById.get(item.id)?.item.quantity ?? 0;
      return next < item.quantity;
    });
    if (reductions.length > 0 && !input.reductionReason) throw new OrderError("INVALID", "Alasan wajib diisi saat mengurangi atau menghapus item.");
    if ([...incomingById.keys()].some((id) => !order.items.some((item) => item.id === id))) throw new OrderError("INVALID", "Item pesanan tidak valid.");

    for (const item of order.items) {
      const next = incomingById.get(item.id);
      await transaction.orderItem.update({
        where: { id: item.id },
        data: next ? orderItemUpdate(next.item, next.resolved, next.item.quantity < item.quantity ? input.reductionReason : undefined) : { quantity: 0, changeReason: input.reductionReason },
      });
    }
    const itemIds = input.items.map((item) => item.orderItemId ?? randomUUID());
    const newItems = input.items.map((item, index) => ({ item, resolved: resolved[index], id: itemIds[index] })).filter(({ item }) => !item.orderItemId);
    if (newItems.length) await transaction.orderItem.createMany({ data: newItems.map(({ item, resolved: value, id }) => ({ id, orderId: order.id, ...orderItemCreate(item, value) })) });

    const changed = await transaction.order.updateMany({
      where: { id: order.id, status: OrderStatus.OPEN, version: input.expectedVersion },
      data: { orderType: input.orderType, tableLabel: table.label, normalizedTableLabel: table.normalized, activeTableKey: table.key, ...totals, lastOperationToken: input.operationToken, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw conflict();
    const version = input.expectedVersion + 1;
    await transaction.orderAuditLog.create({ data: { orderId: order.id, action: OrderAuditAction.UPDATE, actorUserId: actor.id, actorEmail: actor.email, before: { version: input.expectedVersion }, after: { version, itemCount: input.items.length, reductionReason: input.reductionReason ?? null } } });
    return { status: "success", message: "Perubahan pesanan disimpan.", orderId: order.id, version, itemIds };
  }, "Meja tersebut masih digunakan oleh pesanan aktif lain.");
}

/** Accepts fresh catalog prices for an open order after explicit cashier confirmation. */
export async function refreshOpenOrderPricing(input: OrderMutationInput, actor: OrderActor): Promise<OrderActionState> {
  return retrySerializable(async (transaction) => {
    const order = await requireOpenOrder(transaction, input.orderId, input.outletId, actor);
    if (order.lastOperationToken === input.operationToken) return { status: "success", message: "Harga terbaru sudah diterapkan.", orderId: order.id, version: order.version };
    if (order.version !== input.expectedVersion) throw conflict();
    const activeItems = order.items.filter((item) => item.quantity > 0);
    const cart = activeItems.map((item) => ({ orderItemId: item.id, productId: item.productId, quantity: item.quantity, note: item.note ?? undefined, variantOptionIds: item.variantOptionIds, modifierOptionIds: item.modifierOptionIds, expectedUnitPrice: item.unitPrice.toFixed(2) }));
    const resolved = await resolveCheckoutItems(transaction, { outletId: order.outletId, items: cart }, null, true);
    const outlet = await requireOperationalOutlet(transaction, input.outletId, actor, false);
    const totals = orderTotals(resolved, outlet);
    for (const [index, item] of activeItems.entries()) await transaction.orderItem.update({ where: { id: item.id }, data: orderItemUpdate(cart[index], resolved[index]) });
    const version = order.version + 1;
    const changed = await transaction.order.updateMany({ where: { id: order.id, status: OrderStatus.OPEN, version: order.version }, data: { ...totals, lastOperationToken: input.operationToken, version, lastSentVersion: order.lastSentVersion === order.version ? version : order.lastSentVersion } });
    if (changed.count !== 1) throw conflict();
    await transaction.orderAuditLog.create({ data: { orderId: order.id, action: OrderAuditAction.PRICE_REFRESH, actorUserId: actor.id, actorEmail: actor.email, before: { total: order.total.toFixed(2) }, after: { total: totals.total.toFixed(2), version } } });
    return { status: "success", message: "Harga terbaru sudah diterapkan.", orderId: order.id, version };
  });
}

/** Emits the initial or delta kitchen ticket for every unsent order change. */
export async function sendOrderToKitchen(input: OrderMutationInput, actor: OrderActor): Promise<OrderActionState> {
  return retrySerializable(async (transaction) => {
    const idempotent = await transaction.kitchenTicket.findUnique({ where: { operationToken: input.operationToken }, select: { orderId: true, orderVersion: true } });
    if (idempotent) return idempotent.orderId === input.orderId
      ? { status: "success", message: "Ticket sudah dikirim ke dapur.", orderId: input.orderId, version: idempotent.orderVersion }
      : forbiddenToken();
    const order = await requireOpenOrder(transaction, input.orderId, input.outletId, actor);
    if (order.version !== input.expectedVersion) throw conflict();
    const lines = buildKitchenDelta(order.items);
    if (!lines.length) throw new OrderError("INVALID", "Tidak ada perubahan yang perlu dikirim ke dapur.");
    await transaction.kitchenTicket.create({
      data: { operationToken: input.operationToken, outletId: order.outletId, orderId: order.id, orderVersion: order.version, kind: order.lastSentVersion === 0 ? KitchenTicketKind.INITIAL : KitchenTicketKind.DELTA, sentByUserId: actor.id, sentByName: actor.name, lines: { create: lines } },
    });
    for (const item of order.items) await transaction.orderItem.update({ where: { id: item.id }, data: { sentQuantity: item.quantity, sentNote: item.note, sentSelectionLabel: item.selectionLabel, changeReason: null } });
    const changed = await transaction.order.updateMany({ where: { id: order.id, version: order.version, status: OrderStatus.OPEN }, data: { lastSentVersion: order.version } });
    if (changed.count !== 1) throw conflict();
    await transaction.orderAuditLog.create({ data: { orderId: order.id, action: OrderAuditAction.SEND, actorUserId: actor.id, actorEmail: actor.email, after: { version: order.version, ticketKind: order.lastSentVersion === 0 ? "INITIAL" : "DELTA", lineCount: lines.length } } });
    return { status: "success", message: "Ticket berhasil dikirim ke dapur.", orderId: order.id, version: order.version };
  });
}

/** Cancels one unpaid order and notifies the kitchen when sent quantities remain. */
export async function cancelOpenOrder(input: CancelOrderInput, actor: OrderActor): Promise<OrderActionState> {
  return retrySerializable(async (transaction) => {
    const cancelled = await transaction.order.findFirst({ where: { id: input.orderId, outletId: input.outletId, status: OrderStatus.CANCELLED, lastOperationToken: input.operationToken, ...orderAccessWhere(actor) }, select: { id: true, version: true } });
    if (cancelled) return { status: "success", message: "Pesanan sudah dibatalkan.", orderId: cancelled.id, version: cancelled.version };
    const order = await requireOpenOrder(transaction, input.orderId, input.outletId, actor);
    if (order.version !== input.expectedVersion) throw conflict();
    const nextVersion = order.version + 1;
    const sentItems = order.items.filter((item) => item.sentQuantity > 0);
    if (sentItems.length) {
      await transaction.kitchenTicket.create({ data: { operationToken: input.operationToken, outletId: order.outletId, orderId: order.id, orderVersion: nextVersion, kind: KitchenTicketKind.DELTA, sentByUserId: actor.id, sentByName: actor.name, lines: { create: sentItems.map((item) => ({ orderItemId: item.id, action: KitchenTicketLineAction.REMOVE, productName: item.productName, quantity: item.sentQuantity, selectionLabel: item.sentSelectionLabel, note: item.sentNote, reason: input.reason })) } } });
    }
    const changed = await transaction.order.updateMany({ where: { id: order.id, version: order.version, status: OrderStatus.OPEN }, data: { status: OrderStatus.CANCELLED, lastOperationToken: input.operationToken, version: nextVersion, lastSentVersion: nextVersion, activeTableKey: null, cancelledAt: new Date(), cancellationReason: input.reason } });
    if (changed.count !== 1) throw conflict();
    await transaction.orderAuditLog.create({ data: { orderId: order.id, action: OrderAuditAction.CANCEL, actorUserId: actor.id, actorEmail: actor.email, before: { version: order.version }, after: { version: nextVersion, reason: input.reason, kitchenNotified: sentItems.length > 0 } } });
    return { status: "success", message: "Pesanan berhasil dibatalkan.", orderId: order.id, version: nextVersion };
  });
}

/** Advances a kitchen ticket through Baru, Diproses, and Selesai. */
export async function updateKitchenTicketStatus(input: TicketStatusInput, actor: OrderActor): Promise<OrderActionState> {
  const ticket = await prisma.kitchenTicket.findFirst({ where: { id: input.ticketId, outletId: input.outletId, order: orderAccessWhere(actor) }, select: { id: true, status: true } });
  if (!ticket) throw new OrderError("FORBIDDEN", "Ticket dapur tidak tersedia untuk akun ini.");
  const expected = input.status === "PROCESSING" ? KitchenTicketStatus.NEW : KitchenTicketStatus.PROCESSING;
  if (ticket.status === input.status) return { status: "success", message: "Status ticket sudah diperbarui." };
  if (ticket.status !== expected) throw new OrderError("CONFLICT", "Status ticket sudah berubah. Muat ulang antrean.");
  await prisma.kitchenTicket.update({ where: { id: ticket.id }, data: { status: input.status, statusUpdatedByUserId: actor.id, statusUpdatedByName: actor.name, statusUpdatedAt: new Date(), completedAt: input.status === "COMPLETED" ? new Date() : null } });
  return { status: "success", message: input.status === "COMPLETED" ? "Ticket ditandai selesai." : "Ticket mulai diproses." };
}

/** Updates the active outlet's open-order feature and records an admin audit entry. */
export async function updateOpenOrderSetting(outletId: string, enabled: boolean, actor: OrderActor): Promise<OrderActionState> {
  if (actor.role !== "owner" && actor.role !== "manager") throw new OrderError("FORBIDDEN", "Akun ini tidak dapat mengubah pengaturan outlet.");
  const outlet = await prisma.outlet.findFirst({ where: { id: outletId, status: OutletStatus.ACTIVE, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) }, select: { id: true, openOrdersEnabled: true } });
  if (!outlet) throw new OrderError("FORBIDDEN", "Outlet aktif tidak tersedia untuk akun ini.");
  if (outlet.openOrdersEnabled === enabled) return { status: "success", message: "Pengaturan operasional tidak berubah." };
  await prisma.$transaction([
    prisma.outlet.update({ where: { id: outlet.id }, data: { openOrdersEnabled: enabled } }),
    prisma.adminAuditLog.create({ data: { entityType: AdminAuditEntityType.OUTLET, entityId: outlet.id, action: AdminAuditAction.UPDATE, actorUserId: actor.id, actorEmail: actor.email, before: { openOrdersEnabled: outlet.openOrdersEnabled }, after: { openOrdersEnabled: enabled } } }),
  ]);
  return { status: "success", message: enabled ? "Simpan order diaktifkan." : "Simpan order dinonaktifkan." };
}

type OperationalOutlet = { id: string; taxRate: Prisma.Decimal; serviceChargeRate: Prisma.Decimal; pricesIncludeTax: boolean; openOrdersEnabled: boolean };

/** Loads one active outlet and enforces assignment plus optional feature availability. */
async function requireOperationalOutlet(transaction: Prisma.TransactionClient, outletId: string, actor: OrderActor, requireOpenOrders: boolean): Promise<OperationalOutlet> {
  const outlet = await transaction.outlet.findFirst({ where: { id: outletId, status: OutletStatus.ACTIVE, ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }) }, select: { id: true, taxRate: true, serviceChargeRate: true, pricesIncludeTax: true, openOrdersEnabled: true } });
  if (!outlet) throw new OrderError("FORBIDDEN", "Outlet aktif tidak tersedia untuk akun ini.");
  if (requireOpenOrders && !outlet.openOrdersEnabled) throw new OrderError("INVALID", "Fitur simpan order belum diaktifkan untuk outlet ini.");
  return outlet;
}

/** Loads an editable order only when the actor may access its outlet. */
async function requireOpenOrder(transaction: Prisma.TransactionClient, orderId: string, outletId: string, actor: OrderActor) {
  const order = await transaction.order.findFirst({ where: { id: orderId, outletId, status: OrderStatus.OPEN, ...orderAccessWhere(actor) }, include: { items: { orderBy: { createdAt: "asc" } } } });
  if (!order) throw new OrderError("FORBIDDEN", "Open order tidak tersedia untuk akun ini.");
  return order;
}

/** Builds the Prisma outlet-access clause shared by order and ticket queries. */
function orderAccessWhere(actor: OrderActor) {
  return actor.role === "owner" ? {} : { outlet: { assignments: { some: { userId: actor.id } } } };
}

/** Calculates precise order totals from fresh resolved item prices. */
function orderTotals(items: ResolvedItem[], outlet: OperationalOutlet) {
  const subtotal = items.reduce((sum, item) => sum.add(item.lineTotal), new Prisma.Decimal(0));
  return { ...calculateSaleTotals({ subtotal, serviceChargeRate: outlet.serviceChargeRate, taxRate: outlet.taxRate, pricesIncludeTax: outlet.pricesIncludeTax }), serviceChargeRate: outlet.serviceChargeRate, taxRate: outlet.taxRate, pricesIncludeTax: outlet.pricesIncludeTax };
}

/** Maps resolved cart rows to nested Prisma order-item creates with stable IDs. */
function orderItemCreates(input: SaveOrderInput["items"], resolved: ResolvedItem[], ids: string[]) {
  return input.map((item, index) => ({ id: ids[index], ...orderItemCreate(item, resolved[index]) }));
}

/** Creates one durable order-item snapshot from authoritative catalog data. */
function orderItemCreate(item: SaveOrderInput["items"][number], resolved: ResolvedItem) {
  return { productId: resolved.productId, productName: resolved.productName, sku: resolved.sku, quantity: item.quantity, note: item.note || null, variantOptionIds: item.variantOptionIds, modifierOptionIds: item.modifierOptionIds, selectionLabel: selectionLabel(resolved), unitPrice: resolved.unitPrice };
}

/** Updates one order-item snapshot and optionally records its reduction reason. */
function orderItemUpdate(item: SaveOrderInput["items"][number], resolved: ResolvedItem, changeReason?: string) {
  return { ...orderItemCreate(item, resolved), changeReason: changeReason ?? null };
}

/** Joins selected variants and modifiers into a compact kitchen label. */
function selectionLabel(item: ResolvedItem) {
  return [...item.variants.map((value) => `${value.variantGroupName}: ${value.optionName}`), ...item.modifiers.map((value) => value.optionName)].join(" · ") || null;
}

/** Normalizes a dine-in label and produces the nullable unique active-table key. */
function activeTable(outletId: string, orderType: "DINE_IN" | "TAKEAWAY", tableLabel?: string) {
  if (orderType !== "DINE_IN") return { label: null, normalized: null, key: null };
  const label = tableLabel?.trim() ?? "";
  const normalized = label.toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
  return { label, normalized, key: `${outletId}:${normalized}` };
}

/** Compares option ID sets independently from client ordering. */
function sameIds(left: string[], right: string[]) {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

/** Builds kitchen changes from current and last-sent item snapshots. */
export function buildKitchenDelta(items: Array<{ id: string; productName: string; quantity: number; sentQuantity: number; note: string | null; sentNote: string | null; selectionLabel: string | null; sentSelectionLabel: string | null; changeReason: string | null }>): Prisma.KitchenTicketLineCreateWithoutTicketInput[] {
  const lines: Prisma.KitchenTicketLineCreateWithoutTicketInput[] = [];
  for (const item of items) {
    if (item.quantity > item.sentQuantity) lines.push({ orderItem: { connect: { id: item.id } }, action: KitchenTicketLineAction.ADD, productName: item.productName, quantity: item.quantity - item.sentQuantity, selectionLabel: item.selectionLabel, note: item.note, reason: null });
    if (item.quantity < item.sentQuantity) {
      if (!item.changeReason) throw new OrderError("INVALID", `Alasan pengurangan ${item.productName} wajib diisi.`);
      lines.push({ orderItem: { connect: { id: item.id } }, action: KitchenTicketLineAction.REMOVE, productName: item.productName, quantity: item.sentQuantity - item.quantity, selectionLabel: item.sentSelectionLabel, note: item.sentNote, reason: item.changeReason });
    }
    if (item.quantity === item.sentQuantity && item.quantity > 0 && (item.note !== item.sentNote || item.selectionLabel !== item.sentSelectionLabel)) lines.push({ orderItem: { connect: { id: item.id } }, action: KitchenTicketLineAction.UPDATE, productName: item.productName, quantity: item.quantity, selectionLabel: item.selectionLabel, note: item.note, reason: null });
  }
  return lines;
}

/** Retries transient serializable conflicts and converts unique violations to safe errors. */
async function retrySerializable<T>(work: (transaction: Prisma.TransactionClient) => Promise<T>, uniqueMessage = "Data pesanan sudah digunakan."): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 });
    } catch (error) {
      if (isTransactionWriteConflict(error) && attempt < 2) continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new OrderError("CONFLICT", uniqueMessage);
      throw error;
    }
  }
  throw conflict();
}

/** Creates the standard optimistic-concurrency error returned to POS clients. */
function conflict() {
  return new OrderError("CONFLICT", "Pesanan sudah diubah staf lain. Muat ulang sebelum melanjutkan.");
}

/** Throws when one idempotency token is reused across different resources. */
function forbiddenToken(): never {
  throw new OrderError("FORBIDDEN", "Token operasi sudah digunakan.");
}
