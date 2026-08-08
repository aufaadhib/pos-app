"use server";

import { revalidatePath } from "next/cache";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  createSettlementBatch,
  DeliveryError,
  reverseSettlementBatch,
  saveChannelProductPrice,
  saveDeliveryChannel,
} from "@/lib/delivery/service";
import type { DeliveryActionState } from "@/lib/delivery/types";
import {
  channelProductPriceSchema,
  deliveryChannelSchema,
  reverseSettlementSchema,
  settlementBatchSchema,
} from "@/lib/delivery/validation";

/** Validates owner channel configuration and refreshes all affected operational prices. */
export async function saveDeliveryChannelAction(_state: DeliveryActionState, formData: FormData): Promise<DeliveryActionState> {
  const session = await requirePermission({ deliveryChannel: ["manage"] });
  const parsed = deliveryChannelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  return executeDeliveryMutation(
    () => saveDeliveryChannel(parsed.data, actorFromSession(session.user)),
    "Pengaturan channel berhasil disimpan.",
    ["/settlements", "/pos"],
  );
}

/** Validates one exact product price override for an outlet delivery channel. */
export async function saveChannelProductPriceAction(_state: DeliveryActionState, formData: FormData): Promise<DeliveryActionState> {
  const session = await requirePermission({ deliveryChannel: ["manage"] });
  const parsed = channelProductPriceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  return executeDeliveryMutation(
    () => saveChannelProductPrice(parsed.data, actorFromSession(session.user)),
    parsed.data.priceOverride === undefined ? "Harga khusus berhasil dihapus." : "Harga khusus berhasil disimpan.",
    ["/settlements", "/pos"],
  );
}

/** Confirms one balanced transfer batch with manager settlement permission. */
export async function createSettlementBatchAction(_state: DeliveryActionState, formData: FormData): Promise<DeliveryActionState> {
  const session = await requirePermission({ settlement: ["reconcile"] });
  const parsed = settlementBatchSchema.safeParse({
    ...Object.fromEntries(formData),
    paymentIds: formData.getAll("paymentIds"),
  });
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  return executeDeliveryMutation(
    () => createSettlementBatch(parsed.data, actorFromSession(session.user)),
    "Settlement berhasil dikonfirmasi.",
    ["/settlements", "/transactions", "/workspace"],
  );
}

/** Reverses an incorrect settlement while retaining its complete history. */
export async function reverseSettlementBatchAction(_state: DeliveryActionState, formData: FormData): Promise<DeliveryActionState> {
  const session = await requirePermission({ settlement: ["reverse"] });
  const parsed = reverseSettlementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  return executeDeliveryMutation(
    () => reverseSettlementBatch(parsed.data, actorFromSession(session.user)),
    "Settlement berhasil dibalik dan transaksi kembali pending.",
    ["/settlements", "/transactions", "/workspace"],
  );
}

/** Executes a protected delivery mutation and converts safe domain errors into action state. */
async function executeDeliveryMutation(mutation: () => Promise<unknown>, successMessage: string, paths: string[]): Promise<DeliveryActionState> {
  try {
    await mutation();
    for (const path of paths) revalidatePath(path);
    return { status: "success", message: successMessage };
  } catch (error) {
    if (error instanceof DeliveryError) return { status: error.code === "CONFLICT" ? "conflict" : "error", message: error.message };
    console.error("Delivery mutation failed", error);
    return { status: "error", message: "Perubahan belum dapat disimpan. Coba lagi." };
  }
}

/** Builds the trusted audit actor shape from a verified Better Auth session user. */
function actorFromSession(user: { id: string; name: string; email: string; role?: string | null }) {
  if (!isAppRole(user.role)) throw new DeliveryError("FORBIDDEN", "Peran akun tidak valid.");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Converts flattened Zod errors into the shared action-state contract. */
function invalidState(fieldErrors: Record<string, string[] | undefined>): DeliveryActionState {
  return { status: "error", message: "Periksa kembali data yang dimasukkan.", fieldErrors };
}
