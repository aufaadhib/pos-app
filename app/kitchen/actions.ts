"use server";

import { revalidatePath } from "next/cache";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { OrderError, updateKitchenTicketStatus } from "@/lib/orders/service";
import type { OrderActionState } from "@/lib/orders/types";
import { ticketStatusSchema } from "@/lib/orders/validation";

/** Authorizes and advances one kitchen ticket to the next operational state. */
export async function updateKitchenTicketStatusAction(rawInput: unknown): Promise<OrderActionState> {
  const session = await requirePermission({ pos: ["operate"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = ticketStatusSchema.safeParse(rawInput);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Status ticket tidak valid." };
  try {
    const result = await updateKitchenTicketStatus(parsed.data, { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role });
    revalidatePath("/kitchen");
    return result;
  } catch (error) {
    if (error instanceof OrderError) return { status: error.code === "CONFLICT" ? "conflict" : "error", message: error.message };
    console.error("Kitchen ticket mutation failed", error);
    return { status: "error", message: "Status ticket belum dapat diperbarui." };
  }
}
