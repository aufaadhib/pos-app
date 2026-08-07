import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";

import {
  AdvancedCatalogStatusAction,
  ModifierGroupDialog,
  ModifierOptionDialog,
} from "@/components/catalog/advanced-catalog";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { getModifierGroups } from "@/lib/catalog/advanced-queries";
import { formatRupiah } from "@/lib/catalog/normalization";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pustaka Modifier" };

/** Renders the owner-only reusable modifier library with option pricing and archive controls. */
export default async function ModifierLibraryPage() {
  await requirePermission({ catalog: ["manageMaster"] });
  const groups = await getModifierGroups(true);
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content">
      <Link className={cn(buttonVariants({ variant: "ghost" }), "-ml-3 mb-4")} href="/catalog?scope=master"><ArrowLeft aria-hidden="true" />Kembali ke katalog</Link>
      <section className="rounded-2xl border bg-card p-5 sm:flex sm:items-end sm:justify-between sm:gap-8 sm:p-6"><div><p className="text-sm font-medium text-muted-foreground">Katalog master</p><h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-semibold tracking-tight sm:text-3xl"><SlidersHorizontal aria-hidden="true" className="size-6 text-success" />Pustaka modifier</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Satu grup dapat dipasang ke banyak produk dengan aturan pilihan berbeda.</p></div><div className="mt-5 sm:mt-0"><ModifierGroupDialog /></div></section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {groups.length === 0 ? <div className="col-span-full grid min-h-56 place-items-center rounded-xl border border-dashed p-8 text-center text-muted-foreground">Belum ada grup modifier.</div> : groups.map((group) => (
          <Card className={cn("border shadow-none", group.status === "ARCHIVED" && "opacity-65")} key={group.id}>
            <CardHeader className="flex-row items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><CardTitle>{group.name}</CardTitle>{group.status === "ARCHIVED" && <Badge variant="outline">Arsip</Badge>}</div>{group.description && <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>}</div><div className="flex"><ModifierGroupDialog group={group} /><AdvancedCatalogStatusAction entityType="MODIFIER_GROUP" id={group.id} label={group.name} status={group.status} updatedAt={group.updatedAt} /></div></CardHeader>
            <CardContent className="grid gap-2">
              {group.options.map((option) => <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2" key={option.id}><div><p className="text-sm font-semibold">{option.name}</p><p className="font-mono text-xs text-muted-foreground">+{formatRupiah(option.priceAdjustment)}</p></div><div className="flex"><ModifierOptionDialog groupId={group.id} option={option} /><AdvancedCatalogStatusAction entityType="MODIFIER_OPTION" id={option.id} label={option.name} status={option.status} updatedAt={option.updatedAt} /></div></div>)}
              <div className="mt-1"><ModifierOptionDialog groupId={group.id} /></div>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
