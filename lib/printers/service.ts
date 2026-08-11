import "server-only";

import { AdminAuditAction, AdminAuditEntityType, OutletStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { PrinterSettingsActor, PrinterSettingsActionState } from "@/lib/printers/types";
import type { PrinterSettingsInput } from "@/lib/printers/validation";

export class PrinterSettingsError extends Error {
  /** Creates an authenticated settings error that is safe to show in the UI. */
  constructor(public readonly code: "FORBIDDEN" | "INVALID", message: string) {
    super(message);
    this.name = "PrinterSettingsError";
  }
}

/** Updates outlet receipt settings and their before/after audit snapshot atomically. */
export async function updatePrinterSettings(
  input: PrinterSettingsInput,
  actor: PrinterSettingsActor,
): Promise<PrinterSettingsActionState> {
  if (actor.role !== "owner" && actor.role !== "manager") {
    throw new PrinterSettingsError("FORBIDDEN", "Kasir tidak dapat mengubah pengaturan printer.");
  }

  return prisma.$transaction(async (transaction) => {
    const outlet = await transaction.outlet.findFirst({
      where: {
        id: input.outletId,
        status: OutletStatus.ACTIVE,
        ...(actor.role === "owner" ? {} : { assignments: { some: { userId: actor.id } } }),
      },
      select: { id: true, receiptPaperSize: true, receiptFooter: true },
    });
    if (!outlet) {
      throw new PrinterSettingsError("FORBIDDEN", "Outlet aktif tidak tersedia untuk akun ini.");
    }
    if (outlet.receiptPaperSize === input.receiptPaperSize && outlet.receiptFooter === input.receiptFooter) {
      return { status: "success", message: "Pengaturan printer tidak berubah." };
    }

    await transaction.outlet.update({
      where: { id: outlet.id },
      data: {
        receiptPaperSize: input.receiptPaperSize,
        receiptFooter: input.receiptFooter,
      },
    });
    await transaction.adminAuditLog.create({
      data: {
        entityType: AdminAuditEntityType.OUTLET,
        entityId: outlet.id,
        action: AdminAuditAction.UPDATE,
        actorUserId: actor.id,
        actorEmail: actor.email,
        before: {
          receiptPaperSize: outlet.receiptPaperSize,
          receiptFooter: outlet.receiptFooter,
        },
        after: {
          receiptPaperSize: input.receiptPaperSize,
          receiptFooter: input.receiptFooter,
        },
      },
    });
    return { status: "success", message: "Pengaturan printer berhasil disimpan." };
  });
}
