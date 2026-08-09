import { z } from "zod";

export const serverEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL harus berupa URL PostgreSQL Neon."),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL harus berupa URL yang valid."),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET minimal 32 karakter."),
});

export const ownerEnvironmentSchema = serverEnvironmentSchema.extend({
  INITIAL_OWNER_NAME: z.string().trim().min(2),
  INITIAL_OWNER_EMAIL: z.string().trim().email(),
  INITIAL_OWNER_PASSWORD: z.string().min(12),
});

export const attendanceEnvironmentSchema = z.object({
  ATTENDANCE_BLOB_READ_WRITE_TOKEN: z.string().trim().min(1),
  ATTENDANCE_EMBEDDING_KEY: z.string().trim().refine((value) => {
    try {
      return Buffer.from(value, "base64").length === 32;
    } catch {
      return false;
    }
  }, "ATTENDANCE_EMBEDDING_KEY harus berupa base64 dari 32 byte."),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type OwnerEnvironment = z.infer<typeof ownerEnvironmentSchema>;
export type AttendanceEnvironment = z.infer<typeof attendanceEnvironmentSchema>;

export function parseServerEnvironment(
  environment: Record<string, string | undefined>,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(environment);
}

export function parseOwnerEnvironment(
  environment: Record<string, string | undefined>,
): OwnerEnvironment {
  return ownerEnvironmentSchema.parse(environment);
}

/** Validates biometric and private evidence credentials only when attendance is used. */
export function parseAttendanceEnvironment(
  environment: Record<string, string | undefined>,
): AttendanceEnvironment {
  return attendanceEnvironmentSchema.parse(environment);
}
