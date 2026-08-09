import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the geofence form and map across mobile, tablet, and desktop. */
export default function AttendanceSettingsLoading() {
  return <main aria-busy="true" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10"><span className="sr-only" role="status">Memuat pengaturan absensi…</span><Skeleton aria-hidden className="h-44 rounded-2xl" /><div className="mt-5 grid gap-5 xl:grid-cols-[minmax(19rem,0.72fr)_minmax(0,1.28fr)]"><Skeleton aria-hidden className="h-[38rem] rounded-2xl" /><Skeleton aria-hidden className="h-[34rem] rounded-2xl" /></div></main>;
}
