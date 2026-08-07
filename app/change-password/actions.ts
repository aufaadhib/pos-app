"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAppRole } from "@/lib/auth/permissions";
import { requireSession } from "@/lib/auth/session";
import { changeOwnPassword, StaffError } from "@/lib/staff/service";
import type { StaffActionState } from "@/lib/staff/types";
import { changePasswordSchema } from "@/lib/staff/validation";

export async function changePasswordAction(_state: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const authSession = await requireSession();
  if (!isAppRole(authSession.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      status: "error",
      message: "Periksa kembali kata sandi.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  try {
    await changeOwnPassword(parsed.data, { id: authSession.session.id }, {
      id: authSession.user.id,
      email: authSession.user.email,
      role: authSession.user.role,
    });
  } catch (error) {
    if (error instanceof StaffError) return { status: "error", message: error.message };
    console.error("Password change failed", error);
    return { status: "error", message: "Kata sandi belum dapat diubah. Coba lagi." };
  }
  revalidatePath("/");
  redirect("/select-outlet");
}
