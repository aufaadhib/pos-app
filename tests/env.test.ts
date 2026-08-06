import { describe, expect, it } from "vitest";

import {
  parseOwnerEnvironment,
  parseServerEnvironment,
} from "@/lib/env-schema";

const validEnvironment = {
  DATABASE_URL: "postgresql://user:password@host.neon.tech/glutong?sslmode=require",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
};

describe("environment validation", () => {
  it("accepts a complete server environment", () => {
    expect(parseServerEnvironment(validEnvironment)).toEqual(validEnvironment);
  });

  it("rejects a short authentication secret", () => {
    expect(() =>
      parseServerEnvironment({ ...validEnvironment, BETTER_AUTH_SECRET: "short" }),
    ).toThrow();
  });

  it("requires a bootstrap password of at least 12 characters", () => {
    expect(() =>
      parseOwnerEnvironment({
        ...validEnvironment,
        INITIAL_OWNER_NAME: "Pemilik",
        INITIAL_OWNER_EMAIL: "owner@example.com",
        INITIAL_OWNER_PASSWORD: "12345678901",
      }),
    ).toThrow();
  });
});
