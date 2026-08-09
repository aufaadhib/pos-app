import "server-only";

import { KitchenTicketStatus, OrderStatus, OutletStatus } from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
import type { KitchenTicketView, OpenOrder } from "@/lib/orders/types";
import { prisma } from "@/lib/prisma";

/** Returns fresh unpaid orders visible to staff assigned to one outlet. */
export async function getOpenOrders(outletId: string, userId: string, role: AppRole): Promise<OpenOrder[]> {
  const orders = await prisma.order.findMany({
    where: { outletId, status: OrderStatus.OPEN, ...(role === "owner" ? {} : { outlet: { assignments: { some: { userId } } } }) },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      version: true,
      lastSentVersion: true,
      orderType: true,
      tableLabel: true,
      total: true,
      createdByName: true,
      updatedAt: true,
      items: { where: { quantity: { gt: 0 } }, orderBy: { createdAt: "asc" }, select: { id: true, productId: true, productName: true, sku: true, quantity: true, note: true, variantOptionIds: true, modifierOptionIds: true, selectionLabel: true, unitPrice: true } },
    },
  });
  return orders.map((order) => ({ ...order, orderType: order.orderType as "DINE_IN" | "TAKEAWAY", total: order.total.toFixed(2), updatedAt: order.updatedAt.toISOString(), items: order.items.map((item) => ({ ...item, note: item.note ?? "", selectionLabel: item.selectionLabel ?? "", unitPrice: item.unitPrice.toFixed(2) })) }));
}

/** Returns the latest fresh kitchen queue for one authorized outlet. */
export async function getKitchenTickets(outletId: string, userId: string, role: AppRole): Promise<KitchenTicketView[]> {
  const tickets = await prisma.kitchenTicket.findMany({
    where: { outletId, ...(role === "owner" ? {} : { order: { outlet: { assignments: { some: { userId } } } } }) },
    orderBy: [{ status: "asc" }, { sentAt: "asc" }],
    take: 150,
    select: { id: true, number: true, kind: true, status: true, sentAt: true, sentByName: true, order: { select: { orderType: true, tableLabel: true, externalOrderId: true } }, lines: { select: { id: true, action: true, productName: true, quantity: true, selectionLabel: true, note: true, reason: true } } },
  });
  return tickets.map((ticket) => ({ ...ticket, number: ticket.number.toString(), sentAt: ticket.sentAt.toISOString() }));
}

/** Returns settings for the current active outlet after enforcing assignment. */
export async function getOutletOperations(outletId: string, userId: string, role: AppRole) {
  return prisma.outlet.findFirst({
    where: { id: outletId, status: OutletStatus.ACTIVE, ...(role === "owner" ? {} : { assignments: { some: { userId } } }) },
    select: { id: true, code: true, name: true, openOrdersEnabled: true },
  });
}

/** Returns whether an outlet has any unfinished kitchen tickets. */
export async function hasActiveKitchenTickets(outletId: string) {
  return (await prisma.kitchenTicket.count({ where: { outletId, status: { in: [KitchenTicketStatus.NEW, KitchenTicketStatus.PROCESSING] } } })) > 0;
}
