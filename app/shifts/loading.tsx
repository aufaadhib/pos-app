import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the shift dashboard while its fresh financial data is loading. */
export default function ShiftsLoading() {
  return <main aria-busy="true" className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-8 sm:py-8 lg:px-10 lg:pb-8" id="main-content"><span className="sr-only" role="status">Memuat shift…</span><Skeleton className="h-32 rounded-2xl" /><div className="mt-6 grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton className="h-24 rounded-xl" key={index} />)}</div><Skeleton className="mt-8 h-12 rounded-xl" /><div className="mt-4 grid gap-3">{Array.from({ length: 5 }, (_, index) => <Skeleton className="h-20 rounded-xl" key={index} />)}</div></main>;
}
