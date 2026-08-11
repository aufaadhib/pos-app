"use server";

import { revalidatePath } from "next/cache";
import type { ZodType } from "zod";
import { StaffPositionStatus } from "@/generated/prisma/client";
import { isAppRole } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { addPublishedRosterEntry, changeShiftTemplateStatus, copyRosterWeek, createShiftTemplate, publishRosterWeek, resetFixedScheduleOverride, RosterError, saveFixedSchedules, saveRosterDraft, updatePublishedRosterEntry, updateScheduleMode, updateShiftTemplate } from "@/lib/attendance/roster-service";
import { addPublishedRosterEntrySchema, copyRosterWeekSchema, resetFixedScheduleOverrideSchema, rosterWeekTargetSchema, saveFixedSchedulesSchema, saveRosterDraftSchema, shiftTemplateSchema, shiftTemplateTargetSchema, updatePublishedRosterEntrySchema, updateScheduleModeSchema, updateShiftTemplateSchema } from "@/lib/attendance/roster-validation";

export type RosterActionState = { status: "success" | "error"; message: string };

export async function createShiftTemplateAction(raw: unknown) { return run(shiftTemplateSchema, raw, createShiftTemplate, "Template shift dibuat."); }
export async function updateShiftTemplateAction(raw: unknown) { return run(updateShiftTemplateSchema, raw, updateShiftTemplate, "Template shift diperbarui."); }
export async function archiveShiftTemplateAction(raw: unknown) { return run(shiftTemplateTargetSchema, raw, (input, actor) => changeShiftTemplateStatus(input, StaffPositionStatus.ARCHIVED, actor), "Template shift diarsipkan."); }
export async function saveRosterDraftAction(raw: unknown) { return run(saveRosterDraftSchema, raw, saveRosterDraft, "Draf roster disimpan."); }
export async function publishRosterWeekAction(raw: unknown) { return run(rosterWeekTargetSchema, raw, publishRosterWeek, "Roster mingguan diterbitkan."); }
export async function copyRosterWeekAction(raw: unknown) { return run(copyRosterWeekSchema, raw, copyRosterWeek, "Roster minggu sebelumnya disalin sebagai draf."); }
export async function updatePublishedRosterEntryAction(raw: unknown) { return run(updatePublishedRosterEntrySchema, raw, updatePublishedRosterEntry, "Jadwal terbit diperbarui."); }
export async function addPublishedRosterEntryAction(raw: unknown) { return run(addPublishedRosterEntrySchema, raw, addPublishedRosterEntry, "Shift ditambahkan ke roster terbit."); }
export async function saveFixedSchedulesAction(raw: unknown) { return run(saveFixedSchedulesSchema, raw, saveFixedSchedules, "Pola jadwal tetap disimpan."); }
export async function updateScheduleModeAction(raw: unknown) { return run(updateScheduleModeSchema, raw, updateScheduleMode, "Mode jadwal diperbarui."); }
export async function resetFixedScheduleOverrideAction(raw: unknown) { return run(resetFixedScheduleOverrideSchema, raw, resetFixedScheduleOverride, "Jadwal kembali mengikuti pola tetap."); }

async function run<Input>(schema: ZodType<Input>, raw: unknown, mutation: (input: Input, actor: { id: string; name: string; email: string; role: "owner" | "manager" }) => Promise<unknown>, success: string): Promise<RosterActionState> {
  const session = await requirePermission({ attendance: ["schedule"] });
  if (!isAppRole(session.user.role) || (session.user.role !== "owner" && session.user.role !== "manager")) return { status: "error", message: "Akses roster ditolak." };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Data roster tidak valid." };
  try {
    await mutation(parsed.data, { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role });
    revalidatePath("/attendance/roster");
    revalidatePath("/attendance");
    revalidatePath("/attendance/manage");
    return { status: "success", message: success };
  } catch (error) {
    if (error instanceof RosterError) return { status: "error", message: error.message };
    console.error("Roster mutation failed", error);
    return { status: "error", message: "Perubahan roster belum dapat disimpan." };
  }
}
