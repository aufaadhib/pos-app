"use server";

import { revalidatePath } from "next/cache";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { OrderError, updateOpenOrderSetting } from "@/lib/orders/service";
import type { OrderActionState } from "@/lib/orders/types";
import { outletOperationsSchema } from "@/lib/orders/validation";

/** Validates and updates open-order availability for the active outlet. */
export async function updateOpenOrderSettingAction(rawInput: unknown): Promise<OrderActionState> {
  const session = await requirePermission({ settings: ["manage"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = outletOperationsSchema.safeParse(rawInput);
  if (!parsed.success) return { status: "error", message: "Pengaturan outlet tidak valid." };
  try {
    const result = await updateOpenOrderSetting(parsed.data.outletId, parsed.data.openOrdersEnabled, { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role });
    revalidatePath("/settings");
    revalidatePath("/pos");
    return result;
  } catch (error) {
    if (error instanceof OrderError) return { status: "error", message: error.message };
    console.error("Outlet operations setting failed", error);
    return { status: "error", message: "Pengaturan belum dapat disimpan." };
  }
}
