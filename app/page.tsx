import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  if (session.user.mustChangePassword) redirect("/change-password");
  redirect(session.session.activeOutletId ? "/workspace" : "/select-outlet");
}
