import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the attendance header and two-column operating surface while fresh data loads. */
export default function AttendanceLoading() {
  return <main aria-busy="true" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10"><span className="sr-only" role="status">Memuat absensi…</span><Skeleton aria-hidden className="h-40 rounded-2xl" /><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]"><Skeleton aria-hidden className="h-[32rem] rounded-2xl" /><Skeleton aria-hidden className="h-[32rem] rounded-2xl" /></div></main>;
}
