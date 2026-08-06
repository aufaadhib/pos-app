import { describe, expect, it } from "vitest";

import { signInSchema } from "@/lib/validation/sign-in";

describe("signInSchema", () => {
  it("normalizes a valid email and accepts an eight-character password", () => {
    const result = signInSchema.parse({
      email: "  owner@glutong.id  ",
      password: "12345678",
    });

    expect(result.email).toBe("owner@glutong.id");
  });

  it("rejects malformed credentials", () => {
    expect(
      signInSchema.safeParse({ email: "bukan-email", password: "pendek" }).success,
    ).toBe(false);
  });
});
