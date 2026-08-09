import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors catalog heading, filters, category rail, and product results. */
export default function CatalogLoading() {
  return (
    <main className="mx-auto max-w-[90rem] px-4 py-8 sm:px-8 lg:px-10" aria-busy="true" aria-label="Memuat katalog" id="main-content">
      <span className="sr-only" role="status">Memuat katalog…</span>
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <Skeleton className="mt-8 h-16 w-full rounded-xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Skeleton className="hidden h-96 rounded-xl lg:block" />
        <div><div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-20 rounded-xl" key={index} />)}</div><div className="mt-5 flex items-center justify-between gap-2 sm:justify-center"><Skeleton className="size-12" /><Skeleton className="h-4 w-28 sm:hidden" /><div className="hidden gap-1 sm:flex">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="size-12" key={index} />)}</div><Skeleton className="size-12" /></div></div>
      </div>
    </main>
  );
}
