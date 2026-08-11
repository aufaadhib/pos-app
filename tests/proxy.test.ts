import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "@/proxy";

describe("authentication proxy", () => {
  it("redirects a protected route without a session cookie", () => {
    const response = proxy(new NextRequest("https://glutong.test/workspace"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://glutong.test/sign-in");
  });

  it("leaves a protected route with a session cookie for server validation", () => {
    const request = new NextRequest("https://glutong.test/workspace", {
      headers: { cookie: "better-auth.session_token=stale-token" },
    });

    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not handle the sign-in page based on cookie presence", () => {
    const request = new NextRequest("https://glutong.test/sign-in", {
      headers: { cookie: "better-auth.session_token=stale-token" },
    });

    const response = proxy(request);

    expect(config.matcher).not.toContain("/sign-in");
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
