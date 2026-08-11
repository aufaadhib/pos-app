import { Skeleton } from "@/components/ui/skeleton";

/** Keeps manager attendance geometry stable while fresh queues and records stream. */
export default function AttendanceManagementLoading() {
  return <main aria-busy="true" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10"><span className="sr-only" role="status">Memuat pengelolaan absensi…</span><Skeleton aria-hidden className="h-44 rounded-2xl" /><section aria-hidden className="mt-7"><Skeleton className="h-12 w-56" /><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <Skeleton className="h-24 rounded-xl" key={index} />)}</div></section><Skeleton aria-hidden className="mt-7 h-64 rounded-2xl" /><Skeleton aria-hidden className="mt-6 h-96 rounded-2xl" /></main>;
}
