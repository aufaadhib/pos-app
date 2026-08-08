"use server";

import { revalidatePath } from "next/cache";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { refundSale, SaleCorrectionError, voidSale } from "@/lib/pos/correction-service";
import type { PosActor, TransactionActionState } from "@/lib/pos/types";
import { parseRefundSaleForm, voidSaleSchema } from "@/lib/pos/validation";

/** Validates and performs one full same-business-day void for an authorized manager or owner. */
export async function voidSaleAction(_state: TransactionActionState, formData: FormData): Promise<TransactionActionState> {
  const session = await requirePermission({ transaction: ["correct"] });
  const parsed = voidSaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  const outlet = await requireActiveOutlet(session);
  if (outlet.id !== parsed.data.outletId) return { status: "error", message: "Transaksi tidak berada pada outlet aktif." };
  return executeCorrection(() => voidSale(parsed.data, actorFromSession(session.user)), parsed.data.saleId);
}

/** Validates and performs one item-based refund for an authorized manager or owner. */
export async function refundSaleAction(_state: TransactionActionState, formData: FormData): Promise<TransactionActionState> {
  const session = await requirePermission({ transaction: ["correct"] });
  const parsed = parseRefundSaleForm(formData);
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  const outlet = await requireActiveOutlet(session);
  if (outlet.id !== parsed.data.outletId) return { status: "error", message: "Transaksi tidak berada pada outlet aktif." };
  return executeCorrection(() => refundSale(parsed.data, actorFromSession(session.user)), parsed.data.saleId);
}

/** Executes one correction and refreshes every dynamic financial screen affected by it. */
async function executeCorrection(mutation: () => Promise<TransactionActionState>, saleId: string): Promise<TransactionActionState> {
  try {
    const result = await mutation();
    for (const path of [`/transactions/${saleId}`, "/transactions", "/shifts", "/settlements", "/workspace"]) revalidatePath(path);
    return result;
  } catch (error) {
    if (error instanceof SaleCorrectionError) {
      return { status: error.code === "CONFLICT" ? "conflict" : "error", message: error.message };
    }
    console.error("Sale correction failed", error);
    return { status: "error", message: "Koreksi transaksi belum dapat disimpan. Coba lagi." };
  }
}

/** Creates the minimal trusted actor snapshot from a verified Better Auth session. */
function actorFromSession(user: { id: string; name: string; email: string; role?: string | null }): PosActor {
  if (!isAppRole(user.role)) throw new SaleCorrectionError("FORBIDDEN", "Peran akun tidak valid.");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Converts Zod field errors into the transaction action-state shape. */
function invalidState(fieldErrors: Record<string, string[] | undefined>): TransactionActionState {
  return { status: "error", message: "Periksa kembali data koreksi transaksi.", fieldErrors };
}
