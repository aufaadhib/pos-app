import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <main className="mx-auto max-w-[90rem] px-4 py-8 sm:px-8 lg:px-10" aria-busy="true" aria-label="Memuat katalog">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <Skeleton className="mt-8 h-16 w-full rounded-xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Skeleton className="hidden h-96 rounded-xl lg:block" />
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-20 rounded-xl" key={index} />)}</div>
      </div>
    </main>
  );
}
