import { Skeleton } from "@/components/ui/skeleton";

/** Reserves the responsive kitchen columns while fresh tickets load. */
export default function KitchenLoading() {
  return <main aria-busy="true" className="w-full px-3 py-4 pb-24 sm:px-5 lg:px-6" id="main-content"><Skeleton aria-hidden="true" className="h-28 rounded-2xl" /><div className="mt-4 grid gap-4 lg:grid-cols-3">{Array.from({ length: 3 }, (_, column) => <section className="rounded-2xl border p-4" key={column}><Skeleton aria-hidden="true" className="h-7 w-32" /><div className="mt-4 grid gap-3">{Array.from({ length: 2 }, (_, card) => <Skeleton aria-hidden="true" className="h-48 rounded-xl" key={card} />)}</div></section>)}</div><span className="sr-only">Memuat antrean dapur.</span></main>;
}
