import { Skeleton } from "@/components/ui/skeleton";

/** Shows a content-only POS placeholder while the persistent workspace shell remains visible. */
export default function PosLoading() {
  return <main className="mx-auto grid max-w-[100rem] gap-5 px-4 py-5 sm:px-8 sm:py-8 xl:grid-cols-[minmax(0,1fr)_23rem]" id="main-content"><div><Skeleton className="h-44 rounded-2xl" /><div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton className="h-32 rounded-xl" key={index} />)}</div></div><Skeleton className="hidden h-[36rem] rounded-2xl xl:block" /></main>;
}
