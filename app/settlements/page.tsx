import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DeliveryManagement } from "@/components/delivery/delivery-management";
import { isAppRole, roleHasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getDeliveryManagement, getSupportedDeliveryProviders } from "@/lib/delivery/queries";
import { requireActiveOutlet } from "@/lib/outlets/context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ojol & Settlement" };

/** Loads fresh platform receivables and renders the outlet-scoped reconciliation workspace. */
export default async function SettlementsPage() {
  const session = await requirePermission({ settlement: ["view"] });
  if (!isAppRole(session.user.role)) notFound();
  const outlet = await requireActiveOutlet(session);
  const data = await getDeliveryManagement(outlet.id, session.user.id, session.user.role);
  if (!data) notFound();
  return <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content">
    <DeliveryManagement
      canManage={roleHasPermission(session.user.role, { deliveryChannel: ["manage"] })}
      canReverse={roleHasPermission(session.user.role, { settlement: ["reverse"] })}
      data={data}
      outlet={{ id: outlet.id, name: outlet.name, timezone: outlet.timezone }}
      providers={getSupportedDeliveryProviders()}
    />
  </main>;
}
