"use server";

import { revalidatePath } from "next/cache";

import { AttendanceError, correctAttendanceSession, reviewAttendanceException, revokeFaceProfile } from "@/lib/attendance/service";
import type { AttendanceActionState } from "@/lib/attendance/types";
import { attendanceCorrectionSchema, attendanceReviewSchema } from "@/lib/attendance/validation";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

/** Reviews one pending exception after repeating role, scope, and self-review checks. */
export async function reviewAttendanceExceptionAction(rawInput: unknown): Promise<AttendanceActionState> {
  return runManagerAction({ attendance: ["review"] }, rawInput, attendanceReviewSchema.safeParse, reviewAttendanceException);
}

/** Appends a corrected time record while preserving original attendance timestamps. */
export async function correctAttendanceSessionAction(rawInput: unknown): Promise<AttendanceActionState> {
  return runManagerAction({ attendance: ["correct"] }, rawInput, attendanceCorrectionSchema.safeParse, correctAttendanceSession);
}

/** Erases the selected staff member's active biometric template in manager scope. */
export async function revokeFaceProfileAction(userId: string): Promise<AttendanceActionState> {
  const session = await requirePermission({ attendance: ["manage"] });
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  try {
    await revokeFaceProfile(userId, actorFrom(session));
    revalidatePath("/attendance/manage");
    return { status: "success", message: "Profil wajah dibatalkan. Staf harus mendaftar ulang." };
  } catch (error) {
    return safeManagerError(error);
  }
}

async function runManagerAction<T>(permission: { attendance: Array<"review" | "correct"> }, rawInput: unknown, parse: (value: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } }, service: (input: T, actor: ReturnType<typeof actorFrom>) => Promise<unknown>): Promise<AttendanceActionState> {
  const session = await requirePermission(permission);
  if (!isAppRole(session.user.role)) return { status: "error", message: "Peran akun tidak valid." };
  const parsed = parse(rawInput);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  try {
    await service(parsed.data, actorFrom(session));
    revalidatePath("/attendance/manage");
    return { status: "success", message: "Perubahan absensi berhasil disimpan." };
  } catch (error) {
    return safeManagerError(error);
  }
}

function actorFrom(session: { user: { id: string; name: string; email: string; role?: string | null } }) {
  if (!isAppRole(session.user.role)) throw new AttendanceError("FORBIDDEN", "Peran akun tidak valid.");
  return { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
}

function safeManagerError(error: unknown): AttendanceActionState {
  if (error instanceof AttendanceError) return { status: "error", message: error.message };
  console.error("Attendance manager mutation failed", error);
  return { status: "error", message: "Perubahan absensi belum dapat disimpan." };
}
