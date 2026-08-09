"use server";

import { revalidatePath } from "next/cache";

import { AttendanceError, requestAttendanceException } from "@/lib/attendance/service";
import type { AttendanceActionState } from "@/lib/attendance/types";
import { attendanceExceptionSchema } from "@/lib/attendance/validation";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

/** Submits a manager-reviewable exception after three failed attempts. */
export async function requestAttendanceExceptionAction(rawInput: unknown): Promise<AttendanceActionState> {
  const session = await requirePermission({ attendance: ["clock"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = attendanceExceptionSchema.safeParse(rawInput);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Permintaan tidak valid." };
  try {
    await requestAttendanceException(parsed.data.verificationId, parsed.data.reason, { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role });
    revalidatePath("/attendance");
    revalidatePath("/attendance/manage");
    return { status: "success", message: "Permintaan pengecualian dikirim ke manajer." };
  } catch (error) {
    if (error instanceof AttendanceError) return { status: "error", message: error.message };
    console.error("Attendance exception request failed", error);
    return { status: "error", message: "Permintaan belum dapat dikirim." };
  }
}
