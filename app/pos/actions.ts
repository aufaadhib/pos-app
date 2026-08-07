"use server";

import { revalidatePath } from "next/cache";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { PosError, createSale } from "@/lib/pos/service";
import type { CheckoutActionState } from "@/lib/pos/types";
import { checkoutSchema } from "@/lib/pos/validation";

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
    if (error instanceof PosError) return { status: "error", message: error.message };
    console.error("POS checkout failed", error);
    return { status: "error", message: "Transaksi belum dapat disimpan. Coba lagi." };
  }
}
