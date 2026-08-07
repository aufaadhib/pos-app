"use client";

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function CatalogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-xl flex-col items-center justify-center px-5 text-center" id="main-content">
      <AlertCircle aria-hidden="true" className="size-10 text-destructive" />
      <h1 className="mt-4 font-heading text-2xl font-semibold">Katalog belum dapat dimuat</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Koneksi atau data sedang bermasalah. Coba muat ulang tanpa mengirim ulang perubahan apa pun.</p>
      <Button className="mt-6" onClick={reset}>Coba lagi</Button>
    </main>
  );
}
