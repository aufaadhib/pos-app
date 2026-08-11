"use server";

import { revalidatePath } from "next/cache";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  addCashMovement,
  CashShiftError,
  closeCashShift,
  correctCashShiftReconciliation,
  forceCloseCashShift,
  openCashShift,
} from "@/lib/shifts/service";
import type { ShiftActionState, ShiftActor } from "@/lib/shifts/types";
import {
  cashMovementSchema,
  cashShiftReconciliationCorrectionSchema,
  closeCashShiftSchema,
  forceCloseCashShiftSchema,
  openCashShiftSchema,
} from "@/lib/shifts/validation";

/** Validates and opens one personal shift for the authenticated operator. */
export async function openCashShiftAction(_state: ShiftActionState, formData: FormData): Promise<ShiftActionState> {
  const session = await requirePermission({ shift: ["operate"] });
  const parsed = openCashShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  return executeShiftMutation(() => openCashShift(parsed.data, actorFromSession(session.user)));
}

/** Validates and appends one cash movement to the authenticated operator's shift. */
export async function addCashMovementAction(_state: ShiftActionState, formData: FormData): Promise<ShiftActionState> {
  const session = await requirePermission({ shift: ["operate"] });
  const parsed = cashMovementSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  return executeShiftMutation(() => addCashMovement(parsed.data, actorFromSession(session.user)));
}

/** Validates a blind count and closes the authenticated operator's own shift. */
export async function closeCashShiftAction(_state: ShiftActionState, formData: FormData): Promise<ShiftActionState> {
  const session = await requirePermission({ shift: ["operate"] });
  const parsed = closeCashShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  return executeShiftMutation(() => closeCashShift(parsed.data, actorFromSession(session.user)));
}

/** Validates and force-closes an outlet-scoped shift with elevated permission. */
export async function forceCloseCashShiftAction(_state: ShiftActionState, formData: FormData): Promise<ShiftActionState> {
  const session = await requirePermission({ shift: ["forceClose"] });
  const parsed = forceCloseCashShiftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  return executeShiftMutation(() => forceCloseCashShift(parsed.data, actorFromSession(session.user)));
}

/** Validates and appends one owner/manager reconciliation correction to a closed shift. */
export async function correctCashShiftReconciliationAction(_state: ShiftActionState, formData: FormData): Promise<ShiftActionState> {
  const session = await requirePermission({ shift: ["forceClose"] });
  const parsed = cashShiftReconciliationCorrectionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return invalidState(parsed.error.flatten().fieldErrors);
  return executeShiftMutation(() => correctCashShiftReconciliation(parsed.data, actorFromSession(session.user)));
}

/** Executes one protected shift mutation and refreshes all affected dynamic screens. */
async function executeShiftMutation(mutation: () => Promise<ShiftActionState>): Promise<ShiftActionState> {
  try {
    const result = await mutation();
    for (const path of ["/pos", "/shifts", "/transactions", "/workspace", "/select-outlet"]) revalidatePath(path);
    if (result.shiftId) revalidatePath(`/shifts/${result.shiftId}`);
    return result;
  } catch (error) {
    if (error instanceof CashShiftError) {
      return { status: error.code === "CONFLICT" ? "conflict" : "error", message: error.message };
    }
    console.error("Cash shift mutation failed", error);
    return { status: "error", message: "Perubahan shift belum dapat disimpan. Coba lagi." };
  }
}

/** Creates the minimal trusted actor snapshot from a verified Better Auth session. */
function actorFromSession(user: { id: string; name: string; email: string; role?: string | null }): ShiftActor {
  if (!isAppRole(user.role)) throw new CashShiftError("FORBIDDEN", "Peran akun tidak valid.");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/** Converts Zod field errors into the shared action-state shape. */
function invalidState(fieldErrors: Record<string, string[] | undefined>): ShiftActionState {
  return { status: "error", message: "Periksa kembali data shift.", fieldErrors };
}
