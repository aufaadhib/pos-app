import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Layers3, SlidersHorizontal } from "lucide-react";

import {
  AdvancedCatalogStatusAction,
  ProductModifierDialog,
  VariantGroupDialog,
  VariantOptionDialog,
} from "@/components/catalog/advanced-catalog";
import { Badge } from "@/components/ui/badge";
import { ProductImage } from "@/components/product-image";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { getAdvancedProduct, getModifierGroups } from "@/lib/catalog/advanced-queries";
import { formatRupiah } from "@/lib/catalog/normalization";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Opsi Produk" };

/** Renders the owner-only master editor for one product's variants and reusable modifiers. */
export default async function ProductOptionsPage({ params }: { params: Promise<{ productId: string }> }) {
  await requirePermission({ catalog: ["manageMaster"] });
  const { productId } = await params;
  const [product, modifierGroups] = await Promise.all([getAdvancedProduct(productId), getModifierGroups(true)]);
  if (!product) notFound();
  const attachedIds = new Set(product.modifierGroups.map((group) => group.modifierGroupId));
  const attachableGroups = modifierGroups.filter((group) => !attachedIds.has(group.id));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content">
      <Link className={cn(buttonVariants({ variant: "ghost" }), "-ml-3 mb-4")} href="/catalog?scope=master"><ArrowLeft aria-hidden="true" />Kembali ke katalog</Link>
      <section className="rounded-2xl border bg-card p-5 sm:flex sm:items-end sm:justify-between sm:gap-8 sm:p-6">
        <div className="flex min-w-0 items-center gap-4"><ProductImage className="size-16 rounded-xl sm:size-20" imageUrl={product.imageUrl} name={product.name} positionX={product.imagePositionX} positionY={product.imagePositionY} sizes="(max-width: 639px) 64px, 80px" /><div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">Editor opsi produk</p><h1 className="mt-1 truncate font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1><p className="mt-2 text-sm text-muted-foreground">{product.categoryName} · Harga dasar {formatRupiah(product.basePrice)}</p></div></div>
        <Badge className="mt-4 sm:mt-0" variant={product.status === "ACTIVE" ? "secondary" : "outline"}>{product.status === "ACTIVE" ? "Produk aktif" : "Produk arsip"}</Badge>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="variant-heading">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-heading text-xl font-semibold" id="variant-heading"><Layers3 aria-hidden="true" className="size-5 text-primary" />Varian wajib</h2><p className="mt-1 text-sm text-muted-foreground">Pembeli memilih satu opsi dari setiap grup aktif.</p></div><VariantGroupDialog productId={product.id} /></div>
          <div className="grid gap-4">
            {product.variantGroups.length === 0 ? <EmptyPanel text="Belum ada grup varian. Produk tetap dapat dijual dengan harga dasar." /> : product.variantGroups.map((group) => (
              <Card className={cn("border shadow-none", group.status === "ARCHIVED" && "opacity-65")} key={group.id}>
                <CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle>{group.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{group.options.filter((option) => option.status === "ACTIVE").length} opsi aktif</p></div><div className="flex"><VariantGroupDialog group={group} productId={product.id} /><AdvancedCatalogStatusAction entityType="VARIANT_GROUP" id={group.id} label={group.name} status={group.status} updatedAt={group.updatedAt} /></div></CardHeader>
                <CardContent className="grid gap-2">
                  {group.options.map((option) => <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2" key={option.id}><div><p className="text-sm font-semibold">{option.name}</p><p className="font-mono text-xs text-muted-foreground">+{formatRupiah(option.priceAdjustment)}</p></div><div className="flex"><VariantOptionDialog groupId={group.id} option={option} /><AdvancedCatalogStatusAction entityType="VARIANT_OPTION" id={option.id} label={option.name} status={option.status} updatedAt={option.updatedAt} /></div></div>)}
                  <div className="mt-1"><VariantOptionDialog groupId={group.id} /></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section aria-labelledby="modifier-heading">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-heading text-xl font-semibold" id="modifier-heading"><SlidersHorizontal aria-hidden="true" className="size-5 text-success" />Modifier produk</h2><p className="mt-1 text-sm text-muted-foreground">Pasang grup reusable dan tentukan batas pilihan.</p></div><ProductModifierDialog groups={attachableGroups} productId={product.id} /></div>
          <div className="grid gap-4">
            {product.modifierGroups.length === 0 ? <EmptyPanel text="Belum ada modifier. Buat pustaka modifier lalu pasang pada produk ini." /> : product.modifierGroups.map((relation) => (
              <Card className={cn("border shadow-none", relation.status === "ARCHIVED" && "opacity-65")} key={relation.modifierGroupId}>
                <CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle>{relation.modifierGroupName}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Pilih {relation.minSelections}–{relation.maxSelections} opsi</p></div><div className="flex"><ProductModifierDialog groups={modifierGroups} productId={product.id} relation={relation} /><AdvancedCatalogStatusAction entityType="PRODUCT_MODIFIER" id={relation.modifierGroupId} label={relation.modifierGroupName} parentId={product.id} status={relation.status} updatedAt={relation.updatedAt} /></div></CardHeader>
              </Card>
            ))}
          </div>
          <Link className={cn(buttonVariants({ variant: "outline" }), "mt-4 w-full sm:w-auto")} href="/catalog/modifiers">Kelola pustaka modifier</Link>
        </section>
      </div>
    </main>
  );
}

/** Displays a responsive empty state for an unconfigured product option section. */
function EmptyPanel({ text }: { text: string }) {
  return <div className="grid min-h-36 place-items-center rounded-xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
