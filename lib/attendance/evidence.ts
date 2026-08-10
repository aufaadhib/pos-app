import "server-only";

import { del, get, put } from "@vercel/blob";

import { parseAttendanceBlobEnvironment } from "@/lib/env-schema";

const maxEvidenceBytes = 300 * 1024;

export class AttendanceEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttendanceEvidenceError";
  }
}

/** Validates and stores one small JPEG attendance proof in a private Blob store. */
export async function uploadAttendanceEvidence(file: File, userId: string) {
  if (file.type !== "image/jpeg" || file.size < 4 || file.size > maxEvidenceBytes) {
    throw new AttendanceEvidenceError("Foto bukti harus berupa JPEG maksimal 300 KB.");
  }
  const signature = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
    throw new AttendanceEvidenceError("Isi foto bukti tidak valid.");
  }
  const token = attendanceBlobToken();
  const blob = await put(`attendance/${userId}/${Date.now()}.jpg`, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: "image/jpeg",
    token,
  });
  return blob.pathname;
}

/** Opens an authorized private evidence stream without exposing its Blob URL. */
export async function readAttendanceEvidence(pathname: string) {
  return get(pathname, { access: "private", token: attendanceBlobToken(), useCache: false });
}

/** Deletes private attendance evidence and lets callers decide how to record cleanup. */
export async function deleteAttendanceEvidence(pathname: string) {
  await del(pathname, { token: attendanceBlobToken() });
}

function attendanceBlobToken() {
  return parseAttendanceBlobEnvironment(process.env).ATTENDANCE_BLOB_READ_WRITE_TOKEN;
}
