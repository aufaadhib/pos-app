import { Skeleton } from "@/components/ui/skeleton";

/** Reserves the settings form while the active outlet is validated. */
export default function SettingsLoading() {
  return <main aria-busy="true" className="mx-auto w-full max-w-4xl px-4 py-6 pb-24 sm:px-8" id="main-content"><Skeleton aria-hidden="true" className="h-36 rounded-2xl" /><Skeleton aria-hidden="true" className="mt-5 h-36 rounded-xl" /><span className="sr-only">Memuat pengaturan outlet.</span></main>;
}
