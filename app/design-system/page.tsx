import type { Metadata } from "next";
import { CheckCircle2, TriangleAlert } from "lucide-react";

import { WorkspaceHeader } from "@/components/workspace-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { requirePermission } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Design System",
};

const colorTokens = [
  { name: "Service Porcelain", className: "bg-background" },
  { name: "Aubergine Ink", className: "bg-foreground" },
  { name: "Saffron Action", className: "bg-primary" },
  { name: "Herb Success", className: "bg-success" },
  { name: "Tomato Error", className: "bg-destructive" },
  { name: "Steel Border", className: "bg-border" },
] as const;

export default async function DesignSystemPage() {
  await requirePermission({ designSystem: ["view"] });

  return (
    <div className="min-h-svh bg-background">
      <WorkspaceHeader canViewDesignSystem />
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="max-w-3xl">
          <p className="font-mono text-xs font-semibold tracking-widest text-success uppercase">
            Owner only · UI reference
          </p>
          <h1 className="mt-3 font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Design system Glutong
          </h1>
          <p className="mt-4 text-lg leading-7 text-muted-foreground">
            Referensi visual untuk menjaga layar operasional tetap konsisten, terbaca, dan mudah disentuh.
          </p>
        </div>

        <Separator className="my-8" />

        <section aria-labelledby="colors-heading">
          <h2 id="colors-heading" className="font-heading text-2xl font-semibold">Token warna</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {colorTokens.map((token) => (
              <Card key={token.name} className="border border-border py-3 shadow-none">
                <CardContent className="px-3">
                  <div className={`aspect-square rounded-lg border ${token.className}`} />
                  <p className="mt-3 text-sm font-semibold">{token.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="type-heading" className="mt-10 grid gap-5 lg:grid-cols-2">
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardTitle id="type-heading">Tipografi</CardTitle>
              <CardDescription>Tiga peran, tanpa bertukar fungsi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="font-heading text-3xl font-semibold">Bricolage Grotesque</p>
              <p className="text-lg">Atkinson Hyperlegible Next untuk kontrol dan bacaan panjang.</p>
              <p className="font-mono text-sm">IBM PLEX MONO · 08:42 WIB · OWNER</p>
            </CardContent>
          </Card>
          <Card className="border border-border shadow-none">
            <CardHeader>
              <CardTitle>Kontrol</CardTitle>
              <CardDescription>Target sentuh utama minimal 48 piksel.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button>Utama</Button>
              <Button variant="secondary">Sekunder</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destruktif</Button>
              <Button disabled>Nonaktif</Button>
              <Button disabled><Spinner aria-hidden="true" /> Memproses</Button>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="states-heading" className="mt-10">
          <h2 id="states-heading" className="font-heading text-2xl font-semibold">Field dan state</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <Card className="border border-border shadow-none">
              <CardHeader>
                <CardTitle>Input</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <Field>
                  <FieldLabel htmlFor="showcase-outlet">Nama outlet</FieldLabel>
                  <Input id="showcase-outlet" placeholder="Glutong Pusat" />
                  <FieldDescription>Gunakan label yang tetap terlihat.</FieldDescription>
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Badge>Aktif</Badge>
                  <Badge variant="secondary">Kasir</Badge>
                  <Badge variant="outline">Shift pagi</Badge>
                  <Badge variant="destructive">Dibatalkan</Badge>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-4">
              <Alert>
                <CheckCircle2 aria-hidden="true" className="text-success" />
                <AlertTitle>Data tersimpan</AlertTitle>
                <AlertDescription>Konfirmasi menjelaskan hasil, bukan sekadar warna.</AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>Perlu diperiksa</AlertTitle>
                <AlertDescription>State gagal selalu memiliki instruksi lanjutan.</AlertDescription>
              </Alert>
              <div aria-label="Contoh loading" className="space-y-3 rounded-xl border bg-card p-5">
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
