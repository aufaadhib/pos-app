"use server";

import { revalidatePath } from "next/cache";
import { StaffPositionStatus } from "@/generated/prisma/client";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { changeStaffPositionStatus, createStaffPosition, StaffPositionError, updateStaffPosition } from "@/lib/staff/position-service";
import { staffPositionSchema, staffPositionTargetSchema, updateStaffPositionSchema } from "@/lib/staff/validation";

export type PositionActionState = { status: "success" | "error"; message: string };
export async function createStaffPositionAction(raw: unknown) { return execute(staffPositionSchema, raw, createStaffPosition, "Jabatan dibuat."); }
export async function updateStaffPositionAction(raw: unknown) { return execute(updateStaffPositionSchema, raw, updateStaffPosition, "Jabatan diperbarui."); }
export async function archiveStaffPositionAction(raw: unknown) { return execute(staffPositionTargetSchema, raw, (input, actor) => changeStaffPositionStatus(input, StaffPositionStatus.ARCHIVED, actor), "Jabatan diarsipkan."); }
export async function restoreStaffPositionAction(raw: unknown) { return execute(staffPositionTargetSchema, raw, (input, actor) => changeStaffPositionStatus(input, StaffPositionStatus.ACTIVE, actor), "Jabatan dipulihkan."); }

async function execute<Input>(schema: { safeParse: (raw: unknown) => { success: true; data: Input } | { success: false; error: { issues: Array<{ message: string }> } } }, raw: unknown, mutation: (input: Input, actor: { id: string; email: string; role: "owner" }) => Promise<unknown>, message: string): Promise<PositionActionState> {
  const session = await requirePermission({ staff: ["managePositions"] });
  if (!isAppRole(session.user.role) || session.user.role !== "owner") return { status: "error", message: "Hanya pemilik yang dapat mengelola jabatan." };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data jabatan tidak valid." };
  try { await mutation(parsed.data, { id: session.user.id, email: session.user.email, role: session.user.role }); revalidatePath("/settings/staff-positions"); revalidatePath("/staff"); return { status: "success", message }; }
  catch (error) { if (error instanceof StaffPositionError) return { status: "error", message: error.message }; console.error("Staff position mutation failed", error); return { status: "error", message: "Perubahan jabatan belum dapat disimpan." }; }
}
