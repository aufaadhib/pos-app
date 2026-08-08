import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the shift detail layout while fresh financial rows are loading. */
export default function ShiftDetailLoading() {
  return <main aria-busy="true" className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-8 sm:py-8 lg:px-10 lg:pb-8" id="main-content"><span className="sr-only" role="status">Memuat rincian shift…</span><Skeleton className="h-40 rounded-2xl" /><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-24 rounded-xl" key={index} />)}</div><Skeleton className="mt-8 h-64 rounded-xl" /></main>;
}
