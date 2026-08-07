import { Skeleton } from "@/components/ui/skeleton";

/** Shows only transaction content placeholders while the navigation shell stays mounted. */
export default function TransactionsLoading() {
  return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8 lg:px-10" id="main-content"><Skeleton className="h-40 rounded-2xl" /><div className="mt-6 grid gap-3">{Array.from({ length: 5 }, (_, index) => <Skeleton className="h-20 rounded-xl" key={index} />)}</div></main>;
}
