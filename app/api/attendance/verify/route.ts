import { AttendanceEvidenceError } from "@/lib/attendance/evidence";
import { authorizeAttendanceRequest } from "@/lib/attendance/http";
import { AttendanceError, verifyAttendance } from "@/lib/attendance/service";
import { attendanceVerificationSchema } from "@/lib/attendance/validation";

/** Accepts a probe plus private JPEG evidence and performs server-authoritative attendance verification. */
export async function POST(request: Request) {
  const authorization = await authorizeAttendanceRequest({ attendance: ["clock"] });
  if ("error" in authorization) return authorization.error;
  const formData = await request.formData().catch(() => null);
  const rawPayload = formData?.get("payload");
  const evidence = formData?.get("evidence");
  let payload: unknown = null;
  try {
    payload = typeof rawPayload === "string" ? JSON.parse(rawPayload) : null;
  } catch {
    payload = null;
  }
  const parsed = attendanceVerificationSchema.safeParse(payload);
  if (!parsed.success || !(evidence instanceof File)) return Response.json({ message: parsed.error?.issues[0]?.message ?? "Data verifikasi tidak valid." }, { status: 400 });
  try {
    return Response.json(await verifyAttendance(parsed.data, evidence, authorization.actor), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AttendanceEvidenceError) return Response.json({ message: error.message }, { status: 400 });
    if (error instanceof AttendanceError) return Response.json({ message: error.message }, { status: error.code === "FORBIDDEN" ? 403 : 422 });
    console.error("Attendance verification failed", error);
    return Response.json({ message: "Verifikasi belum dapat diproses." }, { status: 500 });
  }
}
