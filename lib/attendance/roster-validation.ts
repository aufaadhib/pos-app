import { z } from "zod";
import { normalizeOperationalLabel } from "@/lib/outlets/normalization";
import { mondayOf } from "@/lib/attendance/roster";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Gunakan format jam HH:mm.");
const isoDateSchema = z.iso.date();
const rosterEntrySchema = z.object({ userId: z.string().trim().min(1), workDate: isoDateSchema, shiftTemplateId: z.string().trim().min(1) });

export const shiftTemplateSchema = z.object({ outletId: z.string().trim().min(1), name: z.string().transform(normalizeOperationalLabel).pipe(z.string().min(2).max(60)), startTime: timeSchema, endTime: timeSchema }).refine((value) => value.startTime !== value.endTime, { message: "Jam mulai dan selesai tidak boleh sama.", path: ["endTime"] });
export const updateShiftTemplateSchema = shiftTemplateSchema.extend({ id: z.string().trim().min(1), expectedUpdatedAt: z.iso.datetime() });
export const shiftTemplateTargetSchema = z.object({ id: z.string().trim().min(1), outletId: z.string().trim().min(1), expectedUpdatedAt: z.iso.datetime() });
export const saveRosterDraftSchema = z.object({ outletId: z.string().trim().min(1), weekStart: isoDateSchema, expectedUpdatedAt: z.iso.datetime().nullable(), entries: z.array(rosterEntrySchema).max(700) }).superRefine((value, context) => { if (mondayOf(value.weekStart) !== value.weekStart) context.addIssue({ code: "custom", message: "Awal minggu harus hari Senin.", path: ["weekStart"] }); const keys = new Set<string>(); for (const [index, entry] of value.entries.entries()) { const key = `${entry.userId}:${entry.workDate}`; if (keys.has(key)) context.addIssue({ code: "custom", message: "Satu staf hanya boleh memiliki satu shift per tanggal.", path: ["entries", index] }); keys.add(key); if (entry.workDate < value.weekStart || entry.workDate > addDays(value.weekStart, 6)) context.addIssue({ code: "custom", message: "Tanggal berada di luar minggu roster.", path: ["entries", index, "workDate"] }); } });
export const rosterWeekTargetSchema = z.object({ outletId: z.string().trim().min(1), weekStart: isoDateSchema, expectedUpdatedAt: z.iso.datetime() });
export const copyRosterWeekSchema = z.object({ outletId: z.string().trim().min(1), sourceWeekStart: isoDateSchema, targetWeekStart: isoDateSchema }).refine((value) => value.sourceWeekStart !== value.targetWeekStart, { message: "Minggu tujuan harus berbeda." });
const rosterRevisionReasonSchema = z.string().trim().min(8).max(240);
export const updatePublishedRosterEntrySchema = z.object({ entryId: z.string().trim().min(1), shiftTemplateId: z.string().trim().min(1).nullable(), expectedUpdatedAt: z.iso.datetime(), reason: rosterRevisionReasonSchema });
export const addPublishedRosterEntrySchema = z.object({ rosterWeekId: z.string().trim().min(1), outletId: z.string().trim().min(1), userId: z.string().trim().min(1), workDate: isoDateSchema, shiftTemplateId: z.string().trim().min(1), expectedWeekUpdatedAt: z.iso.datetime(), reason: rosterRevisionReasonSchema });
const fixedScheduleEntrySchema = z.object({ userId: z.string().trim().min(1), weekday: z.number().int().min(1).max(7), shiftTemplateId: z.string().trim().min(1) });
export const saveFixedSchedulesSchema = z.object({ outletId: z.string().trim().min(1), expectedUpdatedAt: z.iso.datetime(), entries: z.array(fixedScheduleEntrySchema).max(700) }).superRefine((value, context) => { const keys = new Set<string>(); for (const [index, entry] of value.entries.entries()) { const key = `${entry.userId}:${entry.weekday}`; if (keys.has(key)) context.addIssue({ code: "custom", message: "Satu staf hanya boleh memiliki satu shift per hari.", path: ["entries", index] }); keys.add(key); } });
export const updateScheduleModeSchema = z.object({ outletId: z.string().trim().min(1), expectedUpdatedAt: z.iso.datetime(), mode: z.enum(["WEEKLY", "FIXED"]) });
export const resetFixedScheduleOverrideSchema = z.object({ rosterWeekId: z.string().trim().min(1), outletId: z.string().trim().min(1), userId: z.string().trim().min(1), workDate: isoDateSchema, expectedWeekUpdatedAt: z.iso.datetime(), reason: rosterRevisionReasonSchema });

export type ShiftTemplateInput = z.infer<typeof shiftTemplateSchema>;
export type UpdateShiftTemplateInput = z.infer<typeof updateShiftTemplateSchema>;
export type ShiftTemplateTarget = z.infer<typeof shiftTemplateTargetSchema>;
export type SaveRosterDraftInput = z.infer<typeof saveRosterDraftSchema>;
export type RosterWeekTarget = z.infer<typeof rosterWeekTargetSchema>;
export type CopyRosterWeekInput = z.infer<typeof copyRosterWeekSchema>;
export type UpdatePublishedRosterEntryInput = z.infer<typeof updatePublishedRosterEntrySchema>;
export type AddPublishedRosterEntryInput = z.infer<typeof addPublishedRosterEntrySchema>;
export type SaveFixedSchedulesInput = z.infer<typeof saveFixedSchedulesSchema>;
export type UpdateScheduleModeInput = z.infer<typeof updateScheduleModeSchema>;
export type ResetFixedScheduleOverrideInput = z.infer<typeof resetFixedScheduleOverrideSchema>;

function addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
