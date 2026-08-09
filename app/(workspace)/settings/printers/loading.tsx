import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the printer form and receipt preview while outlet settings load. */
export default function PrinterSettingsLoading() {
  return <main aria-busy="true" className="mx-auto w-full max-w-6xl px-4 py-6 pb-24 sm:px-8 sm:py-8 lg:pb-8" id="main-content">
    <Skeleton aria-hidden="true" className="h-44 rounded-2xl" />
    <div aria-hidden="true" className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
      <Skeleton className="h-[38rem] rounded-2xl" />
      <Skeleton className="h-[42rem] rounded-2xl" />
    </div>
    <span className="sr-only">Memuat pengaturan printer struk.</span>
  </main>;
}
