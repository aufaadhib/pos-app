"use server";

import { revalidatePath } from "next/cache";

import { AttendanceError, updateAttendanceSettings } from "@/lib/attendance/service";
import type { AttendanceActionState } from "@/lib/attendance/types";
import { attendanceSettingsSchema } from "@/lib/attendance/validation";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { requireActiveOutlet } from "@/lib/outlets/context";

/** Validates and persists the active outlet geofence plus enabled state. */
export async function updateAttendanceSettingsAction(rawInput: unknown): Promise<AttendanceActionState> {
  const session = await requirePermission({ attendance: ["manage"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = attendanceSettingsSchema.safeParse(rawInput);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Pengaturan absensi tidak valid." };
  const activeOutlet = await requireActiveOutlet(session);
  if (activeOutlet.id !== parsed.data.outletId) return { status: "error", message: "Pengaturan hanya dapat diubah untuk outlet aktif." };
  try {
    await updateAttendanceSettings(parsed.data, { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role });
    revalidatePath("/settings/attendance");
    revalidatePath("/attendance");
    return { status: "success", message: "Pengaturan absensi berhasil disimpan." };
  } catch (error) {
    if (error instanceof AttendanceError) return { status: "error", message: error.message };
    console.error("Attendance settings failed", error);
    return { status: "error", message: "Pengaturan absensi belum dapat disimpan." };
  }
}
