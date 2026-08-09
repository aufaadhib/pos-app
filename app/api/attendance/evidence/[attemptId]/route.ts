import { readAttendanceEvidence } from "@/lib/attendance/evidence";
import { authorizeAttendanceRequest } from "@/lib/attendance/http";
import { getAttendanceEvidencePath } from "@/lib/attendance/queries";

/** Streams private evidence only to its employee or an authorized manager. */
export async function GET(_request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const authorization = await authorizeAttendanceRequest({ attendance: ["viewOwn"] });
  if ("error" in authorization) return authorization.error;
  const { attemptId } = await context.params;
  const pathname = await getAttendanceEvidencePath(attemptId, authorization.actor);
  if (!pathname) return Response.json({ message: "Foto bukti tidak ditemukan atau sudah dihapus." }, { status: 404 });
  const evidence = await readAttendanceEvidence(pathname);
  if (!evidence || evidence.statusCode !== 200 || !evidence.stream) return Response.json({ message: "Foto bukti tidak ditemukan." }, { status: 404 });
  return new Response(evidence.stream, { headers: { "Cache-Control": "private, no-store", "Content-Type": evidence.blob.contentType ?? "image/jpeg", "X-Content-Type-Options": "nosniff" } });
}
