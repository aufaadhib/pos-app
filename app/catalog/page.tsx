import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageOpen, Search } from "lucide-react";

import {
  CatalogStatusActionButton,
  CategoryFormDialog,
  ProductFormDialog,
} from "@/components/catalog/catalog-dialogs";
import { WorkspaceHeader } from "@/components/workspace-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isAppRole, roleHasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { formatRupiah, getProductMonogram } from "@/lib/catalog/normalization";
import { getCatalogCategories, getCatalogProducts } from "@/lib/catalog/queries";
import type { CatalogProductItem } from "@/lib/catalog/types";
import { catalogSearchSchema } from "@/lib/catalog/validation";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Katalog Produk",
  description: "Kelola kategori, produk, SKU, dan harga dasar Glutong POS.",
};

type CatalogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const [session, rawSearch] = await Promise.all([
    requirePermission({ catalog: ["view"] }),
    searchParams,
  ]);
  const role = isAppRole(session.user.role) ? session.user.role : "cashier";
  const canManage = roleHasPermission(role, { catalog: ["manage"] });
  const canViewDesignSystem = roleHasPermission(role, { designSystem: ["view"] });
  const search = catalogSearchSchema.parse({
    q: singleValue(rawSearch.q),
    category: singleValue(rawSearch.category),
    status: singleValue(rawSearch.status),
    page: singleValue(rawSearch.page),
  });
  const [categories, products] = await Promise.all([
    getCatalogCategories(canManage),
    getCatalogProducts(search, canManage),
  ]);
  const activeCategories = categories.filter((category) => category.status === "ACTIVE");

  return (
    <div className="min-h-svh bg-background">
      <WorkspaceHeader activeRoute="catalog" canViewDesignSystem={canViewDesignSystem} />
      <main className="mx-auto max-w-[90rem] px-4 py-6 sm:px-8 sm:py-9 lg:px-10">
        <section className="border-b pb-6 sm:flex sm:items-end sm:justify-between sm:gap-8">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.18em] text-success uppercase">Menu ledger · global</p>
            <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">Katalog produk</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Satu sumber menu dasar untuk seluruh bisnis. Harga outlet, stok, pajak, dan modifier menyusul pada milestone masing-masing.
            </p>
          </div>
          {canManage && (
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-0">
              <CategoryFormDialog />
              <ProductFormDialog categories={categories} defaultCategoryId={search.category} />
            </div>
          )}
        </section>

        <CatalogFilters canManage={canManage} categories={categories} search={search} />

        <section aria-labelledby="compact-category-title" className="mt-5 lg:hidden">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-heading font-semibold" id="compact-category-title">Kategori</h2>
            <span className="font-mono text-xs text-muted-foreground">{categories.length} tercatat</span>
          </div>
          <div className="flex snap-x gap-2 overflow-x-auto pb-2">
            {categories.map((category) => (
              <div className="flex min-w-60 snap-start items-center gap-1 rounded-xl border bg-card p-2" key={category.id}>
                <CategoryRailLink
                  active={search.category === category.id}
                  archived={category.status === "ARCHIVED"}
                  count={canManage ? category.totalProductCount : category.activeProductCount}
                  href={catalogHref(search, { category: category.id, page: 1 })}
                  label={category.name}
                />
                {canManage && <><CategoryFormDialog category={category} /><CatalogStatusActionButton item={category} kind="category" /></>}
              </div>
            ))}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside aria-label="Indeks kategori" className="hidden lg:block">
            <div className="sticky top-5 overflow-hidden rounded-xl border bg-card">
              <div className="border-b px-4 py-3">
                <p className="font-heading font-semibold">Indeks kategori</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{categories.length} kategori tercatat</p>
              </div>
              <nav className="max-h-[calc(100svh-13rem)] overflow-y-auto p-2" aria-label="Filter kategori">
                <CategoryRailLink active={!search.category} href={catalogHref(search, { category: "", page: 1 })} label="Semua produk" count={products.totalItems} />
                {categories.map((category) => (
                  <div className="group mt-1 flex items-center gap-1" key={category.id}>
                    <CategoryRailLink
                      active={search.category === category.id}
                      archived={category.status === "ARCHIVED"}
                      count={canManage ? category.totalProductCount : category.activeProductCount}
                      href={catalogHref(search, { category: category.id, page: 1 })}
                      label={category.name}
                    />
                    {canManage && (
                      <div className="flex shrink-0 opacity-100 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                        <CategoryFormDialog category={category} />
                        <CatalogStatusActionButton item={category} kind="category" />
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          <section aria-labelledby="product-list-title" className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-semibold" id="product-list-title">Daftar produk</h2>
                <p className="text-sm text-muted-foreground">{products.totalItems} hasil · halaman {products.page} dari {products.totalPages}</p>
              </div>
              {!canManage && <Badge variant="secondary">Baca saja</Badge>}
            </div>

            {products.items.length === 0 ? (
              <CatalogEmptyState canManage={canManage} hasCategories={activeCategories.length > 0} categories={categories} />
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="pl-4">Produk</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Harga dasar</TableHead>
                        {canManage && <TableHead className="w-36 text-right">Aksi</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.items.map((product) => (
                        <ProductTableRow canManage={canManage} categories={categories} key={product.id} product={product} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="grid gap-3 md:hidden">
                  {products.items.map((product) => (
                    <ProductCard canManage={canManage} categories={categories} key={product.id} product={product} />
                  ))}
                </div>
              </>
            )}

            <CatalogPagination currentPage={products.page} search={search} totalPages={products.totalPages} />
          </section>
        </div>
      </main>
    </div>
  );
}

function CatalogFilters({
  canManage,
  categories,
  search,
}: {
  canManage: boolean;
  categories: Awaited<ReturnType<typeof getCatalogCategories>>;
  search: ReturnType<typeof catalogSearchSchema.parse>;
}) {
  return (
    <form className="mt-5 grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[minmax(12rem,1fr)_minmax(10rem,0.45fr)_minmax(9rem,0.35fr)_auto]" method="get">
      <label className="relative">
        <span className="sr-only">Cari produk atau SKU</span>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-10" defaultValue={search.q} name="q" placeholder="Cari nama atau SKU…" />
      </label>
      <label>
        <span className="sr-only">Filter kategori</span>
        <select className="h-12 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" defaultValue={search.category} name="category">
          <option value="">Semua kategori</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.status === "ARCHIVED" ? " (arsip)" : ""}</option>)}
        </select>
      </label>
      {canManage ? (
        <label>
          <span className="sr-only">Filter status</span>
          <select className="h-12 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40" defaultValue={search.status} name="status">
            <option value="active">Aktif</option>
            <option value="archived">Diarsipkan</option>
            <option value="all">Semua status</option>
          </select>
        </label>
      ) : <input name="status" type="hidden" value="active" />}
      <Button type="submit">Terapkan</Button>
    </form>
  );
}

function ProductTableRow({ canManage, categories, product }: { canManage: boolean; categories: Awaited<ReturnType<typeof getCatalogCategories>>; product: CatalogProductItem }) {
  return (
    <TableRow className={product.status === "ARCHIVED" ? "opacity-65" : undefined}>
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <ProductMonogram name={product.name} />
          <div className="min-w-0 whitespace-normal">
            <p className="font-semibold">{product.name}</p>
            {product.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{product.description}</p>}
          </div>
        </div>
      </TableCell>
      <TableCell>{product.categoryName}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{product.sku ?? "—"}</TableCell>
      <TableCell className="text-right font-mono font-semibold">{formatRupiah(product.basePrice)}</TableCell>
      {canManage && (
        <TableCell>
          <div className="flex justify-end gap-1">
            <ProductFormDialog categories={categories} product={product} />
            <CatalogStatusActionButton item={product} kind="product" />
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}

function ProductCard({ canManage, categories, product }: { canManage: boolean; categories: Awaited<ReturnType<typeof getCatalogCategories>>; product: CatalogProductItem }) {
  return (
    <Card className={cn("border shadow-none", product.status === "ARCHIVED" && "opacity-70")}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <ProductMonogram name={product.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><p className="font-heading font-semibold">{product.name}</p>{product.status === "ARCHIVED" && <Badge variant="outline">Arsip</Badge>}</div>
            <p className="mt-1 text-xs text-muted-foreground">{product.categoryName} · <span className="font-mono">{product.sku ?? "Tanpa SKU"}</span></p>
            {product.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>}
            <p className="mt-3 font-mono text-base font-semibold">{formatRupiah(product.basePrice)}</p>
          </div>
        </div>
        {canManage && <div className="mt-4 flex justify-end gap-2 border-t pt-3"><ProductFormDialog categories={categories} product={product} /><CatalogStatusActionButton item={product} kind="product" /></div>}
      </CardContent>
    </Card>
  );
}

function ProductMonogram({ name }: { name: string }) {
  return <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent font-heading text-sm font-bold text-accent-foreground">{getProductMonogram(name)}</span>;
}

function CategoryRailLink({ active, archived, count, href, label }: { active: boolean; archived?: boolean; count: number; href: string; label: string }) {
  return <Link aria-current={active ? "page" : undefined} className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-3 text-sm hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none aria-[current=page]:bg-accent aria-[current=page]:font-semibold" href={href}><span className={cn("truncate", archived && "line-through opacity-60")}>{label}</span><span className="font-mono text-xs text-muted-foreground">{count}</span></Link>;
}

function CatalogEmptyState({ canManage, hasCategories, categories }: { canManage: boolean; hasCategories: boolean; categories: Awaited<ReturnType<typeof getCatalogCategories>> }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <PackageOpen aria-hidden="true" className="size-9 text-muted-foreground" />
      <h3 className="mt-4 font-heading text-xl font-semibold">Belum ada produk yang cocok</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{hasCategories ? "Ubah filter atau tambahkan produk pertama untuk kategori aktif." : canManage ? "Buat kategori aktif sebelum menambahkan produk pertama." : "Katalog aktif belum disiapkan oleh pengelola."}</p>
      {canManage && <div className="mt-5">{hasCategories ? <ProductFormDialog categories={categories} /> : <CategoryFormDialog />}</div>}
    </div>
  );
}

function CatalogPagination({ currentPage, search, totalPages }: { currentPage: number; search: ReturnType<typeof catalogSearchSchema.parse>; totalPages: number }) {
  if (totalPages <= 1) return null;
  return <nav aria-label="Halaman produk" className="mt-5 flex items-center justify-between"><Link aria-disabled={currentPage <= 1} className={cn(buttonVariants({ variant: "outline" }), currentPage <= 1 && "pointer-events-none opacity-50")} href={catalogHref(search, { page: currentPage - 1 })}><ChevronLeft aria-hidden="true" />Sebelumnya</Link><span className="font-mono text-xs text-muted-foreground">{currentPage} / {totalPages}</span><Link aria-disabled={currentPage >= totalPages} className={cn(buttonVariants({ variant: "outline" }), currentPage >= totalPages && "pointer-events-none opacity-50")} href={catalogHref(search, { page: currentPage + 1 })}>Berikutnya<ChevronRight aria-hidden="true" /></Link></nav>;
}

function catalogHref(search: ReturnType<typeof catalogSearchSchema.parse>, changes: Partial<ReturnType<typeof catalogSearchSchema.parse>>) {
  const next = { ...search, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.status !== "active") params.set("status", next.status);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/catalog?${query}` : "/catalog";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
