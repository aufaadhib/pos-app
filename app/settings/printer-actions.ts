"use server";

import { revalidatePath } from "next/cache";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";
import { PrinterSettingsError, updatePrinterSettings } from "@/lib/printers/service";
import type { PrinterSettingsActionState } from "@/lib/printers/types";
import { printerSettingsSchema } from "@/lib/printers/validation";

/** Validates, authorizes, and persists receipt settings for the active outlet only. */
export async function updatePrinterSettingsAction(rawInput: unknown): Promise<PrinterSettingsActionState> {
  const session = await requirePermission({ settings: ["manage"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = printerSettingsSchema.safeParse(rawInput);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Pengaturan printer tidak valid." };
  const activeOutlet = await requireActiveOutlet(session);
  if (activeOutlet.id !== parsed.data.outletId) return { status: "error", message: "Pengaturan hanya dapat diubah untuk outlet aktif." };

  try {
    const result = await updatePrinterSettings(parsed.data, {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    });
    revalidatePath("/settings/printers");
    revalidatePath("/pos");
    return result;
  } catch (error) {
    if (error instanceof PrinterSettingsError) return { status: "error", message: error.message };
    console.error("Receipt printer setting failed", error);
    return { status: "error", message: "Pengaturan printer belum dapat disimpan." };
  }
}
