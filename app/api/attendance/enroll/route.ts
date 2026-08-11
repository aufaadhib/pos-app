import { AttendanceError, enrollFaceProfile } from "@/lib/attendance/service";
import { authorizeAttendanceRequest } from "@/lib/attendance/http";
import { attendanceEnrollmentSchema } from "@/lib/attendance/validation";

/** Enrolls a first profile or creates a cashier reenrollment approval request. */
export async function POST(request: Request) {
  const authorization = await authorizeAttendanceRequest({ attendance: ["clock"] });
  if ("error" in authorization) return authorization.error;
  const parsed = attendanceEnrollmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: parsed.error.issues[0]?.message ?? "Data pendaftaran tidak valid." }, { status: 400 });
  try {
    return Response.json(await enrollFaceProfile(parsed.data, authorization.actor));
  } catch (error) {
    return attendanceErrorResponse(error, "Wajah belum dapat didaftarkan.");
  }
}

function attendanceErrorResponse(error: unknown, fallback: string) {
  if (error instanceof AttendanceError) return Response.json({ message: error.message }, { status: error.code === "FORBIDDEN" ? 403 : 422 });
  console.error("Attendance enrollment failed", error);
  return Response.json({ message: fallback }, { status: 500 });
}
