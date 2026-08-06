import type { Metadata } from "next";
import { AlertCircle, Clock3, Coffee, LayoutGrid, ShieldCheck } from "lucide-react";

import { WorkspaceHeader } from "@/components/workspace-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAppRole, roleHasPermission, roleLabels } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workspace",
};

type WorkspacePageProps = {
  searchParams: Promise<{ access?: string }>;
};

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const [session, query] = await Promise.all([
    requirePermission({ workspace: ["view"] }),
    searchParams,
  ]);
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  const canViewDesignSystem = roleHasPermission(role, { designSystem: ["view"] });
  const currentTime = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="min-h-svh bg-background">
      <WorkspaceHeader canViewDesignSystem={canViewDesignSystem} />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        {query.access === "denied" && (
          <Alert className="mb-6" variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Akses dibatasi</AlertTitle>
            <AlertDescription>
              Akun Anda tidak memiliki izin untuk membuka halaman tersebut.
            </AlertDescription>
          </Alert>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
          <div>
            <p className="font-mono text-xs font-semibold tracking-widest text-success uppercase">
              Workspace terlindungi
            </p>
            <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Selamat datang, {session.user.name}.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              Fondasi akses Glutong POS sudah aktif. Modul transaksi akan ditambahkan pada tahap berikutnya.
            </p>
          </div>
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardDescription>Akun aktif</CardDescription>
              <CardTitle className="text-xl">{session.user.email}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="font-mono uppercase">
                {roleLabels[role]}
              </Badge>
              <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <Clock3 aria-hidden="true" className="size-4" />
                {currentTime} WIB
              </span>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="module-heading" className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="module-heading" className="font-heading text-2xl font-semibold">
                Area kerja
              </h2>
              <p className="mt-1 text-muted-foreground">Ruang yang disiapkan untuk operasional outlet.</p>
            </div>
            <Badge variant="outline">Fondasi</Badge>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="border border-border shadow-none">
              <CardHeader>
                <Coffee aria-hidden="true" className="mb-3 size-6 text-primary" />
                <CardTitle>Kasir & pesanan</CardTitle>
                <CardDescription>Alur transaksi akan hadir pada milestone POS.</CardDescription>
              </CardHeader>
            </Card>
            <Card className="border border-border shadow-none">
              <CardHeader>
                <LayoutGrid aria-hidden="true" className="mb-3 size-6 text-success" />
                <CardTitle>Outlet & shift</CardTitle>
                <CardDescription>Konteks outlet dan shift akan diverifikasi sebelum melayani.</CardDescription>
              </CardHeader>
            </Card>
            <Card className="border border-border shadow-none sm:col-span-2 xl:col-span-1">
              <CardHeader>
                <ShieldCheck aria-hidden="true" className="mb-3 size-6 text-foreground" />
                <CardTitle>Akses berbasis peran</CardTitle>
                <CardDescription>Setiap area menolak akses secara default tanpa permission.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}
