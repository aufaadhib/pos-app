import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors outlet guidance and selectable outlet rows while data loads. */
export default function SelectOutletLoading() {
  return <main aria-busy="true" aria-label="Memuat pilihan outlet" className="mx-auto grid max-w-5xl gap-8 px-5 py-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-16" id="main-content"><span className="sr-only" role="status">Memuat pilihan outlet…</span><section className="space-y-4"><Skeleton className="h-3 w-32" /><Skeleton className="h-10 w-64 max-w-full" /><Skeleton className="h-5 w-full max-w-md" /><Skeleton className="h-5 w-4/5 max-w-sm" /></section><section className="rounded-xl border bg-card p-6"><Skeleton className="h-6 w-40" /><Skeleton className="mt-3 h-4 w-64 max-w-full" /><div className="mt-6 space-y-3">{Array.from({ length: 4 }, (_, index) => <div className="flex min-h-16 items-center gap-3 rounded-xl border p-3" key={index}><Skeleton className="size-10 shrink-0 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-40 max-w-full" /><Skeleton className="h-3 w-24" /></div><Skeleton className="size-10" /></div>)}</div></section></main>;
}
