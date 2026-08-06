"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

import { accessControl, roles } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
  plugins: [adminClient({ ac: accessControl, roles })],
});
