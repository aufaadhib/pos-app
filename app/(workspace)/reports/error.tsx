"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Offers a scoped retry when a fresh report query fails without removing the shared workspace shell. */
export default function ReportsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto grid min-h-[65svh] max-w-3xl place-items-center px-5 py-10 text-center" id="main-content"><div className="rounded-2xl border border-dashed bg-card p-8"><h1 className="font-heading text-2xl font-semibold">Laporan belum dapat dimuat</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Periksa koneksi lalu muat ulang data laporan.</p><Button className="mt-5" onClick={reset} type="button"><RotateCcw aria-hidden="true" />Coba lagi</Button></div></main>;
}
