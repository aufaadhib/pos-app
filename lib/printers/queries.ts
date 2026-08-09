import "server-only";

import { OutletStatus } from "@/generated/prisma/client";
import type { AppRole } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

/** Reads fresh receipt settings for one assigned active outlet. */
export async function getPrinterSettings(outletId: string, userId: string, role: AppRole) {
  return prisma.outlet.findFirst({
    where: {
      id: outletId,
      status: OutletStatus.ACTIVE,
      ...(role === "owner" ? {} : { assignments: { some: { userId } } }),
    },
    select: {
      id: true,
      code: true,
      name: true,
      receiptPaperSize: true,
      receiptFooter: true,
    },
  });
}
