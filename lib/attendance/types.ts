import type { AppRole } from "@/lib/auth/permissions";

export type AttendanceActor = { id: string; name: string; email: string; role: AppRole };
export type AttendanceActionState = { status: "idle" | "success" | "error"; message?: string };
