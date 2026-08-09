"use server";

import { revalidatePath } from "next/cache";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { PosError, createSale } from "@/lib/pos/service";
import type { CheckoutActionState } from "@/lib/pos/types";
import { checkoutSchema } from "@/lib/pos/validation";
import { CashShiftError } from "@/lib/shifts/service";
import {
  cancelOpenOrder,
  OrderError,
  refreshOpenOrderPricing,
  saveOpenOrder,
  sendOrderToKitchen,
  updateOpenOrder,
} from "@/lib/orders/service";
import type { OrderActionState, OrderActor } from "@/lib/orders/types";
import { cancelOrderSchema, orderMutationSchema, saveOrderSchema, updateOrderSchema } from "@/lib/orders/validation";
import type { ZodType } from "zod";

/** Validates, authorizes, and commits one internal POS checkout request. */
export async function checkoutSaleAction(rawInput: unknown): Promise<CheckoutActionState> {
  const session = await requirePermission({ pos: ["operate"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = checkoutSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Periksa kembali data transaksi." };
  }
  try {
    const result = await createSale(parsed.data, {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    });
    revalidatePath("/transactions");
    return result;
  } catch (error) {
    if (error instanceof PosError || error instanceof CashShiftError) return { status: "error", message: error.message, ...(error instanceof PosError && error.code === "PRICE_CHANGED" ? { code: "PRICE_CHANGED" as const } : {}) };
    console.error("POS checkout failed", error);
    return { status: "error", message: "Transaksi belum dapat disimpan. Coba lagi." };
  }
}

/** Validates and persists one unpaid order for the active outlet. */
export async function saveOpenOrderAction(rawInput: unknown): Promise<OrderActionState> {
  return executeOrderAction(saveOrderSchema, rawInput, saveOpenOrder);
}

/** Validates an optimistic open-order edit and preserves sent rows for delta tickets. */
export async function updateOpenOrderAction(rawInput: unknown): Promise<OrderActionState> {
  return executeOrderAction(updateOrderSchema, rawInput, updateOpenOrder);
}

/** Sends every unsent order change to the kitchen queue. */
export async function sendOrderToKitchenAction(rawInput: unknown): Promise<OrderActionState> {
  return executeOrderAction(orderMutationSchema, rawInput, sendOrderToKitchen);
}

/** Applies authoritative current prices after explicit cashier confirmation. */
export async function refreshOpenOrderPricingAction(rawInput: unknown): Promise<OrderActionState> {
  return executeOrderAction(orderMutationSchema, rawInput, refreshOpenOrderPricing);
}

/** Cancels one unpaid order with a mandatory operational reason. */
export async function cancelOpenOrderAction(rawInput: unknown): Promise<OrderActionState> {
  return executeOrderAction(cancelOrderSchema, rawInput, cancelOpenOrder);
}

/** Shares the authentication, validation, revalidation, and safe error boundary for order mutations. */
async function executeOrderAction<Input>(schema: ZodType<Input>, rawInput: unknown, mutation: (input: Input, actor: OrderActor) => Promise<OrderActionState>): Promise<OrderActionState> {
  const session = await requirePermission({ pos: ["operate"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Periksa kembali data pesanan." };
  try {
    const result = await mutation(parsed.data, { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role });
    revalidatePath("/pos");
    revalidatePath("/kitchen");
    return result;
  } catch (error) {
    if (error instanceof OrderError || error instanceof PosError || error instanceof CashShiftError) return { status: error instanceof OrderError && error.code === "CONFLICT" ? "conflict" : "error", message: error.message };
    console.error("Open order mutation failed", error);
    return { status: "error", message: "Pesanan belum dapat disimpan. Coba lagi." };
  }
}
