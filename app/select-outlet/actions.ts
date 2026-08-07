"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { OutletError, selectActiveOutlet } from "@/lib/outlets/service";
import type { OutletActionState } from "@/lib/outlets/types";
import { selectOutletSchema } from "@/lib/outlets/validation";

export async function selectOutletAction(_state: OutletActionState, formData: FormData): Promise<OutletActionState> {
  const authSession = await requirePermission({ outlet: ["view"] });
  if (!isAppRole(authSession.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = selectOutletSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Pilih outlet terlebih dahulu." };
  }
  try {
    await selectActiveOutlet(parsed.data.outletId, {
      id: authSession.session.id,
      userId: authSession.user.id,
    }, {
      id: authSession.user.id,
      email: authSession.user.email,
      role: authSession.user.role,
    });
  } catch (error) {
    if (error instanceof OutletError) return { status: "error", message: error.message };
    console.error("Outlet selection failed", error);
    return { status: "error", message: "Outlet belum dapat dipilih. Coba lagi." };
  }
  revalidatePath("/workspace");
  redirect("/workspace");
}
