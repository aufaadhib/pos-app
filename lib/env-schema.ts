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

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type OwnerEnvironment = z.infer<typeof ownerEnvironmentSchema>;

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
